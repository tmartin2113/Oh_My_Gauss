import rateLimit from "express-rate-limit";
import type { Request } from "express";

/** 5 auth attempts per 15 minutes per IP */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many authentication attempts, please try again later" },
});

/** 30 tool calls per minute per session (keyed by session ID set by requireAuth) */
export const toolLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  keyGenerator: (req) => (req as Request & { sessionId?: string }).sessionId ?? req.ip ?? "unknown",
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many tool calls, please slow down" },
});
