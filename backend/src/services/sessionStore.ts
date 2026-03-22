import { v4 as uuidv4 } from "uuid";
import type { Session, Provider } from "../types.js";

const SESSION_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

/** In-memory session store — keyed by sessionId */
const sessions = new Map<string, Session>();

/** Refresh tokens map refresh token → sessionId */
const refreshTokens = new Map<string, { sessionId: string; expiresAt: Date }>();

function purgeExpired(): void {
  const now = new Date();
  for (const [id, session] of sessions) {
    if (session.expiresAt < now) sessions.delete(id);
  }
  for (const [token, meta] of refreshTokens) {
    if (meta.expiresAt < now) refreshTokens.delete(token);
  }
}

export function createSession(provider: Provider, apiKey: string): { sessionId: string; refreshToken: string } {
  purgeExpired();
  const sessionId = uuidv4();
  const now = new Date();
  sessions.set(sessionId, {
    sessionId,
    provider,
    apiKey,
    createdAt: now,
    expiresAt: new Date(now.getTime() + SESSION_TTL_MS),
  });

  const refreshToken = uuidv4();
  refreshTokens.set(refreshToken, {
    sessionId,
    expiresAt: new Date(now.getTime() + REFRESH_TOKEN_TTL_MS),
  });

  return { sessionId, refreshToken };
}

export function getSession(sessionId: string): Session | undefined {
  const session = sessions.get(sessionId);
  if (!session) return undefined;
  if (session.expiresAt < new Date()) {
    sessions.delete(sessionId);
    return undefined;
  }
  return session;
}

export function rotateSession(refreshToken: string): { sessionId: string; newRefreshToken: string } | null {
  const meta = refreshTokens.get(refreshToken);
  if (!meta || meta.expiresAt < new Date()) {
    refreshTokens.delete(refreshToken);
    return null;
  }

  const session = sessions.get(meta.sessionId);
  if (!session) {
    refreshTokens.delete(refreshToken);
    return null;
  }

  // Extend session TTL
  session.expiresAt = new Date(Date.now() + SESSION_TTL_MS);

  // Rotate refresh token (invalidate old, issue new)
  refreshTokens.delete(refreshToken);
  const newRefreshToken = uuidv4();
  refreshTokens.set(newRefreshToken, {
    sessionId: meta.sessionId,
    expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
  });

  return { sessionId: meta.sessionId, newRefreshToken };
}

export function deleteSession(sessionId: string): void {
  sessions.delete(sessionId);
  // Clean up associated refresh tokens
  for (const [token, meta] of refreshTokens) {
    if (meta.sessionId === sessionId) refreshTokens.delete(token);
  }
}
