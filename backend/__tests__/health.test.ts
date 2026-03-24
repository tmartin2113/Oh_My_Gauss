import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import request from "supertest";
import express from "express";
import healthRouter from "../src/routes/health.js";

function buildApp() {
  const app = express();
  app.use("/health", healthRouter);
  return app;
}

describe("GET /health", () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("returns 200 with status=ok when MCP server is healthy", async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
    } as Response);

    const app = buildApp();
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
    expect(res.body.backend).toBe("ok");
    expect(res.body.mcp.status).toBe("ok");
    expect(typeof res.body.mcp.latencyMs).toBe("number");
    expect(res.body.timestamp).toBeTruthy();
  });

  it("returns 503 with status=degraded when MCP server is unreachable", async () => {
    globalThis.fetch = vi.fn().mockRejectedValueOnce(new Error("ECONNREFUSED"));

    const app = buildApp();
    const res = await request(app).get("/health");
    expect(res.status).toBe(503);
    expect(res.body.status).toBe("degraded");
    expect(res.body.backend).toBe("ok");
    expect(res.body.mcp.status).toBe("unreachable");
    expect(res.body.mcp.latencyMs).toBeNull();
  });

  it("returns 503 when MCP returns non-ok status", async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 500,
    } as Response);

    const app = buildApp();
    const res = await request(app).get("/health");
    expect(res.status).toBe(503);
    expect(res.body.mcp.status).toBe("unreachable");
  });

  it("always reports backend=ok regardless of MCP status", async () => {
    globalThis.fetch = vi.fn().mockRejectedValueOnce(new Error("MCP down"));

    const app = buildApp();
    const res = await request(app).get("/health");
    expect(res.body.backend).toBe("ok");
  });

  it("includes MCP URL in response", async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce({ ok: true, status: 200 } as Response);

    const app = buildApp();
    const res = await request(app).get("/health");
    expect(res.body.mcp.url).toContain("3100");
  });
});
