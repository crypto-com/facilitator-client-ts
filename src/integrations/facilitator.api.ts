import type {
  VerifyRequest,
  X402SupportedResponse,
  X402VerifyResponse,
  X402SettleResponse,
} from './facilitator.interface.js';

import {
  assertX402SupportedResponse,
  assertX402VerifyResponse,
  assertX402SettleResponse,
} from './facilitator.guards.js';

/**
 * Default HTTP headers used for all X402 facilitator requests.
 */
const headers: Record<string, string> = {
  'Content-Type': 'application/json',
  'X402-Version': '1',
};

type JsonOrRaw = unknown;

/**
 * @function readJsonOrRaw
 * @description
 * Reads an HTTP response body and attempts to parse it as JSON.
 *
 * If parsing fails, returns the raw text payload instead.
 *
 * This is useful for surfacing non-JSON error responses from the facilitator.
 *
 * @param {Response} res - Fetch response object.
 * @returns {Promise<unknown>} Parsed JSON or `{ raw: string }`.
 */
async function readJsonOrRaw(res: Response): Promise<JsonOrRaw> {
  const text = await res.text();
  if (!text) return null;

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return { raw: text };
  }
}

/**
 * @function stringifySafe
 * @description
 * Safely stringifies any value for error reporting.
 *
 * Prevents crashes from circular references or invalid JSON values.
 *
 * @param {unknown} v - Value to stringify.
 * @returns {string} Safe string representation.
 */
function stringifySafe(v: unknown): string {
  try {
    return JSON.stringify(v);
  } catch {
    return '"[unstringifiable]"';
  }
}

/**
 * @function getSupported
 * @description
 * Fetches the list of **supported X402 payment kinds** from a facilitator.
 *
 * Calls the `/v2/x402/supported` endpoint and validates the response schema.
 *
 * ---
 * @param {string} baseUrl - Facilitator base URL.
 * @returns {Promise<X402SupportedResponse>} Supported payment kinds.
 *
 * @throws {Error} If the request fails or the response schema is invalid.
 *
 * ---
 * @example
 * ```ts
 * const supported = await getSupported("https://facilitator.example.com");
 *
 * supported.kinds.forEach(k => {
 *   console.log(`${k.network}: ${k.scheme}`);
 * });
 * ```
 */
export async function getSupported(baseUrl: string): Promise<X402SupportedResponse> {
  const res = await fetch(`${baseUrl}/v2/x402/supported`);
  const payload = await readJsonOrRaw(res);

  if (!res.ok) {
    throw new Error(`getSupported failed: ${res.status} – ${stringifySafe(payload)}`);
  }

  assertX402SupportedResponse(payload);
  return payload;
}

/**
 * @function verifyPayment
 * @description
 * Submits a payment for **X402 verification**.
 *
 * Calls the facilitator `/v2/x402/verify` endpoint to validate:
 * - payment header
 * - requirements
 * - signature
 * - expiry window
 *
 * ---
 * @param {string} baseUrl - Facilitator base URL.
 * @param {VerifyRequest} body - Verification request payload.
 * @returns {Promise<X402VerifyResponse>} Verification result.
 *
 * @throws {Error} If the request fails or the response schema is invalid.
 *
 * ---
 * @example
 * ```ts
 * const result = await verifyPayment(baseUrl, {
 *   paymentHeader,
 *   paymentRequirements,
 * });
 *
 * if (!result.isValid) {
 *   throw new Error(result.invalidReason);
 * }
 * ```
 */
export async function verifyPayment(baseUrl: string, body: VerifyRequest): Promise<X402VerifyResponse> {
  const res = await fetch(`${baseUrl}/v2/x402/verify`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  const payload = await readJsonOrRaw(res);

  if (!res.ok) {
    throw new Error(`Verify failed: ${res.status} – ${stringifySafe(payload)}`);
  }

  assertX402VerifyResponse(payload);
  return payload;
}

/**
 * @function settlePayment
 * @description
 * Submits a verified payment for **on-chain settlement**.
 *
 * Calls the facilitator `/v2/x402/settle` endpoint which:
 * - broadcasts the signed transaction
 * - waits for confirmation
 * - returns settlement metadata
 *
 * ---
 * @param {string} baseUrl - Facilitator base URL.
 * @param {VerifyRequest} body - Settlement request payload.
 * @returns {Promise<X402SettleResponse>} Settlement result.
 *
 * @throws {Error} If the request fails or the response schema is invalid.
 *
 * ---
 * @example
 * ```ts
 * const result = await settlePayment(baseUrl, {
 *   paymentHeader,
 *   paymentRequirements,
 * });
 *
 * console.log(result.txHash);
 * ```
 */
export async function settlePayment(baseUrl: string, body: VerifyRequest): Promise<X402SettleResponse> {
  const res = await fetch(`${baseUrl}/v2/x402/settle`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  const payload = await readJsonOrRaw(res);

  if (!res.ok) {
    throw new Error(`Settle failed: ${res.status} – ${stringifySafe(payload)}`);
  }

  assertX402SettleResponse(payload);
  return payload;
}
