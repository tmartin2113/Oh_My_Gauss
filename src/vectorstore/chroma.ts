import { ChromaClient, Collection } from "chromadb";
import { DocumentChunk } from "../scraper/chunker.js";
import { embedText, embedBatch } from "../embeddings/embed.js";

const COLLECTION_NAME = "science_tutor";

let client: ChromaClient | null = null;
let collection: Collection | null = null;

async function getCollection(): Promise<Collection> {
  if (!collection) {
    client = new ChromaClient({ path: "http://localhost:8000" });
    collection = await client.getOrCreateCollection({
      name: COLLECTION_NAME,
      metadata: { "hnsw:space": "cosine" },
    });
  }
  return collection;
}

export async function addDocuments(chunks: DocumentChunk[]): Promise<void> {
  const col = await getCollection();

  console.log(`Embedding ${chunks.length} chunks...`);
  const embeddings = await embedBatch(chunks.map((c) => c.text));

  // ChromaDB has a batch limit, add in groups of 100
  const batchSize = 100;
  for (let i = 0; i < chunks.length; i += batchSize) {
    const batchChunks = chunks.slice(i, i + batchSize);
    const batchEmbeddings = embeddings.slice(i, i + batchSize);

    await col.add({
      ids: batchChunks.map((c) => c.id),
      documents: batchChunks.map((c) => c.text),
      embeddings: batchEmbeddings,
      metadatas: batchChunks.map((c) => c.metadata),
    });

    console.log(
      `  Stored batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(chunks.length / batchSize)}`
    );
  }

  console.log(`Stored ${chunks.length} chunks in ChromaDB`);
}

export interface RetrievedContext {
  text: string;
  url: string;
  title: string;
  field: string;
  score: number;
}

export async function queryRelevant(
  question: string,
  topK: number = 5,
  fieldFilter?: string
): Promise<RetrievedContext[]> {
  const col = await getCollection();
  const queryEmbedding = await embedText(question);

  const where = fieldFilter ? { field: fieldFilter } : undefined;

  const results = await col.query({
    queryEmbeddings: [queryEmbedding],
    nResults: topK,
    where,
  });

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
          score: 1 - distance, // cosine distance to similarity
        });
      }
    }
  }

  return contexts;
}

export async function getCollectionStats(): Promise<{ count: number }> {
  const col = await getCollection();
  const count = await col.count();
  return { count };
}
