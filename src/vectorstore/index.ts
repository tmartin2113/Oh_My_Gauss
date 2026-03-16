import type { VectorStore } from "./types.js";

export type { RetrievedContext, VectorStore } from "./types.js";

let store: VectorStore | null = null;

export async function getVectorStore(): Promise<VectorStore> {
  if (store) return store;

  const backend = process.env.VECTOR_BACKEND || "local";

  if (backend === "chroma") {
    const { getChromaVectorStore } = await import("./chroma.js");
    store = getChromaVectorStore();
  } else {
    const { getLocalVectorStore } = await import("./local.js");
    store = getLocalVectorStore();
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
