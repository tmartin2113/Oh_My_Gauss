import { describe, it, expect } from "vitest";
import {
  ApiError,
  NetworkError,
  TimeoutError,
  ValidationError,
  EmbeddingError,
  safeAsync,
  safeSync,
} from "../util/errors.js";

describe("ApiError", () => {
  it("stores service, statusCode, and retryable", () => {
    const err = new ApiError("openai", 429, "Too Many Requests", true);
    expect(err.service).toBe("openai");
    expect(err.statusCode).toBe(429);
    expect(err.retryable).toBe(true);
    expect(err.name).toBe("ApiError");
    expect(err.message).toContain("openai");
    expect(err.message).toContain("429");
  });
});

describe("NetworkError", () => {
  it("stores service and cause", () => {
    const cause = new Error("ECONNREFUSED");
    const err = new NetworkError("openai", "connection refused", cause);
    expect(err.service).toBe("openai");
    expect(err.cause).toBe(cause);
    expect(err.name).toBe("NetworkError");
    expect(err.message).toContain("Network error");
  });
});

describe("TimeoutError", () => {
  it("stores service and timeoutMs", () => {
    const err = new TimeoutError("openai", 5000);
    expect(err.service).toBe("openai");
    expect(err.timeoutMs).toBe(5000);
    expect(err.name).toBe("TimeoutError");
    expect(err.message).toContain("5000");
  });
});

describe("ValidationError", () => {
  it("has correct name", () => {
    const err = new ValidationError("bad input");
    expect(err.name).toBe("ValidationError");
    expect(err.message).toBe("bad input");
  });
});

describe("EmbeddingError", () => {
  it("has correct name and cause", () => {
    const cause = new Error("model not found");
    const err = new EmbeddingError("failed to embed", cause);
    expect(err.name).toBe("EmbeddingError");
    expect(err.cause).toBe(cause);
    expect(err.message).toContain("Embedding error");
  });
});

describe("safeAsync", () => {
  it("returns { ok: true, value } on success", async () => {
    const result = await safeAsync(() => Promise.resolve(42));
    expect(result).toEqual({ ok: true, value: 42 });
  });

  it("returns { ok: false, error } on recoverable failure", async () => {
    const result = await safeAsync(() => Promise.reject(new Error("oops")));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toBe("oops");
    }
  });

  it("rethrows fatal errors (stack overflow)", async () => {
    const stackOverflow = new RangeError("Maximum call stack size exceeded");
    await expect(
      safeAsync(() => Promise.reject(stackOverflow)),
    ).rejects.toThrow(stackOverflow);
  });
});

describe("safeSync", () => {
  it("returns { ok: true, value } on success", () => {
    const result = safeSync(() => 42);
    expect(result).toEqual({ ok: true, value: 42 });
  });

  it("returns { ok: false, error } on recoverable failure", () => {
    const result = safeSync(() => {
      throw new Error("oops");
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toBe("oops");
    }
  });
});
