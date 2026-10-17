// Cozy Run: streaks without shame (owner's yes on the ROADMAP rules, 2026-10-17; docs/ROADMAP.md item 2).
//
// Days Together (every day of care, ever) stays the headline and never resets. The Cozy Run is the gentler
// "in a row" next to it:
//   - any care action counts (a task, a journey step, a check-in, a game), and a day ends at 3 a.m., so a
//     1 a.m. check-in still belongs to the evening before;
//   - the run is the number of days the person showed up; a quiet day inside it is covered, in this order, by
//     a logged period day, a Cozy Pause (1-30 days, chosen), one of the week's 2 automatic Nap Days (Mon-Sun),
//     or a Warm Blanket (1 earned per 7 days of care, at most 3 held, never sold);
//   - when a quiet day finds no cover the run rests. Three days of care within the next five mend it, and the
//     resting days count as covered; otherwise the run is kept as a chapter. It is never "broken" or "lost".
// Pure: the care days come from user_events (services/cozyRunStore.ts) and the period days from the cycle tracker,
// on the device. Nothing here knows about the network or the cycle store.
import { addDaysToDateKey, getLocalDateKey, parseDateKey } from "../utils/dateKeys";

export type DayKey = string; // YYYY-MM-DD, a cozy day (03:00 to 02:59 the next morning)

export const DAY_ENDS_AT_HOUR = 3;
export const NAPS_PER_WEEK = 2;
export const BLANKET_EVERY = 7;
export const MAX_BLANKETS = 3;
export const MEND_SHOW_UPS = 3;
export const MEND_WINDOW = 5;
export const PAUSE_MAX_DAYS = 30;
/** a run shorter than this is not kept as a chapter (two days is a beginning, not a story) */
export const CHAPTER_MIN_DAYS = 3;

export type CozyPause = { start: DayKey; end: DayKey }; // inclusive
export type CoverReason = "cycle" | "pause" | "nap" | "blanket" | "mended";
export type CozyDayKind = "care" | CoverReason | "resting" | "today" | "quiet";
export type CozyDay = { day: DayKey; kind: CozyDayKind };
export type CozyChapter = { start: DayKey; end: DayKey; days: number };

export type CozyRunState = {
  status: "none" | "active" | "resting";
  /** days of care in the current run (resting runs keep their count) */
  days: number;
  start: DayKey | null;
  blankets: number;
  /** days of care toward the next blanket, 0..BLANKET_EVERY-1 (0 while three are held) */
  blanketProgress: number;
  napsLeftThisWeek: number;
  resting: null | { since: DayKey; mendBy: DayKey; showUpsNeeded: number };
  pause: CozyPause | null;
  /** the last 14 days, oldest first, today last */
  recent: CozyDay[];
  /** finished runs of CHAPTER_MIN_DAYS or more, newest first */
  chapters: CozyChapter[];
  best: number;
  today: DayKey;
};

/** The cozy day a moment belongs to: the local calendar day of (moment - 3 hours). */
export function cozyDayKey(moment: Date | string | number): DayKey {
  const date = moment instanceof Date ? moment : new Date(moment);
  if (Number.isNaN(date.getTime())) return getLocalDateKey(new Date(Date.now() - DAY_ENDS_AT_HOUR * 3600_000));
  return getLocalDateKey(new Date(date.getTime() - DAY_ENDS_AT_HOUR * 3600_000));
}

/** Monday of the day's calendar week (Nap Days refresh every Monday). */
export function weekOf(day: DayKey): DayKey {
  const date = parseDateKey(day);
  if (!date) return day;
  const sinceMonday = (date.getDay() + 6) % 7;
  return addDaysToDateKey(day, -sinceMonday);
}

/** Whole days from a to b (b later is positive); daylight-saving days still count as one. */
export function daysBetweenKeys(a: DayKey, b: DayKey): number {
  const from = parseDateKey(a);
  const to = parseDateKey(b);
  if (!from || !to) return 0;
  return Math.round((to.getTime() - from.getTime()) / 86_400_000);
}

export function isPaused(day: DayKey, pauses: readonly CozyPause[]): boolean {
  return pauses.some((p) => day >= p.start && day <= p.end);
}

/** A pause the person asks for today: 1 to 30 days, starting today. */
export function makePause(today: DayKey, days: number): CozyPause {
  const length = Math.max(1, Math.min(PAUSE_MAX_DAYS, Math.round(Number(days) || 1)));
  return { start: today, end: addDaysToDateKey(today, length - 1) };
}

/** Ending a pause early keeps the days already paused; a pause that starts today simply goes. */
export function endPauseEarly(pauses: readonly CozyPause[], today: DayKey): CozyPause[] {
  return pauses
    .map((p) => (today >= p.start && today <= p.end ? (p.start === today ? null : { start: p.start, end: addDaysToDateKey(today, -1) }) : p))
    .filter((p): p is CozyPause => !!p);
}

