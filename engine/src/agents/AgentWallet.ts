/**
 * AgentWallet - Individual wallet for each autonomous agent
 *
 * Each agent gets a deterministic wallet derived from a seed + index,
 * allowing them to sign and submit their own on-chain transactions.
 */

import {
  createWalletClient,
  createPublicClient,
  http,
  type WalletClient,
  type PublicClient,
  type Account,
  type Chain,
  formatEther,
  parseEther,
} from "viem";
import { privateKeyToAccount, generatePrivateKey } from "viem/accounts";
import { config } from "../config.js";
import { logger } from "../utils/logger.js";

const walletLogger = logger.child("AgentWallet");

const baseChain = {
  id: config.base.chainId,
  name: config.base.chainId === 84532 ? "Base Sepolia" : "Base",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: { http: [config.base.rpcUrl] },
  },
  blockExplorers: {
    default: {
      name: "BaseScan",
      url:
        config.base.chainId === 84532
          ? "https://sepolia.basescan.org"
          : "https://basescan.org",
    },
  },
} satisfies Chain;

export class AgentWallet {
  public readonly address: `0x${string}`;
  public readonly walletClient: WalletClient;
  public readonly publicClient: PublicClient;
  private readonly account: Account;

  constructor(privateKey: `0x${string}`) {
    this.account = privateKeyToAccount(privateKey);
    this.address = this.account.address;

    this.walletClient = createWalletClient({
      account: this.account,
      chain: baseChain,
      transport: http(config.base.rpcUrl),
    });

    this.publicClient = createPublicClient({
      chain: baseChain,
      transport: http(config.base.rpcUrl),
    });

    walletLogger.info(`Agent wallet created: ${this.address}`);
  }

  /** Generate a new random wallet */
  static generate(): AgentWallet {
    const privateKey = generatePrivateKey();
    return new AgentWallet(privateKey);
  }

  /** Create wallet from a known private key */
  static fromPrivateKey(key: `0x${string}`): AgentWallet {
    return new AgentWallet(key);
  }

  /** Get ETH balance */
  async getBalance(): Promise<bigint> {
    return this.publicClient.getBalance({ address: this.address });
  }

  /** Get formatted ETH balance */
  async getFormattedBalance(): Promise<string> {
    const balance = await this.getBalance();
    return formatEther(balance);
  }

  /** Send ETH to another address */
  async sendETH(to: `0x${string}`, amount: bigint): Promise<`0x${string}`> {
    walletLogger.info(
      `Sending ${formatEther(amount)} ETH from ${this.address} to ${to}`
    );

    const hash = await this.walletClient.sendTransaction({
      account: this.account,
      to,
      value: amount,
      chain: baseChain,
    });

    walletLogger.info(`TX sent: ${hash}`);
    return hash;
  }

  /** Write to a contract */
  async writeContract(params: {
    address: `0x${string}`;
    abi: readonly unknown[];
    functionName: string;
    args?: readonly unknown[];
    value?: bigint;
  }): Promise<`0x${string}`> {
    walletLogger.info(
      `Agent ${this.address} calling ${params.functionName} on ${params.address}`
    );

    const hash = await this.walletClient.writeContract({
      account: this.account,
      address: params.address,
      abi: params.abi as any,
      functionName: params.functionName,
      args: params.args as any,
      value: params.value,
      chain: baseChain,
    });

    walletLogger.info(`Contract TX sent: ${hash}`);
    return hash;
  }

  /** Read from a contract */
  async readContract(params: {
    address: `0x${string}`;
    abi: readonly unknown[];
    functionName: string;
    args?: readonly unknown[];
  }): Promise<unknown> {
    return this.publicClient.readContract({
      address: params.address,
      abi: params.abi as any,
      functionName: params.functionName,
      args: params.args as any,
    });
  }
}
