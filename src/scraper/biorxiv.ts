import { ScrapedArticle } from "./firecrawl.js";
import type { ScienceField } from "./sources.js";
import { createLogger } from "../util/logger.js";
import { resilientFetch } from "../util/resilientFetch.js";
import { CircuitBreaker } from "../util/circuitBreaker.js";
import { safeAsync } from "../util/errors.js";

const log = createLogger("biorxiv");
const breaker = new CircuitBreaker("biorxiv", { threshold: 3, resetTimeoutMs: 60_000 });

const BASE_URL = "https://api.biorxiv.org/details/biorxiv";

export interface BioRxivQuery {
  field: string;
  category?: string; // bioRxiv category (e.g. "neuroscience", "genomics")
  maxResults?: number;
  dateRange?: { from: string; to: string }; // YYYY-MM-DD format
}

interface BioRxivPaper {
  doi: string;
  title: string;
  authors: string;
  author_corresponding: string;
  date: string;
  version: string;
  category: string;
  abstract: string;
}

interface BioRxivResponse {
  messages: { status: string; count: number; total: number }[];
  collection: BioRxivPaper[];
}

// bioRxiv categories mapped to our science fields
const CATEGORY_TO_FIELD: Record<string, ScienceField> = {
  neuroscience: "biology",
  "cell-biology": "biology",
  genetics: "biology",
  genomics: "biology",
  "evolutionary-biology": "biology",
  zoology: "biology",
  "plant-biology": "biology",
  "developmental-biology": "biology",
  microbiology: "biology",
  "molecular-biology": "biology",
  immunology: "biology",
  "cancer-biology": "biology",
  "systems-biology": "biology",
  ecology: "biology",
  biochemistry: "chemistry",
  pharmacology: "chemistry",
  bioengineering: "nanotechnology",
  "synthetic-biology": "nanotechnology",
  biophysics: "materials_science",
  bioinformatics: "biology",
  pathology: "biology",
  physiology: "biology",
  "animal-behavior": "biology",
};

// Default queries for the CLI `papers` command
export const BIORXIV_QUERIES: BioRxivQuery[] = [
  { field: "biology", category: "neuroscience", maxResults: 10 },
  { field: "biology", category: "genomics", maxResults: 10 },
  { field: "biology", category: "cell-biology", maxResults: 10 },
  { field: "biology", category: "evolutionary-biology", maxResults: 10 },
  { field: "chemistry", category: "biochemistry", maxResults: 10 },
  { field: "nanotechnology", category: "bioengineering", maxResults: 10 },
  { field: "materials_science", category: "biophysics", maxResults: 10 },
];

// Categories to fetch per field in the daily cron
export const BIORXIV_DAILY_CATEGORIES: Record<ScienceField, string[]> = {
  nanotechnology: ["bioengineering", "synthetic-biology"],
  physics: [],
  earth: [],
  astronomy_space: [],
  chemistry: ["biochemistry", "pharmacology"],
  biology: ["neuroscience", "genomics", "cell-biology", "genetics", "evolutionary-biology", "ecology", "molecular-biology"],
  materials_science: ["biophysics"],
};

function getDefaultDateRange(): { from: string; to: string } {
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  return {
    from: weekAgo.toISOString().slice(0, 10),
    to: now.toISOString().slice(0, 10),
  };
}

export async function searchBioRxiv(
  query: BioRxivQuery
): Promise<ScrapedArticle[]> {
  const maxResults = query.maxResults || 10;
  const dateRange = query.dateRange || getDefaultDateRange();
  const articles: ScrapedArticle[] = [];
  let cursor = 0;

  log.info({ category: query.category, dateRange }, `Searching bioRxiv: ${query.category || "all"} (${dateRange.from} to ${dateRange.to})`);

  while (articles.length < maxResults) {
    const url = `${BASE_URL}/${dateRange.from}/${dateRange.to}/${cursor}/json`;

    const response = await resilientFetch(url, { service: "bioRxiv", timeoutMs: 15_000, retries: 3, circuitBreaker: breaker });

    const data = (await response.json()) as BioRxivResponse;

    if (!data.collection || data.collection.length === 0) {
      break;
    }

    for (const paper of data.collection) {
      if (articles.length >= maxResults) break;

      // Filter by category if specified
      if (query.category && paper.category !== query.category) {
        continue;
      }

      if (!paper.abstract || paper.abstract.trim() === "") {
        continue;
      }

      const doiUrl = `https://doi.org/${paper.doi}`;
      const markdown = `# ${paper.title}\n\n**Authors:** ${paper.authors}\n**Date:** ${paper.date}\n**Category:** ${paper.category}\n**DOI:** ${doiUrl}\n\n## Abstract\n\n${paper.abstract}`;

      articles.push({
        url: doiUrl,
        title: paper.title,
        markdown,
        field: query.field || CATEGORY_TO_FIELD[paper.category] || "biology",
        sourceName: "bioRxiv",
        scrapedAt: new Date().toISOString(),
      });
    }

    // bioRxiv returns 100 per page; if we got fewer, we've exhausted results
    if (data.collection.length < 100) {
      break;
    }

    cursor += 100;

    // Courtesy delay between paginated requests
    await new Promise((r) => setTimeout(r, 1000));
  }

  log.info({ category: query.category, count: articles.length }, `Got ${articles.length} papers from bioRxiv for "${query.category || "all"}"`);
  return articles;
}

export async function searchAllBioRxivQueries(
  queries: BioRxivQuery[]
): Promise<ScrapedArticle[]> {
  const allArticles: ScrapedArticle[] = [];

  for (const query of queries) {
    const result = await safeAsync(() => searchBioRxiv(query));
    if (result.ok) {
      allArticles.push(...result.value);
    } else {
      log.error({ category: query.category, err: result.error }, `Error searching bioRxiv for "${query.category || "all"}"`);
    }
    // Courtesy delay between queries
    await new Promise((r) => setTimeout(r, 1000));
  }

  return allArticles;
}
