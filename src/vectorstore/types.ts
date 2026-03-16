import { DocumentChunk } from "../scraper/chunker.js";

export interface RetrievedContext {
  text: string;
  url: string;
  title: string;
  field: string;
  score: number;
}

export interface VectorStore {
  addDocuments(chunks: DocumentChunk[]): Promise<void>;
  queryRelevant(question: string, topK?: number, fieldFilter?: string): Promise<RetrievedContext[]>;
  getCollectionStats(): Promise<{ count: number }>;
}
