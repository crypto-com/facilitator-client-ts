/**
 * Optional client configuration.
 *
 * NOTE: The Cronos Facilitator SDK does **not** allow overriding `baseUrl`
 * in production, but we retain this interface for compatibility.
 */
export interface ClientConfig {
  /** Optional base URL (ignored by the Cronos SDK). */
  baseUrl?: string;
}

/**
 * X402 payment scheme type.
 *
 * Currently, the facilitator supports only `exact` payments, meaning the
 * payment must match the required amount exactly rather than range-based.
 */
export enum Scheme {
  Exact = "exact",
}

/**
 * Supported Cronos EVM networks for X402 flows.
 *
 * These map directly to `NETWORK_REGISTRY` entries.
 */
export enum CronosNetwork {
  /** Cronos EVM Mainnet */
  CronosMainnet = "cronos-mainnet",

  /** Cronos EVM Testnet (chainId: 338) */
  CronosTestnet = "cronos-testnet",
}

/**
 * X402 `PaymentRequirements` define what a payer must provide
 * in order to access a protected resource, settle a transaction,
 * or unlock a service.
 *
 * This object is paired with a Base64-encoded X402 payment header
 * (generated via EIP-3009) and submitted to `/verify` and `/settle`.
 */
export interface PaymentRequirements {
  /** Only `exact` payments are currently supported. */
  scheme: Scheme.Exact;

  /** Target Cronos network this payment will occur on. */
  network: CronosNetwork;

  /** Final recipient (on-chain ERC-20 receiver). */
  payTo: string;

  /** ERC-20 token contract address (e.g., USDCe). */
  asset: Contract;

  /** Human-readable explanation of the payment purpose. */
  description: string;

  /** MIME type of the resource being paid for. */
  mimeType: string;

  /**
   * Maximum allowed amount for the payment.
   *
   * Can be token units or base units depending on integrator conventions.
   */
  maxAmountRequired: string;

  /** Maximum allowed time window (seconds) before the payment expires. */
  maxTimeoutSeconds: number;

  /** Optional resource identifier (e.g. `/api/secret-data`). */
  resource?: string;

  /** Extra metadata for custom application flows. */
  extra?: Record<string, unknown>;

  /** Optional schema describing structured output returned after settlement. */
  outputSchema?: X402OutputSchema;
}

/**
 * Request body sent to the Facilitator `/verify` and `/settle` endpoints.
 *
 * Combines a Base64-encoded payment header with a matching set of
 * payment requirements.
 */
export interface VerifyRequest {
  /** X402 protocol version (always `1`). */
  x402Version: number;

  /** Base64-encoded payment header (EIP-3009 authorization wrapper). */
  paymentHeader: string;

  /** Conditions the payer must satisfy to complete settlement. */
  paymentRequirements: PaymentRequirements;
}

/**
 * Low-level EIP-3009 payload.
 *
 * Represents the raw message signed by the payer using
 * `TransferWithAuthorization` typed data.
 *
 * All numeric values are stored as strings for JSON compatibility.
 */
export interface Eip3009Payload {
  /** Address authorizing the transfer (`signer`). */
  from: string;

  /** Recipient address. */
  to: string;

  /** Amount in base units (stringified BigInt). */
  value: string;

  /** Timestamp (seconds) after which the authorization becomes valid. */
  validAfter: number;

  /** Timestamp (seconds) before which the authorization must be used. */
  validBefore: number;

  /** Unique 32-byte nonce to prevent replay attacks. */
  nonce: string;

  /** EIP-712 signature for the authorization message. */
  signature: string;

  /** ERC-20 token contract address. */
  asset: Contract;
}

/**
 * Full X402 payment header structure wrapping the EIP-3009 payload.
 *
 * This object is Base64-encoded and submitted as `paymentHeader`.
 */
export interface Eip3009PaymentHeader {
  /** X402 protocol version (always `1`). */
  x402Version: number;

  /** Payment scheme (always `"exact"`). */
  scheme: Scheme.Exact;

  /** Network on which the payment will be executed. */
  network: CronosNetwork;

  /** Raw EIP-3009 payload. */
  payload: Eip3009Payload;
}

/**
 * A single supported X402 "kind" (capability), describing
 * scheme + network combinations supported by the facilitator.
 */
export interface X402Kind {
  /** X402 protocol version. */
  x402Version: number;

  /** Payment scheme ("exact"). */
  scheme: string;

  /** Network identifier string. */
  network: string;
}

