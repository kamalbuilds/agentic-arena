/**
 * Service Market API routes
 *
 * Agent-to-Agent service marketplace with x402 payment integration.
 * Agents register services, discover offerings, pay via USDC, and
 * receive results, all through standard REST endpoints.
 *
 * GET  /api/services              - List available services
 * GET  /api/services/:id          - Get service details
 * POST /api/services/register     - Register a new service
 * POST /api/services/request      - Request a service (returns x402 payment info)
 * POST /api/services/:reqId/pay   - Confirm payment for a request
 * GET  /api/services/market/stats - Market overview statistics
 */

import { Router, type Request, type Response } from "express";
import {
  listServices,
  getService,
  registerService,
  createServiceRequest,
  confirmPayment,
  payForService,
  fulfillService,
  executeScoutingReport,
  executeVotePrediction,
  getMarketStats,
  type ServiceType,
} from "../agents/AgentServiceMarket.js";
import { buildPaymentRequired } from "../chain/x402.js";
import { logger } from "../utils/logger.js";

const log = logger.child("ServiceMarketAPI");
export const serviceMarketRouter = Router();

// GET /api/services - List available services
serviceMarketRouter.get("/api/services", (req: Request, res: Response) => {
  const { type, maxPrice, provider } = req.query;

  const services = listServices({
    serviceType: type as ServiceType | undefined,
    maxPrice: maxPrice as string | undefined,
    providerName: provider as string | undefined,
  });

  res.json({
    services,
    total: services.length,
    serviceTypes: [
      "scouting_report",
      "alliance_broker",
      "vote_prediction",
      "trading_signal",
      "deception_analysis",
      "game_commentary",
    ],
  });
});

// GET /api/services/market/stats - Market overview
serviceMarketRouter.get("/api/services/market/stats", (_req: Request, res: Response) => {
  res.json(getMarketStats());
});

// GET /api/services/:id - Get service details
serviceMarketRouter.get("/api/services/:id", (req: Request, res: Response) => {
  const service = getService(req.params.id as string);
  if (!service) {
    res.status(404).json({ error: "Service not found" });
    return;
  }
  res.json(service);
});

// POST /api/services/register - Register a new service
serviceMarketRouter.post("/api/services/register", (req: Request, res: Response) => {
  const { providerName, providerAddress, erc8004Id, serviceType, description, priceUSDC } = req.body;

  if (!providerName || !providerAddress || !serviceType || !priceUSDC) {
    res.status(400).json({
      error: "Missing required fields: providerName, providerAddress, serviceType, priceUSDC",
    });
    return;
  }

  const validTypes: ServiceType[] = [
    "scouting_report", "alliance_broker", "vote_prediction",
    "trading_signal", "deception_analysis", "game_commentary",
  ];

  if (!validTypes.includes(serviceType)) {
    res.status(400).json({ error: `Invalid serviceType. Must be one of: ${validTypes.join(", ")}` });
    return;
  }

  const listing = registerService({
    providerName,
    providerAddress,
    erc8004Id,
    serviceType,
    description: description || `${serviceType} by ${providerName}`,
    priceUSDC,
  });

  res.status(201).json(listing);
});

// POST /api/services/request - Request a service
// Returns x402 payment info if payment required
serviceMarketRouter.post("/api/services/request", (req: Request, res: Response) => {
  const { requesterId, requesterAddress, serviceId, parameters, paymentTxHash } = req.body;

  if (!requesterId || !requesterAddress || !serviceId) {
    res.status(400).json({
      error: "Missing required fields: requesterId, requesterAddress, serviceId",
    });
    return;
  }

  const service = getService(serviceId);
  if (!service) {
    res.status(404).json({ error: "Service not found" });
    return;
  }

  // Create the request
  const request = createServiceRequest({
    requesterId,
    requesterAddress,
    serviceId,
    parameters: parameters || {},
  });

  if (!request) {
    res.status(400).json({ error: "Service unavailable" });
    return;
  }

  // If payment hash provided, try to fulfill immediately
  if (paymentTxHash) {
    const paid = confirmPayment(request.id, paymentTxHash);
    if (paid) {
      // Auto-fulfill known service types
      const result = autoFulfill(service, request, parameters || {});
      if (result) {
        fulfillService(request.id, result);
        res.json({
          request: { ...request, status: "fulfilled", result },
          service,
        });
        return;
      }
    }
  }

  // Return 402 with payment instructions
  const requirement = buildPaymentRequired(
    `/api/services/${serviceId}`,
    service.priceUSDC,
    `Payment for ${service.serviceType} by ${service.providerName}`
  );

  res.status(402).json({
    request,
    service,
    payment: {
      protocol: "x402",
      requirement,
      instructions: {
        step1: `Pay ${service.priceUSDC} USDC to ${requirement.recipient}`,
        step2: `POST /api/services/${request.id}/pay with { txHash: "..." }`,
        step3: "Service result returned automatically after payment confirmation",
      },
    },
  });
});

// POST /api/services/:reqId/pay - Pay via Locus USDC or confirm with manual txHash
serviceMarketRouter.post("/api/services/:reqId/pay", async (req: Request, res: Response) => {
  const requestId = req.params.reqId as string;
  const txHash = req.body.txHash as string | undefined;

  if (txHash) {
    // Manual payment confirmation (agent already sent USDC externally)
    const paid = confirmPayment(requestId, txHash);
    if (!paid) {
      res.status(400).json({ error: "Invalid request or already paid" });
      return;
    }
    res.json({
      status: "paid",
      requestId,
      txHash,
      message: "Payment confirmed. Service will be fulfilled shortly.",
    });
    return;
  }

  // Automatic payment via Locus USDC
  try {
    const result = await payForService(requestId);
    if (!result.success) {
      res.status(402).json({
        error: result.error,
        requestId,
        message: "Payment failed. Ensure Locus wallet has sufficient USDC balance.",
      });
      return;
    }

    res.json({
      status: "paid",
      requestId,
      txHash: result.txHash,
      paymentMethod: "locus_usdc",
      message: "USDC payment sent via Locus. Service will be fulfilled shortly.",
    });
  } catch (err: any) {
    log.error(`Payment failed for ${requestId}`, err);
    res.status(500).json({ error: "Payment processing failed" });
  }
});

/** Auto-fulfill known service types */
function autoFulfill(
  service: { serviceType: ServiceType; providerName: string },
  request: { parameters: Record<string, unknown> },
  params: Record<string, unknown>
): unknown {
  try {
    switch (service.serviceType) {
      case "scouting_report": {
        const targetName = (params.targetName || params.target) as string;
        const targetAddress = (params.targetAddress || params.address || "0x0") as string;
        if (!targetName) return null;
        return executeScoutingReport(service.providerName, targetName, targetAddress);
      }
      case "vote_prediction": {
        const players = params.players as Array<{ name: string; address: string }>;
        if (!players || !Array.isArray(players)) return null;
        return executeVotePrediction(service.providerName, players);
      }
      default:
        return null;
    }
  } catch (err) {
    log.error(`Auto-fulfill failed for ${service.serviceType}`, err);
    return null;
  }
}
