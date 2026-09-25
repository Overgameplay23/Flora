// @ts-nocheck
type ProviderName = "openrouter" | "groq";

type StructuredSummary = {
  summary: string;
  highlights: Record<string, unknown>;
  memories: string[];
};

type ProviderSuccess = {
  ok: true;
  providerUsed: ProviderName;
  payload: StructuredSummary;
};

type ProviderFailure = {
  ok: false;
  providerUsed: ProviderName;
  status?: number;
  message: string;
  retryable: boolean;
};

type ProviderResult = ProviderSuccess | ProviderFailure;

export type GenerateWeeklySummaryOptions = {
  systemPrompt: string;
  userPrompt: string;
  primary: string;
  fallback?: string | null;
  timeoutMs: number;
  openRouterApiKey?: string;
  openRouterModel?: string;
  groqApiKey?: string;
  groqModel?: string;
};

function toProviderName(value: string | null | undefined): ProviderName | null {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "openrouter") return "openrouter";
  if (normalized === "groq") return "groq";
  return null;
}

function safeMessageText(payload: unknown) {
  if (!payload || typeof payload !== "object") return null;
  const root = payload as Record<string, unknown>;
  const direct =
    root?.error && typeof root.error === "object"
      ? (root.error as Record<string, unknown>).message
      : root?.message;
  if (typeof direct === "string" && direct.trim().length > 0) {
    return direct.trim();
  }
  return null;
}

function extractReply(payload: unknown) {
  if (!payload || typeof payload !== "object") return null;
  const root = payload as Record<string, unknown>;
  const choices = Array.isArray(root.choices) ? root.choices : [];
  const first = choices[0] as Record<string, unknown> | undefined;
  const message = first?.message as Record<string, unknown> | undefined;
  const content = message?.content;
  if (typeof content === "string" && content.trim().length > 0) {
    return content.trim();
  }
  if (Array.isArray(content)) {
    const joined = content
      .map((part) => (typeof part === "string" ? part : null))
      .filter(Boolean)
      .join(" ")
      .trim();
    if (joined.length > 0) return joined;
  }
  return null;
}

async function fetchJsonWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number
): Promise<{ response: Response; payload: unknown; snippet: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    const text = await response.text();
    let payload: unknown = null;
    try {
      payload = text ? JSON.parse(text) : null;
    } catch {
      payload = null;
    }
    return {
      response,
      payload,
      snippet: (text || "").slice(0, 300),
    };
  } finally {
    clearTimeout(timer);
  }
}

function buildChatPayload(systemPrompt: string, userPrompt: string, model: string) {
  return {
    model,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    temperature: 0.4,
    max_tokens: 350,
    stream: false,
  };
}

function parseJsonLike(text: string) {
  const trimmed = text.trim();
  if (!trimmed) return null;

  const direct = tryParseStructured(trimmed);
  if (direct) return direct;

  const fenced = trimmed.match(/```json\s*([\s\S]*?)\s*```/i);
  if (fenced?.[1]) {
    const parsed = tryParseStructured(fenced[1]);
    if (parsed) return parsed;
  }

  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    const sliced = trimmed.slice(firstBrace, lastBrace + 1);
    const parsed = tryParseStructured(sliced);
    if (parsed) return parsed;
  }

  return null;
}

function tryParseStructured(raw: string): StructuredSummary | null {
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    const root = parsed as Record<string, unknown>;
    const summaryRaw = typeof root.summary === "string" ? root.summary.trim() : "";
    const highlightsRaw =
      root.highlights && typeof root.highlights === "object"
        ? (root.highlights as Record<string, unknown>)
        : {};
    const memoriesRaw = Array.isArray(root.memories) ? root.memories : [];
    const memories = memoriesRaw
      .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
      .filter((entry) => entry.length > 0)
      .slice(0, 4);
    if (!summaryRaw) return null;
    return {
      summary: summaryRaw.slice(0, 800),
      highlights: highlightsRaw,
      memories,
    };
  } catch {
    return null;
  }
}

