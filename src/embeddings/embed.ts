import { pipeline, type FeatureExtractionPipeline } from "@xenova/transformers";
import { createLogger } from "../util/logger.js";
import { EmbeddingError } from "../util/errors.js";

const MODEL_NAME = "Xenova/all-MiniLM-L6-v2";
const EMBEDDING_DIM = 384;

const log = createLogger("embeddings");

let embedder: FeatureExtractionPipeline | null = null;

async function getEmbedder(): Promise<FeatureExtractionPipeline> {
  if (!embedder) {
    log.info("Loading embedding model (first time may download ~23MB)...");
    try {
      embedder = await pipeline("feature-extraction", MODEL_NAME, {
        quantized: true,
      });
    } catch (error) {
      log.error({ err: error }, "Failed to load embedding model");
      throw new EmbeddingError("Failed to load embedding model", error);
    }
    log.info("Embedding model loaded.");
  }
  return embedder;
}

export async function embedText(text: string): Promise<number[]> {
  const model = await getEmbedder();
  const output = await model(text, { pooling: "mean", normalize: true });
  return Array.from(output.data as Float32Array).slice(0, EMBEDDING_DIM);
}

export async function embedBatch(texts: string[]): Promise<number[][]> {
  const results: number[][] = [];
  // Process in small batches to avoid memory issues
  const batchSize = 16;
  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);
    const embeddings = await Promise.all(batch.map((t) => embedText(t)));
    results.push(...embeddings);
    if (texts.length > batchSize) {
      log.debug(
        `Embedded ${Math.min(i + batchSize, texts.length)}/${texts.length} chunks`
      );
    }
  }
  return results;
}

export { EMBEDDING_DIM };
