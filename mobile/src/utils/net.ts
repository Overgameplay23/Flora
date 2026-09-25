import NetInfo, { type NetInfoState } from "@react-native-community/netinfo";
import { getRawPublicEnv, isPlaceholderValue, isSupabaseUrlConfigured } from "./env";
import { diagLog } from "./diagLog";

type NetFetchOptions = RequestInit & {
  timeoutMs?: number;
};

const DEFAULT_TIMEOUT_MS = 15_000;
const FAILURE_WINDOW_MS = 30_000;
const MAX_ERROR_BODY_SNIPPET = 500;
const AUTH_RETRY_DELAYS_MS = [500, 1_000, 2_000];
const RETRYABLE_STATUSES = new Set([521, 502, 503, 504]);

type NetworkBlockState = {
  url: string;
  blockedAt: number;
  reason: "REPEATED_FAILURE" | "OFFLINE";
  count: number;
};

export type AuthFetchIssue = {
  type: "retryable" | "invalid_token";
  status: number;
  url: string;
  at: number;
};

const failureTracker = new Map<string, number[]>();
const blockedUrls = new Map<string, NetworkBlockState>();
const networkBlockListeners = new Set<(state: NetworkBlockState | null) => void>();
const authFetchIssueListeners = new Set<(issue: AuthFetchIssue | null) => void>();
let activeNetworkBlock: NetworkBlockState | null = null;
let activeAuthFetchIssue: AuthFetchIssue | null = null;

