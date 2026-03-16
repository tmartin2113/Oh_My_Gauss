import "dotenv/config";
import { randomUUID } from "crypto";
import express from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";
import { queryRelevant, addDocuments, getCollectionStats } from "../vectorstore/chroma.js";
import { scrapeSource } from "../scraper/firecrawl.js";
import { chunkArticles } from "../scraper/chunker.js";
import { SCIENCE_SOURCES } from "../scraper/sources.js";

const server = new McpServer({
  name: "oh-my-gauss",
  version: "1.0.0",
});

// Tool 1: Search the science knowledge base
server.registerTool(
  "search_science",
  {
    title: "Search Science Knowledge Base",
    description:
      "Search the science tutor knowledge base for information on a topic. Returns relevant article excerpts with source URLs.",
    inputSchema: {
      question: z.string().describe("The science question or topic to search for"),
      field: z
        .enum(["physics", "biology", "chemistry", "earth_science", "general"])
        .optional()
        .describe("Optional: filter by science field"),
      num_results: z
        .number()
        .min(1)
        .max(20)
        .default(5)
        .describe("Number of results to return (default: 5)"),
    },
  },
  async ({ question, field, num_results }) => {
    try {
      const contexts = await queryRelevant(question, num_results, field);

      if (contexts.length === 0) {
        return {
          content: [
            {
              type: "text" as const,
              text: "No relevant results found in the knowledge base. Try a different query or run a scrape first.",
            },
          ],
        };
      }

      const results = contexts
        .map(
          (ctx, i) =>
            `[${i + 1}] "${ctx.title}" (${ctx.field})\nURL: ${ctx.url}\nRelevance: ${(ctx.score * 100).toFixed(0)}%\n\n${ctx.text}`
        )
        .join("\n\n---\n\n");

      return {
        content: [{ type: "text" as const, text: results }],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error searching knowledge base: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
        isError: true,
      };
    }
  }
);

// Tool 2: Scrape a science source
server.registerTool(
  "scrape_science",
  {
    title: "Scrape Science Website",
    description:
      "Scrape a science website using Firecrawl and add it to the knowledge base. Can scrape a preconfigured source by name or a custom URL.",
    inputSchema: {
      source_name: z
        .string()
        .optional()
        .describe(
          "Name of a preconfigured source (e.g. 'Phys.org - Physics', 'Quanta Magazine', 'ScienceDaily - Biology')"
        ),
      custom_url: z
        .string()
        .url()
        .optional()
        .describe("A custom URL to scrape (if not using a preconfigured source)"),
      custom_field: z
        .enum(["physics", "biology", "chemistry", "earth_science", "general"])
        .optional()
        .describe("Science field for the custom URL (required if using custom_url)"),
      max_pages: z
        .number()
        .min(1)
        .max(50)
        .default(10)
        .describe("Maximum pages to crawl (default: 10)"),
    },
  },
  async ({ source_name, custom_url, custom_field, max_pages }) => {
    try {
      let source;

      if (source_name) {
        source = SCIENCE_SOURCES.find(
          (s) => s.name.toLowerCase() === source_name.toLowerCase()
        );
        if (!source) {
          const available = SCIENCE_SOURCES.map((s) => s.name).join(", ");
          return {
            content: [
              {
                type: "text" as const,
                text: `Source "${source_name}" not found. Available sources: ${available}`,
              },
            ],
            isError: true,
          };
        }
        source = { ...source, maxPages: max_pages };
      } else if (custom_url) {
        source = {
          name: `Custom: ${custom_url}`,
          url: custom_url,
          field: custom_field || "general",
          maxPages: max_pages,
        };
      } else {
        return {
          content: [
            {
              type: "text" as const,
              text: "Please provide either source_name or custom_url.",
            },
          ],
          isError: true,
        };
      }

      const articles = await scrapeSource(source);

      if (articles.length === 0) {
        return {
          content: [
            {
              type: "text" as const,
              text: `No articles found from ${source.name}. The site may be blocking scrapers or have no matching content.`,
            },
          ],
        };
      }

      const chunks = chunkArticles(articles);
      await addDocuments(chunks);

      return {
        content: [
          {
            type: "text" as const,
            text: `Scraped ${articles.length} articles from ${source.name}, creating ${chunks.length} chunks in the knowledge base.`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error scraping: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
        isError: true,
      };
    }
  }
);

// Tool 3: List available sources and knowledge base stats
server.registerTool(
  "list_sources",
  {
    title: "List Science Sources",
    description:
      "List all preconfigured science sources and show knowledge base statistics.",
    inputSchema: {},
  },
  async () => {
    let statsText = "";
    try {
      const stats = await getCollectionStats();
      statsText = `\nKnowledge base: ${stats.count} document chunks stored.\n`;
    } catch {
      statsText = "\nKnowledge base: Not connected (is ChromaDB running?).\n";
    }

    const byField: Record<string, string[]> = {};
    for (const source of SCIENCE_SOURCES) {
      if (!byField[source.field]) byField[source.field] = [];
      byField[source.field].push(`  - ${source.name} (${source.url})`);
    }

    const sourceList = Object.entries(byField)
      .map(([field, sources]) => `**${field}**\n${sources.join("\n")}`)
      .join("\n\n");

    return {
      content: [
        {
          type: "text" as const,
          text: `${statsText}\nAvailable sources:\n\n${sourceList}`,
        },
      ],
    };
  }
);

// Start the HTTP server
const PORT = parseInt(process.env.MCP_PORT || "3100", 10);

const app = express();
app.use(express.json());

// Map of session transports
const transports = new Map<string, StreamableHTTPServerTransport>();

app.post("/mcp", async (req, res) => {
  const sessionId = req.headers["mcp-session-id"] as string | undefined;

  if (sessionId && transports.has(sessionId)) {
    const transport = transports.get(sessionId)!;
    await transport.handleRequest(req, res, req.body);
    return;
  }

  // New session
  let currentSessionId: string | undefined;
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: () => randomUUID(),
    onsessioninitialized: (id) => {
      currentSessionId = id;
      transports.set(id, transport);
      console.log(`Session started: ${id}`);
    },
  });

  transport.onclose = () => {
    if (currentSessionId) {
      transports.delete(currentSessionId);
      console.log(`Session closed: ${currentSessionId}`);
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
