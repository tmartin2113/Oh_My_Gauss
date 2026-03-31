import "dotenv/config";
import { randomUUID } from "crypto";
import express from "express";
import cors from "cors";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { createMcpServer } from "./tools.js";

const PORT = parseInt(process.env.MCP_PORT || "3100", 10);
const HOST = process.env.MCP_HOST || "0.0.0.0";

const app = express();

// CORS — required for CortexOS and other remote MCP clients
app.use(
  cors({
    origin: process.env.MCP_CORS_ORIGIN === "none" ? false : true,
    methods: ["GET", "POST", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "mcp-session-id", "Authorization"],
    exposedHeaders: ["mcp-session-id"],
  })
);

app.use(express.json());

// ---------- Streamable HTTP transport (MCP 2025-03-26+) ----------

const streamableServer = createMcpServer();
const transports = new Map<string, StreamableHTTPServerTransport>();

app.post("/mcp", async (req, res) => {
  const sessionId = req.headers["mcp-session-id"] as string | undefined;

  if (sessionId && transports.has(sessionId)) {
    const transport = transports.get(sessionId)!;
    await transport.handleRequest(req, res, req.body);
    return;
  }

  let currentSessionId: string | undefined;
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: () => randomUUID(),
    onsessioninitialized: (id) => {
      currentSessionId = id;
      transports.set(id, transport);
    },
  });

  transport.onclose = () => {
    if (currentSessionId) {
      transports.delete(currentSessionId);
    }
  };

  await streamableServer.connect(transport);
  await transport.handleRequest(req, res, req.body);
});

app.get("/mcp", async (req, res) => {
  const sessionId = req.headers["mcp-session-id"] as string | undefined;
  if (sessionId && transports.has(sessionId)) {
    const transport = transports.get(sessionId)!;
    await transport.handleRequest(req, res);
    return;
  }
  res.status(400).json({ error: "No valid session. Send a POST first." });
});

app.delete("/mcp", async (req, res) => {
  const sessionId = req.headers["mcp-session-id"] as string | undefined;
  if (sessionId && transports.has(sessionId)) {
    const transport = transports.get(sessionId)!;
    await transport.handleRequest(req, res);
    return;
  }
  res.status(400).json({ error: "No valid session." });
});

// ---------- SSE transport (legacy MCP clients) ----------

const sseServer = createMcpServer();
const sseSessions = new Map<string, SSEServerTransport>();

app.get("/sse", async (_req, res) => {
  const transport = new SSEServerTransport("/messages", res);
  sseSessions.set(transport.sessionId, transport);

  transport.onclose = () => {
    sseSessions.delete(transport.sessionId);
  };

  await sseServer.connect(transport);
});

app.post("/messages", async (req, res) => {
  const sessionId = req.query.sessionId as string | undefined;
  if (!sessionId || !sseSessions.has(sessionId)) {
    res.status(400).json({ error: "Invalid or missing sessionId query parameter." });
    return;
  }
  const transport = sseSessions.get(sessionId)!;
  await transport.handlePostMessage(req, res, req.body);
});

// ---------- Health / discovery ----------

app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    name: "oh-my-gauss",
    version: "1.0.0",
    mcp: {
      transports: ["streamable-http", "sse"],
      endpoints: {
        streamableHttp: "/mcp",
        sse: "/sse",
        sseMessages: "/messages",
      },
      tools: ["search_science", "scrape_science", "list_sources", "search_papers"],
    },
  });
});

app.listen(PORT, HOST, () => {
  console.log(`Oh My Gauss MCP server running at http://${HOST}:${PORT}/mcp`);
  console.log(`SSE endpoint: http://${HOST}:${PORT}/sse`);
  console.log(`Health check: http://${HOST}:${PORT}/health`);
});
