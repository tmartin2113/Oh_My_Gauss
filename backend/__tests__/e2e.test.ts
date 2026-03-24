/**
 * E2E Smoke Tests — Oh_My_Gauss Backend + MCP Server
 *
 * These tests require a running MCP server (npm start in project root)
 * and a running backend (npm run dev in backend/).
 *
 * They are skipped automatically when MCP_URL is not reachable.
 * Run with: MCP_LIVE=1 npx vitest run backend/__tests__/e2e.test.ts
 *
 * What is tested:
 * 1. validate (stub) → get JWT → call search_papers → verify response shape
 * 2. Verify API key is NOT echoed in any response body
 * 3. Verify health endpoint reports both backend + MCP status
 */

import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import express from "express";
import authRouter from "../src/routes/auth.js";
import toolsRouter from "../src/routes/tools.js";
import healthRouter from "../src/routes/health.js";
import { signToken } from "../src/middleware/auth.js";
import { createSession } from "../src/services/sessionStore.js";

const LIVE = process.env.MCP_LIVE === "1";
const MCP_URL = process.env.MCP_URL ?? "http://127.0.0.1:3100";

async function isMcpReachable(): Promise<boolean> {
  try {
    const res = await fetch(`${MCP_URL}/health`, { signal: AbortSignal.timeout(2000) });
    return res.ok;
  } catch {
    return false;
  }
}

function buildFullApp() {
  const app = express();
  app.use(express.json());
  app.use("/auth", authRouter);
  app.use("/tools", toolsRouter);
  app.use("/health", healthRouter);
  return app;
}

describe("E2E Smoke Tests (requires MCP_LIVE=1 + running MCP server)", () => {
  let mcpReachable = false;
  let app: ReturnType<typeof buildFullApp>;
  let authToken: string;
  const STUB_API_KEY = "sk-e2e-smoke-test-key-do-not-use";

  beforeAll(async () => {
    mcpReachable = LIVE && (await isMcpReachable());
    app = buildFullApp();

    // Pre-create a session with a stub key (bypasses real provider validation for E2E)
    const { sessionId } = createSession("claude", STUB_API_KEY);
    authToken = `Bearer ${signToken({ sessionId, provider: "claude" })}`;
  });

  it.skipIf(!mcpReachable)("health endpoint shows backend=ok and mcp=ok", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
    expect(res.body.backend).toBe("ok");
    expect(res.body.mcp.status).toBe("ok");
  });

  it.skipIf(!mcpReachable)("GET /tools lists expected MCP tools", async () => {
    const res = await request(app).get("/tools").set("Authorization", authToken);
    expect(res.status).toBe(200);
    const names: string[] = res.body.tools.map((t: { name: string }) => t.name);
    expect(names).toContain("search_papers");
    expect(names).toContain("list_sources");
  });

  it.skipIf(!mcpReachable)("POST /tools/search_papers returns structured results", async () => {
    const res = await request(app)
      .post("/tools/search_papers")
      .set("Authorization", authToken)
      .send({ arguments: { query: "quantum entanglement", max_results: 3 } });

    expect(res.status).toBe(200);
    // Result shape: { result: { content: [{ type: 'text', text: '...' }] } }
    expect(res.body.result).toBeDefined();
    expect(Array.isArray(res.body.result.content)).toBe(true);
    expect(res.body.result.content.length).toBeGreaterThan(0);
    expect(res.body.result.content[0].type).toBe("text");
  });

  it.skipIf(!mcpReachable)("POST /tools/list_sources returns source list", async () => {
    const res = await request(app)
      .post("/tools/list_sources")
      .set("Authorization", authToken)
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.result.content.length).toBeGreaterThan(0);
  });

  // Security: API key must never appear in any response
  it.skipIf(!mcpReachable)("API key is NOT present in any response body or headers", async () => {
    const toolRes = await request(app)
      .post("/tools/search_papers")
      .set("Authorization", authToken)
      .send({ arguments: { query: "dark matter" } });

    const bodyStr = JSON.stringify(toolRes.body);
    expect(bodyStr).not.toContain(STUB_API_KEY);

    const headerStr = JSON.stringify(toolRes.headers);
    expect(headerStr).not.toContain(STUB_API_KEY);
  });

  it("non-whitelisted tool returns 404 (always, even without live MCP)", async () => {
    const res = await request(app)
      .post("/tools/execute_arbitrary_code")
      .set("Authorization", authToken)
      .send({});
    expect(res.status).toBe(404);
  });

  it("unauthenticated tool call returns 401 (always)", async () => {
    const res = await request(app).post("/tools/search_papers").send({ arguments: { query: "test" } });
    expect(res.status).toBe(401);
  });
});