export function activePause(pauses: readonly CozyPause[], today: DayKey): CozyPause | null {
  return pauses.find((p) => today >= p.start && today <= p.end) ?? null;
}

type Input = {
  careDays: Iterable<DayKey>;
  periodDays?: Iterable<DayKey>;
  pauses?: readonly CozyPause[];
  today?: DayKey;
};

type Run = {
  start: DayKey;
  days: number;
  lastCare: DayKey;
  blankets: number;
  progress: number;
  naps: Map<DayKey, number>;
};

/**
 * Replays the days from the first day of care to today and returns where the run stands. Today never counts
 * against anyone: it is "today" until it is a day of care, and judged only once it is over.
 */
export function cozyRun({ careDays, periodDays = [], pauses = [], today = cozyDayKey(new Date()) }: Input): CozyRunState {
  const care = new Set([...careDays].filter((d) => typeof d === "string" && d <= today));
  const period = new Set(periodDays);
  const kinds = new Map<DayKey, CozyDayKind>();
  const chapters: CozyChapter[] = [];
  let best = 0;

  const sorted = [...care].sort();
  let run: Run | null = null;
  let resting: null | { since: DayKey; windowEnd: DayKey; showUps: DayKey[]; quiet: DayKey[] } = null;

  const newRun = (day: DayKey): Run => ({ start: day, days: 0, lastCare: day, blankets: 0, progress: 0, naps: new Map() });
  const addCare = (r: Run, day: DayKey) => {
    r.days += 1;
    r.lastCare = day;
    kinds.set(day, "care");
    if (r.blankets >= MAX_BLANKETS) {
      r.progress = 0;
      return;
    }
    r.progress += 1;
    if (r.progress >= BLANKET_EVERY) {
      r.progress = 0;
      r.blankets += 1;
    }
  };
  const closeRun = (r: Run) => {
    best = Math.max(best, r.days);
    if (r.days >= CHAPTER_MIN_DAYS) chapters.push({ start: r.start, end: r.lastCare, days: r.days });
  };

  let day = sorted[0];
  while (day && day <= today) {
    const isCare = care.has(day);
    const isToday = day === today;

    if (!run) {
      if (isCare) {
        run = newRun(day);
        addCare(run, day);
      }
    } else if (resting) {
      if (isCare) {
        resting.showUps.push(day);
        kinds.set(day, "care");
      } else if (!isToday && (period.has(day) || isPaused(day, pauses))) {
        // a period day or a paused day does not use up the mending window: it waits one more day
        kinds.set(day, period.has(day) ? "cycle" : "pause");
        resting.windowEnd = addDaysToDateKey(resting.windowEnd, 1);
      } else if (!isToday) {
        resting.quiet.push(day);
      }
      if (resting.showUps.length >= MEND_SHOW_UPS) {
        // mended: the resting days count as covered and the days of care join the run
        kinds.set(resting.since, "mended");
        resting.quiet.forEach((q) => kinds.set(q, "mended"));
        const showUps = resting.showUps;
        resting = null;
        showUps.forEach((d) => addCare(run as Run, d));
      } else {
        // days still to come in the window, today included while it can still become a day of care
        const ahead = daysBetweenKeys(day, resting.windowEnd) + (isToday && !isCare ? 1 : 0);
        if (resting.showUps.length + ahead < MEND_SHOW_UPS) {
          // kept as a chapter; a new run begins with the first day of care after the rest, if there was one
          closeRun(run);
          const restart = resting.showUps[0] ?? null;
          kinds.set(resting.since, "quiet");
          resting.quiet.forEach((q) => kinds.set(q, "quiet"));
          resting = null;
          run = null;
          if (restart) {
            day = restart;
            run = newRun(day);
            addCare(run, day);
          }
        }
      }
    } else if (isCare) {
      addCare(run, day);
    } else if (!isToday) {
      const week = weekOf(day);
      const napsUsed = run.naps.get(week) ?? 0;
      if (period.has(day)) kinds.set(day, "cycle");
      else if (isPaused(day, pauses)) kinds.set(day, "pause");
      else if (napsUsed < NAPS_PER_WEEK) {
        run.naps.set(week, napsUsed + 1);
        kinds.set(day, "nap");
      } else if (run.blankets > 0) {
        run.blankets -= 1;
        kinds.set(day, "blanket");
      } else {
        kinds.set(day, "resting");
        resting = { since: day, windowEnd: addDaysToDateKey(day, MEND_WINDOW), showUps: [], quiet: [] };
      }
    }
    day = addDaysToDateKey(day, 1);
  }

  if (run) best = Math.max(best, run.days);
  const status: CozyRunState["status"] = !run ? "none" : resting ? "resting" : "active";
  const pause = activePause(pauses, today);

  const recent: CozyDay[] = [];
  for (let i = 13; i >= 0; i -= 1) {
    const d = addDaysToDateKey(today, -i);
    const kind = kinds.get(d) ?? (d === today ? "today" : "quiet");
    recent.push({ day: d, kind: d === today && kind !== "care" ? "today" : kind });
  }

  const thisWeek = weekOf(today);
  return {
    status,
    days: run?.days ?? 0,
    start: run?.start ?? null,
    blankets: run?.blankets ?? 0,
    blanketProgress: run && run.blankets < MAX_BLANKETS ? run.progress : 0,
    napsLeftThisWeek: Math.max(0, NAPS_PER_WEEK - (run?.naps.get(thisWeek) ?? 0)),
    resting:
      run && resting
        ? {
            since: resting.since,
            mendBy: resting.windowEnd,
            showUpsNeeded: Math.max(0, MEND_SHOW_UPS - resting.showUps.length),
          }
        : null,
    pause,
    recent,
    chapters: chapters.reverse(),
    best,
    today,
  };
}

