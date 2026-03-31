/**
 * 3-state circuit breaker: CLOSED → OPEN → HALF_OPEN → CLOSED.
 * Opens after `threshold` consecutive failures. Stays open for `resetTimeoutMs`.
 * In half-open, a single success closes the circuit; a failure re-opens it.
 */

export type CircuitState = "closed" | "open" | "half_open";

export class CircuitBreaker {
  private state: CircuitState = "closed";
  private failureCount = 0;
  private lastFailureTime = 0;
  private readonly threshold: number;
  private readonly resetTimeoutMs: number;

  constructor(
    public readonly name: string,
    options?: { threshold?: number; resetTimeoutMs?: number },
  ) {
    this.threshold = options?.threshold ?? 3;
    this.resetTimeoutMs = options?.resetTimeoutMs ?? 60_000;
  }

  getState(): CircuitState {
    if (this.state === "open" && Date.now() - this.lastFailureTime >= this.resetTimeoutMs) {
      this.state = "half_open";
    }
    return this.state;
  }

  /** Returns true if the request should be allowed through. */
  canExecute(): boolean {
    const current = this.getState();
    return current === "closed" || current === "half_open";
  }

  /** Record a successful call. */
  onSuccess(): void {
    this.failureCount = 0;
    this.state = "closed";
  }

  /** Record a failed call. */
  onFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    if (this.failureCount >= this.threshold || this.state === "half_open") {
      this.state = "open";
    }
  }

  /** Execute an async function through the circuit breaker. */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (!this.canExecute()) {
      throw new Error(`Circuit breaker [${this.name}] is open — rejecting request`);
    }
    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }
}
