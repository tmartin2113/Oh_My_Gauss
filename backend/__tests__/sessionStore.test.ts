import { describe, it, expect, beforeEach, vi } from "vitest";
import { createSession, getSession, rotateSession, deleteSession } from "../src/services/sessionStore.js";

describe("sessionStore", () => {
  describe("createSession", () => {
    it("creates a session and returns sessionId + refreshToken", () => {
      const { sessionId, refreshToken } = createSession("claude", "sk-test");
      expect(sessionId).toBeTruthy();
      expect(refreshToken).toBeTruthy();
      expect(typeof sessionId).toBe("string");
      expect(typeof refreshToken).toBe("string");
    });

    it("stores the session so getSession retrieves it", () => {
      const { sessionId } = createSession("openai", "sk-openai-test");
      const session = getSession(sessionId);
      expect(session).toBeDefined();
      expect(session!.provider).toBe("openai");
      // API key stored server-side, never exposed
      expect(session!.apiKey).toBe("sk-openai-test");
    });

    it("creates unique session IDs for each call", () => {
      const first = createSession("claude", "key-a");
      const second = createSession("claude", "key-b");
      expect(first.sessionId).not.toBe(second.sessionId);
      expect(first.refreshToken).not.toBe(second.refreshToken);
    });
  });

  describe("getSession", () => {
    it("returns undefined for non-existent session", () => {
      expect(getSession("non-existent-id")).toBeUndefined();
    });

    it("returns undefined for expired session", () => {
      const { sessionId } = createSession("gemini", "sk-gem");
      // Fake expiry by mocking Date
      const session = getSession(sessionId)!;
      session.expiresAt = new Date(Date.now() - 1000);

      expect(getSession(sessionId)).toBeUndefined();
    });
  });

  describe("rotateSession", () => {
    it("returns new refresh token and same sessionId on valid rotation", () => {
      const { sessionId, refreshToken } = createSession("claude", "sk-rotate");
      const result = rotateSession(refreshToken);
      expect(result).not.toBeNull();
      expect(result!.sessionId).toBe(sessionId);
      expect(result!.newRefreshToken).toBeTruthy();
      expect(result!.newRefreshToken).not.toBe(refreshToken);
    });

    it("returns null for invalid refresh token", () => {
      expect(rotateSession("bad-refresh-token")).toBeNull();
    });

    it("invalidates old refresh token after rotation (rotation is single-use)", () => {
      const { refreshToken } = createSession("openai", "sk-rotate-2");
      rotateSession(refreshToken);
      // Old token should no longer work
      expect(rotateSession(refreshToken)).toBeNull();
    });

    it("new refresh token from rotation is valid", () => {
      const { sessionId, refreshToken } = createSession("claude", "sk-chain");
      const first = rotateSession(refreshToken)!;
      const second = rotateSession(first.newRefreshToken);
      expect(second).not.toBeNull();
      expect(second!.sessionId).toBe(sessionId);
    });
  });

  describe("deleteSession", () => {
    it("removes session so subsequent getSession returns undefined", () => {
      const { sessionId } = createSession("claude", "sk-del");
      deleteSession(sessionId);
      expect(getSession(sessionId)).toBeUndefined();
    });

    it("invalidates refresh tokens for deleted session", () => {
      const { sessionId, refreshToken } = createSession("gemini", "sk-del-rt");
      deleteSession(sessionId);
      expect(rotateSession(refreshToken)).toBeNull();
    });

    it("is a no-op for unknown sessionId", () => {
      expect(() => deleteSession("ghost-session")).not.toThrow();
    });
  });
});
