/**
 * AgentServiceMarket - Agent-to-Agent service discovery and payment
 *
 * Agents register services they can offer (scouting reports, alliance
 * analysis, voting predictions, trading signals) and other agents can
 * discover and purchase these services via x402 micropayments.
 *
 * This hits the Base "Agent Services" bounty ($5K):
 * - Agents autonomously offer and consume services
 * - Payments flow through x402 protocol (USDC on Base via Locus)
 * - Services are discoverable via a registry endpoint
 * - ERC-8004 identity ties services to agent reputation
 *
 * Flow:
 *   1. Agent registers a service (e.g. "scouting report on player X")
 *   2. Service appears in the marketplace registry
 *   3. Another agent discovers the service via GET /api/services
 *   4. Agent pays via x402 (sends USDC, gets txHash)
 *   5. Service provider executes and returns the result
 *   6. Both agents get ERC-8004 reputation feedback
 */

import { logger } from "../utils/logger.js";
import { getAgentMemory } from "./AgentMemory.js";

const log = logger.child("AgentServiceMarket");

export type ServiceType =
  | "scouting_report"    // Analysis of a specific player's behavior
  | "alliance_broker"     // Propose coordinated voting strategy
  | "vote_prediction"     // Predict who will be voted out
  | "trading_signal"      // Suggest a Uniswap swap based on game outcomes
  | "deception_analysis"  // Detect likely impostors from discussion patterns
  | "game_commentary";    // Play-by-play analysis of ongoing game

export interface ServiceListing {
  id: string;
  providerName: string;
  providerAddress: string;
  erc8004Id: string | null;
  serviceType: ServiceType;
  description: string;
  priceUSDC: string;
  available: boolean;
  createdAt: number;
  fulfillments: number;
  rating: number; // 0-5 stars average
}

export interface ServiceRequest {
  id: string;
  requesterId: string;
  requesterAddress: string;
  serviceId: string;
  parameters: Record<string, unknown>;
  paymentTxHash: string | null;
  status: "pending" | "paid" | "fulfilled" | "failed";
  result: unknown | null;
  createdAt: number;
  fulfilledAt: number | null;
}

// Service catalog
const services = new Map<string, ServiceListing>();
const requests = new Map<string, ServiceRequest>();
let requestCounter = 0;

/** Register a new service offering */
export function registerService(opts: {
  providerName: string;
  providerAddress: string;
  erc8004Id?: string | null;
  serviceType: ServiceType;
  description: string;
  priceUSDC: string;
}): ServiceListing {
  const id = `svc_${opts.providerName.toLowerCase()}_${opts.serviceType}_${Date.now().toString(36)}`;

  const listing: ServiceListing = {
    id,
    providerName: opts.providerName,
    providerAddress: opts.providerAddress,
    erc8004Id: opts.erc8004Id || null,
    serviceType: opts.serviceType,
    description: opts.description,
    priceUSDC: opts.priceUSDC,
    available: true,
    createdAt: Date.now(),
    fulfillments: 0,
    rating: 0,
  };

  services.set(id, listing);
  log.info(`Service registered: ${id} by ${opts.providerName} (${opts.serviceType}, $${opts.priceUSDC} USDC)`);
  return listing;
}

/** List all available services, optionally filtered */
export function listServices(filter?: {
  serviceType?: ServiceType;
  maxPrice?: string;
  providerName?: string;
}): ServiceListing[] {
  let results = Array.from(services.values()).filter((s) => s.available);

  if (filter?.serviceType) {
    results = results.filter((s) => s.serviceType === filter.serviceType);
  }
  if (filter?.maxPrice) {
    const max = parseFloat(filter.maxPrice);
    results = results.filter((s) => parseFloat(s.priceUSDC) <= max);
  }
  if (filter?.providerName) {
    results = results.filter(
      (s) => s.providerName.toLowerCase() === filter.providerName!.toLowerCase()
    );
  }

  return results.sort((a, b) => b.rating - a.rating || a.fulfillments - b.fulfillments);
}

/** Get a specific service */
export function getService(serviceId: string): ServiceListing | null {
  return services.get(serviceId) || null;
}

/** Request a service (before payment) */
export function createServiceRequest(opts: {
  requesterId: string;
  requesterAddress: string;
  serviceId: string;
  parameters: Record<string, unknown>;
}): ServiceRequest | null {
  const service = services.get(opts.serviceId);
  if (!service || !service.available) return null;

  const id = `req_${(++requestCounter).toString().padStart(6, "0")}`;

  const request: ServiceRequest = {
    id,
    requesterId: opts.requesterId,
    requesterAddress: opts.requesterAddress,
    serviceId: opts.serviceId,
    parameters: opts.parameters,
    paymentTxHash: null,
    status: "pending",
    result: null,
    createdAt: Date.now(),
    fulfilledAt: null,
  };

  requests.set(id, request);
  log.info(`Service request: ${id} for ${opts.serviceId} by ${opts.requesterId}`);
  return request;
}

