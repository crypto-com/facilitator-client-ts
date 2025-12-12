import {
  VerifyRequest,
  X402SupportedResponse,
  X402VerifyResponse,
  X402SettleResponse,
} from './facilitator.interface.js';

/**
 * @constant
 * @name headers
 * @description
 * Default HTTP headers used for all requests sent to the Cronos X402 Facilitator API.
 *
 * Includes:
 * - `Content-Type: application/json`
 * - `X402-Version: 1`
 *
 * @type {Record<string, string>}
 * @private
 */
const headers = {
  'Content-Type': 'application/json',
  'X402-Version': '1',
};

/**
 * @function getSupported
 * @description
 * Fetches a description of the **supported networks, token assets, and X402 capabilities**
 * exposed by the facilitator backend.
 *
 * This is typically called during SDK initialization or health-check flows.
 *
 * The function returns the parsed API response even on non-JSON payloads, and
 * throws a descriptive error including any error body returned by the server.
 *
 * ---
 * @async
 * @param {string} baseUrl - Base URL of the facilitator backend (e.g., `"https://facilitator.cronoslabs.org"`).
 *
 * @returns {Promise<X402SupportedResponse>}
 * Parsed response data describing the supported X402 configuration.
 *
 * @throws {Error}
 * If the request fails or if the server responds with a non-OK status.
 *
 * ---
 * @example <caption>Fetch supported networks</caption>
 * ```ts
 * const supported = await getSupported("https://facilitator.cronoslabs.org");
 * console.log(supported.kinds);
 * // → [{ x402Version: 1, scheme: "exact", network: "cronos-testnet" }, ...]
 * ```
 */
export async function getSupported(baseUrl: string): Promise<X402SupportedResponse> {
  const res = await fetch(`${baseUrl}/v2/x402/supported`);
  const text = await res.text();

  let json: any = {};
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = { raw: text };
  }

  if (!res.ok) {
    throw new Error(`getSupported failed: ${res.status} – ${JSON.stringify(json)}`);
  }

  return json;
}

/**
 * @function verifyPayment
 * @description
 * Calls the facilitator's **`/verify`** endpoint to validate an X402 payment request.
 *
 * Verification ensures:
 * - The Base64 payment header is valid and decodable
 * - The EIP-3009 signature is correct
 * - The payment requirements match the header contents
 * - Timestamps (`validAfter`, `validBefore`) are valid
 * - The nonce has not been used previously
 *
 * This step must be completed **before** attempting settlement.
 *
 * The function returns the backend's JSON response even when the server returns
 * non-200 errors, providing full debugging detail.
 *
 * ---
 * @async
 * @param {string} baseUrl - Base URL of the facilitator backend.
 * @param {VerifyRequest} body - Body containing `paymentHeader` and `paymentRequirements`.
 *
 * @returns {Promise<X402VerifyResponse>} The structured verification response.
 *
 * @throws {Error}
 * If the facilitator returns a non-OK HTTP status.
 * The error includes the exact payload returned by the server.
 *
 * ---
 * @example <caption>Verify a payment request</caption>
 * ```ts
 * const verify = await verifyPayment(BASE_URL, {
 *   x402Version: 1,
 *   paymentHeader,
 *   paymentRequirements
 * });
 *
 * console.log(verify.isValid);   // true | false
 * console.log(verify.invalidReason);
 * ```
 */
export async function verifyPayment(baseUrl: string, body: VerifyRequest): Promise<X402VerifyResponse> {
  const res = await fetch(`${baseUrl}/v2/x402/verify`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  const text = await res.text();

  let json: any = {};
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = { raw: text };
  }

  if (!res.ok) {
    throw new Error(`Verify failed: ${res.status} – ${JSON.stringify(json)}`);
  }

  return json;
}

/**
 * @function settlePayment
 * @description
 * Calls the facilitator **`/settle`** endpoint to execute a previously verified
 * EIP-3009 authorization on-chain.
 *
 * Settlement is the final step in the X402 flow and will:
 * - Submit the EIP-3009 authorization for on-chain execution
 * - Transfer the specified asset from the signer to the recipient
 * - Return a transaction hash and settlement metadata
 *
 * **Important:** A payment must be successfully verified via `/verify`
 * before it can be settled.
 *
 * ---
 * @async
 * @param {string} baseUrl - Base URL of the facilitator backend.
 * @param {VerifyRequest} body - The exact same body used for verification.
 *
 * @returns {Promise<X402SettleResponse>} Settlement response including tx hash.
 *
 * @throws {Error}
 * If settlement fails or if the facilitator returns a non-OK status code.
 *
 * ---
 * @example <caption>Settle a verified payment</caption>
 * ```ts
 * const settle = await settlePayment(BASE_URL, verifyRequest);
 * console.log(settle.txHash);
 * ```
 */
export async function settlePayment(baseUrl: string, body: VerifyRequest): Promise<X402SettleResponse> {
  const res = await fetch(`${baseUrl}/v2/x402/settle`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  const text = await res.text();

  let json: any = {};
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = { raw: text };
  }

  if (!res.ok) {
    throw new Error(`Settle failed: ${res.status} – ${JSON.stringify(json)}`);
  }

  return json;
}