async function callOpenRouter(options: GenerateWeeklySummaryOptions): Promise<ProviderResult> {
  const providerUsed: ProviderName = "openrouter";
  const apiKey = options.openRouterApiKey || "";
  if (!apiKey) {
    return {
      ok: false,
      providerUsed,
      message: "OPENROUTER_API_KEY is not configured.",
      retryable: false,
    };
  }

  const model = options.openRouterModel || "openrouter/free";
  const body = buildChatPayload(options.systemPrompt, options.userPrompt, model);

  try {
    const { response, payload, snippet } = await fetchJsonWithTimeout(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      },
      options.timeoutMs
    );

    if (!response.ok) {
      return {
        ok: false,
        providerUsed,
        status: response.status,
        message:
          safeMessageText(payload) ||
          `OpenRouter request failed (${response.status}). ${snippet || "No response body."}`,
        retryable: response.status >= 500,
      };
    }

    const reply = extractReply(payload);
    if (!reply) {
      return {
        ok: false,
        providerUsed,
        status: 502,
        message: "OpenRouter returned no reply text.",
        retryable: false,
      };
    }

    const structured = parseJsonLike(reply);
    if (!structured) {
      return {
        ok: false,
        providerUsed,
        status: 502,
        message: "OpenRouter reply could not be parsed as structured JSON.",
        retryable: false,
      };
    }

    return {
      ok: true,
      providerUsed,
      payload: structured,
    };
  } catch (error) {
    return {
      ok: false,
      providerUsed,
      status: 503,
      message: (error as Error)?.message || "OpenRouter request failed.",
      retryable: true,
    };
  }
}

async function callGroq(options: GenerateWeeklySummaryOptions): Promise<ProviderResult> {
  const providerUsed: ProviderName = "groq";
  const apiKey = options.groqApiKey || "";
  if (!apiKey) {
    return {
      ok: false,
      providerUsed,
      message: "GROQ_API_KEY is not configured.",
      retryable: false,
    };
  }

  const model = options.groqModel || "llama-3.1-8b-instant";
  const body = buildChatPayload(options.systemPrompt, options.userPrompt, model);

  try {
    const { response, payload, snippet } = await fetchJsonWithTimeout(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      },
      options.timeoutMs
    );

    if (!response.ok) {
      return {
        ok: false,
        providerUsed,
        status: response.status,
        message:
          safeMessageText(payload) ||
          `Groq request failed (${response.status}). ${snippet || "No response body."}`,
        retryable: response.status >= 500,
      };
    }

    const reply = extractReply(payload);
    if (!reply) {
      return {
        ok: false,
        providerUsed,
        status: 502,
        message: "Groq returned no reply text.",
        retryable: false,
      };
    }

    const structured = parseJsonLike(reply);
    if (!structured) {
      return {
        ok: false,
        providerUsed,
        status: 502,
        message: "Groq reply could not be parsed as structured JSON.",
        retryable: false,
      };
    }

    return {
      ok: true,
      providerUsed,
      payload: structured,
    };
  } catch (error) {
    return {
      ok: false,
      providerUsed,
      status: 503,
      message: (error as Error)?.message || "Groq request failed.",
      retryable: true,
    };
  }
}

async function callProvider(provider: ProviderName, options: GenerateWeeklySummaryOptions) {
  if (provider === "openrouter") return callOpenRouter(options);
  return callGroq(options);
}

export async function generateWeeklySummaryObject(options: GenerateWeeklySummaryOptions) {
  const primary = toProviderName(options.primary) || "openrouter";
  const fallback = toProviderName(options.fallback || null);

  const primaryResult = await callProvider(primary, options);
  if (primaryResult.ok) return primaryResult;

  const canFallback =
    fallback &&
    fallback !== primary &&
    (primaryResult.retryable || (primaryResult.status || 0) >= 500);

  if (!canFallback) return primaryResult;

  const fallbackResult = await callProvider(fallback, options);
  return fallbackResult;
}
