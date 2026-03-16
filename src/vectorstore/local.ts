import * as fs from "fs";
import * as path from "path";
import { DocumentChunk } from "../scraper/chunker.js";
import { embedText, embedBatch } from "../embeddings/embed.js";
import type { RetrievedContext, VectorStore } from "./types.js";

interface StoredDocument {
  id: string;
  text: string;
  embedding: number[];
  metadata: {
    url: string;
    title: string;
    field: string;
    sourceName: string;
    scrapedAt: string;
    chunkIndex: number;
  };
}

interface StoreData {
  documents: StoredDocument[];
}

const DEFAULT_STORE_PATH = path.join(
  process.env.VECTOR_STORE_PATH || path.join(process.cwd(), "data"),
  "vectors.json"
);

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

class LocalVectorStore implements VectorStore {
  private storePath: string;
  private data: StoreData | null = null;

  constructor(storePath?: string) {
    this.storePath = storePath || DEFAULT_STORE_PATH;
  }

  private load(): StoreData {
    if (this.data) return this.data;

    if (fs.existsSync(this.storePath)) {
      const raw = fs.readFileSync(this.storePath, "utf-8");
      this.data = JSON.parse(raw) as StoreData;
    } else {
      this.data = { documents: [] };
    }
    return this.data;
  }

  private save(): void {
    if (!this.data) return;
    const dir = path.dirname(this.storePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(this.storePath, JSON.stringify(this.data), "utf-8");
  }

  async addDocuments(chunks: DocumentChunk[]): Promise<void> {
    const store = this.load();
    const existingIds = new Set(store.documents.map((d) => d.id));

    // Filter out duplicates
    const newChunks = chunks.filter((c) => !existingIds.has(c.id));
    if (newChunks.length === 0) {
      console.log("All chunks already exist in store, skipping.");
      return;
    }

    console.log(`Embedding ${newChunks.length} new chunks (${chunks.length - newChunks.length} duplicates skipped)...`);
    const embeddings = await embedBatch(newChunks.map((c) => c.text));

    for (let i = 0; i < newChunks.length; i++) {
      store.documents.push({
        id: newChunks[i].id,
        text: newChunks[i].text,
        embedding: embeddings[i],
        metadata: newChunks[i].metadata,
      });
    }

    this.save();
    console.log(`Stored ${newChunks.length} chunks (total: ${store.documents.length})`);
  }

  async queryRelevant(
    question: string,
    topK: number = 5,
    fieldFilter?: string
  ): Promise<RetrievedContext[]> {
    const store = this.load();
    const queryEmbedding = await embedText(question);

    let docs = store.documents;
    if (fieldFilter) {
      docs = docs.filter((d) => d.metadata.field === fieldFilter);
    }

    // Score all documents
    const scored = docs.map((doc) => ({
      doc,
      score: cosineSimilarity(queryEmbedding, doc.embedding),
    }));

    // Sort by score descending, take top K
    scored.sort((a, b) => b.score - a.score);
    const topResults = scored.slice(0, topK);

    return topResults.map((r) => ({
      text: r.doc.text,
      url: r.doc.metadata.url,
      title: r.doc.metadata.title,
      field: r.doc.metadata.field,
      score: r.score,
    }));
  }

  async getCollectionStats(): Promise<{ count: number }> {
    const store = this.load();
    return { count: store.documents.length };
  }
}

// Singleton
let instance: LocalVectorStore | null = null;

export function getLocalVectorStore(): VectorStore {
  if (!instance) {
    instance = new LocalVectorStore();
  }
  return instance;
}
