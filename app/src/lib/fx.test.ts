/**
 * Tests for the FX rate fetcher. We mock the global fetch since these
 * are public APIs and we don't want CI flakiness or rate-limit hits.
 *
 * Goal of these tests is to verify our LOGIC around the providers:
 * - 1:1 short-circuit for same-currency
 * - Frankfurter primary
 * - exchangerate.host fallback when Frankfurter fails
 * - direct exchangerate.host for unsupported-by-Frankfurter codes (TWD/VND)
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

beforeEach(async () => {
  vi.resetModules();
  vi.unstubAllGlobals();
  // The fx module keeps an in-process cache; clear it so order-of-tests
  // doesn't matter (e.g. JPY→THB cached from one test bleeds into another).
  const { _resetFxCache } = await import("./fx");
  _resetFxCache();
});
afterEach(() => {
  vi.unstubAllGlobals();
});

function mockFetch(handler: (url: string) => Response | Promise<Response>) {
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : input.toString();
    return handler(url);
  }));
}

describe("fetchFxRate", () => {
  it("returns 1 immediately when from === to (no network)", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const { fetchFxRate } = await import("./fx");
    expect(await fetchFxRate("THB", "THB")).toBe(1);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("uses Frankfurter for major-currency pairs", async () => {
    mockFetch((url) => {
      if (url.includes("frankfurter.dev")) {
        return new Response(
          JSON.stringify({ rates: { THB: 0.2333 } }),
          { status: 200 }
        );
      }
      throw new Error(`unexpected URL: ${url}`);
    });
    const { fetchFxRate } = await import("./fx");
    expect(await fetchFxRate("JPY", "THB")).toBeCloseTo(0.2333, 4);
  });

  it("falls back to exchangerate.host when Frankfurter fails", async () => {
    let calls = 0;
    mockFetch((url) => {
      calls++;
      if (url.includes("frankfurter.dev")) {
        return new Response("upstream down", { status: 503 });
      }
      if (url.includes("exchangerate.host")) {
        return new Response(JSON.stringify({ result: 0.234 }), {
          status: 200,
        });
      }
      throw new Error(`unexpected URL: ${url}`);
    });
    const { fetchFxRate } = await import("./fx");
    expect(await fetchFxRate("JPY", "THB")).toBeCloseTo(0.234, 4);
    // Hit Frankfurter THEN exchangerate.host — the fallback chain.
    expect(calls).toBe(2);
  });

  it("skips Frankfurter and goes straight to exchangerate.host for TWD", async () => {
    let frankCalls = 0;
    let hostCalls = 0;
    mockFetch((url) => {
      if (url.includes("frankfurter.dev")) {
        frankCalls++;
        return new Response("nope", { status: 404 });
      }
      if (url.includes("exchangerate.host")) {
        hostCalls++;
        return new Response(JSON.stringify({ result: 1.05 }), {
          status: 200,
        });
      }
      throw new Error(`unexpected URL: ${url}`);
    });
    const { fetchFxRate } = await import("./fx");
    expect(await fetchFxRate("TWD", "THB")).toBeCloseTo(1.05, 2);
    expect(frankCalls).toBe(0);
    expect(hostCalls).toBe(1);
  });

  it("rejects unsupported currency codes before any network call", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const { fetchFxRate } = await import("./fx");
    await expect(fetchFxRate("ZZZ", "THB")).rejects.toThrow();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("throws when both providers fail", async () => {
    mockFetch(() => new Response("down", { status: 503 }));
    const { fetchFxRate } = await import("./fx");
    await expect(fetchFxRate("JPY", "THB")).rejects.toThrow();
  });
});
