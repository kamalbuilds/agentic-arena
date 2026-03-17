/**
 * Uniswap Trading API integration for Among Claws.
 *
 * Agents swap tokens on Base via the Uniswap Trading API before entering games.
 * Flow: check_approval -> quote -> swap -> broadcast tx
 */

import { type Hex, isAddress, isHex, parseUnits, formatUnits } from "viem";
import { publicClient, walletClient, base } from "./client.js";
import { config } from "../config.js";
import { logger } from "../utils/logger.js";

const log = logger.child("Uniswap");

const TRADING_API_BASE = "https://trade-api.gateway.uniswap.org/v1";
const BASE_CHAIN_ID = config.base.chainId; // number, as required by the Trading API

// Well-known Base token addresses
export const BASE_TOKENS: Record<string, { address: string; decimals: number; symbol: string }> = {
  ETH: { address: "0x0000000000000000000000000000000000000000", decimals: 18, symbol: "ETH" },
  WETH: { address: "0x4200000000000000000000000000000000000006", decimals: 18, symbol: "WETH" },
  USDC: { address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", decimals: 6, symbol: "USDC" },
  USDbC: { address: "0xd9aAEc86B65D86f6A7B5B1b0c42FFA531710b6CA", decimals: 6, symbol: "USDbC" },
  CLAW: { address: config.claw.tokenAddress || "", decimals: 18, symbol: "CLAW" },
};

// Base Sepolia token addresses (testnet)
export const BASE_SEPOLIA_TOKENS: Record<string, { address: string; decimals: number; symbol: string }> = {
  ETH: { address: "0x0000000000000000000000000000000000000000", decimals: 18, symbol: "ETH" },
  WETH: { address: "0x4200000000000000000000000000000000000006", decimals: 18, symbol: "WETH" },
  USDC: { address: "0x036CbD53842c5426634e7929541eC2318f3dCF7e", decimals: 6, symbol: "USDC" },
};

function getTokens() {
  return config.base.chainId === 84532 ? BASE_SEPOLIA_TOKENS : BASE_TOKENS;
}

// ── Types ────────────────────────────────────────────────────────────

export interface SwapQuoteRequest {
  tokenIn: string;
  tokenOut: string;
  amount: string;
  swapperAddress: string;
  type?: "EXACT_INPUT" | "EXACT_OUTPUT";
  slippageTolerance?: number;
  routingPreference?: "BEST_PRICE" | "FASTEST" | "CLASSIC";
}

interface ApprovalResponse {
  approval: {
    to: string;
    from: string;
    data: string;
    value: string;
    chainId: number;
  } | null;
}

interface ClassicQuote {
  input: { token: string; amount: string };
  output: { token: string; amount: string };
  slippage: number;
  route: unknown[];
  gasFee: string;
  gasFeeUSD: string;
  gasUseEstimate: string;
}

interface UniswapXOutput {
  token: string;
  startAmount: string;
  endAmount: string;
  recipient: string;
}

interface UniswapXQuote {
  orderInfo: {
    outputs: UniswapXOutput[];
    input: { token: string; startAmount: string; endAmount: string };
    deadline: number;
    nonce: string;
  };
  encodedOrder: string;
  orderHash: string;
}

export interface QuoteResponse {
  routing: string;
  quote: ClassicQuote | UniswapXQuote;
  permitData: Record<string, unknown> | null;
  [key: string]: unknown;
}

export interface SwapResponse {
  swap: {
    to: string;
    from: string;
    data: string;
    value: string;
    chainId: number;
    gasLimit?: string;
  };
}

export interface SwapResult {
  txHash: string;
  tokenIn: string;
  tokenOut: string;
  amountIn: string;
  amountOut: string;
  routing: string;
  chainId: number;
  blockExplorerUrl: string;
}

// ── API Helpers ──────────────────────────────────────────────────────

const apiHeaders = () => {
  const key = config.uniswap?.apiKey;
  if (!key) throw new Error("UNISWAP_API_KEY not configured");
  return {
    "Content-Type": "application/json",
    "x-api-key": key,
    "x-universal-router-version": "2.0",
  };
};

async function tradingApiPost<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const url = `${TRADING_API_BASE}${path}`;
  log.debug(`POST ${path}`);

  const res = await fetch(url, {
    method: "POST",
    headers: apiHeaders(),
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    log.error(`Trading API error ${res.status}: ${text}`);
    throw new Error(`Uniswap Trading API ${path} failed (${res.status}): ${text}`);
  }

  return res.json() as Promise<T>;
}

// ── Core Functions ───────────────────────────────────────────────────

/**
 * Step 1: Check if the token needs approval for the Universal Router.
 */
export async function checkApproval(
  walletAddress: string,
  token: string,
  amount: string
): Promise<ApprovalResponse> {
  if (!isAddress(walletAddress)) throw new Error("Invalid wallet address");
  if (!isAddress(token)) throw new Error("Invalid token address");

  return tradingApiPost<ApprovalResponse>("/check_approval", {
    walletAddress,
    token,
    amount,
    chainId: config.base.chainId,
  });
}

/**
 * Step 2: Get a swap quote from the Trading API.
 */
export async function getQuote(req: SwapQuoteRequest): Promise<QuoteResponse> {
  if (!isAddress(req.swapperAddress)) throw new Error("Invalid swapper address");

  return tradingApiPost<QuoteResponse>("/quote", {
    swapper: req.swapperAddress,
    tokenIn: req.tokenIn,
    tokenOut: req.tokenOut,
    tokenInChainId: BASE_CHAIN_ID,
    tokenOutChainId: BASE_CHAIN_ID,
    amount: req.amount,
    type: req.type || "EXACT_INPUT",
    slippageTolerance: req.slippageTolerance ?? 0.5,
    routingPreference: req.routingPreference || "BEST_PRICE",
  });
}

/**
 * Step 3: Get the executable swap/order transaction.
 *
 * The Uniswap Trading API uses two endpoints:
 *   POST /order  - for UniswapX (DUTCH_V2, DUTCH_V3, PRIORITY) orders
 *   POST /swap   - for classic on-chain swaps
 */
export async function getSwapTransaction(quoteResponse: QuoteResponse, signature?: string): Promise<SwapResponse> {
  const { permitData, ...cleanQuote } = quoteResponse;
  const request: Record<string, unknown> = { ...cleanQuote };

  const isUniswapX =
    quoteResponse.routing === "DUTCH_V2" ||
    quoteResponse.routing === "DUTCH_V3" ||
    quoteResponse.routing === "PRIORITY";

  if (isUniswapX) {
    if (signature) request.signature = signature;
  } else {
    if (signature && permitData && typeof permitData === "object") {
      request.signature = signature;
      request.permitData = permitData;
    }
  }

  // UniswapX orders go to /order, classic swaps go to /swap
  const endpoint = isUniswapX ? "/order" : "/swap";
  return tradingApiPost<SwapResponse>(endpoint, request);
}

/**
 * Validate swap response before broadcasting.
 */
function validateSwapResponse(swap: SwapResponse["swap"]): void {
  if (!swap.data || swap.data === "" || swap.data === "0x") {
    throw new Error("swap.data is empty, quote may have expired. Re-fetch the quote.");
  }
  if (!isHex(swap.data as Hex)) {
    throw new Error("swap.data is not valid hex");
  }
  if (!isAddress(swap.to)) {
    throw new Error("swap.to is not a valid address");
  }
  if (!isAddress(swap.from)) {
    throw new Error("swap.from is not a valid address");
  }
}

/**
 * Execute a token approval transaction via the operator wallet.
 */
export async function executeApproval(approval: ApprovalResponse["approval"]): Promise<string | null> {
  if (!approval) return null;
  if (!walletClient) throw new Error("Operator wallet not configured");

  log.info(`Executing approval tx to ${approval.to}`);

  const hash = await walletClient.sendTransaction({
    to: approval.to as `0x${string}`,
    data: approval.data as `0x${string}`,
    value: BigInt(approval.value || "0"),
    chain: base,
    account: walletClient.account!,
  });

  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  log.info(`Approval confirmed in block ${receipt.blockNumber}, tx: ${hash}`);
  return hash;
}

/**
 * Broadcast the swap transaction via the operator wallet.
 */
export async function broadcastSwap(swap: SwapResponse["swap"]): Promise<string> {
  if (!walletClient) throw new Error("Operator wallet not configured");

  validateSwapResponse(swap);

  log.info(`Broadcasting swap tx to ${swap.to}`);

  const hash = await walletClient.sendTransaction({
    to: swap.to as `0x${string}`,
    data: swap.data as `0x${string}`,
    value: BigInt(swap.value || "0"),
    chain: base,
    account: walletClient.account!,
    ...(swap.gasLimit ? { gas: BigInt(swap.gasLimit) } : {}),
  });

  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  log.info(`Swap confirmed in block ${receipt.blockNumber}, tx: ${hash}`);
  return hash;
}

/**
 * End-to-end swap: approval check -> quote -> swap -> broadcast.
 * Returns the on-chain tx hash.
 */
export async function executeSwap(req: SwapQuoteRequest): Promise<SwapResult> {
  const operatorAddress = walletClient?.account?.address;
  if (!operatorAddress) throw new Error("Operator wallet not configured");

  // Use operator address as swapper (agents don't have keys in this model)
  const swapperAddress = req.swapperAddress || operatorAddress;

  // Resolve token symbols to addresses
  const tokens = getTokens();
  const tokenInAddr = tokens[req.tokenIn.toUpperCase()]?.address || req.tokenIn;
  const tokenOutAddr = tokens[req.tokenOut.toUpperCase()]?.address || req.tokenOut;

  log.info(`Swap: ${req.amount} ${req.tokenIn} -> ${req.tokenOut} for ${swapperAddress}`);

  // Step 1: Check approval (skip for native ETH)
  const isNativeIn = tokenInAddr === "0x0000000000000000000000000000000000000000";
  if (!isNativeIn) {
    const approvalResult = await checkApproval(swapperAddress, tokenInAddr, req.amount);
    if (approvalResult.approval) {
      await executeApproval(approvalResult.approval);
    }
  }

  // Step 2: Get quote
  const quoteResponse = await getQuote({
    ...req,
    tokenIn: tokenInAddr,
    tokenOut: tokenOutAddr,
    swapperAddress,
  });

  log.info(`Quote received: routing=${quoteResponse.routing}`);

  // Extract output amount based on routing type
  let amountOut = "0";
  const isUniswapX =
    quoteResponse.routing === "DUTCH_V2" ||
    quoteResponse.routing === "DUTCH_V3" ||
    quoteResponse.routing === "PRIORITY";

  if (isUniswapX) {
    const uniswapXQuote = quoteResponse.quote as UniswapXQuote;
    amountOut = uniswapXQuote.orderInfo.outputs[0]?.startAmount || "0";
  } else {
    const classicQuote = quoteResponse.quote as ClassicQuote;
    amountOut = classicQuote.output?.amount || "0";
  }

  // Step 3: Get swap transaction
  const swapResponse = await getSwapTransaction(quoteResponse);

  // Step 4: Broadcast
  const txHash = await broadcastSwap(swapResponse.swap);

  const explorerBase = config.base.chainId === 84532
    ? "https://sepolia.basescan.org"
    : "https://basescan.org";

  const result: SwapResult = {
    txHash,
    tokenIn: tokenInAddr,
    tokenOut: tokenOutAddr,
    amountIn: req.amount,
    amountOut,
    routing: quoteResponse.routing,
    chainId: config.base.chainId,
    blockExplorerUrl: `${explorerBase}/tx/${txHash}`,
  };

  log.info(`Swap complete: ${result.blockExplorerUrl}`);
  return result;
}

/**
 * Get the current price of a token in USD (via USDC quote).
 * Uses a 1-unit EXACT_INPUT quote from the Trading API.
 */
export async function getTokenPrice(token: string): Promise<{
  token: string;
  priceUSD: string;
  source: string;
  chainId: number;
  timestamp: number;
}> {
  const tokens = getTokens();
  const tokenInfo = tokens[token.toUpperCase()] || { address: token, decimals: 18, symbol: token };
  const usdcInfo = tokens["USDC"];

  if (!usdcInfo || !usdcInfo.address) {
    throw new Error("USDC not configured for this chain");
  }

  // If the token IS USDC, return $1
  if (tokenInfo.address.toLowerCase() === usdcInfo.address.toLowerCase()) {
    return {
      token: tokenInfo.symbol,
      priceUSD: "1.000000",
      source: "identity",
      chainId: config.base.chainId,
      timestamp: Date.now(),
    };
  }

  // Native ETH: use WETH address for pricing
  const isNative = tokenInfo.address === "0x0000000000000000000000000000000000000000";
  const pricingAddress = isNative
    ? (tokens["WETH"]?.address || "0x4200000000000000000000000000000000000006")
    : tokenInfo.address;

  // Quote 1 unit of the token priced in USDC
  const oneUnit = parseUnits("1", tokenInfo.decimals).toString();

  // Build a swapper address for the quote (doesn't need to be the real sender)
  // Using a well-known address since this is just a price check
  const dummySwapper = walletClient?.account?.address || "0x0000000000000000000000000000000000000001";

  const quoteResponse = await tradingApiPost<QuoteResponse>("/quote", {
    swapper: dummySwapper,
    tokenIn: pricingAddress,
    tokenOut: usdcInfo.address,
    tokenInChainId: BASE_CHAIN_ID,
    tokenOutChainId: BASE_CHAIN_ID,
    amount: oneUnit,
    type: "EXACT_INPUT",
    slippageTolerance: 1.0,
    routingPreference: "CLASSIC",
  });

  let outputAmount = "0";
  const isUniswapX =
    quoteResponse.routing === "DUTCH_V2" ||
    quoteResponse.routing === "DUTCH_V3" ||
    quoteResponse.routing === "PRIORITY";

  if (isUniswapX) {
    const uniQuote = quoteResponse.quote as UniswapXQuote;
    outputAmount = uniQuote.orderInfo.outputs[0]?.startAmount || "0";
  } else {
    const classicQuote = quoteResponse.quote as ClassicQuote;
    outputAmount = classicQuote.output?.amount || "0";
  }

  // USDC has 6 decimals
  const priceUSD = formatUnits(BigInt(outputAmount), usdcInfo.decimals);

  log.info(`Price: 1 ${tokenInfo.symbol} = $${priceUSD} USDC`);

  return {
    token: tokenInfo.symbol,
    priceUSD,
    source: `uniswap-trading-api-${quoteResponse.routing.toLowerCase()}`,
    chainId: config.base.chainId,
    timestamp: Date.now(),
  };
}

/**
 * Get a list of supported tokens on the current chain.
 */
export function getSupportedTokens() {
  const tokens = getTokens();
  return Object.entries(tokens)
    .filter(([_, t]) => t.address !== "")
    .map(([symbol, t]) => ({
      symbol,
      address: t.address,
      decimals: t.decimals,
    }));
}

/**
 * Parse a human-readable amount to wei/smallest unit.
 */
export function parseTokenAmount(amount: string, symbol: string): string {
  const tokens = getTokens();
  const token = tokens[symbol.toUpperCase()];
  if (!token) throw new Error(`Unknown token: ${symbol}`);
  return parseUnits(amount, token.decimals).toString();
}

/**
 * Format from smallest unit to human-readable.
 */
export function formatTokenAmount(amount: string, symbol: string): string {
  const tokens = getTokens();
  const token = tokens[symbol.toUpperCase()];
  if (!token) throw new Error(`Unknown token: ${symbol}`);
  return formatUnits(BigInt(amount), token.decimals);
}
