// @ts-nocheck
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.3";
import { generateWeeklySummaryObject } from "./llm.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-admin-secret",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

const DEFAULT_TIMEOUT_MS = 20_000;
const DEFAULT_ADMIN_BATCH_LIMIT = 25;
const MAX_ADMIN_BATCH_LIMIT = 200;

type JsonRecord = Record<string, unknown>;

type DailyMetricsRow = {
  day: string;
  tasks_completed: number | null;
  tasks_created: number | null;
  checkins_completed: number | null;
  points_earned: number | null;
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
  const token = match[1]?.trim();
  return token || null;
}

function toDateKeyUTC(date: Date) {
  return date.toISOString().slice(0, 10);
}

function utcDayStart(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function fromDateKey(dateKey: string) {
  const [y, m, d] = dateKey.split("-").map((part) => Number(part));
  return new Date(Date.UTC(y, (m || 1) - 1, d || 1));
}

function addDaysUtc(date: Date, days: number) {
  return new Date(date.getTime() + days * 86_400_000);
}

function toSafeInt(value: unknown, fallback = 0) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(0, Math.floor(numeric));
}

function parseInteger(value: unknown, fallback: number) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.floor(numeric);
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function weekRangeForLastCompleteWeek(now = new Date()) {
  const today = utcDayStart(now);
  const utcDow = today.getUTCDay(); // 0=Sun, 1=Mon, ..., 6=Sat
  const daysSinceMonday = (utcDow + 6) % 7;
  const currentWeekStart = addDaysUtc(today, -daysSinceMonday);
  const weekStart = addDaysUtc(currentWeekStart, -7);
  const weekEndExclusive = addDaysUtc(weekStart, 7);
  const weekEndInclusive = addDaysUtc(weekEndExclusive, -1);

  return {
    weekStart,
    weekStartKey: toDateKeyUTC(weekStart),
    weekEndExclusive,
    weekEndExclusiveKey: toDateKeyUTC(weekEndExclusive),
    weekEndInclusiveKey: toDateKeyUTC(weekEndInclusive),
  };
}

function toWeekdayLabel(dateKey: string) {
  const date = fromDateKey(dateKey);
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    weekday: "short",
  }).format(date);
}

