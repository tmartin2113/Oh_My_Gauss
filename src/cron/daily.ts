import "dotenv/config";
import { searchAllPaperQueries, type SemanticScholarQuery } from "../scraper/semanticscholar.js";
import { searchAllArxivQueries, type ArxivQuery } from "../scraper/arxiv.js";
import { chunkArticles } from "../scraper/chunker.js";
import { addDocuments, getCollectionStats } from "../vectorstore/index.js";
import { SCIENCE_FIELDS, type ScienceField } from "../scraper/sources.js";

// ── Configuration ──────────────────────────────────────────────────
// Set CRON_FIELDS env var to comma-separated fields to limit categories.
// Default: all fields.
// Example: CRON_FIELDS=physics,biology,astronomy_space

const enabledFields = getEnabledFields();

function getEnabledFields(): Set<ScienceField> {
  const envFields = process.env.CRON_FIELDS;
  if (envFields) {
    const requested = envFields.split(",").map((f) => f.trim()) as ScienceField[];
    const valid = requested.filter((f) =>
      (SCIENCE_FIELDS as readonly string[]).includes(f)
    );
    if (valid.length === 0) {
      console.error(`No valid fields in CRON_FIELDS="${envFields}"`);
      console.error(`Valid fields: ${SCIENCE_FIELDS.join(", ")}`);
      process.exit(1);
    }
    return new Set(valid);
  }
  return new Set(SCIENCE_FIELDS);
}

// ── Date helpers ───────────────────────────────────────────────────

function getLast24hDates(): { s2Range: string; arxivFrom: string; arxivTo: string } {
  const now = new Date();
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  // Semantic Scholar: YYYY-MM-DD:YYYY-MM-DD
  const s2From = yesterday.toISOString().slice(0, 10);
  const s2To = now.toISOString().slice(0, 10);
  const s2Range = `${s2From}:${s2To}`;

  // arXiv: YYYYMMDDTTTT (GMT)
  const pad = (n: number) => String(n).padStart(2, "0");
  const arxivFrom = `${yesterday.getUTCFullYear()}${pad(yesterday.getUTCMonth() + 1)}${pad(yesterday.getUTCDate())}0000`;
  const arxivTo = `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}2359`;

  return { s2Range, arxivFrom, arxivTo };
}

// ── Semantic Scholar daily queries ─────────────────────────────────

const S2_DAILY_QUERIES: Record<ScienceField, string[]> = {
  nanotechnology: ["nanotechnology nanomaterials", "nanoparticles graphene"],
  physics: ["quantum physics", "condensed matter", "particle physics"],
  earth: ["climate change geology", "seismology earth science"],
  astronomy_space: ["astrophysics cosmology", "exoplanets", "gravitational waves"],
  chemistry: ["organic chemistry synthesis", "computational chemistry"],
  biology: ["molecular biology CRISPR", "neuroscience cognition", "ecology biodiversity"],
  materials_science: ["materials science polymers", "semiconductor photovoltaics"],
};

// ── arXiv daily queries ────────────────────────────────────────────

const ARXIV_DAILY_CATEGORIES: Record<ScienceField, string[]> = {
  nanotechnology: ["cond-mat.mtrl-sci"],
  physics: ["quant-ph", "hep-ph", "cond-mat"],
  earth: ["physics.geo-ph", "physics.ao-ph"],
  astronomy_space: ["astro-ph", "gr-qc"],
  chemistry: ["physics.chem-ph"],
  biology: ["q-bio"],
  materials_science: ["cond-mat.mtrl-sci", "cond-mat.supr-con"],
};

// ── Main ───────────────────────────────────────────────────────────

async function runDailyScrape(): Promise<void> {
  const startTime = Date.now();
  const dates = getLast24hDates();
  const fields = [...enabledFields];

  console.log("=== Oh My Gauss — Daily Paper Cron ===");
  console.log(`Date range: last 24 hours`);
  console.log(`Fields: ${fields.join(", ")}\n`);

  // Build Semantic Scholar queries for enabled fields
  const s2Queries: SemanticScholarQuery[] = [];
  for (const field of fields) {
    const queryStrings = S2_DAILY_QUERIES[field] || [];
    for (const query of queryStrings) {
      s2Queries.push({
        query,
        field,
        maxResults: 10,
        publicationDateRange: dates.s2Range,
      });
    }
  }

  // Build arXiv queries for enabled fields
  const arxivQueries: ArxivQuery[] = [];
  for (const field of fields) {
    const categories = ARXIV_DAILY_CATEGORIES[field] || [];
    for (const category of categories) {
      arxivQueries.push({
        searchQuery: field.replace("_", " "),
        field,
        maxResults: 10,
        category,
        submittedDateRange: { from: dates.arxivFrom, to: dates.arxivTo },
      });
    }
  }

  console.log(`[Semantic Scholar] ${s2Queries.length} queries`);
  const s2Articles = await searchAllPaperQueries(s2Queries);
  console.log(`  Total: ${s2Articles.length} papers\n`);

  console.log(`[arXiv] ${arxivQueries.length} queries`);
  const arxivArticles = await searchAllArxivQueries(arxivQueries);
  console.log(`  Total: ${arxivArticles.length} papers\n`);

  const allArticles = [...s2Articles, ...arxivArticles];

  if (allArticles.length === 0) {
    console.log("No new papers found in the last 24 hours.");
    return;
  }

  const chunks = chunkArticles(allArticles);
  console.log(`Storing ${chunks.length} chunks in ChromaDB...\n`);
  await addDocuments(chunks);

  const stats = await getCollectionStats();
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log(`\nDone in ${elapsed}s!`);
  console.log(`  New papers: ${allArticles.length}`);
  console.log(`  New chunks: ${chunks.length}`);
  console.log(`  Total in knowledge base: ${stats.count}`);
}

runDailyScrape().catch((error) => {
  console.error("Daily scrape failed:", error);
  process.exit(1);
});
