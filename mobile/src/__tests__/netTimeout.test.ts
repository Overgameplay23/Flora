jest.mock("@react-native-community/netinfo", () => ({
  __esModule: true,
  default: { fetch: async () => ({ isConnected: true, isInternetReachable: true, type: "wifi" }) },
}));
jest.mock("../utils/env", () => ({
  getRawPublicEnv: () => "https://proj.supabase.co",
  isPlaceholderValue: () => false,
  isSupabaseUrlConfigured: () => true,
}));
jest.mock("../utils/diagLog", () => ({ diagLog: () => {} }));

import { resilientFetch } from "../utils/net";

(globalThis as any).__DEV__ = false;

const PAINT_URL = "https://proj.functions.supabase.co/pet-stylize";
const realFetch = globalThis.fetch;

// a request that only ends when it is aborted
function hangingFetch() {
  return jest.fn(
    (_url: string, init: RequestInit) =>
      new Promise((_resolve, reject) => {
        init.signal?.addEventListener("abort", () => reject(Object.assign(new Error("Aborted"), { name: "AbortError" })));
      })
  );
}

beforeEach(() => {
  // only the clock is fake; promise plumbing keeps running
  jest.useFakeTimers({ doNotFake: ["nextTick", "setImmediate", "queueMicrotask"] });
  jest.spyOn(console, "error").mockImplementation(() => {});
  jest.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
  globalThis.fetch = realFetch;
});

describe("resilientFetch timeouts", () => {
  it("honours a per-call timeout, tags it, and never retries the request", async () => {
    const fetchMock = hangingFetch();
    globalThis.fetch = fetchMock as any;
    const outcome = resilientFetch(PAINT_URL, { method: "POST", body: "{}", timeoutMs: 110_000 }).then(
      () => null,
      (error) => error
    );
    await jest.advanceTimersByTimeAsync(15_000);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    let settled = false;
    void outcome.then(() => {
      settled = true;
    });
    await jest.advanceTimersByTimeAsync(0);
    expect(settled).toBe(false); // still waiting past the 15 s default

    await jest.advanceTimersByTimeAsync(95_000);
    const error = await outcome;
    expect(error).toMatchObject({ errorCode: "NETWORK_FAIL", timedOut: true });
    await jest.advanceTimersByTimeAsync(10_000);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("keeps the 15 s default for everything else", async () => {
    const fetchMock = hangingFetch();
    globalThis.fetch = fetchMock as any;
    const outcome = resilientFetch("https://proj.supabase.co/rest/v1/pet").then(
      () => null,
      (error) => error
    );
    await jest.advanceTimersByTimeAsync(15_000);
    expect(await outcome).toMatchObject({ timedOut: true });
  });

  it("does not tag a failure that was not a timeout", async () => {
    globalThis.fetch = jest.fn(async () => {
      throw new Error("Network request failed");
    }) as any;
    const error = await resilientFetch(PAINT_URL, { method: "POST", timeoutMs: 110_000 }).catch((e) => e);
    expect(error.errorCode).toBe("NETWORK_FAIL");
    expect(error.timedOut).toBeUndefined();
  });

  it("does not retry a 5xx from the painting function (only auth endpoints retry)", async () => {
    const fetchMock = jest.fn(async () => ({
      ok: false,
      status: 503,
      headers: { get: () => "application/json" },
      clone: () => ({ text: async () => '{"error":{"code":"PIPELINE"}}' }),
    }));
    globalThis.fetch = fetchMock as any;
    const response = await resilientFetch(PAINT_URL, { method: "POST", timeoutMs: 110_000 });
    expect(response.status).toBe(503);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
