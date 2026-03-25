import { Router } from "express";
import { z } from "zod";
import { listTools, callTool, ALLOWED_TOOLS } from "../services/mcpClient.js";
import { requireAuth } from "../middleware/auth.js";
import { toolLimiter } from "../middleware/rateLimit.js";

const router = Router();

// All tool routes require auth + rate limiting
router.use(requireAuth);
router.use(toolLimiter);

const SCIENCE_FIELDS = [
  "nanotechnology",
  "physics",
  "earth",
  "astronomy_space",
  "chemistry",
  "biology",
  "materials_science",
] as const;

/** Zod schemas per tool — validated before forwarding to MCP */
const toolSchemas: Record<string, z.ZodTypeAny> = {
  search_papers: z.object({
    query: z.string(),
    source: z.enum(["semantic_scholar", "arxiv", "biorxiv", "all"]).default("all"),
    field: z.enum(SCIENCE_FIELDS).default("physics"),
    max_results: z.number().int().min(1).max(50).default(10),
    arxiv_category: z.string().optional(),
    biorxiv_category: z.string().optional(),
  }),
  search_science: z.object({
    question: z.string(),
    field: z.enum(SCIENCE_FIELDS).optional(),
    num_results: z.number().int().min(1).max(20).default(5),
  }),
  scrape_science: z
    .object({
      source_name: z.string().optional(),
      custom_url: z.string().url().optional(),
      custom_field: z.enum(SCIENCE_FIELDS).optional(),
      max_pages: z.number().int().min(1).max(50).default(10),
    })
    .refine((d) => d.source_name || d.custom_url, {
      message: "Either source_name or custom_url is required",
    }),
  list_sources: z.object({}).optional().default({}),
};

/** GET /tools — list available MCP tools */
router.get("/", async (_req, res) => {
  try {
    const tools = await listTools();
    res.json({ tools });
  } catch (err) {
    console.error("Failed to list tools:", err);
    res.status(502).json({ error: "Could not reach MCP server" });
  }
});

/** POST /tools/:toolName — execute a whitelisted tool */
router.post("/:toolName", async (req, res) => {
  const { toolName } = req.params;

  if (!ALLOWED_TOOLS.has(toolName)) {
    res.status(404).json({ error: `Tool "${toolName}" not found` });
    return;
  }

  const schema = toolSchemas[toolName];
  const parsed = schema.safeParse(req.body?.arguments ?? req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid arguments", details: parsed.error.flatten() });
    return;
  }

  try {
    const result = await callTool(toolName, parsed.data as Record<string, unknown>);
    if (result.isError) {
      res.status(500).json({ error: "Tool execution failed" });
      return;
    }
    res.json({ result });
  } catch (err) {
    console.error(`Tool "${toolName}" execution error:`, err);
    res.status(502).json({ error: "MCP tool call failed" });
  }
});

export default router;
