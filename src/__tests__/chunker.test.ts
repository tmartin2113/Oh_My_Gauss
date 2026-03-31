import { describe, it, expect } from "vitest";
import { chunkArticle, chunkArticles, DocumentChunk } from "../scraper/chunker.js";
import type { ScrapedArticle } from "../scraper/firecrawl.js";

function makeArticle(overrides: Partial<ScrapedArticle> = {}): ScrapedArticle {
  return {
    url: "https://example.com/test-article",
    title: "Test Article",
    markdown: "This is a test article with enough content to pass the minimum length filter easily.",
    field: "physics",
    sourceName: "TestSource",
    scrapedAt: "2026-03-30T00:00:00Z",
    ...overrides,
  };
}

describe("chunkArticle", () => {
  it("produces a single chunk from a short article", () => {
    const article = makeArticle({
      markdown: "This is a short article body that is well under the target chunk size but long enough to pass the minimum length filter.",
    });
    const chunks = chunkArticle(article);
    expect(chunks.length).toBe(1);
    expect(chunks[0].text).toContain("short article body");
  });

  it("splits long text into multiple chunks with overlap", () => {
    // Build text significantly longer than TARGET_CHUNK_SIZE (1500 chars)
    const paragraph = "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. ";
    const longMarkdown = Array(50).fill(paragraph).join("\n\n");
    const article = makeArticle({ markdown: longMarkdown });
    const chunks = chunkArticle(article);

    expect(chunks.length).toBeGreaterThan(1);

    // Check overlap: the end of one chunk should appear at the start of the next
    for (let i = 0; i < chunks.length - 1; i++) {
      const endOfCurrent = chunks[i].text.slice(-100);
      // The overlap region should appear near the beginning of the next chunk
      expect(chunks[i + 1].text).toContain(endOfCurrent.trim().slice(0, 50));
    }
  });

  it("generates unique chunk IDs that contain URL slug", () => {
    const paragraph = "A meaningful paragraph with enough length to be kept. ";
    const longMarkdown = Array(50).fill(paragraph).join("\n\n");
    const article = makeArticle({
      url: "https://example.com/my-paper",
      markdown: longMarkdown,
    });
    const chunks = chunkArticle(article);

    const ids = chunks.map((c) => c.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);

    for (const id of ids) {
      expect(id).toContain("example_com_my_paper");
      expect(id).toMatch(/_chunk_\d+$/);
    }
  });

  it("filters out chunks shorter than 50 chars", () => {
    const article = makeArticle({
      markdown: "Short.\n\n\n\nAnother very short bit.\n\n\n\nThis paragraph is long enough to survive the fifty-character minimum filter threshold easily.",
    });
    const chunks = chunkArticle(article);

    for (const chunk of chunks) {
      expect(chunk.text.length).toBeGreaterThan(50);
    }
  });

  it("preserves metadata correctly", () => {
    const article = makeArticle({
      url: "https://example.com/paper-1",
      title: "My Paper Title",
      field: "chemistry",
      sourceName: "ChemWorld",
      scrapedAt: "2026-01-15T12:00:00Z",
    });
    const chunks = chunkArticle(article);
    expect(chunks.length).toBeGreaterThan(0);

    const meta = chunks[0].metadata;
    expect(meta.url).toBe("https://example.com/paper-1");
    expect(meta.title).toBe("My Paper Title");
    expect(meta.field).toBe("chemistry");
    expect(meta.sourceName).toBe("ChemWorld");
    expect(meta.scrapedAt).toBe("2026-01-15T12:00:00Z");
    expect(meta.chunkIndex).toBe(0);
  });

  it("splits on markdown headings", () => {
    const markdown = [
      "Introduction paragraph that is definitely long enough to pass the minimum length filter for chunks.",
      "## Methods",
      "Methods paragraph that is definitely long enough to pass the minimum length filter for chunks as well.",
      "## Results",
      "Results paragraph that is definitely long enough to pass the minimum length filter for chunks too yes.",
    ].join("\n");

    const article = makeArticle({ markdown });
    const chunks = chunkArticle(article);

    // Should have at least 3 sections (intro, methods, results)
    expect(chunks.length).toBeGreaterThanOrEqual(3);

    const texts = chunks.map((c) => c.text);
    expect(texts.some((t) => t.includes("Introduction"))).toBe(true);
    expect(texts.some((t) => t.includes("## Methods"))).toBe(true);
    expect(texts.some((t) => t.includes("## Results"))).toBe(true);
  });

  it("cleans image references from markdown", () => {
    const markdown =
      "This is a paragraph with an image ![alt text](https://example.com/image.png) embedded in the middle and enough text to be over fifty characters.";
    const article = makeArticle({ markdown });
    const chunks = chunkArticle(article);

    for (const chunk of chunks) {
      expect(chunk.text).not.toContain("![");
      expect(chunk.text).not.toContain("image.png");
    }
  });
});

describe("chunkArticles", () => {
  it("handles multiple articles and combines chunks", () => {
    const articles = [
      makeArticle({
        url: "https://example.com/article-1",
        title: "Article One",
        markdown: "First article content that is long enough to pass the minimum chunk length filter requirement.",
      }),
      makeArticle({
        url: "https://example.com/article-2",
        title: "Article Two",
        markdown: "Second article content that is long enough to pass the minimum chunk length filter requirement.",
      }),
    ];

    const chunks = chunkArticles(articles);
    expect(chunks.length).toBeGreaterThanOrEqual(2);

    const urls = new Set(chunks.map((c) => c.metadata.url));
    expect(urls.has("https://example.com/article-1")).toBe(true);
    expect(urls.has("https://example.com/article-2")).toBe(true);
  });
});
