import { ScrapedArticle } from "./firecrawl.js";
import { createLogger } from "../util/logger.js";

const log = createLogger("chunker");

export interface DocumentChunk {
  id: string;
  text: string;
  metadata: {
    url: string;
    title: string;
    field: string;
    sourceName: string;
    scrapedAt: string;
    chunkIndex: number;
  };
}

const TARGET_CHUNK_SIZE = 1500; // ~500 tokens ≈ ~1500 characters
const CHUNK_OVERLAP = 200;

export function chunkArticle(article: ScrapedArticle): DocumentChunk[] {
  const cleaned = cleanMarkdown(article.markdown);
  const sections = splitBySections(cleaned);
  const chunks: DocumentChunk[] = [];
  let chunkIndex = 0;

  for (const section of sections) {
    if (section.length <= TARGET_CHUNK_SIZE) {
      if (section.trim().length > 50) {
        chunks.push(makeChunk(article, section.trim(), chunkIndex++));
      }
    } else {
      const subChunks = splitBySize(section, TARGET_CHUNK_SIZE, CHUNK_OVERLAP);
      for (const sub of subChunks) {
        if (sub.trim().length > 50) {
          chunks.push(makeChunk(article, sub.trim(), chunkIndex++));
        }
      }
    }
  }

  return chunks;
}

function makeChunk(
  article: ScrapedArticle,
  text: string,
  chunkIndex: number
): DocumentChunk {
  const urlSlug = article.url.replace(/[^a-zA-Z0-9]/g, "_").slice(0, 80);
  return {
    id: `${urlSlug}_chunk_${chunkIndex}`,
    text,
    metadata: {
      url: article.url,
      title: article.title,
      field: article.field,
      sourceName: article.sourceName,
      scrapedAt: article.scrapedAt,
      chunkIndex,
    },
  };
}

function cleanMarkdown(markdown: string): string {
  return (
    markdown
      // Remove image references
      .replace(/!\[.*?\]\(.*?\)/g, "")
      // Remove excessive whitespace
      .replace(/\n{3,}/g, "\n\n")
      .trim()
  );
}

function splitBySections(text: string): string[] {
  // Split by markdown headings
  const sections = text.split(/\n(?=#{1,3}\s)/);
  return sections.filter((s) => s.trim().length > 0);
}

function splitBySize(
  text: string,
  maxSize: number,
  overlap: number
): string[] {
  const chunks: string[] = [];
  const paragraphs = text.split(/\n\n/);
  let current = "";

  for (const para of paragraphs) {
    if (current.length + para.length > maxSize && current.length > 0) {
      chunks.push(current);
      // Keep overlap from the end of the current chunk
      const overlapText = current.slice(-overlap);
      current = overlapText + "\n\n" + para;
    } else {
      current = current ? current + "\n\n" + para : para;
    }
  }

  if (current.trim().length > 0) {
    chunks.push(current);
  }

  return chunks;
}

export function chunkArticles(articles: ScrapedArticle[]): DocumentChunk[] {
  const allChunks: DocumentChunk[] = [];
  for (const article of articles) {
    allChunks.push(...chunkArticle(article));
  }
  log.info(
    { articles: articles.length, chunks: allChunks.length },
    "Chunked articles into chunks"
  );
  return allChunks;
}
