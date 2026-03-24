import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import express from "express";
import { signToken } from "../src/middleware/auth.js";
import { createSession } from "../src/services/sessionStore.js";

// Mock the MCP client so tool tests never need a live MCP server
vi.mock("../src/services/mcpClient.js", () => ({
  listTools: vi.fn(),
  callTool: vi.fn(),
  ALLOWED_TOOLS: new Set(["search_papers", "scrape_science", "search_science", "list_sources"]),
}));

import { listTools, callTool } from "../src/services/mcpClient.js";
import toolsRouter from "../src/routes/tools.js";

const mockListTools = vi.mocked(listTools);
const mockCallTool = vi.mocked(callTool);

function buildAuthenticatedApp() {
  const app = express();
  app.use(express.json());
  app.use("/tools", toolsRouter);
  return app;
}

function makeAuthHeader(): string {
  const { sessionId } = createSession("claude", "sk-test");
  const token = signToken({ sessionId, provider: "claude" });
  return `Bearer ${token}`;
}

describe("GET /tools", () => {
  beforeEach(() => {
    mockListTools.mockReset();
    mockCallTool.mockReset();
  });

  it("returns 401 without Authorization", async () => {
    const app = buildAuthenticatedApp();
    const res = await request(app).get("/tools");
    expect(res.status).toBe(401);
  });

  it("returns tool list with valid auth", async () => {
    mockListTools.mockResolvedValueOnce([
      { name: "search_papers", description: "Search papers", inputSchema: {} },
      { name: "list_sources", description: "List sources", inputSchema: {} },
    ]);
    const app = buildAuthenticatedApp();
    const res = await request(app).get("/tools").set("Authorization", makeAuthHeader());
    expect(res.status).toBe(200);
    expect(res.body.tools).toHaveLength(2);
    expect(res.body.tools[0].name).toBe("search_papers");
  });

  it("returns 502 when MCP server is unreachable", async () => {
    mockListTools.mockRejectedValueOnce(new Error("MCP connection refused"));
    const app = buildAuthenticatedApp();
    const res = await request(app).get("/tools").set("Authorization", makeAuthHeader());
    expect(res.status).toBe(502);
  });
});

describe("POST /tools/:toolName", () => {
  beforeEach(() => {
    mockListTools.mockReset();
    mockCallTool.mockReset();
  });

  it("returns 401 without Authorization", async () => {
    const app = buildAuthenticatedApp();
    const res = await request(app).post("/tools/search_papers").send({ arguments: { query: "test" } });
    expect(res.status).toBe(401);
  });

  it("returns 404 for non-whitelisted tool (e.g. unknown_tool)", async () => {
    const app = buildAuthenticatedApp();
    const res = await request(app)
      .post("/tools/unknown_tool")
      .set("Authorization", makeAuthHeader())
      .send({ arguments: {} });
    expect(res.status).toBe(404);
  });

  it("returns 400 for invalid arguments to search_papers (missing query)", async () => {
    const app = buildAuthenticatedApp();
    const res = await request(app)
      .post("/tools/search_papers")
      .set("Authorization", makeAuthHeader())
      .send({ arguments: { max_results: 5 } }); // missing required 'query'
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/invalid arguments/i);
  });

  it("returns 400 for invalid arguments to search_science (missing question)", async () => {
    const app = buildAuthenticatedApp();
    const res = await request(app)
      .post("/tools/search_science")
      .set("Authorization", makeAuthHeader())
      .send({ arguments: {} });
    expect(res.status).toBe(400);
  });

  it("returns 400 for scrape_science without source_name or custom_url", async () => {
    const app = buildAuthenticatedApp();
    const res = await request(app)
      .post("/tools/scrape_science")
      .set("Authorization", makeAuthHeader())
      .send({ arguments: { max_pages: 5 } });
    expect(res.status).toBe(400);
  });

  it("returns 200 with result for valid search_papers call", async () => {
    const mockResult = {
      content: [{ type: "text", text: JSON.stringify([{ title: "Test Paper", score: 0.9 }]) }],
      isError: false,
    };
    mockCallTool.mockResolvedValueOnce(mockResult);
    const app = buildAuthenticatedApp();
    const res = await request(app)
      .post("/tools/search_papers")
      .set("Authorization", makeAuthHeader())
      .send({ arguments: { query: "quantum entanglement" } });
    expect(res.status).toBe(200);
    expect(res.body.result).toEqual(mockResult);
  });

  it("returns 200 for list_sources with empty arguments", async () => {
    const mockResult = {
      content: [{ type: "text", text: "sources list" }],
      isError: false,
    };
    mockCallTool.mockResolvedValueOnce(mockResult);
    const app = buildAuthenticatedApp();
    const res = await request(app)
      .post("/tools/list_sources")
      .set("Authorization", makeAuthHeader())
      .send({});
    expect(res.status).toBe(200);
    expect(res.body.result).toEqual(mockResult);
  });

  it("returns 500 when tool execution returns isError=true", async () => {
    mockCallTool.mockResolvedValueOnce({
      content: [{ type: "text", text: "tool failed internally" }],
      isError: true,
    });
    const app = buildAuthenticatedApp();
    const res = await request(app)
      .post("/tools/search_papers")
      .set("Authorization", makeAuthHeader())
      .send({ arguments: { query: "fail" } });
    expect(res.status).toBe(500);
    expect(res.body.error).toMatch(/tool execution failed/i);
  });

  it("returns 502 when MCP call throws", async () => {
    mockCallTool.mockRejectedValueOnce(new Error("MCP disconnected"));
    const app = buildAuthenticatedApp();
    const res = await request(app)
      .post("/tools/search_papers")
      .set("Authorization", makeAuthHeader())
      .send({ arguments: { query: "mcp down" } });
    expect(res.status).toBe(502);
  });

  it("search_papers accepts optional source, field, max_results", async () => {
    mockCallTool.mockResolvedValueOnce({ content: [{ type: "text", text: "[]" }], isError: false });
    const app = buildAuthenticatedApp();
    const res = await request(app)
      .post("/tools/search_papers")
      .set("Authorization", makeAuthHeader())
      .send({ arguments: { query: "dark matter", source: "arxiv", field: "physics", max_results: 20 } });
    expect(res.status).toBe(200);
    // Verify callTool was called with validated args
    expect(mockCallTool).toHaveBeenCalledWith(
      "search_papers",
      expect.objectContaining({ query: "dark matter", source: "arxiv", max_results: 20 }),
    );
  });
});
