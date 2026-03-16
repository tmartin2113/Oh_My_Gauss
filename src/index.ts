import "dotenv/config";
import * as readline from "readline";
import { SCIENCE_SOURCES } from "./scraper/sources.js";
import { scrapeAllSources } from "./scraper/firecrawl.js";
import { chunkArticles } from "./scraper/chunker.js";
import { addDocuments, getCollectionStats } from "./vectorstore/index.js";
import { askTutor, ConversationMessage } from "./tutor/chat.js";
import { SEMANTIC_SCHOLAR_QUERIES, searchAllPaperQueries } from "./scraper/semanticscholar.js";
import { ARXIV_QUERIES, searchAllArxivQueries } from "./scraper/arxiv.js";

async function runScrape(): Promise<void> {
  console.log("=== Oh My Gauss — Science Scraper ===\n");

  // Phase 1: Free APIs first (no tokens/credits used)
  console.log("Phase 1: Research papers (free APIs)\n");

  console.log("[Semantic Scholar]");
  const s2Articles = await searchAllPaperQueries(SEMANTIC_SCHOLAR_QUERIES);
  console.log(`  Total from Semantic Scholar: ${s2Articles.length}\n`);

  console.log("[arXiv]");
  const arxivArticles = await searchAllArxivQueries(ARXIV_QUERIES);
  console.log(`  Total from arXiv: ${arxivArticles.length}\n`);

  const paperChunks = chunkArticles([...s2Articles, ...arxivArticles]);
  if (paperChunks.length > 0) {
    console.log(`Storing ${paperChunks.length} paper chunks in ChromaDB...\n`);
    await addDocuments(paperChunks);
  }

  // Phase 2: Firecrawl (uses credits)
  console.log("Phase 2: Science websites (Firecrawl — uses credits)\n");
  console.log(`Scraping ${SCIENCE_SOURCES.length} sources...\n`);

  const articles = await scrapeAllSources(SCIENCE_SOURCES);
  console.log(`\nTotal articles scraped: ${articles.length}\n`);

  if (articles.length > 0) {
    const webChunks = chunkArticles(articles);
    console.log(`Storing ${webChunks.length} web article chunks in ChromaDB...\n`);
    await addDocuments(webChunks);
  }

  const stats = await getCollectionStats();
  console.log(`\nDone! ChromaDB now has ${stats.count} documents total.`);
}

async function runChat(): Promise<void> {
  console.log("=== Oh My Gauss — Science Tutor ===");
  console.log('Ask any science question! Type "quit" to exit.\n');

  try {
    const stats = await getCollectionStats();
    console.log(`Knowledge base: ${stats.count} document chunks loaded.\n`);
  } catch {
    console.log(
      "Warning: Could not connect to ChromaDB. Run `npm run scrape` first.\n"
    );
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const history: ConversationMessage[] = [];

  const askQuestion = (): void => {
    rl.question("You: ", async (input) => {
      const question = input.trim();

      if (!question) {
        askQuestion();
        return;
      }

      if (question.toLowerCase() === "quit") {
        console.log("\nGoodbye! Keep exploring science!");
        rl.close();
        return;
      }

      try {
        process.stdout.write("\nOh My Gauss: ");
        const { answer, sources } = await askTutor(question, history);
        console.log(answer);

        if (sources.length > 0) {
          console.log("\n📚 Sources:");
          const uniqueUrls = new Set<string>();
          for (const src of sources) {
            if (!uniqueUrls.has(src.url)) {
              uniqueUrls.add(src.url);
              console.log(`  - ${src.title} (${src.url})`);
            }
          }
        }

        // Keep conversation history (last 10 exchanges)
        history.push({ role: "user", content: question });
        history.push({ role: "assistant", content: answer });
        if (history.length > 20) {
          history.splice(0, 2);
        }
      } catch (error) {
        console.error(
          "\nError:",
          error instanceof Error ? error.message : error
        );
      }

      console.log();
      askQuestion();
    });
  };

  askQuestion();
}

async function runPapersOnly(): Promise<void> {
  console.log("=== Oh My Gauss — Research Paper Scraper (Free) ===\n");

  console.log("[Semantic Scholar]");
  const s2Articles = await searchAllPaperQueries(SEMANTIC_SCHOLAR_QUERIES);
  console.log(`  Total from Semantic Scholar: ${s2Articles.length}\n`);

  console.log("[arXiv]");
  const arxivArticles = await searchAllArxivQueries(ARXIV_QUERIES);
  console.log(`  Total from arXiv: ${arxivArticles.length}\n`);

  const allArticles = [...s2Articles, ...arxivArticles];
  if (allArticles.length === 0) {
    console.log("No papers found.");
    return;
  }

  const chunks = chunkArticles(allArticles);
  console.log(`Storing ${chunks.length} paper chunks in ChromaDB...\n`);
  await addDocuments(chunks);

  const stats = await getCollectionStats();
  console.log(`\nDone! ChromaDB now has ${stats.count} documents total.`);
}

const mode = process.argv[2];

if (mode === "scrape") {
  runScrape().catch(console.error);
} else if (mode === "papers") {
  runPapersOnly().catch(console.error);
} else if (mode === "chat") {
  runChat().catch(console.error);
} else {
  console.log("Oh My Gauss — Science Tutor\n");
  console.log("Usage:");
  console.log("  npm run papers   Fetch research papers only (free, no API credits)");
  console.log("  npm run scrape   Fetch papers + scrape websites (uses Firecrawl credits)");
  console.log("  npm run chat     Start interactive science tutor chatbot");
  console.log("  npm run mcp      Start MCP server for Claude integration");
}