function truncateValue(value: string | null, maxLength = 120) {
  if (!value) return value;
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength - 3)}...`;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isAuthEndpoint(url: string) {
  return /\/auth\/v1\//.test(url);
}

function isRefreshTokenEndpoint(url: string) {
  return /\/auth\/v1\/token/.test(url) && /grant_type=refresh_token/.test(url);
}

function isJsonContentType(contentType: string | null) {
  if (!contentType) return false;
  const normalized = contentType.toLowerCase();
  return normalized.includes("application/json") || normalized.includes("+json");
}

type StructuredFetchError = Error & {
  errorCode?: string;
  status?: number;
  url?: string;
  method?: string;
  contentType?: string | null;
  snippet?: string;
  retryable?: boolean;
  isNonJsonResponse?: boolean;
};

function createStructuredFetchError(params: {
  message: string;
  errorCode: string;
  status?: number;
  url: string;
  method: string;
  contentType?: string | null;
  snippet?: string;
  retryable?: boolean;
  isNonJsonResponse?: boolean;
}) {
  const err = new Error(params.message) as StructuredFetchError;
  err.errorCode = params.errorCode;
  err.status = params.status;
  err.url = params.url;
  err.method = params.method;
  err.contentType = params.contentType;
  err.snippet = params.snippet;
  err.retryable = params.retryable;
  err.isNonJsonResponse = params.isNonJsonResponse;
  return err;
}

function isStructuredFetchError(error: unknown): error is StructuredFetchError {
  return (
    error instanceof Error &&
    (typeof (error as StructuredFetchError).status === "number" ||
      typeof (error as StructuredFetchError).errorCode === "string")
  );
}

type ConnectivityProbeResult = {
  url: string;
  reachable: boolean;
  status?: number;
  ok?: boolean;
  durationMs: number;
  error?: string;
};

async function probeConnectivity(url: string, timeoutMs = 6_000): Promise<ConnectivityProbeResult> {
  const startedAt = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const resp = await fetch(url, { method: "GET", signal: controller.signal });
    return {
      url,
      reachable: true,
      status: resp.status,
      ok: resp.ok,
      durationMs: Date.now() - startedAt,
    };
  } catch (error: any) {
    return {
      url,
      reachable: false,
      durationMs: Date.now() - startedAt,
      error: error?.message || "Network probe failed",
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function getNetworkState(): Promise<NetInfoState | null> {
  try {
    return await NetInfo.fetch();
  } catch {
    return null;
  }
}

function isDefinitivelyOffline(state: NetInfoState | null) {
  if (!state) return false;
  // NetInfo may report isInternetReachable as null while it is still resolving; treat it as unknown.
  return state.isConnected === false || state.isInternetReachable === false;
}

function updateOfflineBlock(url: string, state: NetInfoState | null) {
  if (!isDefinitivelyOffline(state)) {
    if (activeNetworkBlock?.reason === "OFFLINE") {
      clearNetworkBlock();
    }
    return false;
  }

  const block: NetworkBlockState = {
    url,
    blockedAt: Date.now(),
    reason: "OFFLINE",
    count: 0,
  };
  blockedUrls.clear();
  blockedUrls.set(url, block);
  activeNetworkBlock = block;
  notifyNetworkBlock();
  return true;
}

function shouldBlockUrl(url: string) {
  if (isPlaceholderValue(url)) {
    return { blocked: true, reason: "PLACEHOLDER_URL" };
  }
  if (!isSupabaseUrlConfigured() && url.includes("supabase.co")) {
    return { blocked: true, reason: "SUPABASE_URL_MISSING" };
  }
  return { blocked: false, reason: null };
}

function tagNetworkError(error: unknown, fallbackMessage: string) {
  if (error instanceof Error) {
    (error as any).errorCode = "NETWORK_FAIL";
    return error;
  }
  const wrapped = new Error(fallbackMessage);
  (wrapped as any).errorCode = "NETWORK_FAIL";
  return wrapped;
}

function notifyNetworkBlock() {
  networkBlockListeners.forEach((listener) => listener(activeNetworkBlock));
}

function notifyAuthFetchIssue() {
  authFetchIssueListeners.forEach((listener) => listener(activeAuthFetchIssue));
}

function setAuthFetchIssue(issue: AuthFetchIssue | null) {
  if (
    activeAuthFetchIssue?.type === issue?.type &&
    activeAuthFetchIssue?.status === issue?.status &&
    activeAuthFetchIssue?.url === issue?.url
  ) {
    return;
  }
  activeAuthFetchIssue = issue;
  notifyAuthFetchIssue();
}

function recordFailure(url: string) {
  const now = Date.now();
  const windowed = (failureTracker.get(url) || []).filter(
    (timestamp) => now - timestamp <= FAILURE_WINDOW_MS
  );
  windowed.push(now);
  failureTracker.set(url, windowed);
}

export function subscribeNetworkBlock(listener: (state: NetworkBlockState | null) => void) {
  networkBlockListeners.add(listener);
  listener(activeNetworkBlock);
  return () => {
    networkBlockListeners.delete(listener);
  };
}

export function subscribeAuthFetchIssue(listener: (issue: AuthFetchIssue | null) => void) {
  authFetchIssueListeners.add(listener);
  listener(activeAuthFetchIssue);
  return () => {
    authFetchIssueListeners.delete(listener);
  };
}

export function getAuthFetchIssue() {
  return activeAuthFetchIssue;
}

export function clearAuthFetchIssue() {
  setAuthFetchIssue(null);
}

export function clearNetworkBlock(url?: string) {
  if (url) {
    blockedUrls.delete(url);
    failureTracker.delete(url);
  } else {
    blockedUrls.clear();
    failureTracker.clear();
  }
  activeNetworkBlock = null;
  notifyNetworkBlock();
}

export function getNetworkBlockState() {
  return activeNetworkBlock;
}

export async function runStartupNetworkDiagnostics() {
  const supabaseUrlRaw = getRawPublicEnv("EXPO_PUBLIC_SUPABASE_URL");
  const supabaseUrl =
    supabaseUrlRaw && !isPlaceholderValue(supabaseUrlRaw)
      ? supabaseUrlRaw.replace(/\/$/, "")
      : null;
  const targets = ["https://www.google.com/generate_204"];
  if (supabaseUrl) {
    // Health endpoint returns fast and doesn't require auth; non-200 still confirms reachability.
    targets.push(`${supabaseUrl}/auth/v1/health`);
  }

  // Early probes are non-blocking and only log reachability for troubleshooting.
  const results = await Promise.all(targets.map((target) => probeConnectivity(target)));
  results.forEach((result) => {
    if (result.reachable) {
      console.info("NET_PROBE_OK", {
        url: result.url,
        status: result.status,
        ok: result.ok,
        durationMs: result.durationMs,
      });
    } else {
      console.warn("NET_PROBE_FAIL", {
        url: result.url,
        error: result.error,
        durationMs: result.durationMs,
      });
    }
  });
}

export async function resilientFetch(url: string, options: NetFetchOptions = {}) {
  const method = options?.method || "GET";
  const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const supabaseUrl = getRawPublicEnv("EXPO_PUBLIC_SUPABASE_URL");
  const apiUrl = getRawPublicEnv("EXPO_PUBLIC_API_URL");
  const startedAt = Date.now();
  const authEndpoint = isAuthEndpoint(url);

  if (__DEV__) {
    console.log("NET_FETCH", {
      method,
      url,
      timeoutMs,
      env: {
        SUPABASE_URL: truncateValue(supabaseUrl),
        API_URL: truncateValue(apiUrl),
      },
    });
  }

  const block = shouldBlockUrl(url);
  if (block.blocked) {
    const message =
      block.reason === "SUPABASE_URL_MISSING"
        ? "SUPABASE URL not configured"
        : "Network URL not configured";
    const error = tagNetworkError(new Error(message), message);
    console.error("NET_FETCH_BLOCKED", { url, reason: block.reason, message });
    throw error;
  }

  const netState = await getNetworkState();
  if (__DEV__) {
    console.log("NET_FETCH_NETINFO", {
      url,
      isConnected: netState?.isConnected,
      isInternetReachable: netState?.isInternetReachable,
      type: netState?.type,
      details: netState?.details,
    });
  }
  if (updateOfflineBlock(url, netState)) {
    const message = "Network blocked: check VPN/Wi-Fi";
    const error = tagNetworkError(new Error(message), message);
    (error as any).errorCode = "NETWORK_BLOCKED";
    console.warn("NET_FETCH_PAUSED", {
      url,
      message,
      isConnected: netState?.isConnected,
      isInternetReachable: netState?.isInternetReachable,
    });
    throw error;
  }

  const signal = options?.signal;
  const { timeoutMs: _timeoutMs, ...init } = options;

  for (let attempt = 0; attempt <= AUTH_RETRY_DELAYS_MS.length; attempt += 1) {
    const controller = new AbortController();
    if (signal?.aborted) {
      controller.abort();
    }

    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    const abortListener = () => controller.abort();
    if (signal && !signal.aborted) {
      signal.addEventListener("abort", abortListener, { once: true });
    }

    try {
      const response = await fetch(url, { ...init, signal: controller.signal });
      const contentType = response.headers.get("content-type");
      const retryableStatus = RETRYABLE_STATUSES.has(response.status);
      const refreshTokenRequest = isRefreshTokenEndpoint(url);

      if (refreshTokenRequest) {
        if (response.ok) {
          clearAuthFetchIssue();
        } else if (retryableStatus) {
          setAuthFetchIssue({
            type: "retryable",
            status: response.status,
            url,
            at: Date.now(),
          });
        } else if (response.status === 401 || response.status === 403) {
          setAuthFetchIssue({
            type: "invalid_token",
            status: response.status,
            url,
            at: Date.now(),
          });
        } else {
          clearAuthFetchIssue();
        }
      }

      if (!response.ok) {
        let bodySnippet = "";
        try {
          const rawBody = await response.clone().text();
          bodySnippet = rawBody.slice(0, MAX_ERROR_BODY_SNIPPET);
        } catch (bodyReadError: any) {
          bodySnippet = `[unable to read body: ${bodyReadError?.message || "unknown"}]`;
          diagLog("NET_FETCH_BAD_BODY", {
            status: response.status,
            url,
            snippet: bodySnippet,
          });
        }

        console.warn("NET_FETCH_NON_OK", {
          url,
          method,
          status: response.status,
          contentType: contentType || "unknown",
          bodySnippet,
          durationMs: Date.now() - startedAt,
          attempt,
        });

        if (authEndpoint && retryableStatus && attempt < AUTH_RETRY_DELAYS_MS.length) {
          const retryInMs = AUTH_RETRY_DELAYS_MS[attempt];
          console.warn("NET_FETCH_RETRY", {
            url,
            method,
            status: response.status,
            retryInMs,
            attempt: attempt + 1,
          });
          await sleep(retryInMs);
          continue;
        }

        if (!isJsonContentType(contentType)) {
          diagLog("NON_JSON_RESPONSE", {
            status: response.status,
            url,
            snippet: bodySnippet,
          });
          throw createStructuredFetchError({
            message: `Non-JSON error response (${response.status}) from ${url}`,
            errorCode: retryableStatus ? "AUTH_SERVICE_UNAVAILABLE" : "NON_JSON_ERROR_RESPONSE",
            status: response.status,
            url,
            method,
            contentType,
            snippet: bodySnippet,
            retryable: retryableStatus,
            isNonJsonResponse: true,
          });
        }
      }

      if (__DEV__) {
        console.log("NET_FETCH_RESPONSE", {
          url,
          method,
          status: response.status,
          ok: response.ok,
          durationMs: Date.now() - startedAt,
          attempt,
        });
      }
      return response;
    } catch (error: any) {
      if (isStructuredFetchError(error)) {
        throw error;
      }

      const message = error?.message || "Network request failed";
      recordFailure(url);
      console.error("NET_FETCH_ERROR", {
        url,
        message,
        name: error?.name,
        code: error?.code,
        durationMs: Date.now() - startedAt,
        stack: error?.stack,
        attempt,
      });
      throw tagNetworkError(error, message);
    } finally {
      clearTimeout(timeout);
      if (signal) {
        signal.removeEventListener("abort", abortListener);
      }
    }
  }

  throw tagNetworkError(new Error("Network request failed"), "Network request failed");
}

export const netFetch = resilientFetch;
