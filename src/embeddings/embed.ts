import { pipeline, type FeatureExtractionPipeline } from "@xenova/transformers";

const MODEL_NAME = "Xenova/all-MiniLM-L6-v2";
const EMBEDDING_DIM = 384;

let embedder: FeatureExtractionPipeline | null = null;

async function getEmbedder(): Promise<FeatureExtractionPipeline> {
  if (!embedder) {
    console.log("Loading embedding model (first time may download ~23MB)...");
    embedder = await pipeline("feature-extraction", MODEL_NAME, {
      quantized: true,
    });
    console.log("Embedding model loaded.");
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
      process.stdout.write(
        `\r  Embedded ${Math.min(i + batchSize, texts.length)}/${texts.length} chunks`
      );
    }
  }
  if (texts.length > batchSize) {
    console.log(); // newline after progress
  }
  return results;
}

export { EMBEDDING_DIM };
