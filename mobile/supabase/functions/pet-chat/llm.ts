// @ts-nocheck
export type PetChatMessage = {
  role: "user" | "assistant";
  content: string;
};

type ProviderName = "openrouter" | "groq";

type ProviderSuccess = {
  ok: true;
  reply: string;
  providerUsed: ProviderName;
};

type ProviderFailure = {
  ok: false;
  providerUsed: ProviderName;
  status?: number;
  message: string;
  retryable: boolean;
};

export type ProviderResult = ProviderSuccess | ProviderFailure;

export type GenerateReplyOptions = {
  messages: PetChatMessage[];
  systemPrompt: string;
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

function buildChatPayload(systemPrompt: string, messages: PetChatMessage[], model: string) {
  return {
    model,
    messages: [
      { role: "system", content: systemPrompt },
      ...messages.map((item) => ({ role: item.role, content: item.content })),
    ],
    temperature: 0.7,
    max_tokens: 200,
    stream: false,
  };
}

async function callOpenRouter(options: GenerateReplyOptions): Promise<ProviderResult> {
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
  const body = buildChatPayload(options.systemPrompt, options.messages, model);

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
      const providerMessage = safeMessageText(payload);
      return {
        ok: false,
        providerUsed,
        status: response.status,
        message:
          providerMessage ||
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

    return {
      ok: true,
      reply,
      providerUsed,
    };
  } catch (error) {
    const message = (error as Error)?.message || "OpenRouter request failed.";
    return {
      ok: false,
      providerUsed,
      status: 503,
      message,
      retryable: true,
    };
  }
}

async function callGroq(options: GenerateReplyOptions): Promise<ProviderResult> {
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
  const body = buildChatPayload(options.systemPrompt, options.messages, model);

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
      const providerMessage = safeMessageText(payload);
      return {
        ok: false,
        providerUsed,
        status: response.status,
        message:
          providerMessage ||
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

    return {
      ok: true,
      reply,
      providerUsed,
    };
  } catch (error) {
    const message = (error as Error)?.message || "Groq request failed.";
    return {
      ok: false,
      providerUsed,
      status: 503,
      message,
      retryable: true,
    };
  }
}

async function callProvider(provider: ProviderName, options: GenerateReplyOptions) {
  if (provider === "openrouter") {
    return callOpenRouter(options);
  }
  return callGroq(options);
}

export async function generatePetReply(options: GenerateReplyOptions): Promise<ProviderResult> {
  const primary = toProviderName(options.primary) || "openrouter";
  const fallback = toProviderName(options.fallback || null);

  const primaryResult = await callProvider(primary, options);
  if (primaryResult.ok) return primaryResult;

  const canFallback =
    fallback && fallback !== primary && (primaryResult.retryable || (primaryResult.status || 0) >= 500);

  if (!canFallback) return primaryResult;

  const fallbackResult = await callProvider(fallback, options);
  if (fallbackResult.ok) return fallbackResult;

  return fallbackResult;
}
