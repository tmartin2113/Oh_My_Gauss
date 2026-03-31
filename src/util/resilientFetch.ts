import { CircuitBreaker } from "./circuitBreaker.js";
import { ApiError, NetworkError, TimeoutError } from "./errors.js";

export interface ResilientFetchOptions {
  /** Timeout in ms (default: 30_000) */
  timeoutMs?: number;
  /** Max retries on transient failure (default: 3) */
  retries?: number;
  /** Base delay for exponential backoff in ms (default: 1000) */
  baseDelayMs?: number;
  /** Circuit breaker to use (optional) */
  circuitBreaker?: CircuitBreaker;
  /** Service name for error messages */
  service?: string;
}

function isRetryableStatus(status: number): boolean {
  return status === 429 || status === 502 || status === 503 || status === 504;
}

/**
 * Fetch with timeout, exponential-backoff retry, and circuit breaker.
 */
export async function resilientFetch(
  url: string,
  options: ResilientFetchOptions = {},
): Promise<Response> {
  const {
    timeoutMs = 30_000,
    retries = 3,
    baseDelayMs = 1000,
    circuitBreaker,
    service = "HTTP",
  } = options;

  const doFetch = async (): Promise<Response> => {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);

        let response: Response;
        try {
          response = await fetch(url, { signal: controller.signal });
        } finally {
          clearTimeout(timer);
        }

        if (response.ok) {
          return response;
        }

        if (isRetryableStatus(response.status) && attempt < retries) {
          const delay = baseDelayMs * Math.pow(2, attempt);
          lastError = new ApiError(service, response.status, response.statusText, true);
          await new Promise((r) => setTimeout(r, delay));
          continue;
        }

        throw new ApiError(service, response.status, response.statusText, false);
      } catch (error) {
        if (error instanceof ApiError) throw error;

        if (error instanceof DOMException && error.name === "AbortError") {
          throw new TimeoutError(service, timeoutMs);
        }

        // Network errors are retryable
        if (attempt < retries) {
          lastError = new NetworkError(service, String(error), error);
          const delay = baseDelayMs * Math.pow(2, attempt);
          await new Promise((r) => setTimeout(r, delay));
          continue;
        }

        throw new NetworkError(service, String(error), error);
      }
    }

    throw lastError ?? new NetworkError(service, "Max retries exceeded");
  };

  if (circuitBreaker) {
    return circuitBreaker.execute(doFetch);
  }
  return doFetch();
}
