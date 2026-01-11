import crypto from 'node:crypto';
import { ethers } from 'ethers';

import {
  Eip3009Payload,
  CronosNetwork,
  Eip3009PaymentHeader,
  Scheme,
  Contract,
} from '../../integrations/facilitator.interface.js';
import { EIP712_DOMAIN_BY_NETWORK, NETWORK_REGISTRY } from '../../integrations/facilitator.registry.js';

/**
 * @function randomNonceHex32
 * @description
 * Generates a cryptographically secure **32-byte nonce** in `0x`-prefixed hex format,
 * suitable for use as the `nonce` field in an EIP-3009 `TransferWithAuthorization`
 * payload.
 *
 * This function:
 * - Uses `globalThis.crypto.getRandomValues` in browser-like environments
 * - Falls back to Node.js `crypto.randomBytes` on the server
 *
 * @returns {string} A `0x`-prefixed, 64-hex-character nonce string.
 *
 * @example
 * ```ts
 * const nonce = randomNonceHex32();
 * console.log(nonce); // 0xabc123...
 * ```
 */
export const randomNonceHex32 = (): string => {
  if (typeof globalThis !== 'undefined' && typeof globalThis.crypto?.getRandomValues === 'function') {
    const array = new Uint8Array(32);
    globalThis.crypto.getRandomValues(array);
    return (
      '0x' +
      Array.from(array)
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('')
    );
  }
  return '0x' + crypto.randomBytes(32).toString('hex');
};

/**
 * @function buildEip3009Header
 * @description
 * Wraps a low-level {@link Eip3009Payload} into a structured
 * **X402-compatible payment header** for a given Cronos network.
 *
 * The resulting {@link Eip3009PaymentHeader} can be serialized and
 * base64-encoded for use as the `paymentHeader` field in X402 `/verify`
 * and `/settle` requests.
 *
 * @param {Eip3009Payload} payload - The signed EIP-3009 payload.
 * @param {CronosNetwork} network - Target Cronos network identifier.
 *
 * @returns {Eip3009PaymentHeader} A complete X402 payment header object.
 *
 * @example
 * ```ts
 * const header = buildEip3009Header(payload, CronosNetwork.CronosTestnet);
 * console.log(header.x402Version); // 1
 * ```
 */
export const buildEip3009Header = (payload: Eip3009Payload, network: CronosNetwork): Eip3009PaymentHeader => ({
  x402Version: 1,
  scheme: Scheme.Exact,
  network,
  payload,
});

/**
 * @function encodePaymentHeader
 * @description
 * Serializes an {@link Eip3009PaymentHeader} to JSON and encodes it as a
 * **Base64 string**, suitable for use as the `paymentHeader` field in
 * X402 requests.
 *
 * In browser-like environments, this function prefers `btoa`. In Node.js,
 * it falls back to `Buffer.from(...).toString('base64')`.
 *
 * @param {Eip3009PaymentHeader} header - Header object to encode.
 *
 * @returns {string} A Base64-encoded JSON representation of the header.
 *
 * @example
 * ```ts
 * const base64Header = encodePaymentHeader(header);
 * console.log(base64Header); // eyJ4NDAyVmVyc2lvbiI6MS4uLg==
 * ```
 */
export const encodePaymentHeader = (header: Eip3009PaymentHeader): string => {
  const json = JSON.stringify(header);

  if (typeof globalThis !== 'undefined' && typeof globalThis.btoa === 'function') {
    return globalThis.btoa(json);
  }
  return Buffer.from(json, 'utf8').toString('base64');
};

/**
 * @function decodePaymentHeader
 * @description
 * Decodes a Base64-encoded JSON string containing an {@link Eip3009PaymentHeader}
 * back into its UTF-8 JSON representation.
 *
 * This helper is convenient for debugging and testing:
 * it does **not** parse the JSON, it only returns the decoded string.
 *
 * In browser-like environments, it prefers `atob`. In Node.js, it falls back
 * to `Buffer.from(..., 'base64').toString('utf-8')`.
 *
 * @param {string} base64String - Base64-encoded header JSON.
 *
 * @returns {string} Decoded JSON string.
 *
 * @example
 * ```ts
 * const json = decodePaymentHeader(base64);
 * const header = JSON.parse(json);
 * console.log(header.network); // "cronos-testnet"
 * ```
 */
export const decodePaymentHeader = (base64String: string): string => {
  if (typeof globalThis !== 'undefined' && typeof globalThis.atob === 'function') {
    return globalThis.atob(base64String);
  }
  return Buffer.from(base64String, 'base64').toString('utf-8');
};

