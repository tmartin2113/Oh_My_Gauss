import { describe, it, expect, vi, beforeEach } from "vitest";
import { resilientFetch } from "../util/resilientFetch.js";
import { CircuitBreaker } from "../util/circuitBreaker.js";
import { ApiError, TimeoutError, NetworkError } from "../util/errors.js";

describe("resilientFetch", () => {
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
    mockFetch = vi.fn();
    vi.stubGlobal("fetch", mockFetch);
  });

  it("successful fetch returns response", async () => {
    const fakeResponse = { ok: true, status: 200, statusText: "OK" } as Response;
    mockFetch.mockResolvedValueOnce(fakeResponse);

    const result = await resilientFetch("https://example.com", { retries: 0 });
    expect(result).toBe(fakeResponse);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("retries on 429 status", async () => {
    vi.useFakeTimers();
    const retryResponse = { ok: false, status: 429, statusText: "Too Many Requests" } as Response;
    const okResponse = { ok: true, status: 200, statusText: "OK" } as Response;

    mockFetch
      .mockResolvedValueOnce(retryResponse)
      .mockResolvedValueOnce(okResponse);

    const promise = resilientFetch("https://example.com", {
      retries: 2,
      baseDelayMs: 100,
    });

    // Advance past the first retry delay (100ms * 2^0 = 100ms)
    await vi.advanceTimersByTimeAsync(150);

    const result = await promise;
    expect(result).toBe(okResponse);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("retries on 503 status", async () => {
    vi.useFakeTimers();
    const retryResponse = { ok: false, status: 503, statusText: "Service Unavailable" } as Response;
    const okResponse = { ok: true, status: 200, statusText: "OK" } as Response;

    mockFetch
      .mockResolvedValueOnce(retryResponse)
      .mockResolvedValueOnce(okResponse);

    const promise = resilientFetch("https://example.com", {
      retries: 2,
      baseDelayMs: 100,
    });

    await vi.advanceTimersByTimeAsync(150);

    const result = await promise;
    expect(result).toBe(okResponse);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("throws ApiError on non-retryable 404", async () => {
    const notFoundResponse = { ok: false, status: 404, statusText: "Not Found" } as Response;
    mockFetch.mockResolvedValueOnce(notFoundResponse);

    await expect(
      resilientFetch("https://example.com", { retries: 3 }),
    ).rejects.toThrow(ApiError);

    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("throws TimeoutError when request times out", async () => {
    // Mock a fetch that never resolves but respects abort signal
    mockFetch.mockImplementation(
      (_url: string, init?: RequestInit) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            reject(new DOMException("The operation was aborted", "AbortError"));
          });
        }),
    );

    await expect(
      resilientFetch("https://example.com", {
        timeoutMs: 50,
        retries: 0,
      }),
    ).rejects.toThrow(TimeoutError);
  });

  it("throws NetworkError on fetch rejection", async () => {
    mockFetch.mockRejectedValue(new TypeError("Failed to fetch"));

    await expect(
      resilientFetch("https://example.com", { retries: 0 }),
    ).rejects.toThrow(NetworkError);
  });

  it("respects circuit breaker - throws when open", async () => {
    const cb = new CircuitBreaker("test", { threshold: 1, resetTimeoutMs: 60000 });
    cb.onFailure(); // open the breaker

    await expect(
      resilientFetch("https://example.com", { circuitBreaker: cb }),
    ).rejects.toThrow(/Circuit breaker.*open/);

    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("records success/failure on circuit breaker", async () => {
    const cb = new CircuitBreaker("test", { threshold: 3, resetTimeoutMs: 60000 });
    const okResponse = { ok: true, status: 200, statusText: "OK" } as Response;
    mockFetch.mockResolvedValueOnce(okResponse);

    await resilientFetch("https://example.com", {
      circuitBreaker: cb,
      retries: 0,
    });
    expect(cb.getState()).toBe("closed");

    // Now cause a failure
    const notFoundResponse = { ok: false, status: 404, statusText: "Not Found" } as Response;
    mockFetch.mockResolvedValueOnce(notFoundResponse);

    await expect(
      resilientFetch("https://example.com", {
        circuitBreaker: cb,
        retries: 0,
      }),
    ).rejects.toThrow(ApiError);

    // Circuit breaker should have recorded the failure
    // (won't be open yet since threshold is 3)
    expect(cb.getState()).toBe("closed");
  });
});
