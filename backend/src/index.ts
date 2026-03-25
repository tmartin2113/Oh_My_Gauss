import express from "express";
import cors from "cors";
import authRouter from "./routes/auth.js";
import toolsRouter from "./routes/tools.js";
import healthRouter from "./routes/health.js";

const PORT = Number(process.env.PORT ?? 4000);
const CORS_ORIGIN = process.env.CORS_ORIGIN ?? "*";

const app = express();

// Trust reverse proxy (cloud deployment)
app.set("trust proxy", 1);

// Middleware
app.use(
  cors({
    origin: CORS_ORIGIN === "*" ? true : CORS_ORIGIN.split(",").map((o) => o.trim()),
    allowedHeaders: ["Authorization", "Content-Type"],
    methods: ["GET", "POST", "DELETE", "OPTIONS"],
  }),
);
app.use(express.json({ limit: "1mb" }));

// Liveness probe — only checks Express is listening (used by Railway healthcheck)
app.get("/healthz", (_req, res) => {
  res.status(200).json({ status: "ok" });
});

// Routes
app.use("/auth", authRouter);
app.use("/tools", toolsRouter);
app.use("/health", healthRouter);

// 404 catch-all
app.use((_req, res) => {
  res.status(404).json({ error: "Not found" });
});

// Error handler
app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ error: "Internal server error" });
});

app.listen(PORT, () => {
  console.log(`Oh_My_Gauss backend listening on port ${PORT}`);
  console.log(`MCP proxy → http://127.0.0.1:3100/mcp`);
});

export default app;
