import { Router } from "express";

const router = Router();
const MCP_HEALTH_URL = process.env.MCP_HEALTH_URL ?? "http://127.0.0.1:3100/health";

/** GET /health — check backend + MCP server health */
router.get("/", async (_req, res) => {
  let mcpStatus: "ok" | "unreachable" = "unreachable";
  let mcpLatencyMs: number | null = null;

  try {
    const start = Date.now();
    const response = await fetch(MCP_HEALTH_URL, { signal: AbortSignal.timeout(3000) });
    mcpLatencyMs = Date.now() - start;
    mcpStatus = response.ok ? "ok" : "unreachable";
  } catch {
    // MCP server down — still report backend status
  }

  const healthy = mcpStatus === "ok";
  res.status(healthy ? 200 : 503).json({
    status: healthy ? "ok" : "degraded",
    backend: "ok",
    mcp: {
      status: mcpStatus,
      latencyMs: mcpLatencyMs,
    },
    timestamp: new Date().toISOString(),
  });
});

export default router;
