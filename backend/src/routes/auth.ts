import { Router } from "express";
import { z } from "zod";
import { validateProviderKey, ProviderValidationError } from "../services/providerValidation.js";
import { createSession, rotateSession, deleteSession, getSession } from "../services/sessionStore.js";
import { signToken, requireAuth } from "../middleware/auth.js";
import { authLimiter } from "../middleware/rateLimit.js";
import type { Request } from "express";

const router = Router();

const validateSchema = z.object({
  provider: z.enum(["claude", "openai", "gemini"]),
  apiKey: z.string().min(1),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});

/** POST /auth/validate — validate API key and issue JWT */
router.post("/validate", authLimiter, async (req, res) => {
  const parsed = validateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request", details: parsed.error.flatten() });
    return;
  }

  const { provider, apiKey } = parsed.data;

  try {
    await validateProviderKey(provider, apiKey);
  } catch (err) {
    if (err instanceof ProviderValidationError) {
      res.status(401).json({ error: err.message });
      return;
    }
    console.error("Provider validation unexpected error:", err);
    res.status(502).json({ error: "Could not reach provider API" });
    return;
  }

  const { sessionId, refreshToken } = createSession(provider, apiKey);
  const token = signToken({ sessionId, provider });

  res.json({
    token,
    refreshToken,
    expiresIn: 3600,
    provider,
  });
});

/** POST /auth/refresh — rotate refresh token, issue new JWT */
router.post("/refresh", async (req, res) => {
  const parsed = refreshSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "refreshToken required" });
    return;
  }

  const result = rotateSession(parsed.data.refreshToken);
  if (!result) {
    res.status(401).json({ error: "Invalid or expired refresh token" });
    return;
  }

  const session = getSession(result.sessionId);
  if (!session) {
    res.status(401).json({ error: "Session not found" });
    return;
  }

  const token = signToken({ sessionId: result.sessionId, provider: session.provider });

  res.json({
    token,
    refreshToken: result.newRefreshToken,
    expiresIn: 3600,
  });
});

/** DELETE /auth/session — logout */
router.delete("/session", requireAuth, (req, res) => {
  const sessionId = (req as Request & { sessionId: string }).sessionId;
  deleteSession(sessionId);
  res.json({ message: "Session deleted" });
});

export default router;
