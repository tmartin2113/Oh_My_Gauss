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

import { searchPapers } from "../scraper/semanticscholar.js";
import { resilientFetch } from "../util/resilientFetch.js";

const mockResilientFetch = vi.mocked(resilientFetch);

const makeMockResponse = (data: unknown) => ({
  ok: true,
  json: async () => data,
});

const mockS2Data = {
  total: 2,
  data: [
    {
      paperId: "abc",
      title: "Quantum Computing",
      abstract: "A study on quantum...",
      url: "https://example.com/paper",
      year: 2026,
      authors: [{ name: "Alice" }, { name: "Bob" }],
      publicationDate: "2026-01-01",
      openAccessPdf: { url: "https://example.com/pdf" },
      publicationTypes: ["JournalArticle"],
    },
    {
      paperId: "def",
      title: "No Abstract Paper",
      abstract: null,
      url: "https://example.com/paper2",
      year: 2026,
      authors: [],
      publicationDate: null,
      openAccessPdf: null,
      publicationTypes: null,
    },
  ],
};

describe("searchPapers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns articles from valid API response", async () => {
    mockResilientFetch.mockResolvedValue(makeMockResponse(mockS2Data) as any);

    const articles = await searchPapers({
      query: "quantum computing",
      field: "physics",
    });

    expect(articles.length).toBe(1);
    expect(articles[0].title).toBe("Quantum Computing");
    expect(articles[0].markdown).toContain("A study on quantum...");
    expect(articles[0].markdown).toContain("Alice, Bob");
  });

  it("filters out papers without abstracts", async () => {
    mockResilientFetch.mockResolvedValue(makeMockResponse(mockS2Data) as any);

    const articles = await searchPapers({
      query: "quantum computing",
      field: "physics",
    });

    // Only 1 paper has an abstract
    expect(articles.length).toBe(1);
    expect(articles[0].title).toBe("Quantum Computing");
  });

  it("returns empty array when no data", async () => {
    mockResilientFetch.mockResolvedValue(
      makeMockResponse({ total: 0, data: [] }) as any
    );

    const articles = await searchPapers({
      query: "nonexistent topic",
      field: "physics",
    });

    expect(articles).toEqual([]);
  });

  it("includes publicationDateRange in URL when provided", async () => {
    mockResilientFetch.mockResolvedValue(
      makeMockResponse({ total: 0, data: [] }) as any
    );

    await searchPapers({
      query: "quantum",
      field: "physics",
      publicationDateRange: "2026-03-01:2026-03-31",
    });

    expect(mockResilientFetch).toHaveBeenCalledTimes(1);
    const calledUrl = mockResilientFetch.mock.calls[0][0] as string;
    expect(calledUrl).toContain("publicationDateOrYear=");
    expect(calledUrl).toContain("2026-03-01");
  });

  it("articles have correct field and sourceName", async () => {
    mockResilientFetch.mockResolvedValue(makeMockResponse(mockS2Data) as any);

    const articles = await searchPapers({
      query: "quantum computing",
      field: "physics",
    });

    expect(articles[0].field).toBe("physics");
    expect(articles[0].sourceName).toBe("Semantic Scholar");
  });
});