async function parseBody(req: Request): Promise<JsonRecord> {
  if (req.method !== "POST") return {};
  const contentType = (req.headers.get("content-type") || "").toLowerCase();
  if (!contentType.includes("application/json")) return {};
  try {
    const parsed = (await req.json()) as JsonRecord;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

async function computeStreakAtDay(admin: any, userId: string, endDayKey: string) {
  const endDate = fromDateKey(endDayKey);
  const startDate = addDaysUtc(endDate, -364);
  const startDayKey = toDateKeyUTC(startDate);
  const rowsResp = await admin
    .from("daily_user_metrics")
    .select("day, tasks_completed, checkins_completed")
    .eq("user_id", userId)
    .gte("day", startDayKey)
    .lte("day", endDayKey);

  if (rowsResp.error) {
    throw rowsResp.error;
  }

  const activityByDay = new Map<string, number>();
  for (const row of rowsResp.data || []) {
    const dayKey = String(row.day);
    const activities = toSafeInt(row.tasks_completed) + toSafeInt(row.checkins_completed);
    activityByDay.set(dayKey, activities);
  }

  let streak = 0;
  for (let i = 0; i < 365; i++) {
    const cursorDay = addDaysUtc(endDate, -i);
    const cursorKey = toDateKeyUTC(cursorDay);
    const activities = activityByDay.get(cursorKey) || 0;
    if (activities <= 0) break;
    streak += 1;
  }
  return streak;
}

function summarizeWeek(rows: DailyMetricsRow[]) {
  const normalized = (rows || []).map((row) => {
    const tasks = toSafeInt(row.tasks_completed);
    const checkins = toSafeInt(row.checkins_completed);
    const points = toSafeInt(row.points_earned);
    const activities = tasks + checkins;
    return {
      day: String(row.day),
      weekday: toWeekdayLabel(String(row.day)),
      tasksCompleted: tasks,
      checkinsCompleted: checkins,
      pointsEarned: points,
      activities,
    };
  });

  const totalTasks = normalized.reduce((sum, row) => sum + row.tasksCompleted, 0);
  const totalCheckins = normalized.reduce((sum, row) => sum + row.checkinsCompleted, 0);
  const totalPoints = normalized.reduce((sum, row) => sum + row.pointsEarned, 0);

  const ranked = [...normalized].sort((a, b) => {
    if (b.activities !== a.activities) return b.activities - a.activities;
    if (b.pointsEarned !== a.pointsEarned) return b.pointsEarned - a.pointsEarned;
    return a.day.localeCompare(b.day);
  });

  const best = ranked[0] || null;
  const topDays = ranked
    .filter((row) => row.activities > 0)
    .slice(0, 3)
    .map((row) => ({
      day: row.day,
      weekday: row.weekday,
      activities: row.activities,
      points: row.pointsEarned,
    }));

  return {
    totals: {
      total_tasks: totalTasks,
      total_checkins: totalCheckins,
      total_points: totalPoints,
    },
    best_day: best
      ? {
          day: best.day,
          weekday: best.weekday,
          activities: best.activities,
          points: best.pointsEarned,
        }
      : null,
    top_days: topDays,
    days: normalized,
  };
}

function inferMemoryType(content: string, index: number) {
  const normalized = content.toLowerCase();
  if (normalized.includes("streak") || normalized.includes("milestone") || normalized.match(/\b\d+\b/)) {
    return "milestone";
  }
  if (index === 0) return "pattern";
  return "milestone";
}

function fallbackSummaryPayload(options: {
  highlights: Record<string, unknown>;
  streakAtWeekEnd: number;
}) {
  const totals = (options.highlights?.totals || {}) as Record<string, unknown>;
  const totalTasks = toSafeInt(totals.total_tasks);
  const totalCheckins = toSafeInt(totals.total_checkins);
  const totalPoints = toSafeInt(totals.total_points);
  const streak = toSafeInt(options.streakAtWeekEnd);

  const summary =
    `You completed ${totalTasks} tasks and ${totalCheckins} check-ins this week, ` +
    `earning ${totalPoints} points. Current streak signal: ${streak} day${streak === 1 ? "" : "s"}. ` +
    `Next week, pick one small habit and repeat it at the same time each day.`;

  const memories = [
    `Completed ${totalTasks} tasks last week with ${totalPoints} points earned.`,
    `Weekly check-in consistency reached ${totalCheckins} entries.`,
  ].filter((entry) => entry.trim().length > 0);

  return {
    summary,
    highlights: {},
    memories,
    providerUsed: "fallback",
  };
}

async function generateSummaryWithLLM(options: {
  weekStartKey: string;
  weekEndInclusiveKey: string;
  highlights: Record<string, unknown>;
  streakAtWeekEnd: number;
}) {
  const timeoutMs = clamp(
    parseInteger(Deno.env.get("REQUEST_TIMEOUT_MS"), DEFAULT_TIMEOUT_MS),
    5_000,
    60_000
  );
  const primary = String(Deno.env.get("PROVIDER_PRIMARY") || "openrouter").toLowerCase();
  const fallback = String(Deno.env.get("PROVIDER_FALLBACK") || "groq").toLowerCase();

  const systemPrompt =
    "You are a retention coach for a wellness pet app. " +
    "Return strict JSON only: {\"summary\": string, \"highlights\": object, \"memories\": string[]}. " +
    "Keep summary concise, motivational, specific, and not cringe. Mention behavior patterns and one next-step habit. " +
    "memories must contain 1-2 short high-signal statements.";

  const userPrompt = JSON.stringify({
    instruction:
      "Summarize the last complete week and suggest one practical next-step habit. Return only JSON.",
    week_start: options.weekStartKey,
    week_end: options.weekEndInclusiveKey,
    streak_at_week_end: options.streakAtWeekEnd,
    highlights: options.highlights,
  });

  const llmResult = await generateWeeklySummaryObject({
    systemPrompt,
    userPrompt,
    primary,
    fallback,
    timeoutMs,
    openRouterApiKey: Deno.env.get("OPENROUTER_API_KEY") || "",
    openRouterModel: Deno.env.get("OPENROUTER_MODEL") || "openrouter/free",
    groqApiKey: Deno.env.get("GROQ_API_KEY") || "",
    groqModel: Deno.env.get("GROQ_MODEL") || "llama-3.1-8b-instant",
  });

  if (llmResult.ok) {
    return {
      summary: llmResult.payload.summary,
      highlights: llmResult.payload.highlights || {},
      memories: Array.isArray(llmResult.payload.memories) ? llmResult.payload.memories : [],
      providerUsed: llmResult.providerUsed,
    };
  }

  return fallbackSummaryPayload({
    highlights: options.highlights,
    streakAtWeekEnd: options.streakAtWeekEnd,
  });
}

async function fetchUserIdsForAdminRun(admin: any, limit: number, offset: number) {
  const collected: string[] = [];
  const seen = new Set<string>();

  const fromProfiles = await admin
    .from("profiles")
    .select("user_id")
    .not("user_id", "is", null)
    .order("user_id", { ascending: true })
    .range(offset, offset + limit - 1);

  if (!fromProfiles.error) {
    for (const row of fromProfiles.data || []) {
      const userId = String(row.user_id || "").trim();
      if (!userId || seen.has(userId)) continue;
      seen.add(userId);
      collected.push(userId);
    }
    if (collected.length > 0) return collected;
  }

  const fromMetrics = await admin
    .from("daily_user_metrics")
    .select("user_id")
    .order("user_id", { ascending: true })
    .range(offset, offset + limit - 1);

  if (fromMetrics.error) {
    throw fromMetrics.error;
  }

  for (const row of fromMetrics.data || []) {
    const userId = String(row.user_id || "").trim();
    if (!userId || seen.has(userId)) continue;
    seen.add(userId);
    collected.push(userId);
  }

  return collected;
}

async function generateForUser(options: {
  admin: any;
  userId: string;
  weekStartKey: string;
  weekEndExclusiveKey: string;
  weekEndInclusiveKey: string;
}) {
  const { admin, userId, weekStartKey, weekEndExclusiveKey, weekEndInclusiveKey } = options;

  const metricsResp = await admin
    .from("daily_user_metrics")
    .select("day, tasks_completed, tasks_created, checkins_completed, points_earned")
    .eq("user_id", userId)
    .gte("day", weekStartKey)
    .lt("day", weekEndExclusiveKey)
    .order("day", { ascending: true });

  if (metricsResp.error) {
    throw metricsResp.error;
  }

  const weekSummary = summarizeWeek((metricsResp.data || []) as DailyMetricsRow[]);
  const streakAtWeekEnd = await computeStreakAtDay(admin, userId, weekEndInclusiveKey);

  const baselineHighlights: Record<string, unknown> = {
    week_start: weekStartKey,
    week_end: weekEndInclusiveKey,
    streak_at_week_end: streakAtWeekEnd,
    ...weekSummary,
  };

  const generated = await generateSummaryWithLLM({
    weekStartKey,
    weekEndInclusiveKey,
    highlights: baselineHighlights,
    streakAtWeekEnd,
  });

  const mergedHighlights = {
    ...baselineHighlights,
    ai_highlights: generated.highlights || {},
    llm_provider: generated.providerUsed,
    generated_at: new Date().toISOString(),
  };

  const summaryText = String(generated.summary || "").trim();
  const safeSummary =
    summaryText.length > 0
      ? summaryText
      : `You made progress this week. Keep your next habit small and repeatable.`;

  const upsertResp = await admin.from("weekly_summaries").upsert(
    {
      user_id: userId,
      week_start: weekStartKey,
      summary: safeSummary,
      highlights: mergedHighlights,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,week_start" }
  );

  if (upsertResp.error) {
    throw upsertResp.error;
  }

  const memories = Array.from(
    new Set(
      (Array.isArray(generated.memories) ? generated.memories : [])
        .map((entry) => String(entry || "").trim())
        .filter((entry) => entry.length > 0)
    )
  ).slice(0, 2);

  if (memories.length > 0) {
    const memoryRows = memories.map((content, index) => ({
      user_id: userId,
      memory_type: inferMemoryType(content, index),
      content,
      weight: 1,
      source_week_start: weekStartKey,
      created_at: new Date().toISOString(),
    }));

    const memoryResp = await admin
      .from("user_memories")
      .upsert(memoryRows, { onConflict: "user_id,source_week_start,content" });

    if (memoryResp.error) {
      throw memoryResp.error;
    }
  }

  return {
    weekStart: weekStartKey,
    summary: safeSummary,
    highlights: mergedHighlights,
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "GET" && req.method !== "POST") {
    return jsonResponse(405, {
      error: "method_not_allowed",
      message: "Use GET or POST.",
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
    return jsonResponse(500, {
      error: "config_error",
      message: "Missing Supabase function environment variables.",
    });
  }

  const body = await parseBody(req);
  const url = new URL(req.url);
  const authHeader = req.headers.get("Authorization") || "";
  const accessToken = extractBearerToken(authHeader);
  const adminSecret = String(Deno.env.get("WEEKLY_SUMMARY_ADMIN_SECRET") || "");
  const providedAdminSecret =
    String(req.headers.get("x-admin-secret") || body.adminSecret || "").trim();
  const requestedMode = String(url.searchParams.get("mode") || body.mode || "user").toLowerCase();

  const isServiceRoleInvocation = !!accessToken && accessToken === serviceRoleKey;
  const isAdminSecretInvocation =
    adminSecret.length > 0 && providedAdminSecret.length > 0 && providedAdminSecret === adminSecret;
  const adminRequested = requestedMode === "admin";
  const isAdminInvocation = isServiceRoleInvocation || isAdminSecretInvocation || (adminRequested && isAdminSecretInvocation);

  const admin = createClient(supabaseUrl, serviceRoleKey);
  const { weekStartKey, weekEndExclusiveKey, weekEndInclusiveKey } = weekRangeForLastCompleteWeek();

  try {
    if (isAdminInvocation) {
      const requestedUserId = String(url.searchParams.get("userId") || body.userId || "").trim();
      const limit = clamp(
        parseInteger(url.searchParams.get("limit") || body.limit, DEFAULT_ADMIN_BATCH_LIMIT),
        1,
        MAX_ADMIN_BATCH_LIMIT
      );
      const offset = Math.max(0, parseInteger(url.searchParams.get("offset") || body.offset, 0));

      const userIds = requestedUserId
        ? [requestedUserId]
        : await fetchUserIdsForAdminRun(admin, limit, offset);

      if (userIds.length === 0) {
        return jsonResponse(200, {
          weekStart: weekStartKey,
          processed: 0,
          successes: [],
          failures: [],
        });
      }

      const successes: Array<Record<string, unknown>> = [];
      const failures: Array<Record<string, unknown>> = [];

      for (const userId of userIds) {
        try {
          const result = await generateForUser({
            admin,
            userId,
            weekStartKey,
            weekEndExclusiveKey,
            weekEndInclusiveKey,
          });
          successes.push({ userId, summary: result.summary, highlights: result.highlights });
        } catch (error) {
          failures.push({
            userId,
            message: (error as Error)?.message || "Failed to generate summary.",
          });
        }
      }

      return jsonResponse(200, {
        weekStart: weekStartKey,
        processed: userIds.length,
        successCount: successes.length,
        failureCount: failures.length,
        successes,
        failures,
      });
    }

    if (!accessToken) {
      return jsonResponse(401, {
        error: "unauthorized",
        message: "Missing Authorization header.",
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

    const result = await generateForUser({
      admin,
      userId: user.id,
      weekStartKey,
      weekEndExclusiveKey,
      weekEndInclusiveKey,
    });

    return jsonResponse(200, {
      weekStart: result.weekStart,
      summary: result.summary,
      highlights: result.highlights,
    });
  } catch (error) {
    return jsonResponse(500, {
      error: "internal_error",
      message: (error as Error)?.message || "Unexpected weekly summary error.",
    });
  }
});
