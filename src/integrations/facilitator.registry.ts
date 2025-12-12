import { generateCronosPaymentHeader } from "../lib/utils/payment.header.js";
import { Contract, CronosNetwork } from "./facilitator.interface.js";

/**
 * @module NETWORK_REGISTRY
 *
 * @description
 * Centralized registry that maps each supported **Cronos network** to its:
 *
 * - **default ERC-20 asset address** (typically USDCe or equivalent)
 * - **header generator** used to build X402-compliant payment headers
 * - **RPC endpoint** used for signing and chain metadata resolution
 *
 * The Facilitator SDK uses this registry to:
 * - auto-select the correct token contract for each network
 * - resolve the correct EIP-712 domain values (chainId, verifying contract)
 * - provide the correct RPC URL when constructing signers
 * - select the correct header-generation function
 *
 * This registry is intentionally **frozen** (`as const`) to ensure:
 * - SDK consumers cannot mutate network config at runtime
 * - all values remain strongly typed
 *
 * ---
 *
 * @example <caption>Get the RPC URL for Cronos Testnet</caption>
 * ```ts
 * const rpc = NETWORK_REGISTRY[CronosNetwork.CronosTestnet].rpc_url;
 * console.log(rpc); // "https://evm-t3.cronos.org"
 * ```
 *
 * @example <caption>Use the registered header generator</caption>
 * ```ts
 * const header = await NETWORK_REGISTRY[CronosNetwork.CronosMainnet]
 *   .headerGenerator({
 *     signer,
 *     network: CronosNetwork.CronosMainnet,
 *     to: "0xRecipient",
 *     value: "1000000",
 *   });
 * ```
 */
export const NETWORK_REGISTRY = {
  /**
   * Configuration for **Cronos EVM Mainnet**.
   *
   * - `asset`: USDCe contract on Cronos mainnet
   * - `headerGenerator`: Shared EIP-3009 header builder
   * - `rpc_url`: Canonical mainnet RPC endpoint
   */
  [CronosNetwork.CronosMainnet]: {
    /** Default ERC-20 asset for mainnet X402 payments (USDCe). */
    asset: Contract.USDCe,

    /**
     * Header constructor used to generate Base64-encoded X402 payment headers
     * for Cronos mainnet using EIP-3009 `TransferWithAuthorization`.
     */
    headerGenerator: generateCronosPaymentHeader,

    /** Public JSON-RPC endpoint for Cronos EVM Mainnet. */
    rpc_url: "https://evm.cronos.org",
  },

  /**
   * Configuration for **Cronos EVM Testnet** (chainId: 338).
   *
   * - `asset`: USDCe testnet contract
   * - `headerGenerator`: Shared EIP-3009 header builder
   * - `rpc_url`: Official Cronos testnet RPC
   */
  [CronosNetwork.CronosTestnet]: {
    /** Default ERC-20 asset for testnet X402 payments (USDCe test deployment). */
    asset: Contract.DevUSDCe,

    /** Header generator used to create EIP-3009 X402 headers for testnet. */
    headerGenerator: generateCronosPaymentHeader,

    /** Public JSON-RPC endpoint for Cronos EVM Testnet. */
    rpc_url: "https://evm-t3.cronos.org",
  },
} as const;

/**
 * Strongly typed representation of the network registry object.
 *
 * Enables:
 * - compile-time lookup safety
 * - autocompletion of registry keys and fields
 * - strict typing for dynamic access
 */
export type NetworkRegistry = typeof NETWORK_REGISTRY;
