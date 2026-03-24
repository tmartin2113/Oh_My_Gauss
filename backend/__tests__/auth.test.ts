import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import express from "express";
import authRouter from "../src/routes/auth.js";
import { signToken } from "../src/middleware/auth.js";
import { createSession } from "../src/services/sessionStore.js";

// Bypass rate limiters so tests don't hit the 5-per-15-min cap
vi.mock("../src/middleware/rateLimit.js", () => ({
  authLimiter: (_req: unknown, _res: unknown, next: () => void) => next(),
  toolLimiter: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

// Mock provider validation so tests never call real external APIs
vi.mock("../src/services/providerValidation.js", async (importOriginal) => {
  const real = await importOriginal<typeof import("../src/services/providerValidation.js")>();
  return {
    ...real,
    validateProviderKey: vi.fn(),
  };
});

import { validateProviderKey, ProviderValidationError } from "../src/services/providerValidation.js";
const mockValidate = vi.mocked(validateProviderKey);

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use("/auth", authRouter);
  return app;
}

describe("POST /auth/validate", () => {
  beforeEach(() => {
    mockValidate.mockReset();
  });

  it("returns 400 for missing body fields", async () => {
    const app = buildApp();
    const res = await request(app).post("/auth/validate").send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toBeTruthy();
  });

  it("returns 400 for missing apiKey", async () => {
    const app = buildApp();
    const res = await request(app).post("/auth/validate").send({ provider: "claude" });
    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid provider", async () => {
    const app = buildApp();
    const res = await request(app).post("/auth/validate").send({ provider: "unknown", apiKey: "sk-test" });
    expect(res.status).toBe(400);
  });

  it("returns 401 when provider rejects the API key", async () => {
    mockValidate.mockRejectedValueOnce(new ProviderValidationError("claude", "Invalid Claude API key"));
    const app = buildApp();
    const res = await request(app).post("/auth/validate").send({ provider: "claude", apiKey: "sk-bad" });
    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/invalid/i);
  });

  it("returns 200 with token and refreshToken on valid key", async () => {
    mockValidate.mockResolvedValueOnce(undefined);
    const app = buildApp();
    const res = await request(app).post("/auth/validate").send({ provider: "claude", apiKey: "sk-good" });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeTruthy();
    expect(res.body.refreshToken).toBeTruthy();
    expect(res.body.expiresIn).toBe(3600);
    expect(res.body.provider).toBe("claude");
  });

  it("does not include raw API key in response", async () => {
    mockValidate.mockResolvedValueOnce(undefined);
    const app = buildApp();
    const res = await request(app).post("/auth/validate").send({ provider: "openai", apiKey: "sk-my-secret-key" });
    expect(JSON.stringify(res.body)).not.toContain("sk-my-secret-key");
  });

  it("validates openai provider", async () => {
    mockValidate.mockResolvedValueOnce(undefined);
    const app = buildApp();
    const res = await request(app).post("/auth/validate").send({ provider: "openai", apiKey: "sk-openai" });
    expect(res.status).toBe(200);
    expect(res.body.provider).toBe("openai");
  });

  it("validates gemini provider", async () => {
    mockValidate.mockResolvedValueOnce(undefined);
    const app = buildApp();
    const res = await request(app).post("/auth/validate").send({ provider: "gemini", apiKey: "AIzatest" });
    expect(res.status).toBe(200);
    expect(res.body.provider).toBe("gemini");
  });
});

describe("POST /auth/refresh", () => {
  it("returns 400 when refreshToken is missing", async () => {
    const app = buildApp();
    const res = await request(app).post("/auth/refresh").send({});
    expect(res.status).toBe(400);
  });

  it("returns 401 for invalid refresh token", async () => {
    const app = buildApp();
    const res = await request(app).post("/auth/refresh").send({ refreshToken: "bad-token" });
    expect(res.status).toBe(401);
  });

  it("returns new token and refreshToken on valid rotation", async () => {
    // Create a real session to get a valid refresh token
    const { refreshToken } = createSession("claude", "sk-real");
    const app = buildApp();
    const res = await request(app).post("/auth/refresh").send({ refreshToken });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeTruthy();
    expect(res.body.refreshToken).toBeTruthy();
    // Returned refreshToken must be different (rotation)
    expect(res.body.refreshToken).not.toBe(refreshToken);
  });

  it("old refresh token is invalidated after rotation", async () => {
    const { refreshToken } = createSession("openai", "sk-rotate");
    const app = buildApp();
    await request(app).post("/auth/refresh").send({ refreshToken });
    // Try to use old token again
    const res2 = await request(app).post("/auth/refresh").send({ refreshToken });
    expect(res2.status).toBe(401);
  });
});

describe("DELETE /auth/session", () => {
  it("returns 401 without Authorization header", async () => {
    const app = buildApp();
    const res = await request(app).delete("/auth/session");
    expect(res.status).toBe(401);
  });

  it("returns 401 with invalid JWT", async () => {
    const app = buildApp();
    const res = await request(app).delete("/auth/session").set("Authorization", "Bearer invalid.jwt.token");
    expect(res.status).toBe(401);
  });

  it("returns 200 and deletes session with valid JWT", async () => {
    const { sessionId } = createSession("claude", "sk-logout");
    const token = signToken({ sessionId, provider: "claude" });
    const app = buildApp();
    const res = await request(app).delete("/auth/session").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/deleted/i);
  });

  it("returns 401 after session is deleted (JWT points to dead session)", async () => {
    const { sessionId } = createSession("gemini", "sk-dead");
    const token = signToken({ sessionId, provider: "gemini" });
    const app = buildApp();
    await request(app).delete("/auth/session").set("Authorization", `Bearer ${token}`);
    // Second delete attempt — session gone
    const res2 = await request(app).delete("/auth/session").set("Authorization", `Bearer ${token}`);
    expect(res2.status).toBe(401);
  });
});