/**
 * @function generateCronosPaymentHeader
 * @description
 * Generates a **Base64-encoded X402 payment header** for Cronos EVM networks
 * using the EIP-3009 `TransferWithAuthorization` typed-data structure.
 *
 * Internally, this function:
 *
 * 1. Resolves the appropriate network configuration from {@link NETWORK_REGISTRY}.
 * 2. Ensures a usable `ethers` provider is available for the signer.
 * 3. Derives the `from` address and current `chainId`.
 * 4. Computes `validAfter`, `validBefore`, and a secure 32-byte `nonce`.
 * 5. Builds an EIP-712 domain and `TransferWithAuthorization` type definition.
 * 6. Uses the signer to produce an EIP-712 signature.
 * 7. Wraps all fields into an {@link Eip3009Payload}.
 * 8. Wraps the payload into an {@link Eip3009PaymentHeader} and Base64-encodes it.
 *
 * ---
 *
 * ### Value units
 * The `value` parameter must be in **base units**, meaning:
 * - For a 6-decimal token (e.g. USDCe), `1` token = `"1000000"`.
 *
 * ---
 *
 * @param {Object} params - Header generation options.
 * @param {ethers.Wallet | ethers.Signer} params.signer
 * Ethers signer or wallet used to sign the EIP-712 typed data.
 * @param {CronosNetwork} params.network
 * Cronos network identifier (e.g. `CronosNetwork.CronosMainnet`).
 * @param {string} params.to
 * Recipient (ERC-20) address.
 * @param {string} params.value
 * Transfer amount in base units (e.g. `"1000000"` for 1 token with 6 decimals).
 * @param {string} [params.asset]
 * ERC-20 token contract address. Defaults to the `asset` configured in {@link NETWORK_REGISTRY}
 * for the given network.
 * @param {number} [params.validAfter]
 * Optional UNIX timestamp (seconds) after which the authorization becomes valid.
 * Defaults to `0`.
 * @param {number} [params.validBefore]
 * Optional UNIX timestamp (seconds) before which the authorization must be used.
 * Defaults to `now + 3600` seconds (1 hour).
 *
 * @returns {Promise<string>} A Base64-encoded JSON string representing the X402 payment header.
 *
 * @throws {Error}
 * - If the network is unsupported.
 * - If a signer address cannot be resolved.
 * - If no token asset address can be determined.
 *
 * @example <caption>Generate a 1 USDCe header on Cronos testnet</caption>
 * ```ts
 * import { ethers } from 'ethers';
 * import { CronosNetwork } from '../../integrations/facilitator.interface.js';
 * import { generateCronosPaymentHeader } from '../utils/payment.header.js';
 *
 * const provider = new ethers.JsonRpcProvider('https://evm-t3.cronos.org');
 * const signer = new ethers.Wallet(PRIVATE_KEY, provider);
 *
 * const headerBase64 = await generateCronosPaymentHeader({
 *   signer,
 *   network: CronosNetwork.CronosTestnet,
 *   to: '0xReceiverAddress',
 *   value: '1000000', // 1 USDCe (6 decimals)
 * });
 *
 * console.log('Payment header:', headerBase64);
 * ```
 */
export async function generateCronosPaymentHeader(params: {
  signer: ethers.Wallet | ethers.Signer;
  network: CronosNetwork;
  to: string;
  value: string;
  asset?: Contract;
  validAfter?: number;
  validBefore?: number;
}): Promise<string> {
  const { signer, network, to, value, asset, validAfter, validBefore } = params;

  const config = NETWORK_REGISTRY[network];
  if (!config) throw new Error(`Unsupported network: ${network}`);

  const provider =
    'provider' in signer && signer.provider ? signer.provider : new ethers.JsonRpcProvider(config.rpc_url);

  const chain = await provider.getNetwork();
  const chainId = Number(chain.chainId);

  const from = await (signer as ethers.Wallet).getAddress?.();
  if (!from) throw new Error('Unable to resolve signer address');

  const now = Math.floor(Date.now() / 1000);
  const computedValidAfter = validAfter ?? 0;
  const computedValidBefore = validBefore ?? now + 3600;

  const nonce = randomNonceHex32();
  const tokenAddress = asset ?? config.asset;
  if (!tokenAddress) {
    throw new Error('Token asset address is required (no default configured)');
  }

  const { name, version } = EIP712_DOMAIN_BY_NETWORK[network];

  const domain = {
    name,
    version,
    chainId: chainId,
    verifyingContract: tokenAddress,
  };

  const types: Record<string, ethers.TypedDataField[]> = {
    TransferWithAuthorization: [
      { name: 'from', type: 'address' },
      { name: 'to', type: 'address' },
      { name: 'value', type: 'uint256' },
      { name: 'validAfter', type: 'uint256' },
      { name: 'validBefore', type: 'uint256' },
      { name: 'nonce', type: 'bytes32' },
    ],
  };

  const valueBigInt = BigInt(value);

  const message = {
    from,
    to,
    value: valueBigInt,
    validAfter: computedValidAfter,
    validBefore: computedValidBefore,
    nonce,
  };

  const signature = await (signer as ethers.Wallet).signTypedData(domain, types, message);

  const payload: Eip3009Payload = {
    from,
    to,
    value: valueBigInt.toString(),
    validAfter: computedValidAfter,
    validBefore: computedValidBefore,
    nonce,
    signature,
    asset: tokenAddress,
  };

  const header = buildEip3009Header(payload, network);
  return encodePaymentHeader(header);
}
