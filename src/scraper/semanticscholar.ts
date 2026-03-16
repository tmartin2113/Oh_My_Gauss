import { ScrapedArticle } from "./firecrawl.js";

const BASE_URL = "https://api.semanticscholar.org/graph/v1";
const FIELDS = "title,abstract,url,year,authors,publicationDate,openAccessPdf,publicationTypes";

export interface SemanticScholarQuery {
  query: string;
  field: string;
  maxResults?: number;
  publicationDateRange?: string; // e.g. "2026-03-15:2026-03-16" for last 24h
}

interface S2Paper {
  paperId: string;
  title: string;
  abstract: string | null;
  url: string;
  year: number | null;
  authors: { name: string }[];
  publicationDate: string | null;
  openAccessPdf: { url: string } | null;
  publicationTypes: string[] | null;
}

interface S2SearchResponse {
  total: number;
  data: S2Paper[];
  token?: string;
}

export const SEMANTIC_SCHOLAR_QUERIES: SemanticScholarQuery[] = [
  // Nanotechnology
  { query: "nanotechnology nanomaterials nanoparticles", field: "nanotechnology", maxResults: 15 },
  { query: "carbon nanotubes graphene nanoscale", field: "nanotechnology", maxResults: 10 },

  // Physics
  { query: "quantum mechanics recent discoveries", field: "physics", maxResults: 15 },
  { query: "particle physics standard model", field: "physics", maxResults: 10 },
  { query: "condensed matter superconductivity", field: "physics", maxResults: 10 },

  // Earth
  { query: "climate change earth systems geology", field: "earth", maxResults: 15 },
  { query: "seismology plate tectonics volcanology", field: "earth", maxResults: 10 },

  // Astronomy & Space
  { query: "astrophysics black holes neutron stars", field: "astronomy_space", maxResults: 15 },
  { query: "exoplanets cosmology dark matter dark energy", field: "astronomy_space", maxResults: 15 },
  { query: "gravitational waves space exploration", field: "astronomy_space", maxResults: 10 },

  // Chemistry
  { query: "organic chemistry catalysis synthesis", field: "chemistry", maxResults: 15 },
  { query: "computational chemistry molecular dynamics", field: "chemistry", maxResults: 10 },

  // Materials Science
  { query: "materials science polymers ceramics composites", field: "materials_science", maxResults: 15 },
  { query: "semiconductor materials photovoltaics", field: "materials_science", maxResults: 10 },

  // Biology
  { query: "molecular biology gene editing CRISPR", field: "biology", maxResults: 15 },
  { query: "neuroscience brain cognition", field: "biology", maxResults: 10 },
  { query: "evolutionary biology ecology biodiversity", field: "biology", maxResults: 10 },
];

async function fetchWithRetry(url: string, retries = 3): Promise<Response> {
  for (let attempt = 0; attempt < retries; attempt++) {
    const response = await fetch(url);

    if (response.status === 429) {
      // Rate limited — wait and retry
      const waitMs = Math.pow(2, attempt + 1) * 1000;
      console.log(`  Rate limited, waiting ${waitMs / 1000}s...`);
      await new Promise((r) => setTimeout(r, waitMs));
      continue;
    }

    if (!response.ok) {
      throw new Error(`S2 API error: ${response.status} ${response.statusText}`);
    }

    return response;
  }
  throw new Error("S2 API: max retries exceeded");
}

export async function searchPapers(
  query: SemanticScholarQuery
): Promise<ScrapedArticle[]> {
  const maxResults = query.maxResults || 20;
  let url = `${BASE_URL}/paper/search?query=${encodeURIComponent(query.query)}&limit=${maxResults}&fields=${FIELDS}`;
  if (query.publicationDateRange) {
    url += `&publicationDateOrYear=${encodeURIComponent(query.publicationDateRange)}`;
  }

  console.log(`  Searching Semantic Scholar: "${query.query}"...`);

  const response = await fetchWithRetry(url);
  const data = (await response.json()) as S2SearchResponse;

  const articles: ScrapedArticle[] = [];

  if (!data.data || data.data.length === 0) {
    console.log(`  No papers found for "${query.query}"`);
    return articles;
  }

  for (const paper of data.data) {
    if (!paper.abstract) continue;

    const authors = paper.authors.map((a) => a.name).join(", ");
    const pdfLink = paper.openAccessPdf?.url
      ? `\n\nOpen Access PDF: ${paper.openAccessPdf.url}`
      : "";

    const markdown = `# ${paper.title}\n\n**Authors:** ${authors}\n**Year:** ${paper.year || "N/A"}\n**Published:** ${paper.publicationDate || "N/A"}\n\n## Abstract\n\n${paper.abstract}${pdfLink}`;

    articles.push({
      url: paper.url,
      title: paper.title,
      markdown,
      field: query.field,
      sourceName: "Semantic Scholar",
      scrapedAt: new Date().toISOString(),
    });
  }

  console.log(`  Got ${articles.length} papers for "${query.query}"`);
  return articles;
}

export async function searchAllPaperQueries(
  queries: SemanticScholarQuery[]
): Promise<ScrapedArticle[]> {
  const allArticles: ScrapedArticle[] = [];

  for (const query of queries) {
    try {
      const articles = await searchPapers(query);
      allArticles.push(...articles);
      // Respect rate limit: 100 req / 5 min ≈ 1 req / 3s
      await new Promise((r) => setTimeout(r, 3000));
    } catch (error) {
      console.error(
        `  Error searching S2 for "${query.query}":`,
        error instanceof Error ? error.message : error
      );
    }
  }

  return allArticles;
}
