import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { queryRelevant, addDocuments, getCollectionStats } from "../vectorstore/index.js";
import { scrapeSource, type ScrapedArticle } from "../scraper/firecrawl.js";
import { chunkArticles } from "../scraper/chunker.js";
import { SCIENCE_SOURCES, SCIENCE_FIELDS } from "../scraper/sources.js";
import { searchPapers } from "../scraper/semanticscholar.js";
import { searchArxiv } from "../scraper/arxiv.js";
import { searchBioRxiv } from "../scraper/biorxiv.js";
import { createLogger } from "../util/logger.js";
import { scanForInjection, sanitizeForRag } from "../util/injectionDetector.js";

const log = createLogger("mcp:tools");

export function createMcpServer(): McpServer {
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
          .enum(SCIENCE_FIELDS)
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
        const scan = scanForInjection(question);
        if (scan.flagged) {
          log.warn({ tier: scan.tier, reason: scan.reason }, "Injection attempt detected in search query");
        }
        const safeQuestion = sanitizeForRag(question);
        const contexts = await queryRelevant(safeQuestion, num_results, field);

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
        "Scrape a science website using Firecrawl (PAID — requires FIRECRAWL_API_KEY, consumes API credits) and add it to the knowledge base. Only use when the user explicitly asks to scrape a website. For free paper search, use search_papers instead.",
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
          .enum(SCIENCE_FIELDS)
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
            field: custom_field || "physics",
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
        statsText = "\nKnowledge base: empty or not initialized.\n";
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

  // Tool 4: Search research papers (free APIs — no credits used)
  server.registerTool(
    "search_papers",
    {
      title: "Search Research Papers",
      description:
        "Search academic research papers via Semantic Scholar and arXiv APIs (free, no credits). Results are added to the knowledge base.",
      inputSchema: {
        query: z.string().describe("Search query for research papers"),
        source: z
          .enum(["semantic_scholar", "arxiv", "biorxiv", "all"])
          .default("all")
          .describe("Which paper source to search (default: all)"),
        field: z
          .enum(SCIENCE_FIELDS)
          .default("physics")
          .describe("Science field for categorization"),
        max_results: z
          .number()
          .min(1)
          .max(50)
          .default(10)
          .describe("Maximum papers to fetch (default: 10)"),
        arxiv_category: z
          .string()
          .optional()
          .describe("Optional arXiv category filter (e.g. quant-ph, astro-ph, q-bio, cond-mat)"),
        biorxiv_category: z
          .string()
          .optional()
          .describe("Optional bioRxiv category filter (e.g. neuroscience, genomics, cell-biology, biochemistry)"),
      },
    },
    async ({ query, source, field, max_results, arxiv_category, biorxiv_category }) => {
      try {
        const scan = scanForInjection(query);
        if (scan.flagged) {
          log.warn({ tier: scan.tier, reason: scan.reason }, "Injection attempt detected in paper search query");
        }
        const safeQuery = sanitizeForRag(query);

        // Run all API calls in parallel — each has its own circuit breaker and retry logic
        const fetchers: Promise<ScrapedArticle[]>[] = [];

        if (source === "semantic_scholar" || source === "all") {
          fetchers.push(
            searchPapers({ query: safeQuery, field, maxResults: max_results })
          );
        }

        if (source === "arxiv" || source === "all") {
          fetchers.push(
            searchArxiv({ searchQuery: safeQuery, field, maxResults: max_results, category: arxiv_category })
          );
        }

        if (source === "biorxiv" || source === "all") {
          fetchers.push(
            searchBioRxiv({ field, maxResults: max_results, category: biorxiv_category })
          );
        }

        const results = await Promise.allSettled(fetchers);
        const allArticles: ScrapedArticle[] = [];
        for (const result of results) {
          if (result.status === "fulfilled") {
            allArticles.push(...result.value);
          } else {
            log.warn({ err: result.reason }, "Paper source failed (partial results returned)");
          }
        }

        if (allArticles.length === 0) {
          return {
            content: [
              {
                type: "text" as const,
                text: `No papers found for "${query}". Try different search terms.`,
              },
            ],
          };
        }

        const summaries = allArticles
          .slice(0, 5)
          .map((a, i) => `${i + 1}. "${a.title}" (${a.sourceName}) — ${a.url}`)
          .join("\n");

        // Embed and store in the background — don't block the response
        const chunks = chunkArticles(allArticles);
        addDocuments(chunks).catch((err) =>
          log.error({ err }, "Background embedding/storage failed")
        );

        return {
          content: [
            {
              type: "text" as const,
              text: `Found ${allArticles.length} papers (${chunks.length} chunks queued for indexing).\n\nTop results:\n${summaries}${allArticles.length > 5 ? `\n... and ${allArticles.length - 5} more` : ""}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error searching papers: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  return server;
}
