import { ethers } from "ethers";
import {
  getSupported,
  settlePayment,
  verifyPayment,
} from "../../integrations/facilitator.api.js";
import {
  ClientConfig,
  CronosNetwork,
  X402SupportedResponse,
  X402VerifyResponse,
  X402SettleResponse,
  PaymentRequirements,
  VerifyRequest,
  X402OutputSchema,
  Contract,
} from "../../integrations/facilitator.interface.js";

import { generatePaymentRequirements } from "../utils/payment.requirements.js";
import { NETWORK_REGISTRY } from "../../integrations/facilitator.registry.js";
import { generateCronosPaymentHeader } from "../utils/payment.header.js";

/**
 * @constant
 * @name FACILITATOR_BASE_URL
 * @description
 * The **fixed base URL** of the Cronos X402 Facilitator backend.
 *
 * This SDK intentionally prevents consumers from overriding the base URL
 * to ensure all requests are routed through the official Facilitator service.
 *
 * @type {string}
 * @private
 */
const FACILITATOR_BASE_URL: string = "https://facilitator.cronoslabs.org";

/**
 * @class Facilitator
 * @classdesc
 * The **Cronos Facilitator SDK Client** provides a complete interface for interacting
 * with the Cronos X402 Facilitator service.
 *
 * This implementation is designed exclusively for **Cronos EVM chains**, using
 * **EIP-3009 TransferWithAuthorization** as the signing scheme for off-chain
 * payment headers.
 *
 * The Facilitator SDK automates:
 * - Fetching supported networks and capabilities from the facilitator
 * - Creating a signed EIP-3009 payment header
 * - Constructing a valid X402 payment requirements object
 * - Verifying a payment request via `/verify`
 * - Settling a validated payment via `/settle`
 *
 * The SDK supports:
 * - `cronos-mainnet`
 * - `cronos-testnet`
 *
 * ---
 *
 * @example <caption>Basic Usage (1 USDCe payment)</caption>
 * ```ts
 * import { Facilitator } from './sdk/facilitator.js';
 * import { CronosNetwork } from './integrations/facilitator.interface.js';
 * import { ethers } from 'ethers';
 *
 * const signer = new ethers.Wallet(PRIVATE_KEY, new ethers.JsonRpcProvider("https://evm-t3.cronos.org"));
 *
 * const facilitator = new Facilitator({
 *   network: CronosNetwork.CronosTestnet,
 * });
 *
 * // 1) Create header for a 1 USDCe payment
 * const header = await facilitator.generatePaymentHeader({
 *   to: RECEIVER,
 *   value: "1000000",
 *   signer,
 * });
 *
 * // 2) Build requirements
 * const reqs = facilitator.generatePaymentRequirements({
 *   payTo: RECEIVER,
 *   description: "Premium API access",
 *   maxAmountRequired: "1000",
 * });
 *
 * // 3) Verify
 * const body = facilitator.buildVerifyRequest(header, reqs);
 * const verify = await facilitator.verifyPayment(body);
 *
 * if (verify.isValid) {
 *   const settle = await facilitator.settlePayment(body);
 *   console.log("Settled:", settle);
 * }
 * ```
 */
export class Facilitator {
  /**
   * @private
   * @readonly
   * @type {string}
   * Fixed facilitator API base URL.
   */
  private readonly baseUrl: string = FACILITATOR_BASE_URL;

  /**
   * @private
   * @type {CronosNetwork}
   * The Cronos network this client instance operates on.
   */
  private network: CronosNetwork;

  /**
   * @private
   * @type {string}
   * Default ERC-20 token used for payments (usually USDCe).
   */
  private defaultAsset: Contract;

  /**
   * @private
   * @type {string | undefined}
   * RPC endpoint for chain metadata and chainId resolution.
   */
  private rpcUrl?: string;

  /**
   * Creates a new Facilitator SDK instance.
   *
   * @param {ClientConfig & { network: CronosNetwork }} config
   * Configuration object including the chosen Cronos network.
   *
   * @throws {Error} If the specified network is not included in {@link NETWORK_REGISTRY}.
   *
   * @example
   * ```ts
   * const facilitator = new Facilitator({ network: CronosNetwork.CronosTestnet });
   * ```
   */
  constructor(config: ClientConfig & { network: CronosNetwork }) {
    this.network = config.network;

    const registryConfig = NETWORK_REGISTRY[this.network];
    if (!registryConfig) {
      throw new Error(`Unsupported network: ${this.network}`);
    }

    this.defaultAsset = registryConfig.asset;
    this.rpcUrl = registryConfig.rpc_url;
  }

  /**
   * Fetches facilitator-supported networks, schemes, and configuration metadata.
   *
   * @async
   * @returns {Promise<X402SupportedResponse>} Supported X402 capabilities.
   *
   * @example
   * ```ts
   * const supported = await facilitator.getSupported();
   * console.log(supported.kinds);
   * ```
   */
  async getSupported(): Promise<X402SupportedResponse> {
    return await getSupported(this.baseUrl);
  }

