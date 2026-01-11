import {
  Contract,
  CronosNetwork,
  PaymentRequirements,
  Scheme,
  X402OutputSchema,
} from '../../integrations/facilitator.interface.js';
import { NETWORK_REGISTRY } from '../../integrations/facilitator.registry.js';

/**
 * @function generatePaymentRequirements
 * @description
 * Generates a fully structured **X402 `PaymentRequirements` object** for Cronos EVM networks.
 *
 * This object describes:
 * - what payment must be performed,
 * - the token to use,
 * - max amount allowed,
 * - validity window,
 * - any extra metadata,
 * - and optionally a response `outputSchema`.
 *
 * `PaymentRequirements` is paired with a Base64-encoded payment header and submitted
 * to the facilitator's `/verify` and `/settle` endpoints.
 *
 * ---
 * ### Defaults
 * Unless overridden:
 * - `description` → `"X402 payment request"`
 * - `maxAmountRequired` → `"1000"`
 * - `mimeType` → `"application/json"`
 * - `maxTimeoutSeconds` → `300`
 * - `asset` defaults to the configured token for the selected Cronos network
 *
 * ---
 * @param {Object} options - Requirement configuration.
 * @param {CronosNetwork} options.network - Target Cronos network (`cronos-testnet` or `cronos-mainnet`).
 * @param {string} options.payTo - Recipient wallet address.
 * @param {string} [options.asset] - ERC-20 token contract used for payment. Defaults to `NETWORK_REGISTRY[network].asset`.
 * @param {string} [options.description] - Human-readable explanation of what the payment is for.
 * @param {string} [options.maxAmountRequired] - Maximum allowed payment amount (as a string).
 * @param {string} [options.mimeType] - MIME type of the protected resource.
 * @param {number} [options.maxTimeoutSeconds] - Validity window in seconds.
 * @param {string} [options.resource] - Optional resource identifier or API endpoint.
 * @param {Record<string, unknown>} [options.extra] - Optional metadata payload.
 * @param {X402OutputSchema} [options.outputSchema] - Schema describing expected output after settlement.
 *
 * @returns {PaymentRequirements} A complete requirement object suitable for `/verify` and `/settle`.
 *
 * @throws {Error} If the provided network is not registered in {@link NETWORK_REGISTRY}.
 *
 * ---
 * @example <caption>Basic Example</caption>
 * ```ts
 * const reqs = generatePaymentRequirements({
 *   network: CronosNetwork.CronosTestnet,
 *   payTo: "0xReceiverAddress",
 *   description: "Premium API access",
 *   maxAmountRequired: "1000",
 * });
 *
 * console.log(reqs.scheme); // "exact"
 * ```
 *
 * @example <caption>With Output Schema</caption>
 * ```ts
 * const reqs = generatePaymentRequirements({
 *   network: CronosNetwork.CronosMainnet,
 *   payTo: "0xReceiver",
 *   asset: USDCe,
 *   description: "Download encrypted dataset",
 *   mimeType: "application/octet-stream",
 *   outputSchema: {
 *     input: { type: "http", method: "GET" },
 *     output: { encryptedBlob: "base64" }
 *   }
 * });
 * ```
 */
export const generatePaymentRequirements = (options: {
  network: CronosNetwork;
  payTo: string;
  asset?: Contract;
  description?: string;
  maxAmountRequired?: string;
  mimeType?: string;
  maxTimeoutSeconds?: number;
  resource?: string;
  extra?: Record<string, unknown>;
  outputSchema?: X402OutputSchema;
}): PaymentRequirements => {
  const {
    network,
    payTo,
    asset,
    description = 'X402 payment request',
    maxAmountRequired = '1000',
    mimeType = 'application/json',
    maxTimeoutSeconds = 300,
    resource,
    extra,
    outputSchema,
  } = options;

  const config = NETWORK_REGISTRY[network];
  if (!config) throw new Error(`Unsupported network: ${network}`);

  return {
    scheme: Scheme.Exact,
    network,
    payTo,
    asset: asset ?? config.asset,
    description,
    mimeType,
    maxAmountRequired,
    maxTimeoutSeconds,
    resource,
    extra,
    outputSchema,
  };
};
