export function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function safeJsonParse(text) {
  if (typeof text !== "string") {
    return { ok: false, value: null };
  }
  const trimmed = text.trim();
  if (!trimmed) {
    return { ok: false, value: null };
  }
  try {
    return { ok: true, value: JSON.parse(trimmed) };
  } catch (_error) {
    return { ok: false, value: null };
  }
}
