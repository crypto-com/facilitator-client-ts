# **@crypto.com/facilitator-client**

### **Official Cronos X402 Facilitator SDK**

The **Crypto.com Facilitator SDK** provides a lightweight, strongly typed Node.js/TypeScript client for interacting with the **Cronos X402 Facilitator API**.
It allows developers to easily:

- Generate **EIP-3009 signed payment headers**
- Build **X402 Payment Requirements**
- Submit payments for **verification** and **settlement**
- Discover **supported networks and capabilities**

This SDK enables fully automated **off-chain authorization / on-chain execution** payments on **Cronos Mainnet** and **Cronos Testnet**.

![npm](https://img.shields.io/npm/v/@crypto.com/facilitator-client)
![License](https://img.shields.io/npm/l/@crypto.com/facilitator-client)

# Features

- **Facilitator API Client**
  `/verify`, `/settle`, `/supported`

- **EIP-3009 Header Generator**
  Produces Base64-encoded X402 payment headers

- **Typed X402 Payment Requirements**
  Fully typed and schema-driven

- **Zero unnecessary dependencies**
  Built around `ethers` and native Node features

- **Cronos-native**
  Supports **Cronos Mainnet** and **Cronos Testnet**

# Installation

```bash
npm install @crypto.com/facilitator-client
# or
yarn add @crypto.com/facilitator-client
```

# Usage

## 1. Create a Facilitator Client

> The Facilitator base URL is **fixed internally** and cannot be overridden.

```ts
import { Facilitator } from '@crypto.com/facilitator-client';
import { CronosNetwork } from '@crypto.com/facilitator-client';

const facilitator = new Facilitator({
  network: CronosNetwork.CronosTestnet, // or CronosMainnet
});
```

## 2. Generate Payment Requirements

```ts
const requirements = facilitator.generatePaymentRequirements({
  payTo: '0xRecipientAddress',
  description: 'Payment for Order #123',
  maxAmountRequired: '1000000', // base units
});

console.log(requirements);
```

## 3. Generate a Base64 Payment Header (EIP-3009)

```ts
import { ethers } from 'ethers';

const signer = new ethers.Wallet(process.env.PRIVATE_KEY!, new ethers.JsonRpcProvider('https://evm-t3.cronos.org'));

const header = await facilitator.generatePaymentHeader({
  to: '0xRecipientAddress',
  value: '1000000', // 1 USDCe (6 decimals)
  signer,
  validBefore: Math.floor(Date.now() / 1000) + 600, // 10 min expiry
});

console.log('header:', header);
```

## 4. Verify a Payment Request

```ts
const body = facilitator.buildVerifyRequest(header, requirements);

const verifyResponse = await facilitator.verifyPayment(body);
console.log('verify:', verifyResponse);
```

## 5. Settle a Verified Payment

```ts
const settleResponse = await facilitator.settlePayment(body);
console.log('settled:', settleResponse);
```

## 6. Discover Supported Networks & Schemes

```ts
const capabilities = await facilitator.getSupported();
console.log(capabilities);
```

# End-to-End Example (Full Flow)

```ts
const facilitator = new Facilitator({ network: CronosNetwork.CronosTestnet });

const signer = new ethers.Wallet(PRIVATE_KEY, new ethers.JsonRpcProvider('https://evm-t3.cronos.org'));

const header = await facilitator.generatePaymentHeader({
  to: RECEIVER,
  value: '1000000',
  signer,
});

const requirements = facilitator.generatePaymentRequirements({
  payTo: RECEIVER,
  description: 'Premium API access',
  maxAmountRequired: '1000000',
});

const body = facilitator.buildVerifyRequest(header, requirements);

const verify = await facilitator.verifyPayment(body);

if (verify.isValid) {
  const settle = await facilitator.settlePayment(body);
  console.log('Transaction:', settle.txHash);
}
```

# API Overview

### **Client**

| Method                                     | Description                                           |
| ------------------------------------------ | ----------------------------------------------------- |
| `getSupported()`                           | Returns supported networks, schemes, and capabilities |
| `verifyPayment(request)`                   | Validates the Base64 header + requirements            |
| `settlePayment(request)`                   | Executes the authorized transfer on-chain             |
| `buildVerifyRequest(header, requirements)` | Helper to produce valid X402 bodies                   |

### **Utilities**

| Function                               | Description                              |
| -------------------------------------- | ---------------------------------------- |
| `generatePaymentHeader(options)`       | Creates Base64 EIP-3009 payment header   |
| `generatePaymentRequirements(options)` | Produces typed X402 Payment Requirements |

# License

MIT © 2025 **Crypto.com**
