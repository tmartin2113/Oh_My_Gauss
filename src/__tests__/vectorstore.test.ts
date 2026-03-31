import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

vi.mock("../embeddings/embed.js", () => ({
  embedText: vi.fn(async () => Array(384).fill(0).map(() => Math.random())),
  embedBatch: vi.fn(async (texts: string[]) =>
    texts.map(() => Array(384).fill(0).map(() => Math.random()))
  ),
  EMBEDDING_DIM: 384,
}));

vi.mock("../util/logger.js", () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
}));

import type { DocumentChunk } from "../scraper/chunker.js";

function makeChunk(id: string, field: string = "physics"): DocumentChunk {
  return {
    id,
    text: `This is the text content for chunk ${id}. It contains useful information about ${field}.`,
    metadata: {
      url: `https://example.com/${id}`,
      title: `Paper ${id}`,
      field,
      sourceName: "TestSource",
      scrapedAt: "2026-03-30T00:00:00Z",
      chunkIndex: 0,
    },
  };
}

describe("LocalVectorStore", () => {
  let tmpDir: string;
  let storePath: string;
  let LocalVectorStoreModule: typeof import("../vectorstore/local.js");

  beforeEach(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "vectorstore-test-"));
    storePath = path.join(tmpDir, "vectors.json");

    // Set the env var before importing the module so DEFAULT_STORE_PATH uses our tmpDir
    process.env.VECTOR_STORE_PATH = tmpDir;

    // Reset modules so we get a fresh singleton each time
    vi.resetModules();

    // Re-apply mocks after resetModules
    vi.doMock("../embeddings/embed.js", () => ({
      embedText: vi.fn(async () => Array(384).fill(0).map(() => Math.random())),
      embedBatch: vi.fn(async (texts: string[]) =>
        texts.map(() => Array(384).fill(0).map(() => Math.random()))
      ),
      EMBEDDING_DIM: 384,
    }));
    vi.doMock("../util/logger.js", () => ({
      createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
    }));

    LocalVectorStoreModule = await import("../vectorstore/local.js");
  });

  afterEach(() => {
    if (fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
    delete process.env.VECTOR_STORE_PATH;
  });

  it("addDocuments stores chunks", async () => {
    const store = LocalVectorStoreModule.getLocalVectorStore();
    const chunks = [makeChunk("chunk-1"), makeChunk("chunk-2")];

    await store.addDocuments(chunks);

    const stats = await store.getCollectionStats();
    expect(stats.count).toBe(2);
  });

  it("queryRelevant returns results", async () => {
    const store = LocalVectorStoreModule.getLocalVectorStore();
    const chunks = [makeChunk("chunk-a"), makeChunk("chunk-b"), makeChunk("chunk-c")];

    await store.addDocuments(chunks);

    const results = await store.queryRelevant("information about physics", 2);
    expect(results.length).toBe(2);
    expect(results[0]).toHaveProperty("text");
    expect(results[0]).toHaveProperty("url");
    expect(results[0]).toHaveProperty("title");
    expect(results[0]).toHaveProperty("field");
    expect(results[0]).toHaveProperty("score");
  });

  it("getCollectionStats returns correct count", async () => {
    const store = LocalVectorStoreModule.getLocalVectorStore();

    const statsBefore = await store.getCollectionStats();
    expect(statsBefore.count).toBe(0);

    await store.addDocuments([makeChunk("s1"), makeChunk("s2"), makeChunk("s3")]);

    const statsAfter = await store.getCollectionStats();
    expect(statsAfter.count).toBe(3);
  });

  it("duplicate chunks are skipped", async () => {
    const store = LocalVectorStoreModule.getLocalVectorStore();
    const chunk = makeChunk("dup-1");

    await store.addDocuments([chunk]);
    await store.addDocuments([chunk]); // same ID again

    const stats = await store.getCollectionStats();
    expect(stats.count).toBe(1);
  });

  it("field filter works on queryRelevant", async () => {
    const store = LocalVectorStoreModule.getLocalVectorStore();

    await store.addDocuments([
      makeChunk("phys-1", "physics"),
      makeChunk("phys-2", "physics"),
      makeChunk("bio-1", "biology"),
    ]);

    const physicsResults = await store.queryRelevant("test query", 10, "physics");
    expect(physicsResults.length).toBe(2);
    for (const r of physicsResults) {
      expect(r.field).toBe("physics");
    }

    const bioResults = await store.queryRelevant("test query", 10, "biology");
    expect(bioResults.length).toBe(1);
    expect(bioResults[0].field).toBe("biology");
  });
});
