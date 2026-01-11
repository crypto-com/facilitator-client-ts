import type {
  X402SupportedResponse,
  X402VerifyResponse,
  X402SettleResponse,
  X402Kind,
  X402EventType,
} from './facilitator.interface.js';

/**
 * @function isRecord
 * @description
 * Runtime guard for plain object records.
 *
 * Ensures the value is:
 * - an object
 * - not null
 * - not an array
 */
function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/**
 * @function isString
 * @description Runtime guard for strings.
 */
function isString(v: unknown): v is string {
  return typeof v === 'string';
}

/**
 * @function isNumber
 * @description Runtime guard for finite numbers.
 */
function isNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

/**
 * @function isBoolean
 * @description Runtime guard for booleans.
 */
function isBoolean(v: unknown): v is boolean {
  return typeof v === 'boolean';
}

/**
 * @function isNull
 * @description Runtime guard for null values.
 */
function isNull(v: unknown): v is null {
  return v === null;
}

/**
 * @function isOptional
 * @description
 * Runtime guard for optional values.
 *
 * Accepts either:
 * - `undefined`
 * - or a value matching the provided guard
 *
 * @template T
 * @param {unknown} v - Value to validate.
 * @param {(x: unknown) => x is T} guard - Type guard for the value.
 * @returns {boolean} True if value is valid or undefined.
 */
function isOptional<T>(v: unknown, guard: (x: unknown) => x is T): v is T | undefined {
  return v === undefined || guard(v);
}

/**
 * @function isX402Kind
 * @description
 * Runtime validator for X402 payment kind descriptors.
 *
 * Used to validate `/x402/supported` responses.
 */
function isX402Kind(v: unknown): v is X402Kind {
  if (!isRecord(v)) return false;
  return isNumber(v.x402Version) && isString(v.scheme) && isString(v.network);
}

/**
 * @function assertX402SupportedResponse
 * @description
 * Asserts that a value conforms to the **X402SupportedResponse** schema.
 *
 * Used when validating facilitator `/x402/supported` responses.
 *
 * ---
 * @param {unknown} v - API response payload.
 * @throws {Error} If the response shape is invalid.
 *
 * ---
 * @example
 * ```ts
 * const res = await fetch("/x402/supported").then(r => r.json());
 * assertX402SupportedResponse(res);
 *
 * res.kinds.forEach(k => console.log(k.network));
 * ```
 */
export function assertX402SupportedResponse(v: unknown): asserts v is X402SupportedResponse {
  if (!isRecord(v)) throw new Error('X402SupportedResponse: not an object');
  if (!Array.isArray(v.kinds)) throw new Error('X402SupportedResponse.kinds: not an array');
  if (!v.kinds.every(isX402Kind)) throw new Error('X402SupportedResponse.kinds: invalid items');
}

/**
 * @function assertX402VerifyResponse
 * @description
 * Asserts that a value conforms to the **X402VerifyResponse** schema.
 *
 * Used when validating facilitator `/x402/verify` responses.
 *
 * ---
 * @param {unknown} v - API response payload.
 * @throws {Error} If the response shape is invalid.
 *
 * ---
 * @example
 * ```ts
 * const res = await fetch("/x402/verify").then(r => r.json());
 * assertX402VerifyResponse(res);
 *
 * if (!res.isValid) {
 *   console.error(res.invalidReason);
 * }
 * ```
 */
export function assertX402VerifyResponse(v: unknown): asserts v is X402VerifyResponse {
  if (!isRecord(v)) throw new Error('X402VerifyResponse: not an object');
  if (!isBoolean(v.isValid)) throw new Error('X402VerifyResponse.isValid: not boolean');

  const ir = v.invalidReason;
  if (!(isString(ir) || isNull(ir))) {
    throw new Error('X402VerifyResponse.invalidReason: not string|null');
  }
}

/**
 * @function isX402EventType
 * @description
 * Runtime validator for X402 settlement event types.
 *
 * Hard-checks against the known event string literals:
 * - `payment.settled`
 * - `payment.failed`
 */
function isX402EventType(v: unknown): v is X402EventType {
  return v === 'payment.settled' || v === 'payment.failed';
}

/**
 * @function assertX402SettleResponse
 * @description
 * Asserts that a value conforms to the **X402SettleResponse** schema.
 *
 * Used when validating facilitator `/x402/settle` webhook or API responses.
 *
 * ---
 * @param {unknown} v - API response payload.
 * @throws {Error} If the response shape is invalid.
 *
 * ---
 * @example
 * ```ts
 * const res = await fetch("/x402/settle").then(r => r.json());
 * assertX402SettleResponse(res);
 *
 * console.log(res.event); // "payment.settled"
 * ```
 */
export function assertX402SettleResponse(v: unknown): asserts v is X402SettleResponse {
  if (!isRecord(v)) throw new Error('X402SettleResponse: not an object');

  if (!isNumber(v.x402Version)) throw new Error('X402SettleResponse.x402Version: not number');
  if (!isX402EventType(v.event)) throw new Error('X402SettleResponse.event: invalid');
  if (!isString(v.network)) throw new Error('X402SettleResponse.network: not string');
  if (!isString(v.timestamp)) throw new Error('X402SettleResponse.timestamp: not string');

  if (!isOptional(v.txHash, isString)) throw new Error('X402SettleResponse.txHash: not string|undefined');
  if (!isOptional(v.from, isString)) throw new Error('X402SettleResponse.from: not string|undefined');
  if (!isOptional(v.to, isString)) throw new Error('X402SettleResponse.to: not string|undefined');
  if (!isOptional(v.value, isString)) throw new Error('X402SettleResponse.value: not string|undefined');
  if (!isOptional(v.blockNumber, isNumber)) {
    throw new Error('X402SettleResponse.blockNumber: not number|undefined');
  }
  if (!isOptional(v.error, isString)) throw new Error('X402SettleResponse.error: not string|undefined');
}
