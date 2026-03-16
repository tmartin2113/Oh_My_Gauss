import { ScrapedArticle } from "./firecrawl.js";

const BASE_URL = "http://export.arxiv.org/api/query";

export interface ArxivQuery {
  searchQuery: string;
  field: string;
  maxResults?: number;
  category?: string;
  submittedDateRange?: { from: string; to: string }; // format: YYYYMMDDTTTT (GMT)
}

export const ARXIV_QUERIES: ArxivQuery[] = [
  // Nanotechnology
  { searchQuery: "nanotechnology nanomaterials", field: "nanotechnology", category: "cond-mat.mtrl-sci", maxResults: 10 },

  // Physics
  { searchQuery: "quantum computing", field: "physics", category: "quant-ph", maxResults: 15 },
  { searchQuery: "general relativity", field: "physics", category: "gr-qc", maxResults: 10 },
  { searchQuery: "condensed matter", field: "physics", category: "cond-mat", maxResults: 10 },
  { searchQuery: "high energy physics", field: "physics", category: "hep-ph", maxResults: 10 },

  // Earth
  { searchQuery: "earth science geophysics climate", field: "earth", category: "physics.geo-ph", maxResults: 10 },
  { searchQuery: "atmospheric science", field: "earth", category: "physics.ao-ph", maxResults: 10 },

  // Astronomy & Space
  { searchQuery: "astrophysics cosmology", field: "astronomy_space", category: "astro-ph", maxResults: 15 },
  { searchQuery: "exoplanets stellar evolution", field: "astronomy_space", category: "astro-ph.EP", maxResults: 10 },
  { searchQuery: "gravitational waves", field: "astronomy_space", category: "gr-qc", maxResults: 10 },

  // Chemistry
  { searchQuery: "chemical physics molecular", field: "chemistry", category: "physics.chem-ph", maxResults: 10 },

  // Biology
  { searchQuery: "computational biology genomics", field: "biology", category: "q-bio", maxResults: 15 },
  { searchQuery: "biophysics molecular biology", field: "biology", category: "q-bio.BM", maxResults: 10 },

  // Materials Science
  { searchQuery: "materials science", field: "materials_science", category: "cond-mat.mtrl-sci", maxResults: 15 },
  { searchQuery: "superconductivity topological materials", field: "materials_science", category: "cond-mat.supr-con", maxResults: 10 },
];

function parseAtomXml(xml: string): Array<{
  title: string;
  summary: string;
  authors: string[];
  id: string;
  published: string;
  category: string;
  pdfLink: string;
}> {
  const entries: Array<{
    title: string;
    summary: string;
    authors: string[];
    id: string;
    published: string;
    category: string;
    pdfLink: string;
  }> = [];

  const entryRegex = /<entry>([\s\S]*?)<\/entry>/g;
  let match;

  while ((match = entryRegex.exec(xml)) !== null) {
    const entry = match[1];

    const title = extractTag(entry, "title")?.replace(/\s+/g, " ").trim() || "";
    const summary = extractTag(entry, "summary")?.replace(/\s+/g, " ").trim() || "";
    const id = extractTag(entry, "id") || "";
    const published = extractTag(entry, "published") || "";

    const authors: string[] = [];
    const authorRegex = /<author>\s*<name>([\s\S]*?)<\/name>/g;
    let authorMatch;
    while ((authorMatch = authorRegex.exec(entry)) !== null) {
      authors.push(authorMatch[1].trim());
    }

    const categoryMatch = entry.match(/<arxiv:primary_category[^>]*term="([^"]+)"/);
    const category = categoryMatch ? categoryMatch[1] : "";

    const pdfMatch = entry.match(/<link[^>]*title="pdf"[^>]*href="([^"]+)"/);
    const pdfLink = pdfMatch ? pdfMatch[1] : "";

    if (title && summary) {
      entries.push({ title, summary, authors, id, published, category, pdfLink });
    }
  }

  return entries;
}

function extractTag(xml: string, tag: string): string | null {
  const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`);
  const match = xml.match(regex);
  return match ? match[1] : null;
}

export async function searchArxiv(
  query: ArxivQuery
): Promise<ScrapedArticle[]> {
  const maxResults = query.maxResults || 15;

  let searchTerms = query.category
    ? `cat:${query.category}+AND+all:${encodeURIComponent(query.searchQuery)}`
    : `all:${encodeURIComponent(query.searchQuery)}`;

  if (query.submittedDateRange) {
    searchTerms += `+AND+submittedDate:[${query.submittedDateRange.from}+TO+${query.submittedDateRange.to}]`;
  }

  const url = `${BASE_URL}?search_query=${searchTerms}&start=0&max_results=${maxResults}&sortBy=submittedDate&sortOrder=descending`;

  console.log(`  Searching arXiv: "${query.searchQuery}" (${query.category || "all"})...`);

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`arXiv API error: ${response.status} ${response.statusText}`);
  }

  const xml = await response.text();
  const entries = parseAtomXml(xml);

  const articles: ScrapedArticle[] = entries.map((entry) => {
    const authors = entry.authors.join(", ");
    const pdfNote = entry.pdfLink ? `\n\nPDF: ${entry.pdfLink}` : "";

    const markdown = `# ${entry.title}\n\n**Authors:** ${authors}\n**Published:** ${entry.published}\n**Category:** ${entry.category}\n**arXiv ID:** ${entry.id}\n\n## Abstract\n\n${entry.summary}${pdfNote}`;

    return {
      url: entry.id,
      title: entry.title,
      markdown,
      field: query.field,
      sourceName: "arXiv",
      scrapedAt: new Date().toISOString(),
    };
  });

  console.log(`  Got ${articles.length} papers from arXiv for "${query.searchQuery}"`);
  return articles;
}

export async function searchAllArxivQueries(
  queries: ArxivQuery[]
): Promise<ScrapedArticle[]> {
  const allArticles: ScrapedArticle[] = [];

  for (const query of queries) {
    try {
      const articles = await searchArxiv(query);
      allArticles.push(...articles);
      // arXiv asks for 3-second courtesy delay between requests
      await new Promise((r) => setTimeout(r, 3000));
    } catch (error) {
      console.error(
        `  Error searching arXiv for "${query.searchQuery}":`,
        error instanceof Error ? error.message : error
      );
    }
  }

  return allArticles;
}
