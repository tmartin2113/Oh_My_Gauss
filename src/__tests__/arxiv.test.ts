import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../util/resilientFetch.js", () => ({
  resilientFetch: vi.fn(),
}));

vi.mock("../util/logger.js", () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
}));

vi.mock("../util/circuitBreaker.js", () => ({
  CircuitBreaker: class {
    constructor() {}
  },
}));

import { searchArxiv } from "../scraper/arxiv.js";
import { resilientFetch } from "../util/resilientFetch.js";

const mockResilientFetch = vi.mocked(resilientFetch);

const mockXml = `<?xml version="1.0"?>
<feed>
  <entry>
    <title>Test Paper Title</title>
    <summary>This is a test abstract about quantum physics.</summary>
    <id>http://arxiv.org/abs/2026.12345</id>
    <published>2026-03-30T00:00:00Z</published>
    <author><name>Test Author</name></author>
    <arxiv:primary_category term="quant-ph" />
    <link title="pdf" href="http://arxiv.org/pdf/2026.12345" />
  </entry>
</feed>`;

const emptyXml = `<?xml version="1.0"?>
<feed>
</feed>`;

describe("searchArxiv", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("parses XML response correctly", async () => {
    mockResilientFetch.mockResolvedValue({
      ok: true,
      text: async () => mockXml,
    } as any);

    const articles = await searchArxiv({
      searchQuery: "quantum computing",
      field: "physics",
    });

    expect(articles.length).toBe(1);
    expect(articles[0].url).toBe("http://arxiv.org/abs/2026.12345");
    expect(articles[0].sourceName).toBe("arXiv");
    expect(articles[0].field).toBe("physics");
  });

  it("extracts title, summary, authors, category, pdfLink", async () => {
    mockResilientFetch.mockResolvedValue({
      ok: true,
      text: async () => mockXml,
    } as any);

    const articles = await searchArxiv({
      searchQuery: "quantum",
      field: "physics",
    });

    const article = articles[0];
    expect(article.title).toBe("Test Paper Title");
    expect(article.markdown).toContain("This is a test abstract about quantum physics.");
    expect(article.markdown).toContain("Test Author");
    expect(article.markdown).toContain("quant-ph");
    expect(article.markdown).toContain("http://arxiv.org/pdf/2026.12345");
  });

  it("returns empty array for empty response", async () => {
    mockResilientFetch.mockResolvedValue({
      ok: true,
      text: async () => emptyXml,
    } as any);

    const articles = await searchArxiv({
      searchQuery: "nonexistent",
      field: "physics",
    });

    expect(articles).toEqual([]);
  });

  it("includes category in search query when provided", async () => {
    mockResilientFetch.mockResolvedValue({
      ok: true,
      text: async () => emptyXml,
    } as any);

    await searchArxiv({
      searchQuery: "quantum computing",
      field: "physics",
      category: "quant-ph",
    });

    expect(mockResilientFetch).toHaveBeenCalledTimes(1);
    const calledUrl = mockResilientFetch.mock.calls[0][0] as string;
    expect(calledUrl).toContain("cat:quant-ph");
  });

  it("omits category from URL when not provided", async () => {
    mockResilientFetch.mockResolvedValue({
      ok: true,
      text: async () => emptyXml,
    } as any);

    await searchArxiv({
      searchQuery: "quantum computing",
      field: "physics",
    });

    const calledUrl = mockResilientFetch.mock.calls[0][0] as string;
    expect(calledUrl).not.toContain("cat:");
    expect(calledUrl).toContain("all:");
  });
});
