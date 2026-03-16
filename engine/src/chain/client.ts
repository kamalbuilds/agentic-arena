import {
  createPublicClient,
  createWalletClient,
  http,
  type Chain,
  type PublicClient,
  type WalletClient,
  type Transport,
  type HttpTransport,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { config } from "../config.js";
import { logger } from "../utils/logger.js";

const chainLogger = logger.child("Chain");

const base = {
  id: config.base.chainId,
  name: config.base.chainId === 84532 ? "Base Sepolia" : "Base",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: { http: [config.base.rpcUrl] },
  },
  blockExplorers: {
    default: {
      name: "BaseScan",
      url: config.base.chainId === 84532
        ? "https://sepolia.basescan.org"
        : "https://basescan.org",
    },
  },
} satisfies Chain;

export { base };

export const publicClient: PublicClient<Transport, typeof base> =
  createPublicClient({
    chain: base,
    transport: http(config.base.rpcUrl),
  });

function createOperatorWalletClient(): WalletClient<
  HttpTransport,
  typeof base
> | null {
  if (!config.operator.privateKey || config.operator.privateKey === "0x_your_private_key_here") {
    chainLogger.warn(
      "No operator private key configured. On-chain transactions will fail."
    );
    return null;
  }

  try {
    const account = privateKeyToAccount(
      config.operator.privateKey as `0x${string}`
    );
    chainLogger.info(`Operator wallet initialized: ${account.address}`);

    return createWalletClient({
      account,
      chain: base,
      transport: http(config.base.rpcUrl),
    });
  } catch (err) {
    chainLogger.error("Failed to create operator wallet client", err);
    return null;
  }
}

export const walletClient = createOperatorWalletClient();

export function getOperatorAddress(): `0x${string}` | null {
  if (!walletClient || !walletClient.account) return null;
  return walletClient.account.address;
}