// ---- words ---------------------------------------------------------------------------------------------------

export function daysLabel(n: number): string {
  return `${n} ${n === 1 ? "day" : "days"}`;
}

/** One line for the top of the Cozy Run screen and the Profile row. Never mentions what was missed. */
export function cozyHeadline(state: CozyRunState, petName: string): string {
  const pet = (petName || "Your pet").trim() || "Your pet";
  if (state.status === "none") return `Your first day of care starts a cozy run with ${pet}.`;
  if (state.status === "resting" && state.resting) {
    const n = state.resting.showUpsNeeded;
    return `Your ${state.days}-day run is resting. Show up ${n === 1 ? "one more day" : `${n} more days`} by ${shortWeekday(state.resting.mendBy)} and it mends.`;
  }
  if (state.pause) return `Paused until ${shortWeekday(state.pause.end)}. Your ${state.days}-day run waits for you.`;
  return `${daysLabel(state.days)} of care in this run.`;
}

/** The small line under the headline: what is keeping the run safe this week. */
export function cozyCover(state: CozyRunState): string {
  const naps = state.napsLeftThisWeek;
  const nap = naps === 0 ? "Both Nap Days used this week" : `${naps} Nap ${naps === 1 ? "Day" : "Days"} left this week`;
  const blankets = state.blankets === 0 ? "no Warm Blankets yet" : `${state.blankets} Warm ${state.blankets === 1 ? "Blanket" : "Blankets"}`;
  return `${nap} · ${blankets}`;
}

export function blanketLine(state: CozyRunState): string {
  if (state.blankets >= MAX_BLANKETS) return "Three Warm Blankets: as cozy as it gets.";
  const left = BLANKET_EVERY - state.blanketProgress;
  return `${left} more ${left === 1 ? "day" : "days"} of care for the next Warm Blanket.`;
}

export function chapterLine(chapter: CozyChapter): string {
  return `${daysLabel(chapter.days)}, ${shortDate(chapter.start)} to ${shortDate(chapter.end)}`;
}

function shortWeekday(day: DayKey): string {
  const date = parseDateKey(day);
  return date ? date.toLocaleDateString("en-GB", { weekday: "long" }) : day;
}

function shortDate(day: DayKey): string {
  const date = parseDateKey(day);
  return date ? date.toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : day;
}

// ---- the chapters kept on the device ---------------------------------------------------------------------------

export const MAX_KEPT_CHAPTERS = 60;

export function normalizeChapters(raw: unknown): CozyChapter[] {
  if (!Array.isArray(raw)) return [];
  const ok = raw.filter(
    (c): c is CozyChapter =>
      !!c && typeof c === "object" && typeof (c as any).start === "string" && typeof (c as any).end === "string" && Number.isFinite((c as any).days) && (c as any).days > 0
  );
  return mergeChapters([], ok);
}

/** Keeps every chapter ever computed: history beyond the fetch window still shows. Newest first, one per start. */
export function mergeChapters(kept: readonly CozyChapter[], fresh: readonly CozyChapter[]): CozyChapter[] {
  const byStart = new Map<DayKey, CozyChapter>();
  for (const c of [...kept, ...fresh]) {
    const prior = byStart.get(c.start);
    if (!prior || c.days >= prior.days) byStart.set(c.start, { start: c.start, end: c.end, days: Math.round(c.days) });
  }
  return [...byStart.values()].sort((a, b) => (a.start < b.start ? 1 : -1)).slice(0, MAX_KEPT_CHAPTERS);
}

export function normalizePauses(raw: unknown): CozyPause[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((p): p is CozyPause => !!p && typeof (p as any).start === "string" && typeof (p as any).end === "string" && (p as any).start <= (p as any).end)
    .map((p) => ({ start: p.start, end: p.end }))
    .sort((a, b) => (a.start < b.start ? -1 : 1))
    .slice(-50);
}
