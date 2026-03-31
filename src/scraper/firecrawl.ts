import FirecrawlApp from "@mendable/firecrawl-js";
import { ScienceSource } from "./sources.js";
import { createLogger } from "../util/logger.js";
import { CircuitBreaker } from "../util/circuitBreaker.js";
import { safeAsync } from "../util/errors.js";

const log = createLogger("firecrawl");
const breaker = new CircuitBreaker("firecrawl", { threshold: 3, resetTimeoutMs: 120_000 });

export interface ScrapedArticle {
  url: string;
  title: string;
  markdown: string;
  field: string;
  sourceName: string;
  scrapedAt: string;
}

let firecrawlClient: FirecrawlApp | null = null;

function getClient(): FirecrawlApp {
  if (!firecrawlClient) {
    const apiKey = process.env.FIRECRAWL_API_KEY;
    if (!apiKey) {
      throw new Error("FIRECRAWL_API_KEY is not set in environment variables");
    }
    firecrawlClient = new FirecrawlApp({ apiKey });
  }
  return firecrawlClient;
}

export async function scrapeSource(
  source: ScienceSource
): Promise<ScrapedArticle[]> {
  const client = getClient();
  log.info({ source: source.name, url: source.url }, `Crawling ${source.name} (${source.url})`);

  const crawlResult = await breaker.execute(() =>
    client.crawlUrl(source.url, {
      limit: source.maxPages,
      includePaths: source.includePatterns,
      excludePaths: source.excludePatterns,
      scrapeOptions: {
        formats: ["markdown"],
      },
    })
  );

  if (!crawlResult.success) {
    log.error({ source: source.name, error: crawlResult.error }, `Failed to crawl ${source.name}: ${crawlResult.error}`);
    return [];
  }

  const articles: ScrapedArticle[] = [];

  for (const page of crawlResult.data) {
    const markdown = page.markdown;
    if (!markdown || markdown.length < 200) continue;

    const title =
      page.metadata?.title || page.metadata?.ogTitle || "Untitled";

    articles.push({
      url: page.metadata?.sourceURL || source.url,
      title,
      markdown,
      field: source.field,
      sourceName: source.name,
      scrapedAt: new Date().toISOString(),
    });
  }

  log.info({ source: source.name, count: articles.length }, `Got ${articles.length} articles from ${source.name}`);
  return articles;
}

export async function scrapeAllSources(
  sources: ScienceSource[]
): Promise<ScrapedArticle[]> {
  const allArticles: ScrapedArticle[] = [];

  for (const source of sources) {
    const result = await safeAsync(() => scrapeSource(source));
    if (result.ok) {
      allArticles.push(...result.value);
    } else {
      log.error({ source: source.name, err: result.error }, `Error scraping ${source.name}`);
    }
  }

  return allArticles;
}
