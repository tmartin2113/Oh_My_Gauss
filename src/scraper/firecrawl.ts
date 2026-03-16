import FirecrawlApp from "@mendable/firecrawl-js";
import { ScienceSource } from "./sources.js";

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
  console.log(`  Crawling ${source.name} (${source.url})...`);

  const crawlResult = await client.crawlUrl(source.url, {
    limit: source.maxPages,
    scrapeOptions: {
      formats: ["markdown"],
    },
  });

  if (!crawlResult.success) {
    console.error(`  Failed to crawl ${source.name}: ${crawlResult.error}`);
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

  console.log(`  Got ${articles.length} articles from ${source.name}`);
  return articles;
}

export async function scrapeAllSources(
  sources: ScienceSource[]
): Promise<ScrapedArticle[]> {
  const allArticles: ScrapedArticle[] = [];

  for (const source of sources) {
    try {
      const articles = await scrapeSource(source);
      allArticles.push(...articles);
    } catch (error) {
      console.error(
        `  Error scraping ${source.name}:`,
        error instanceof Error ? error.message : error
      );
    }
  }

  return allArticles;
}
