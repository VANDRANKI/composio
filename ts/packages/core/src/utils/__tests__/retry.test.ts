import { describe, it, expect, vi } from "vitest";
import { calculateBackoffDelay, withRetry } from "../retry";

describe("calculateBackoffDelay", () => {
  it("returns base delay for attempt 0", () => {
    const delay = calculateBackoffDelay(0, { baseDelayMs: 100, jitter: false });
    expect(delay).toBe(100);
  });

  it("doubles delay for each attempt", () => {
    const delay = calculateBackoffDelay(2, { baseDelayMs: 100, jitter: false });
    expect(delay).toBe(400);
  });

  it("caps delay at maxDelayMs", () => {
    const delay = calculateBackoffDelay(10, { baseDelayMs: 100, maxDelayMs: 1000, jitter: false });
    expect(delay).toBe(1000);
  });
});

describe("withRetry", () => {
  it("returns immediately on success", async () => {
    const fn = vi.fn().mockResolvedValue("ok");
    const result = await withRetry(fn, { maxAttempts: 3, baseDelayMs: 0 });
    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("retries on failure and eventually succeeds", async () => {
    const fn = vi.fn().mockRejectedValueOnce(new Error("fail")).mockResolvedValue("ok");
    const result = await withRetry(fn, { maxAttempts: 3, baseDelayMs: 0 });
    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("throws after exhausting all attempts", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("permanent"));
    await expect(withRetry(fn, { maxAttempts: 3, baseDelayMs: 0 })).rejects.toThrow("permanent");
    expect(fn).toHaveBeenCalledTimes(3);
  });
});
