// @ts-nocheck
// pet-talk: the pet's conversation, backed by OpenAI. New function (pet-chat is left as it was).
//
// Secrets (set on the hosted project, never in the app):
//   OPENAI_API_KEY          required for real replies
//   OPENAI_MODEL            model name (defaults to gpt-4o-mini until the owner picks one)
//   PET_TALK_MAX_PER_DAY    per-user daily cap (default 30) via consume_pet_chat_quota
//   PET_TALK_TIMEOUT_MS     provider timeout (default 20000)
//
// Requests (Authorization: Bearer <user JWT>):
//   GET  /                          -> health, including whether a key is configured
//   POST { "ping": true }           -> { configured } (no model call)
//   POST { messages, context }      -> { reply, remaining, resetAt, model }
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.3";
import { buildSystemPrompt, normalizeContext } from "./prompt.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const FUNCTION_NAME = "pet-talk";
const FUNCTION_VERSION = "v1";
const MAX_MESSAGES = 12;
const MAX_CONTENT_CHARS = 800;
const DEFAULT_MODEL = "gpt-4o-mini";
const OPENAI_URL = "https://api.openai.com/v1/chat/completions";

function json(status: number, payload: Record<string, unknown>) {
  return new Response(JSON.stringify(payload), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

function envInt(name: string, fallback: number) {
  const parsed = Number(Deno.env.get(name));
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

function bearer(header: string | null) {
  const match = String(header || "").match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : null;
}

function normalizeMessages(input: unknown): { ok: true; messages: Array<{ role: "user" | "assistant"; content: string }> } | { ok: false; message: string } {
  if (!Array.isArray(input) || input.length === 0) return { ok: false, message: "`messages` must be a non-empty array." };
  const out: Array<{ role: "user" | "assistant"; content: string }> = [];
  for (const raw of input.slice(-MAX_MESSAGES)) {
    const role = String(raw?.role || "").toLowerCase();
    const content = typeof raw?.content === "string" ? raw.content.trim().slice(0, MAX_CONTENT_CHARS) : "";
    if ((role !== "user" && role !== "assistant") || !content) continue;
    out.push({ role, content });
  }
  if (out.length === 0 || out[out.length - 1].role !== "user") return { ok: false, message: "The last message must be from the person." };
  return { ok: true, messages: out };
}

function isQuotaNotConfigured(error: { code?: string | null; message?: string | null } | null | undefined) {
  const code = String(error?.code || "");
  const message = String(error?.message || "").toLowerCase();
  return code === "PGRST202" || code === "42883" || message.includes("consume_pet_chat_quota") || message.includes("does not exist");
}

async function callOpenAI(apiKey: string, model: string, systemPrompt: string, messages: Array<{ role: string; content: string }>, timeoutMs: number) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(OPENAI_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        messages: [{ role: "system", content: systemPrompt }, ...messages],
        max_tokens: 220,
        temperature: 0.8,
      }),
      signal: controller.signal,
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      const message = payload?.error?.message || `OpenAI returned ${response.status}`;
      return { ok: false as const, status: response.status, message };
    }
    const reply = String(payload?.choices?.[0]?.message?.content || "").trim();
    if (!reply) return { ok: false as const, status: 502, message: "Empty reply from the model." };
    return { ok: true as const, reply };
  } catch (error) {
    return { ok: false as const, status: 504, message: error?.name === "AbortError" ? "The model took too long." : String(error?.message || error) };
  } finally {
    clearTimeout(timer);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const apiKey = Deno.env.get("OPENAI_API_KEY") || "";
  const model = Deno.env.get("OPENAI_MODEL") || DEFAULT_MODEL;
  const configured = apiKey.length > 0;

  if (req.method === "GET") {
    return json(200, { ok: true, name: FUNCTION_NAME, version: FUNCTION_VERSION, configured, model: configured ? model : null, time: new Date().toISOString() });
  }
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (!supabaseUrl || !serviceRoleKey) return json(500, { error: "Function is missing its Supabase configuration." });

  const token = bearer(req.headers.get("Authorization"));
  if (!token) return json(401, { error: "Sign in to talk to your pet." });
  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: userData, error: userError } = await admin.auth.getUser(token);
  const userId = userData?.user?.id;
  if (userError || !userId) return json(401, { error: "Your session has expired. Sign in again." });

  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) || {};
  } catch {
    return json(400, { error: "Body must be JSON." });
  }

  if (body.ping === true) return json(200, { configured, model: configured ? model : null });
  if (!configured) return json(503, { error: "The pet's voice is not set up yet.", code: "not_configured" });

  const parsed = normalizeMessages(body.messages);
  if (!parsed.ok) return json(400, { error: parsed.message });
  const context = normalizeContext(body.context);

  // quota: the same daily counter the old chat used; missing RPC means "no cap" on an older database
  const maxPerDay = envInt("PET_TALK_MAX_PER_DAY", 30);
  let remaining = maxPerDay;
  let resetAt: string | null = null;
  const quota = await admin.rpc("consume_pet_chat_quota", { p_user_id: userId, p_max: maxPerDay });
  if (quota.error && !isQuotaNotConfigured(quota.error)) return json(500, { error: "Could not check today's limit." });
  if (!quota.error) {
    const row = Array.isArray(quota.data) ? quota.data[0] : quota.data;
    if (row && row.allowed === false) return json(429, { error: `${context.petName} needs a rest until tomorrow.`, code: "quota", resetAt: row.reset_at ?? null });
    remaining = Number(row?.remaining ?? maxPerDay);
    resetAt = row?.reset_at ?? null;
  }

  const result = await callOpenAI(apiKey, model, buildSystemPrompt(context), parsed.messages, envInt("PET_TALK_TIMEOUT_MS", 20_000));
  if (!result.ok) {
    console.error("PET_TALK_PROVIDER_ERROR", { status: result.status, message: result.message, user: userId.slice(0, 8) });
    return json(502, { error: `${context.petName} couldn't find the words just now. Try again in a moment.`, code: "provider" });
  }
  return json(200, { reply: result.reply, remaining, resetAt, model });
});
