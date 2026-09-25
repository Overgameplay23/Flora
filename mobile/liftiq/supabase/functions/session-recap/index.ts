// @ts-nocheck
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const DEFAULT_TIMEOUT_MS = 15_000;

type JsonRecord = Record<string, unknown>;

type SessionSet = {
  completedReps?: number;
  weight?: number;
  isWarmup?: boolean;
};

type SessionExercise = {
  exerciseId?: string | null;
  name?: string | null;
  category?: string | null;
  sets?: SessionSet[] | null;
};

type CompletedSessionPayload = {
  id?: string | null;
  title?: string | null;
  goalPhase?: string | null;
  durationSeconds?: number | null;
  startedAt?: string | null;
  completedAt?: string | null;
  exercises?: SessionExercise[] | null;
};

type SessionRecapPayload = {
  session: CompletedSessionPayload;
  history?: CompletedSessionPayload[] | null;
  profile?: JsonRecord | null;
  persist?: boolean;
};

function jsonResponse(status: number, payload: JsonRecord) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

function extractBearerToken(authHeader: string) {
  if (!authHeader) return null;
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) return null;
  return match[1]?.trim() || null;
}

function toSafeNumber(value: unknown, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function parseBody(raw: unknown): SessionRecapPayload | null {
  if (!raw || typeof raw !== "object") return null;
  const payload = raw as SessionRecapPayload;
  if (!payload.session || typeof payload.session !== "object") return null;
  return payload;
}

function normalizeSet(raw: SessionSet) {
  return {
    completedReps: Math.max(0, Math.floor(toSafeNumber(raw?.completedReps))),
    weight: Math.max(0, toSafeNumber(raw?.weight)),
    isWarmup: raw?.isWarmup === true,
  };
}

function normalizeExercises(exercises: SessionExercise[] | null | undefined) {
  return (Array.isArray(exercises) ? exercises : []).map((exercise, index) => {
    const sets = (Array.isArray(exercise?.sets) ? exercise.sets : [])
      .map(normalizeSet)
      .filter((set) => !set.isWarmup);

    return {
      exerciseId: String(exercise?.exerciseId || ""),
      name: String(exercise?.name || `Exercise ${index + 1}`).trim(),
      category: String(exercise?.category || "").trim(),
      sets,
    };
  });
}

function summarizeSession(session: CompletedSessionPayload) {
  const exercises = normalizeExercises(session.exercises);
  const flattenedSets = exercises.flatMap((exercise) =>
    exercise.sets.map((set) => ({
      exerciseName: exercise.name,
      category: exercise.category,
      ...set,
    }))
  );
  const totalSets = flattenedSets.length;
  const totalVolume = flattenedSets.reduce((sum, set) => sum + set.weight * set.completedReps, 0);
  const topSet = flattenedSets.reduce(
    (best, set) => {
      const score = set.weight * Math.max(set.completedReps, 1);
      if (!best || score > best.score) {
        return {
          exerciseName: set.exerciseName,
          reps: set.completedReps,
          weight: set.weight,
          score,
        };
      }
      return best;
    },
    null as null | { exerciseName: string; reps: number; weight: number; score: number }
  );

  return {
    exercises,
    flattenedSets,
    totalExercises: exercises.filter((exercise) => exercise.sets.length > 0).length,
    totalSets,
    totalVolume,
    topSet,
  };
}

function buildHistoryLookup(history: CompletedSessionPayload[] | null | undefined) {
  const byExercise = new Map<string, Array<{ weight: number; reps: number }>>();

  for (const session of Array.isArray(history) ? history : []) {
    for (const exercise of normalizeExercises(session.exercises)) {
      const key = exercise.exerciseId || exercise.name.toLowerCase();
      if (!key) continue;
      const entries = byExercise.get(key) || [];
      for (const set of exercise.sets) {
        entries.push({ weight: set.weight, reps: set.completedReps });
      }
      byExercise.set(key, entries);
    }
  }

  return byExercise;
}

function collectPrFlags(session: CompletedSessionPayload, history: CompletedSessionPayload[] | null | undefined) {
  const currentExercises = normalizeExercises(session.exercises);
  const historyLookup = buildHistoryLookup(history);
  const prFlags: Array<JsonRecord> = [];

  for (const exercise of currentExercises) {
    const key = exercise.exerciseId || exercise.name.toLowerCase();
    if (!key || exercise.sets.length === 0) continue;

    const bestCurrent = exercise.sets.reduce((best, set) => {
      const score = set.weight * Math.max(set.completedReps, 1);
      if (!best || score > best.score) {
        return { reps: set.completedReps, weight: set.weight, score };
      }
      return best;
    }, null as null | { reps: number; weight: number; score: number });

    const previousSets = historyLookup.get(key) || [];
    const bestPrevious = previousSets.reduce((best, set) => {
      const score = set.weight * Math.max(set.reps, 1);
      return !best || score > best.score ? { ...set, score } : best;
    }, null as null | { reps: number; weight: number; score: number });

    if (bestCurrent && (!bestPrevious || bestCurrent.score > bestPrevious.score)) {
      prFlags.push({
        exercise: exercise.name,
        weight: bestCurrent.weight,
        reps: bestCurrent.reps,
        previousWeight: bestPrevious?.weight ?? null,
        previousReps: bestPrevious?.reps ?? null,
      });
    }
  }

  return prFlags;
}

function collectStallFlags(session: CompletedSessionPayload, history: CompletedSessionPayload[] | null | undefined) {
  const currentExercises = normalizeExercises(session.exercises);
  const historyLookup = buildHistoryLookup(history);
  const stalled: Array<JsonRecord> = [];

  for (const exercise of currentExercises) {
    const key = exercise.exerciseId || exercise.name.toLowerCase();
    const previousSets = historyLookup.get(key) || [];
    if (exercise.sets.length === 0 || previousSets.length < 2) continue;

    const bestCurrent = exercise.sets.reduce((best, set) => {
      const score = set.weight * Math.max(set.completedReps, 1);
      return !best || score > best.score ? { reps: set.completedReps, weight: set.weight, score } : best;
    }, null as null | { reps: number; weight: number; score: number });

    const recentScores = previousSets
      .slice(-6)
      .map((set) => set.weight * Math.max(set.reps, 1))
      .sort((a, b) => b - a);

    const reference = recentScores[0] || 0;
    if (bestCurrent && reference > 0 && bestCurrent.score < reference * 0.95) {
      stalled.push({
        exercise: exercise.name,
        currentScore: bestCurrent.score,
        recentBestScore: reference,
      });
    }
  }

  return stalled;
}

function buildDeterministicRecap(payload: SessionRecapPayload) {
  const sessionSummary = summarizeSession(payload.session);
  const prFlags = collectPrFlags(payload.session, payload.history);
  const stalledLiftFlags = collectStallFlags(payload.session, payload.history);
  const durationMinutes = Math.round(Math.max(0, toSafeNumber(payload.session.durationSeconds)) / 60);
  const summaryParts = [
    `${sessionSummary.totalExercises} exercise${sessionSummary.totalExercises === 1 ? "" : "s"}`,
    `${sessionSummary.totalSets} work set${sessionSummary.totalSets === 1 ? "" : "s"}`,
    `${Math.round(sessionSummary.totalVolume)} lb total volume`,
  ];

  if (durationMinutes > 0) {
    summaryParts.push(`${durationMinutes} min`);
  }

  if (sessionSummary.topSet) {
    summaryParts.push(
      `top set ${sessionSummary.topSet.weight} x ${sessionSummary.topSet.reps} on ${sessionSummary.topSet.exerciseName}`
    );
  }

  let actionableTakeaway =
    "Repeat the same exercise order next session and push one top set slightly harder if readiness feels normal.";

  if (stalledLiftFlags.length > 0) {
    const first = stalledLiftFlags[0];
    actionableTakeaway =
      `Hold load on ${first.exercise} next time and focus on matching reps with cleaner execution before progressing.`;
  } else if (prFlags.length > 0) {
    const first = prFlags[0];
    actionableTakeaway =
      `You moved ${first.exercise} forward today. Keep the same setup next session and take the smallest available jump if recovery is solid.`;
  } else if (sessionSummary.totalSets >= 16) {
    actionableTakeaway =
      "Volume was already high today. Keep accessories tight next session and protect bar speed on compounds.";
  }

  return {
    summary: `Completed ${summaryParts.join(", ")}.`,
    actionableTakeaway,
    prFlags,
    stalledLiftFlags,
    evidence: {
      totalExercises: sessionSummary.totalExercises,
      totalSets: sessionSummary.totalSets,
      totalVolume: sessionSummary.totalVolume,
      topSet: sessionSummary.topSet,
      profileGoalPhase: payload.profile?.goalPhase || payload.session.goalPhase || null,
    },
    providerUsed: "deterministic",
    fallbackUsed: true,
  };
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

function parseProviderJson(content: string) {
  try {
    const parsed = JSON.parse(content);
    if (!parsed || typeof parsed !== "object") return null;
    return parsed as JsonRecord;
  } catch {
    return null;
  }
}

async function generateWithProvider(payload: SessionRecapPayload, deterministic: JsonRecord) {
  const timeoutMs = Math.max(5_000, Math.min(60_000, Math.floor(toSafeNumber(Deno.env.get("REQUEST_TIMEOUT_MS"), DEFAULT_TIMEOUT_MS))));
  const openRouterApiKey = String(Deno.env.get("OPENROUTER_API_KEY") || "").trim();
  const groqApiKey = String(Deno.env.get("GROQ_API_KEY") || "").trim();

  if (!openRouterApiKey && !groqApiKey) {
    return deterministic;
  }

  const systemPrompt =
    "You are a strength training recap assistant. Return strict JSON only with keys " +
    "{\"summary\": string, \"actionableTakeaway\": string, \"prFlags\": array, \"stalledLiftFlags\": array, \"evidence\": object}. " +
    "Every statement must be grounded in the provided workout data. No medical advice, no hype language.";

  const userPrompt = JSON.stringify({
    instruction: "Summarize this workout, mention notable progress or stalls, and suggest one next action.",
    session: payload.session,
    history: payload.history || [],
    profile: payload.profile || {},
    deterministicBaseline: deterministic,
  });

  const requestBody = {
    model: openRouterApiKey
      ? String(Deno.env.get("OPENROUTER_MODEL") || "openai/gpt-4o-mini")
      : String(Deno.env.get("GROQ_MODEL") || "llama-3.1-8b-instant"),
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    temperature: 0.2,
    response_format: { type: "json_object" },
  };

  const endpoint = openRouterApiKey
    ? "https://openrouter.ai/api/v1/chat/completions"
    : "https://api.groq.com/openai/v1/chat/completions";

  const apiKey = openRouterApiKey || groqApiKey;

  try {
    const response = await fetchWithTimeout(
      endpoint,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      },
      timeoutMs
    );

    if (!response.ok) {
      return deterministic;
    }

    const data = (await response.json()) as JsonRecord;
    const content = String(
      ((data.choices as JsonRecord[] | undefined)?.[0]?.message as JsonRecord | undefined)?.content || ""
    ).trim();
    const parsed = parseProviderJson(content);

    if (!parsed?.summary || !parsed?.actionableTakeaway) {
      return deterministic;
    }

    return {
      summary: String(parsed.summary),
      actionableTakeaway: String(parsed.actionableTakeaway),
      prFlags: Array.isArray(parsed.prFlags) ? parsed.prFlags : deterministic.prFlags,
      stalledLiftFlags: Array.isArray(parsed.stalledLiftFlags) ? parsed.stalledLiftFlags : deterministic.stalledLiftFlags,
      evidence: parsed.evidence && typeof parsed.evidence === "object" ? parsed.evidence : deterministic.evidence,
      providerUsed: openRouterApiKey ? "openrouter" : "groq",
      fallbackUsed: false,
    };
  } catch {
    return deterministic;
  }
}

async function maybePersistRecap(admin: any, userId: string, sessionId: string, recap: JsonRecord) {
  if (!admin || !sessionId) return;

  await admin.from("session_recaps").upsert(
    {
      session_id: sessionId,
      user_id: userId,
      summary: String(recap.summary || ""),
      actionable_takeaway: String(recap.actionableTakeaway || ""),
      pr_flags: Array.isArray(recap.prFlags) ? recap.prFlags : [],
      stalled_lift_flags: Array.isArray(recap.stalledLiftFlags) ? recap.stalledLiftFlags : [],
      evidence: recap.evidence && typeof recap.evidence === "object" ? recap.evidence : {},
      provider_used: String(recap.providerUsed || "deterministic"),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "session_id" }
  );
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method === "GET") {
    return jsonResponse(200, {
      ok: true,
      name: "session-recap",
      time: new Date().toISOString(),
      authRequired: true,
    });
  }

  if (req.method !== "POST") {
    return jsonResponse(405, {
      error: "method_not_allowed",
      message: "Use GET or POST.",
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !supabaseAnonKey) {
    return jsonResponse(500, {
      error: "config_error",
      message: "Missing Supabase function configuration.",
    });
  }

  const authHeader = req.headers.get("Authorization") || "";
  const accessToken = extractBearerToken(authHeader);
  if (!accessToken) {
    return jsonResponse(401, {
      error: "unauthorized",
      message: "Missing Authorization header.",
    });
  }

  let body: SessionRecapPayload | null = null;
  try {
    body = parseBody(await req.json());
  } catch {
    body = null;
  }

  if (!body) {
    return jsonResponse(400, {
      error: "bad_request",
      message: "Expected a JSON body with a `session` object.",
    });
  }

  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });

  const {
    data: { user },
    error: authError,
  } = await userClient.auth.getUser();

  if (authError || !user) {
    return jsonResponse(401, {
      error: "unauthorized",
      message: "Unauthorized request.",
    });
  }

  const deterministic = buildDeterministicRecap(body);
  const recap = await generateWithProvider(body, deterministic);
  const requestId = crypto.randomUUID();

  if (body.persist !== false && serviceRoleKey && body.session?.id) {
    const admin = createClient(supabaseUrl, serviceRoleKey);
    await maybePersistRecap(admin, user.id, String(body.session.id), recap);
  }

  return jsonResponse(200, {
    requestId,
    sessionId: body.session?.id || null,
    summary: String(recap.summary || deterministic.summary),
    actionableTakeaway: String(recap.actionableTakeaway || deterministic.actionableTakeaway),
    prFlags: Array.isArray(recap.prFlags) ? recap.prFlags : [],
    stalledLiftFlags: Array.isArray(recap.stalledLiftFlags) ? recap.stalledLiftFlags : [],
    evidence: recap.evidence && typeof recap.evidence === "object" ? recap.evidence : {},
    providerUsed: String(recap.providerUsed || "deterministic"),
    fallbackUsed: recap.fallbackUsed !== false,
  });
});
