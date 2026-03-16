import "dotenv/config";
import * as readline from "readline";
import { SCIENCE_SOURCES } from "./scraper/sources.js";
import { scrapeAllSources } from "./scraper/firecrawl.js";
import { chunkArticles } from "./scraper/chunker.js";
import { addDocuments, getCollectionStats } from "./vectorstore/chroma.js";
import { askTutor, ConversationMessage } from "./tutor/chat.js";

async function runScrape(): Promise<void> {
  console.log("=== Oh My Gauss — Science Scraper ===\n");
  console.log(`Scraping ${SCIENCE_SOURCES.length} sources...\n`);

  const articles = await scrapeAllSources(SCIENCE_SOURCES);
  console.log(`\nTotal articles scraped: ${articles.length}\n`);

  if (articles.length === 0) {
    console.log("No articles found. Check your FIRECRAWL_API_KEY and sources.");
    return;
  }

  const chunks = chunkArticles(articles);
  console.log(`\nStoring ${chunks.length} chunks in ChromaDB...\n`);

  await addDocuments(chunks);

  const stats = await getCollectionStats();
  console.log(`\nDone! ChromaDB now has ${stats.count} documents.`);
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

const mode = process.argv[2];

if (mode === "scrape") {
  runScrape().catch(console.error);
} else if (mode === "chat") {
  runChat().catch(console.error);
} else {
  console.log("Oh My Gauss — Science Tutor\n");
  console.log("Usage:");
  console.log("  npm run scrape   Scrape science websites and build knowledge base");
  console.log("  npm run chat     Start interactive science tutor chatbot");
}
