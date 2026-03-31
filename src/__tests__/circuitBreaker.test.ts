import { describe, it, expect, vi, beforeEach } from "vitest";
import { CircuitBreaker } from "../util/circuitBreaker.js";

describe("CircuitBreaker", () => {
  let cb: CircuitBreaker;

  beforeEach(() => {
    vi.useRealTimers();
    cb = new CircuitBreaker("test", { threshold: 3, resetTimeoutMs: 1000 });
  });

  it("starts in closed state with canExecute true", () => {
    expect(cb.getState()).toBe("closed");
    expect(cb.canExecute()).toBe(true);
  });

  it("opens after threshold failures", () => {
    cb.onFailure();
    cb.onFailure();
    expect(cb.getState()).toBe("closed");
    cb.onFailure();
    expect(cb.getState()).toBe("open");
  });

  it("rejects requests when open", () => {
    cb.onFailure();
    cb.onFailure();
    cb.onFailure();
    expect(cb.canExecute()).toBe(false);
  });

  it("transitions to half_open after resetTimeoutMs", () => {
    vi.useFakeTimers();
    cb.onFailure();
    cb.onFailure();
    cb.onFailure();
    expect(cb.getState()).toBe("open");

    vi.advanceTimersByTime(1000);
    expect(cb.getState()).toBe("half_open");
    expect(cb.canExecute()).toBe(true);
  });

  it("closes on success in half_open state", () => {
    vi.useFakeTimers();
    cb.onFailure();
    cb.onFailure();
    cb.onFailure();

    vi.advanceTimersByTime(1000);
    expect(cb.getState()).toBe("half_open");

    cb.onSuccess();
    expect(cb.getState()).toBe("closed");
  });

  it("re-opens on failure in half_open state", () => {
    vi.useFakeTimers();
    cb.onFailure();
    cb.onFailure();
    cb.onFailure();

    vi.advanceTimersByTime(1000);
    expect(cb.getState()).toBe("half_open");

    cb.onFailure();
    expect(cb.getState()).toBe("open");
  });

  it("execute() passes through on closed", async () => {
    const result = await cb.execute(() => Promise.resolve("ok"));
    expect(result).toBe("ok");
    expect(cb.getState()).toBe("closed");
  });

  it("execute() throws when open", async () => {
    cb.onFailure();
    cb.onFailure();
    cb.onFailure();

    await expect(cb.execute(() => Promise.resolve("ok"))).rejects.toThrow(
      /Circuit breaker.*open/,
    );
  });
});
