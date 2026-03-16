import "dotenv/config";
import { randomUUID } from "crypto";
import express from "express";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createMcpServer } from "./tools.js";

const server = createMcpServer();
const PORT = parseInt(process.env.MCP_PORT || "3100", 10);

const app = express();
app.use(express.json());

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

  await server.connect(transport);
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

app.get("/health", (_req, res) => {
  res.json({ status: "ok", name: "oh-my-gauss", version: "1.0.0" });
});

app.listen(PORT, "127.0.0.1", () => {
  console.log(`Oh My Gauss MCP server running at http://127.0.0.1:${PORT}/mcp`);
  console.log(`Health check: http://127.0.0.1:${PORT}/health`);
});