  /**
   * Submits an X402 verification request.
   *
   * This checks whether:
   * - the payment header is valid,
   * - the signature matches,
   * - timestamps, nonce, and asset requirements are honored.
   *
   * @async
   * @param {VerifyRequest} request - Combined `paymentHeader` and `paymentRequirements`.
   * @returns {Promise<X402VerifyResponse>} Verification result.
   *
   * @example
   * ```ts
   * const verify = await facilitator.verifyPayment(body);
   * console.log(verify.isValid);
   * ```
   */
  async verifyPayment(request: VerifyRequest): Promise<X402VerifyResponse> {
    return await verifyPayment(this.baseUrl, request);
  }

  /**
   * Settles a previously verified payment.
   *
   * Must only be called **after** `/verify` succeeds.
   *
   * @async
   * @param {VerifyRequest} request - Same body used for verification.
   * @returns {Promise<X402SettleResponse>} Settlement result including tx hash.
   *
   * @example
   * ```ts
   * const settle = await facilitator.settlePayment(body);
   * console.log(settle.txHash);
   * ```
   */
  async settlePayment(request: VerifyRequest): Promise<X402SettleResponse> {
    return await settlePayment(this.baseUrl, request);
  }

  /**
   * Generates a **Base64-encoded EIP-3009 payment header** for Cronos.
   *
   * This uses the EIP-712 `TransferWithAuthorization` typed-data structure,
   * producing an off-chain authorization that the facilitator can relay on-chain.
   *
   * ---
   * ### Requirements
   * - `value` must be in **base units** (e.g., 1 USDCe = `"1000000"`).
   * - A valid signer (`ethers.Wallet` or connected `Signer`) must be provided.
   *
   * @async
   * @param {Object} options - Header generation options.
   * @param {string} options.to - Recipient address.
   * @param {string} options.value - Amount to transfer (base units).
   * @param {string} [options.asset] - ERC-20 token contract (defaults to network asset).
   * @param {ethers.Wallet | ethers.Signer} options.signer - Signer used to sign typed data.
   * @param {number} [options.validAfter] - Optional validity start timestamp.
   * @param {number} [options.validBefore] - Optional expiry timestamp.
   *
   * @returns {Promise<string>} Base64-encoded payment header.
   *
   * @example
   * ```ts
   * const header = await facilitator.generatePaymentHeader({
   *   to: RECEIVER,
   *   value: "1000000",
   *   signer,
   * });
   * ```
   */
  async generatePaymentHeader(options: {
    to: string;
    value: string;
    asset?: Contract;
    signer: ethers.Wallet | ethers.Signer;
    validAfter?: number;
    validBefore?: number;
  }): Promise<string> {
    return await generateCronosPaymentHeader({
      network: this.network,
      to: options.to,
      value: options.value,
      asset: options.asset ?? this.defaultAsset,
      signer: options.signer,
      validAfter: options.validAfter,
      validBefore: options.validBefore,
    });
  }

  /**
   * Builds a structured X402 `PaymentRequirements` object.
   *
   * This defines *what must be paid*, and is paired with the signed payment header
   * when calling `/verify` and `/settle`.
   *
   * @param {Object} options - Requirement options.
   * @param {string} options.payTo - Recipient address.
   * @param {string} [options.asset] - ERC-20 token (defaults to network asset).
   * @param {string} [options.description] - Human-friendly purpose description.
   * @param {string} [options.maxAmountRequired] - Max allowed amount (string).
   * @param {string} [options.mimeType] - MIME type of protected resource.
   * @param {number} [options.maxTimeoutSeconds] - Validity window.
   * @param {string} [options.resource] - Resource identifier.
   * @param {Record<string, unknown>} [options.extra] - Additional metadata.
   * @param {X402OutputSchema} [options.outputSchema] - Expected response schema.
   *
   * @returns {PaymentRequirements} Structured requirement payload.
   *
   * @example
   * ```ts
   * const reqs = facilitator.generatePaymentRequirements({
   *   payTo: RECEIVER,
   *   description: "Access premium content",
   *   maxAmountRequired: "1000",
   * });
   * ```
   */
  generatePaymentRequirements(options: {
    payTo: string;
    asset?: Contract;
    description?: string;
    maxAmountRequired?: string;
    mimeType?: string;
    maxTimeoutSeconds?: number;
    resource?: string;
    extra?: Record<string, unknown>;
    outputSchema?: X402OutputSchema;
  }): PaymentRequirements {
    return generatePaymentRequirements({
      network: this.network,
      payTo: options.payTo,
      asset: options.asset ?? this.defaultAsset,
      description: options.description,
      maxAmountRequired: options.maxAmountRequired,
      mimeType: options.mimeType,
      maxTimeoutSeconds: options.maxTimeoutSeconds,
      resource: options.resource,
      extra: options.extra,
      outputSchema: options.outputSchema,
    });
  }

  /**
   * Creates a complete **X402 verification body**, ready to submit to
   * `/verify` or `/settle`.
   *
   * @param {string} paymentHeader - The Base64 EIP-3009 payment header.
   * @param {PaymentRequirements} paymentRequirements - Requirements defining the payment.
   *
   * @returns {VerifyRequest} Full request body.
   *
   * @example
   * ```ts
   * const body = facilitator.buildVerifyRequest(header, reqs);
   * const response = await facilitator.verifyPayment(body);
   * ```
   */
  buildVerifyRequest(
    paymentHeader: string,
    paymentRequirements: PaymentRequirements
  ): VerifyRequest {
    return {
      x402Version: 1,
      paymentHeader,
      paymentRequirements,
    };
  }
}
