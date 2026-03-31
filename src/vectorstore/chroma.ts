import { ChromaClient, Collection } from "chromadb";
import { DocumentChunk } from "../scraper/chunker.js";
import { embedText, embedBatch } from "../embeddings/embed.js";
import type { RetrievedContext, VectorStore } from "./types.js";
import { createLogger } from "../util/logger.js";

const log = createLogger("vectorstore:chroma");

const COLLECTION_NAME = "science_tutor";
const CHROMADB_URL = process.env.CHROMADB_URL || "http://localhost:8000";

class ChromaVectorStore implements VectorStore {
  private client: ChromaClient | null = null;
  private collection: Collection | null = null;

  private resetConnection(): void {
    this.client = null;
    this.collection = null;
  }

  private async getCollection(): Promise<Collection> {
    if (!this.collection) {
      this.client = new ChromaClient({ path: CHROMADB_URL });
      try {
        this.collection = await this.client.getOrCreateCollection({
          name: COLLECTION_NAME,
          metadata: { "hnsw:space": "cosine" },
        });
      } catch (error) {
        this.resetConnection();
        throw error;
      }
    }
    return this.collection;
  }

  async addDocuments(chunks: DocumentChunk[]): Promise<void> {
    log.info(`Embedding ${chunks.length} chunks...`);
    const embeddings = await embedBatch(chunks.map((c) => c.text));

    const batchSize = 100;
    for (let i = 0; i < chunks.length; i += batchSize) {
      const batchChunks = chunks.slice(i, i + batchSize);
      const batchEmbeddings = embeddings.slice(i, i + batchSize);

      try {
        const col = await this.getCollection();
        await col.add({
          ids: batchChunks.map((c) => c.id),
          documents: batchChunks.map((c) => c.text),
          embeddings: batchEmbeddings,
          metadatas: batchChunks.map((c) => c.metadata),
        });
      } catch (error) {
        this.resetConnection();
        throw error;
      }

      log.info(
        `  Stored batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(chunks.length / batchSize)}`
      );
    }

    log.info(`Stored ${chunks.length} chunks in ChromaDB`);
  }

  async queryRelevant(
    question: string,
    topK: number = 5,
    fieldFilter?: string
  ): Promise<RetrievedContext[]> {
    const queryEmbedding = await embedText(question);
    const where = fieldFilter ? { field: fieldFilter } : undefined;

    let results;
    try {
      const col = await this.getCollection();
      results = await col.query({
        queryEmbeddings: [queryEmbedding],
        nResults: topK,
        where,
      });
    } catch (error) {
      this.resetConnection();
      throw error;
    }

    const contexts: RetrievedContext[] = [];
    if (results.documents[0]) {
      for (let i = 0; i < results.documents[0].length; i++) {
        const doc = results.documents[0][i];
        const meta = results.metadatas[0][i] as Record<string, string>;
        const distance = results.distances?.[0]?.[i] ?? 0;

        if (doc) {
          contexts.push({
            text: doc,
            url: meta.url || "",
            title: meta.title || "",
            field: meta.field || "",
            score: 1 - distance,
          });
        }
      }
    }

    return contexts;
  }

  async getCollectionStats(): Promise<{ count: number }> {
    try {
      const col = await this.getCollection();
      const count = await col.count();
      return { count };
    } catch (error) {
      this.resetConnection();
      throw error;
    }
  }
}

let instance: ChromaVectorStore | null = null;

export function getChromaVectorStore(): VectorStore {
  if (!instance) {
    instance = new ChromaVectorStore();
  }
  return instance;
}
