import { type Request, type Response, type NextFunction } from "express";
import { verifyMessage } from "viem";
import { logger } from "./logger.js";

const authLogger = logger.child("Auth");

export interface AuthenticatedRequest extends Request {
  authenticatedAddress?: `0x${string}`;
}

export async function verifySignature(
  message: string,
  signature: `0x${string}`,
  expectedAddress: `0x${string}`
): Promise<boolean> {
  try {
    const valid = await verifyMessage({
      address: expectedAddress,
      message,
      signature,
    });
    return valid;
  } catch (err) {
    authLogger.error("Signature verification failed", err);
    return false;
  }
}

export function authMiddleware(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  const { address, signature } = req.body;

  if (!address || !signature) {
    res.status(401).json({ error: "Missing address or signature" });
    return;
  }

  const message = buildSignatureMessage(req.method, req.originalUrl, req.body);

  verifySignature(message, signature as `0x${string}`, address as `0x${string}`)
    .then((valid) => {
      if (!valid) {
        res.status(401).json({ error: "Invalid signature" });
        return;
      }
      req.authenticatedAddress = address as `0x${string}`;
      next();
    })
    .catch((err) => {
      authLogger.error("Auth middleware error", err);
      res.status(500).json({ error: "Authentication error" });
    });
}

export function buildSignatureMessage(
  method: string,
  path: string,
  body: Record<string, unknown>
): string {
  const filtered = { ...body };
  delete filtered.signature;
  const payload = JSON.stringify(filtered, Object.keys(filtered).sort());
  return `ClawWars:${method}:${path}:${payload}`;
}