/**
 * Schema describing the structure of inputs and outputs for
 * applications that want strongly typed workflows.
 *
 * The facilitator does not enforce this schema—it's passed through
 * for client applications to interpret.
 */
export interface X402OutputSchema {
  input: {
    /** Type of request (always `"http"`). */
    type: "http";

    /** Allowed HTTP methods. */
    method: "GET" | "POST";

    /** Optional body content type. */
    bodyType?: "json" | "form-data" | "multipart-form-data" | "text" | "binary";

    /** Optional query parameter schema. */
    queryParams?: Record<string, FieldDef>;

    /** Optional request body schema. */
    bodyFields?: Record<string, FieldDef>;

    /** Optional header schema. */
    headerFields?: Record<string, FieldDef>;
  };

  /** Optional structured output definition. */
  output?: Record<string, unknown>;
}

/**
 * A flexible field descriptor used in X402 schema definitions.
 */
export interface FieldDef {
  /** Primitive type (e.g., `"string"`, `"number"`). */
  type?: string;

  /** Whether the field is required, or list of required subfields. */
  required?: boolean | string[];

  /** Developer description of the field. */
  description?: string;

  /** Optional enum constraint. */
  enum?: string[];

  /** Optional nested properties. */
  properties?: Record<string, FieldDef>;
}

/**
 * Alias for payment requirements within discovery responses.
 */
export interface X402PaymentRequirements extends PaymentRequirements {}

/**
 * Response format from `/discover` endpoint.
 *
 * Provides:
 * - Supported X402 kinds
 * - Optional payer metadata
 * - Optional accepted payment requirements
 */
export interface X402DiscoverResponse {
  /** X402 protocol version. */
  x402Version: number;

  /** Supported network/scheme combinations. */
  kinds: X402Kind[];

  /** Optional default payer address. */
  payer?: string;

  /** List of accepted payment requirements (if any). */
  accepts?: X402PaymentRequirements[];

  /** Requirements tied to the requested resource. */
  paymentRequirements?: X402PaymentRequirements[];

  /** Optional error description. */
  error?: string;
}

/**
 * Response from `/supported`.
 *
 * Lists all X402 "kinds" supported by the active facilitator instance.
 */
export interface X402SupportedResponse {
  kinds: X402Kind[];
}

/**
 * Event types emitted during settlement.
 */
export enum X402EventType {
  /** Payment successfully settled on-chain. */
  PaymentSettled = "payment.settled",

  /** Payment verification or execution failed. */
  PaymentFailed = "payment.failed",
}

/**
 * Structured verification result for typed SDK usage.
 */
export interface X402VerifyResponse {
  /** Whether the payment header and requirements are valid. */
  isValid: boolean;

  /** Null if valid, otherwise human-readable error description. */
  invalidReason: string | null;
}

/**
 * Structured settlement response aligned with facilitator backend.
 *
 * Contains:
 * - transaction hash (if successful)
 * - event type
 * - metadata describing the payment
 */
export interface X402SettleResponse {
  /** X402 version (always 1). */
  x402Version: number;

  /** Settlement event type. */
  event: X402EventType;

  /** Transaction hash (present only if settlement succeeded). */
  txHash?: string;

  /** Sender address. */
  from?: string;

  /** Recipient address. */
  to?: string;

  /** Token value transferred (base units). */
  value?: string;

  /** Block number where settlement occurred. */
  blockNumber?: number;

  /** Chain/network identifier. */
  network: string;

  /** ISO timestamp of settlement event. */
  timestamp: string;

  /** Optional error message for failed events. */
  error?: string;
}

/**
 * Supported ERC-20 contract addresses accepted by the Cronos X402 facilitator.
 *
 * These contracts implement the **EIP-3009 TransferWithAuthorization**
 * interface and are validated by the facilitator during verification
 * and settlement.
 *
 * The SDK restricts payments to this enum to prevent unsupported
 * or unsafe token usage.
 */
export enum Contract {
  /**
   * USDCe contract address on Cronos mainnet.
   *
   * Implements EIP-3009 and is accepted by the production facilitator.
   */
  USDCe = "0xf951eC28187D9E5Ca673Da8FE6757E6f0Be5F77C",

  /**
   * USDCe contract address on Cronos testnet.
   *
   * Intended for development and testing environments only.
   */
  DevUSDCe = "0xc01efAaF7C5C61bEbFAeb358E1161b537b8bC0e0",
}
