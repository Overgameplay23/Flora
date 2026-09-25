import { supabase } from "../lib/supabase";

export type PetChatMode = "coach" | "chat";

export type PetChatMessageInput = {
  role: "user" | "assistant";
  content: string;
};

export type PetChatResponse = {
  reply: string;
  providerUsed: string | null;
  requestId: string | null;
  mode: PetChatMode;
  context?: {
    mood?: string;
    streakDays?: number;
    riskScore?: number;
  } | null;
  rateLimit: {
    remaining: number;
    resetAt: string | null;
  };
};

export class PetChatError extends Error {
  status: number | null;
  code: string | null;
  resetAt: string | null;
  providerUsed: string | null;
  requestId: string | null;

  constructor(
    message: string,
    options?: {
      status?: number | null;
      code?: string | null;
      resetAt?: string | null;
      providerUsed?: string | null;
      requestId?: string | null;
    }
  ) {
    super(message);
    this.name = "PetChatError";
    this.status = options?.status ?? null;
    this.code = options?.code ?? null;
    this.resetAt = options?.resetAt ?? null;
    this.providerUsed = options?.providerUsed ?? null;
    this.requestId = options?.requestId ?? null;
  }
}

function toSafeNumber(value: unknown, fallback = 0) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(0, Math.floor(parsed));
}

function toJsonRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object") return null;
  return value as Record<string, unknown>;
}

async function parseInvokeError(error: any) {
  const context = error?.context;
  let status: number | null = null;
  let payload: Record<string, unknown> | null = null;

  if (typeof context?.status === "number") {
    status = context.status;
  }

  if (context && typeof context.clone === "function") {
    try {
      const cloned = context.clone();
      const parsed = await cloned.json();
      payload = toJsonRecord(parsed);
      if (status == null && typeof context.status === "number") {
        status = context.status;
      }
    } catch {
      // ignore parse failures
    }
  }

  if (!payload && typeof context?.body === "string") {
    try {
      payload = toJsonRecord(JSON.parse(context.body));
    } catch {
      payload = null;
    }
  }

  if (status == null) {
    status = Number(error?.status);
    if (!Number.isFinite(status)) {
      status = null;
    }
  }

  return { status, payload };
}

export async function invokePetChat(
  messages: PetChatMessageInput[],
  options?: { mode?: PetChatMode }
): Promise<PetChatResponse> {
  const mode: PetChatMode = options?.mode === "chat" ? "chat" : "coach";

  const {
    data: { session },
  } = await supabase.auth.getSession();
  const accessToken = session?.access_token || null;

  const { data, error } = await supabase.functions.invoke("pet-chat", {
    headers: accessToken
      ? {
          Authorization: `Bearer ${accessToken}`,
        }
      : undefined,
    body: { messages, mode },
  });

  if (error) {
    const parsed = await parseInvokeError(error);
    const payload = parsed.payload || {};
    const code = typeof payload.error === "string" ? payload.error : null;
    const requestId = typeof payload.requestId === "string" ? payload.requestId : null;
    const resetAt =
      typeof payload.resetAt === "string"
        ? payload.resetAt
        : typeof toJsonRecord(payload.rateLimit)?.resetAt === "string"
          ? String(toJsonRecord(payload.rateLimit)?.resetAt)
          : null;
    const providerUsed = typeof payload.providerUsed === "string" ? payload.providerUsed : null;
    const message =
      typeof payload.message === "string" && payload.message.trim().length > 0
        ? payload.message.trim()
        : error?.message || "Chat request failed.";

    throw new PetChatError(message, {
      status: parsed.status,
      code,
      resetAt,
      providerUsed,
      requestId,
    });
  }

  const payload = toJsonRecord(data) || {};
  const reply = typeof payload.reply === "string" ? payload.reply.trim() : "";
  const requestId = typeof payload.requestId === "string" ? payload.requestId : null;
  if (!reply) {
    throw new PetChatError("Chat reply was empty.", {
      status: 502,
      code: "empty_reply",
      providerUsed: typeof payload.providerUsed === "string" ? payload.providerUsed : null,
      requestId,
    });
  }

  const rateLimit = toJsonRecord(payload.rateLimit) || {};
  const context = toJsonRecord(payload.context);
  const parsedMode = payload.mode === "chat" ? "chat" : "coach";

  return {
    reply,
    providerUsed: typeof payload.providerUsed === "string" ? payload.providerUsed : null,
    requestId,
    mode: parsedMode,
    context: context
      ? {
          mood: typeof context.mood === "string" ? context.mood : undefined,
          streakDays: toSafeNumber(context.streakDays, 0),
          riskScore: toSafeNumber(context.riskScore, 0),
        }
      : null,
    rateLimit: {
      remaining: toSafeNumber(rateLimit.remaining, 0),
      resetAt: typeof rateLimit.resetAt === "string" ? rateLimit.resetAt : null,
    },
  };
}

