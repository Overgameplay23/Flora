export type DiagEntry = {
  timestamp: string;
  event: string;
  payload?: unknown;
};

const MAX_DIAG_ENTRIES = 200;
const entries: DiagEntry[] = [];

const REDACT_PATTERNS = [
  "password",
  "access_token",
  "refresh_token",
  "token",
  "authorization",
  "apikey",
  "api_key",
  "anon_key",
  "email",
];

function shouldRedactKey(key: string) {
  const normalized = key.toLowerCase();
  return REDACT_PATTERNS.some((pattern) => normalized.includes(pattern));
}

function safeSerialize(value: unknown, seen = new WeakSet<object>(), depth = 0): unknown {
  if (value == null) return value;
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return value;
  if (typeof value === "bigint") return String(value);
  if (value instanceof Date) return value.toISOString();
  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
    };
  }
  if (depth >= 6) return "[MaxDepth]";
  if (Array.isArray(value)) {
    return value.map((item) => safeSerialize(item, seen, depth + 1));
  }
  if (typeof value === "object") {
    if (seen.has(value as object)) return "[Circular]";
    seen.add(value as object);
    const output: Record<string, unknown> = {};
    Object.entries(value as Record<string, unknown>).forEach(([key, nextValue]) => {
      if (shouldRedactKey(key)) {
        output[key] = "[REDACTED]";
      } else {
        output[key] = safeSerialize(nextValue, seen, depth + 1);
      }
    });
    seen.delete(value as object);
    return output;
  }
  return String(value);
}

export function diagLog(event: string, payload?: unknown) {
  const entry: DiagEntry = {
    timestamp: new Date().toISOString(),
    event,
    payload: payload == null ? undefined : safeSerialize(payload),
  };
  entries.push(entry);
  if (entries.length > MAX_DIAG_ENTRIES) {
    entries.splice(0, entries.length - MAX_DIAG_ENTRIES);
  }
}

export function getDiagLogs() {
  return entries.slice();
}

export function clearDiagLogs() {
  entries.length = 0;
}
