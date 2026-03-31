/**
 * Custom error types for Oh My Gauss.
 * Discriminating catch utilities that distinguish recoverable from fatal errors.
 */

// --- Custom Error Types ---

export class ApiError extends Error {
  constructor(
    public readonly service: string,
    public readonly statusCode: number,
    message: string,
    public readonly retryable: boolean = false,
  ) {
    super(`[${service}] ${statusCode}: ${message}`);
    this.name = "ApiError";
  }
}

export class NetworkError extends Error {
  constructor(
    public readonly service: string,
    message: string,
    public readonly cause?: unknown,
  ) {
    super(`[${service}] Network error: ${message}`);
    this.name = "NetworkError";
  }
}

export class TimeoutError extends Error {
  constructor(
    public readonly service: string,
    public readonly timeoutMs: number,
  ) {
    super(`[${service}] Request timed out after ${timeoutMs}ms`);
    this.name = "TimeoutError";
  }
}

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

export class EmbeddingError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(`Embedding error: ${message}`);
    this.name = "EmbeddingError";
  }
}

// --- Discriminating Catch ---

/** Errors that should never be caught — they indicate JVM/runtime-fatal conditions */
function isFatal(error: unknown): boolean {
  if (error instanceof RangeError && error.message.includes("Maximum call stack")) return true;
  // Out of memory manifests as various errors in Node.js
  if (error instanceof Error && error.message.includes("JavaScript heap out of memory")) return true;
  return false;
}

/**
 * Safe wrapper for async operations. Rethrows fatal errors (stack overflow, OOM).
 * Returns { ok: true, value } on success or { ok: false, error } on recoverable failure.
 */
export async function safeAsync<T>(
  fn: () => Promise<T>,
): Promise<{ ok: true; value: T } | { ok: false; error: Error }> {
  try {
    const value = await fn();
    return { ok: true, value };
  } catch (error) {
    if (isFatal(error)) throw error;
    return { ok: false, error: error instanceof Error ? error : new Error(String(error)) };
  }
}

/**
 * Safe wrapper for sync operations. Same semantics as safeAsync.
 */
export function safeSync<T>(
  fn: () => T,
): { ok: true; value: T } | { ok: false; error: Error } {
  try {
    const value = fn();
    return { ok: true, value };
  } catch (error) {
    if (isFatal(error)) throw error;
    return { ok: false, error: error instanceof Error ? error : new Error(String(error)) };
  }
}