/** Confirm payment for a service request */
export function confirmPayment(requestId: string, txHash: string): boolean {
  const request = requests.get(requestId);
  if (!request || request.status !== "pending") return false;

  request.paymentTxHash = txHash;
  request.status = "paid";
  log.info(`Payment confirmed for ${requestId}: ${txHash}`);
  return true;
}

/** Fulfill a service request (provider delivers the result) */
export async function fulfillService(
  requestId: string,
  result: unknown
): Promise<boolean> {
  const request = requests.get(requestId);
  if (!request || request.status !== "paid") return false;

  request.result = result;
  request.status = "fulfilled";
  request.fulfilledAt = Date.now();

  // Update service stats
  const service = services.get(request.serviceId);
  if (service) {
    service.fulfillments++;
  }

  log.info(`Service fulfilled: ${requestId}`);
  return true;
}

/** Execute a scouting report service using agent memory */
export function executeScoutingReport(
  providerName: string,
  targetName: string,
  targetAddress: string
): object {
  const memory = getAgentMemory(providerName);
  const briefing = memory.getOpponentBriefing([
    { name: targetName, address: targetAddress },
  ]);
  const stats = memory.getStats();

  return {
    target: targetName,
    analysis: briefing || `No prior data on ${targetName}`,
    providerStats: {
      gamesPlayed: stats.totalGames,
      winRate: Math.round(stats.winRate * 100),
    },
    generatedAt: Date.now(),
    disclaimer: "Based on cross-game memory analysis. Accuracy improves with more games.",
  };
}

/** Execute a vote prediction service */
export function executeVotePrediction(
  providerName: string,
  players: Array<{ name: string; address: string }>
): object {
  const memory = getAgentMemory(providerName);
  const predictions: Array<{ name: string; eliminationRisk: string; reasoning: string }> = [];

  for (const player of players) {
    if (player.name === providerName) continue;

    const briefing = memory.getOpponentBriefing([player]);
    const lines = briefing.split("\n");
    const trustLine = lines.find((l) => l.includes("trust="));
    const trustScore = trustLine ? parseInt(trustLine.match(/trust=(-?\d+)/)?.[1] || "0") : 0;

    let risk = "medium";
    let reasoning = "Insufficient data for prediction";

    if (trustScore < -20) {
      risk = "high";
      reasoning = "Low trust score, frequently voted against or caught lying";
    } else if (trustScore > 30) {
      risk = "low";
      reasoning = "High trust, reliable ally in past games";
    }

    predictions.push({ name: player.name, eliminationRisk: risk, reasoning });
  }

  return {
    predictions,
    confidence: Math.min(1, memory.getStats().totalGames / 10),
    generatedAt: Date.now(),
  };
}

/** Auto-register default services for an agent */
export function autoRegisterServices(
  agentName: string,
  agentAddress: string,
  erc8004Id?: string | null
): ServiceListing[] {
  const registered: ServiceListing[] = [];

  const defaultServices: Array<{
    type: ServiceType;
    description: string;
    price: string;
  }> = [
    {
      type: "scouting_report",
      description: `${agentName}'s cross-game intelligence report on any player. Includes trust score, deception history, and alliance reliability.`,
      price: "0.10",
    },
    {
      type: "vote_prediction",
      description: `${agentName}'s prediction of who will be eliminated next round, based on behavioral pattern analysis.`,
      price: "0.05",
    },
    {
      type: "trading_signal",
      description: `${agentName}'s post-game trading recommendation based on game outcome analysis and market sentiment.`,
      price: "0.15",
    },
  ];

  for (const svc of defaultServices) {
    const listing = registerService({
      providerName: agentName,
      providerAddress: agentAddress,
      erc8004Id,
      serviceType: svc.type,
      description: svc.description,
      priceUSDC: svc.price,
    });
    registered.push(listing);
  }

  return registered;
}

/** Get market stats */
export function getMarketStats(): {
  totalServices: number;
  totalRequests: number;
  totalFulfilled: number;
  servicesByType: Record<string, number>;
  topProviders: Array<{ name: string; fulfillments: number; rating: number }>;
} {
  const byType: Record<string, number> = {};
  const providerStats = new Map<string, { fulfillments: number; rating: number }>();

  for (const svc of services.values()) {
    byType[svc.serviceType] = (byType[svc.serviceType] || 0) + 1;

    const existing = providerStats.get(svc.providerName) || { fulfillments: 0, rating: 0 };
    existing.fulfillments += svc.fulfillments;
    existing.rating = Math.max(existing.rating, svc.rating);
    providerStats.set(svc.providerName, existing);
  }

  const topProviders = Array.from(providerStats.entries())
    .map(([name, stats]) => ({ name, ...stats }))
    .sort((a, b) => b.fulfillments - a.fulfillments)
    .slice(0, 10);

  return {
    totalServices: services.size,
    totalRequests: requests.size,
    totalFulfilled: Array.from(requests.values()).filter((r) => r.status === "fulfilled").length,
    servicesByType: byType,
    topProviders,
  };
}
