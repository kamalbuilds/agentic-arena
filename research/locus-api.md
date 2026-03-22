# Locus Payment API Documentation

## API Base
`https://beta-api.paywithlocus.com/api`

## Authentication
- API keys start with `claw_beta_...`
- Header: `Authorization: Bearer YOUR_API_KEY`
- NEVER send key to any domain other than beta-api.paywithlocus.com

## Registration (No Auth Required)

```
POST /api/register
Body: {"name": "MyAgent"}
Returns: {
  apiKey: "claw_beta_...",
  ownerPrivateKey: "0x...",
  ownerAddress: "0x...",
  walletId: "...",
  walletStatus: "deploying",
  defaults: {...}
}
```

- walletStatus starts as "deploying", poll GET /api/status until "deployed"
- apiKey and ownerPrivateKey shown ONLY ONCE, save immediately

## Core Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | /api/status | Yes | Wallet deployment status |
| GET | /api/pay/balance | Yes | USDC balance |
| POST | /api/pay/send | Yes | Send USDC to address |
| POST | /api/pay/send-email | Yes | Send via email (escrow) |
| GET | /api/pay/transactions | Yes | Transaction history |
| GET | /api/pay/transactions/:id | Yes | Single transaction |
| GET | /api/checkout/agent/preflight/:sessionId | Yes | Checkout preflight |
| POST | /api/checkout/agent/pay/:sessionId | Yes | Pay checkout |
| GET | /api/checkout/agent/payments/:txId | Yes | Payment status |
| POST | /api/gift-code-requests | Yes | Request promo credits |
| GET | /api/gift-code-requests/mine | Yes | Check credit request status |
| POST | /api/gift-code-requests/redeem | Yes | Redeem approved credits |

## Spending Controls (Dashboard-configured)

- **Allowance**: Global USDC budget (403 if exceeded)
- **Max transaction size**: Per-transfer cap (403 if exceeded)
- **Approval threshold**: Returns 202 PENDING_APPROVAL with approval_url for large amounts

## Wallet Architecture

- ERC-4337 smart wallets on **Base ONLY**
- Dual-key: user key (never stored by Locus) + permissioned key (AWS KMS)
- Gas sponsored by Locus paymaster (no ETH needed)
- Subwallet system for email escrows (max 100 per wallet)

## Wrapped APIs (Pay-per-use third-party services)

```
POST /api/wrapped/{provider}/{endpoint}
```

Providers available: Firecrawl, OpenAI, Gemini, Exa, Resend, X/Twitter, Apollo
Agents can call these APIs and pay with their Locus USDC balance.

## x402 Endpoints

```
POST /api/x402/{slug}       # Call cataloged x402 endpoint
POST /api/x402/call         # Call any x402-compatible URL ad-hoc
```

## Our Integration Status

File: `engine/src/chain/locus.ts` (698 lines)

Implements:
- Agent registration with Locus
- Balance checking
- USDC send (direct + email escrow)
- Checkout preflight/pay/status flow
- Credit requests and redemption
- Game entry payment flow (balance check -> send USDC -> record)
- In-memory spending controls (daily limit + per-tx limit)
- Guarded payments (spending check + payment in one call)

10 API endpoints exposed via locusRoutes.ts:
- POST /api/locus/register
- GET /api/locus/balance
- POST /api/locus/send
- POST /api/locus/send-email
- GET /api/locus/transactions
- GET /api/locus/checkout/preflight/:sessionId
- POST /api/locus/checkout/pay/:sessionId
- GET /api/locus/checkout/status/:txId
- POST /api/locus/credits/request
- POST /api/locus/pay-game

Competition: Only 1 other project targeting Locus track ($3K). Basically uncontested.
