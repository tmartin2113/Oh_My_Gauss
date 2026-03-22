import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { getSession } from "../services/sessionStore.js";
import type { JwtPayload } from "../types.js";

const JWT_SECRET = process.env.JWT_SECRET ?? "dev-secret-change-in-production";

export function signToken(payload: JwtPayload, expiresIn: string | number = "1h"): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn } as jwt.SignOptions);
}

export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, JWT_SECRET) as JwtPayload;
}

/** Middleware: validate Bearer JWT and attach session to req */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Missing or invalid Authorization header" });
    return;
  }

  const token = authHeader.slice(7);
  let payload: JwtPayload;
  try {
    payload = verifyToken(token);
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
    return;
  }

  const session = getSession(payload.sessionId);
  if (!session) {
    res.status(401).json({ error: "Session not found or expired" });
    return;
  }

  // Attach to request for downstream handlers
  (req as Request & { sessionId: string }).sessionId = payload.sessionId;
  next();
}
