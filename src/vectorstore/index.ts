import type { VectorStore } from "./types.js";
import { createLogger } from "../util/logger.js";

export type { RetrievedContext, VectorStore } from "./types.js";

const log = createLogger("vectorstore");

let store: VectorStore | null = null;

export async function getVectorStore(): Promise<VectorStore> {
  if (store) return store;

  const backend = process.env.VECTOR_BACKEND || "local";

  if (backend === "chroma") {
    try {
      const { getChromaVectorStore } = await import("./chroma.js");
      const chromaStore = getChromaVectorStore();
      // Verify connection
      await chromaStore.getCollectionStats();
      store = chromaStore;
      log.info("Connected to ChromaDB");
    } catch (error) {
      log.warn({ err: error }, "ChromaDB unavailable, falling back to local vector store");
      const { getLocalVectorStore } = await import("./local.js");
      store = getLocalVectorStore();
    }
  } else {
    const { getLocalVectorStore } = await import("./local.js");
    store = getLocalVectorStore();
    log.info("Using local vector store");
  }

  return store;
}

// Convenience wrappers that match the old API
export async function addDocuments(
  ...args: Parameters<VectorStore["addDocuments"]>
): ReturnType<VectorStore["addDocuments"]> {
  const s = await getVectorStore();
  return s.addDocuments(...args);
}

export async function queryRelevant(
  ...args: Parameters<VectorStore["queryRelevant"]>
): ReturnType<VectorStore["queryRelevant"]> {
  const s = await getVectorStore();
  return s.queryRelevant(...args);
}

export async function getCollectionStats(
  ...args: Parameters<VectorStore["getCollectionStats"]>
): ReturnType<VectorStore["getCollectionStats"]> {
  const s = await getVectorStore();
  return s.getCollectionStats(...args);
}
