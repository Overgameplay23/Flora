// Cozy Run: the forgiving run that sits under Days Together (docs/ROADMAP.md "Cozy Run"; research B2, rules
// R1-R11, approved by the owner on 2026-10-15). Pure rules, no storage: the whole history is replayed from the
// first care day each time it is asked for (R11, "compute lazily"), so the same days always tell the same story.
//
//   * Days Together counts every care day ever and never goes down. It stays the headline (R8).
//   * A run is the days in a row she was looked after: a care day (R1), or a quiet day the rules covered.
//     Each Mon-Sun week brings Nap Days by pace (Gentle 3, Steady 2, Daily 1; R2), spent silently on a quiet
//     day; when the week's naps are gone a Warm Blanket is used (1 per 7 care days, at most 3 held, never
//     sold; R3). Days the device already knows were gentle days are covered without spending either (R4).
//     A Cozy Pause freezes the run and ends by itself on her first care day back (R5).
//   * When nothing is left to cover a quiet day the run is kept as a scrapbook chapter (R6); 3 care days in
//     her first 5 back reconnect it, at most once every 30 days (R7).
//   * Today is never spent: until it is cared for it stays open and the run holds still.
//   * Nothing in the result or the copy calls a quiet day a miss (R9). Quiet days are blank paper.
import { getLocalDateKey } from "../utils/dateKeys";

// ---- rules -----------------------------------------------------------------------------------------------

export type CozyPace = "gentle" | "steady" | "daily";

/** Nap Days per Mon-Sun week (R2). */
export const NAPS_PER_WEEK: Record<CozyPace, number> = { gentle: 3, steady: 2, daily: 1 };
export const DEFAULT_PACE: CozyPace = "steady";
/**
 * When the care day ends. The research (R1) suggests 3 a.m. so a late night belongs to the evening before, but the
 * server (complete_task, daily_user_metrics) and the plan engine count local calendar days; two different days
 * made one 1 a.m. task count twice. So the care day is the calendar day (0); 3 a.m. is parked in docs/dev-notes.md.
 */
export const CARE_DAY_ENDS_AT_HOUR = 0;
export const SHOW_UPS_PER_BLANKET = 7;
export const MAX_BLANKETS = 3;
export const MEND_NEEDED = 3;
export const MEND_WINDOW_DAYS = 5;
export const MEND_COOLDOWN_DAYS = 30;
export const MAX_PAUSE_DAYS = 30;
/** The lengths offered on the "Need a break?" card (R5). */
export const PAUSE_OPTIONS = [1, 3, 7, 14, 30] as const;
/** The calendar in the result covers the last four weeks, today included. */
export const CALENDAR_DAYS = 28;
/** Days Together milestones (R8): every day of the first week, then the bigger moments. */
export const DAYS_TOGETHER_MILESTONES = [1, 2, 3, 4, 5, 6, 7, 14, 30, 50, 100, 150, 200, 365] as const;

/** An inclusive range of days (YYYY-MM-DD care days). */
export type CozyPauseRange = { from: string; to: string };
/** A pace choice and the day it took effect, so changing pace never rewrites weeks already lived. */
export type CozyPaceChange = { from: string; pace: CozyPace };

export type CozyRunInput = {
  /** today's care day, from careDayKey() */
  today: string;
  /** care days: any task, check-in, battery answer or "I'm here" */
  showedUp: string[];
  /** the current pace (default steady) */
  pace: CozyPace;
  /** quiet days already covered without spending anything (worked out elsewhere on the device; no reason given) */
  covered: string[];
  /** Cozy Pause ranges, inclusive */
  pauses: CozyPauseRange[];
  /** the last day a mend reconnected a run, as remembered on the device */
  mendUsedOn?: string | null;
  /** when each pace was chosen; without it `pace` applies to every week */
  paceHistory?: CozyPaceChange[];
};

export type CozyDayKind = "showed_up" | "nap" | "blanket" | "paused" | "covered" | "open" | "today_open";

export type CozyDay = { day: string; kind: CozyDayKind };

export type CozyChapter = { from: string; to: string; length: number };

export type CozyRunResult = {
  /** every care day ever; never resets */
  daysTogether: number;
  run: {
    /** days in the current run, covered days included and paused days not; 0 between runs */
    length: number;
    startedOn: string | null;
    /** today is already part of `length` (cared for, or covered) */
    todayCounted: boolean;
    napsLeftThisWeek: number;
    /** Warm Blankets held, 0-3 */
    blankets: number;
  };
  /** the last 28 days, oldest first, today last */
  days: CozyDay[];
  /** runs kept in the scrapbook once nothing was left to cover a quiet day, oldest first */
  chapters: CozyChapter[];
  mend: {
    /** she is in her first days back after a chapter and a mend can still happen */
    available: boolean;
    needed: number;
    /** care days so far in the window (0 when no mend is open) */
    progress: number;
    /** the latest day a mend reconnected a run in this history; worth remembering with rememberMend() */
    lastMendedOn: string | null;
  };
  nextMilestone: { at: number; label: string } | null;
  /** the last day of the Cozy Pause in effect today, or null */
  pausedUntil: string | null;
};

// ---- day arithmetic --------------------------------------------------------------------------------------
// Days are whole numbers (days since 1970-01-01, a Thursday) so the walk is plain integer steps and no
// daylight-saving shift can make a day 23 or 25 hours long.

const DAY_MS = 86_400_000;

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function toDayNumber(key: unknown): number | null {
  if (typeof key !== "string") return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
  if (!match) return null;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const ms = Date.UTC(year, month - 1, day);
  const check = new Date(ms);
  if (check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) return null;
  return Math.round(ms / DAY_MS);
}

function toDayKey(n: number): string {
  const date = new Date(n * DAY_MS);
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

/** 0 = Monday ... 6 = Sunday */
function weekdayIndex(n: number) {
  return (((n + 3) % 7) + 7) % 7;
}

/** Changes on every Monday. */
function weekNumber(n: number) {
  return Math.floor((n + 3) / 7);
}

/** A care day key moved by whole days ("" for a key that is not a date). */
export function addCareDays(day: string, delta: number): string {
  const n = toDayNumber(day);
  return n == null ? "" : toDayKey(n + Math.round(delta));
}

export function isCareDayKey(value: unknown): value is string {
  return toDayNumber(value) != null;
}

/**
 * The care day a moment belongs to: the local calendar date (CARE_DAY_ENDS_AT_HOUR moves the boundary past
 * midnight if that is ever wanted again). Local dates, so travel never splits a day.
 */
export function careDayKey(date: Date = new Date()): string {
  const at = date instanceof Date && !Number.isNaN(date.getTime()) ? date : new Date();
  const back = at.getHours() < CARE_DAY_ENDS_AT_HOUR ? 1 : 0;
  return getLocalDateKey(new Date(at.getFullYear(), at.getMonth(), at.getDate() - back));
}

export function isPace(value: unknown): value is CozyPace {
  return value === "gentle" || value === "steady" || value === "daily";
}

export function normalizePace(value: unknown): CozyPace {
  return isPace(value) ? value : DEFAULT_PACE;
}

// ---- the walk --------------------------------------------------------------------------------------------

function daySet(keys: unknown): Set<number> {
  const set = new Set<number>();
  for (const key of Array.isArray(keys) ? keys : []) {
    const n = toDayNumber(key);
    if (n != null) set.add(n);
  }
  return set;
}

/**
 * Pace on a given day. With a history, each choice holds from its day on and the days before the first
 * choice keep the default (that is what was shown then); without one, the current pace holds everywhere.
 */
function paceReader(input: CozyRunInput): (day: number) => CozyPace {
  const current = normalizePace(input?.pace);
  const changes = (Array.isArray(input?.paceHistory) ? input.paceHistory : [])
    .map((change) => ({ at: toDayNumber(change?.from), pace: isPace(change?.pace) ? change.pace : null }))
    .filter((change): change is { at: number; pace: CozyPace } => change.at != null && change.pace != null)
    .sort((a, b) => a.at - b.at);
  if (changes.length === 0) return () => current;
  return (day) => {
    let pace = DEFAULT_PACE;
    for (const change of changes) {
      if (change.at > day) break;
      pace = change.pace;
    }
    return pace;
  };
}

/**
 * The paused days, and the last day of the pause in effect today. A pause ends by itself on her first care
 * day after it began (R5); a care day on the day it began does not end it (she may pause after one small thing).
 */
function pausedDays(pauses: unknown, cared: Set<number>, today: number): { days: Set<number>; until: number | null } {
  const days = new Set<number>();
  let until: number | null = null;
  for (const range of Array.isArray(pauses) ? pauses : []) {
    const from = toDayNumber(range?.from);
    const to = toDayNumber(range?.to);
    if (from == null || to == null || to < from) continue;
    // a pause started on a day that already counted runs one day longer (see startPause): still at most 30 quiet days
    let end = Math.min(to, from + MAX_PAUSE_DAYS - 1 + (cared.has(from) ? 1 : 0));
    for (let day = from; day <= end; day++) {
      if (day > from && cared.has(day)) {
        end = day - 1;
        break;
      }
      if (!cared.has(day)) days.add(day);
    }
    if (today >= from && today <= end) until = until == null ? end : Math.max(until, end);
  }
  return { days, until };
}

/** The whole story for one person: replayed from the first care day to today. */
export function computeCozyRun(input: CozyRunInput): CozyRunResult {
  const today = toDayNumber(input?.today) ?? (toDayNumber(careDayKey()) as number);
  const everCared = daySet(input?.showedUp);
  const cared = new Set([...everCared].filter((day) => day <= today));
  const covered = daySet(input?.covered);
  const paused = pausedDays(input?.pauses, cared, today);
  const paceOn = paceReader(input);
  const mendUsedOn = toDayNumber(input?.mendUsedOn ?? null);

  let firstCare: number | null = null;
  for (const day of cared) if (firstCare == null || day < firstCare) firstCare = day;
  const calendarStart = today - CALENDAR_DAYS + 1;
  const start = firstCare == null ? calendarStart : Math.min(firstCare, calendarStart);

  let run: { start: number; last: number; length: number } | null = null;
  let week = Number.NaN;
  let napsUsed = 0;
  let blankets = 0;
  let careDays = 0;
  const chapters: Array<{ from: number; to: number; length: number }> = [];
  // the first days of a run that began right after a chapter: 3 care days in 5 reconnect the two (R7)
  let mendWindow: { opened: number; progress: number } | null = null;
  let lastMend: number | null = null;
  const kinds = new Map<number, CozyDayKind>();

  // at most once every 30 days, counting both the mends in this history and the one the device remembers
  const mendAllowed = (day: number) =>
    (lastMend == null || day - lastMend >= MEND_COOLDOWN_DAYS) &&
    (mendUsedOn == null || day === mendUsedOn || Math.abs(day - mendUsedOn) >= MEND_COOLDOWN_DAYS);

  for (let day = start; day <= today; day++) {
    if (weekNumber(day) !== week) {
      week = weekNumber(day);
      napsUsed = 0;
    }
    if (mendWindow && day >= mendWindow.opened + MEND_WINDOW_DAYS) mendWindow = null;

    let kind: CozyDayKind;
    if (cared.has(day)) {
      kind = "showed_up";
      careDays += 1;
      if (!run) {
        run = { start: day, last: day, length: 0 };
        // a fresh run starts with this week's naps, so the first days back are as soft as any other
        napsUsed = 0;
        mendWindow = chapters.length > 0 ? { opened: day, progress: 0 } : null;
      }
      run.length += 1;
      run.last = day;
      if (careDays % SHOW_UPS_PER_BLANKET === 0 && blankets < MAX_BLANKETS) blankets += 1;
      if (mendWindow) {
        mendWindow.progress += 1;
        if (mendWindow.progress >= MEND_NEEDED && mendAllowed(day)) {
          const chapter = chapters.pop() as { from: number; to: number; length: number };
          // the days between stay blank paper and are not counted; the two runs become one
          run = { start: chapter.from, last: day, length: chapter.length + run.length };
          lastMend = day;
          mendWindow = null;
        }
      }
    } else if (paused.days.has(day)) {
      kind = "paused";
    } else if (covered.has(day)) {
      kind = "covered";
      if (run) {
        run.length += 1;
        run.last = day;
      }
    } else if (day === today) {
      kind = "today_open";
    } else if (!run) {
      kind = "open";
    } else if (napsUsed < NAPS_PER_WEEK[paceOn(day)]) {
      kind = "nap";
      napsUsed += 1;
      run.length += 1;
      run.last = day;
    } else if (blankets > 0) {
      kind = "blanket";
      blankets -= 1;
      run.length += 1;
      run.last = day;
    } else {
      // nothing left to cover the day: the run goes into the scrapbook as it was
      kind = "open";
      chapters.push({ from: run.start, to: run.last, length: run.length });
      run = null;
      mendWindow = null;
    }
    if (day >= calendarStart) kinds.set(day, kind);
  }

  let mend: CozyRunResult["mend"] = { available: false, needed: MEND_NEEDED, progress: 0, lastMendedOn: lastMend == null ? null : toDayKey(lastMend) };
  if (mendWindow && run) {
    const windowEnd = mendWindow.opened + MEND_WINDOW_DAYS - 1;
    const firstOpen = cared.has(today) ? today + 1 : today;
    const stillToCome = Math.max(0, windowEnd - firstOpen + 1);
    const soonest = firstOpen + Math.max(1, MEND_NEEDED - mendWindow.progress) - 1;
    let allowed = false;
    for (let day = soonest; day <= windowEnd; day++) {
      if (mendAllowed(day)) {
        allowed = true;
        break;
      }
    }
    if (allowed && mendWindow.progress + stillToCome >= MEND_NEEDED) {
      mend = { ...mend, available: true, progress: mendWindow.progress };
    }
  }

  const days: CozyDay[] = [];
  for (let day = calendarStart; day <= today; day++) days.push({ day: toDayKey(day), kind: kinds.get(day) ?? "open" });

  return {
    daysTogether: everCared.size,
    run: {
      length: run ? run.length : 0,
      startedOn: run ? toDayKey(run.start) : null,
      todayCounted: run != null && run.last === today,
      napsLeftThisWeek: Math.max(0, NAPS_PER_WEEK[paceOn(today)] - (run ? napsUsed : 0)),
      blankets: run ? blankets : 0,
    },
    days,
    chapters: chapters.map((chapter) => ({ from: toDayKey(chapter.from), to: toDayKey(chapter.to), length: chapter.length })),
    mend,
    nextMilestone: nextMilestone(everCared.size),
    pausedUntil: paused.until == null ? null : toDayKey(paused.until),
  };
}

// ---- milestones (R8) -------------------------------------------------------------------------------------

export function milestoneLabel(at: number): string {
  if (at === 1) return "Your first day together";
  if (at === 7) return "A whole week together";
  if (at === 14) return "Two weeks together";
  if (at === 30) return "A month together";
  if (at === 365) return "A whole year together";
  return `${at} days together`;
}

/** The next Days Together milestone after `daysTogether`, or null past the last one. */
export function nextMilestone(daysTogether: number): { at: number; label: string } | null {
  const count = Number.isFinite(daysTogether) ? Math.max(0, Math.floor(daysTogether)) : 0;
  const at = DAYS_TOGETHER_MILESTONES.find((milestone) => milestone > count);
  return at == null ? null : { at, label: milestoneLabel(at) };
}

// ---- the calendar's shape --------------------------------------------------------------------------------

/** One stamp on the calendar; `kind` is null for a day still ahead in this week. */
export type StampCell = { day: string; kind: CozyDayKind | null; isToday: boolean };

/** The result's days laid out as Mon-Sun rows (the weeks naps belong to), the current week last. */
export function stampWeeks(days: CozyDay[], today: string, weeks = 4): StampCell[][] {
  const todayN = toDayNumber(today);
  if (todayN == null) return [];
  const count = Math.max(1, Math.min(4, Math.floor(weeks)));
  const byDay = new Map((Array.isArray(days) ? days : []).map((entry) => [entry.day, entry.kind]));
  const first = todayN - weekdayIndex(todayN) - (count - 1) * 7;
  const rows: StampCell[][] = [];
  for (let w = 0; w < count; w++) {
    const row: StampCell[] = [];
    for (let i = 0; i < 7; i++) {
      const n = first + w * 7 + i;
      const day = toDayKey(n);
      row.push({ day, kind: n > todayN ? null : byDay.get(day) ?? "open", isToday: n === todayN });
    }
    rows.push(row);
  }
  return rows;
}

// ---- copy (R9: no "broken", nothing lost, no countdowns, nothing counted against her) ----------------------

const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** "Tuesday 14 October" (for screen readers). */
export function dayLabel(day: string): string {
  const n = toDayNumber(day);
  if (n == null) return day;
  const date = new Date(n * DAY_MS);
  return `${WEEKDAYS[weekdayIndex(n)]} ${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]}`;
}

/** "Tue 14 Oct". */
export function shortDayLabel(day: string): string {
  const n = toDayNumber(day);
  if (n == null) return day;
  const date = new Date(n * DAY_MS);
  return `${WEEKDAYS[weekdayIndex(n)].slice(0, 3)} ${date.getUTCDate()} ${MONTHS[date.getUTCMonth()].slice(0, 3)}`;
}

/** The day of the month, for under a stamp. */
export function dayOfMonth(day: string): string {
  const n = toDayNumber(day);
  return n == null ? "" : String(new Date(n * DAY_MS).getUTCDate());
}

function petOr(petName: string) {
  return (petName || "").trim() || "Your pet";
}

export function cozyRunHeadline(length: number): string {
  const n = Number.isFinite(length) ? Math.max(0, Math.floor(length)) : 0;
  return n > 0 ? `${n}-day cozy run` : "A fresh cozy run";
}

export function daysTogetherLine(daysTogether: number): string {
  return `Days Together: ${Math.max(0, Math.floor(Number(daysTogether) || 0))}`;
}

/** The line under the headline: where today stands, said gently. */
export function runSubline(result: CozyRunResult, petName: string): string {
  const pet = petOr(petName);
  if (result.pausedUntil) return `Resting until ${shortDayLabel(result.pausedUntil)}. Nothing is spent while you rest.`;
  if (result.run.length === 0) return `One small thing with ${pet} starts a new one.`;
  if (result.run.todayCounted) return `Today counts. ${pet} is curled up next to you.`;
  return "Today is still open, whenever you're ready.";
}

/** What a stamp means, for its accessibility label and the legend. */
export function stampLabel(kind: CozyDayKind, petName: string): string {
  const pet = petOr(petName);
  switch (kind) {
    case "showed_up":
      return "You showed up";
    case "nap":
      return `${pet} napped with you`;
    case "blanket":
      return "Wrapped in a warm blanket";
    case "paused":
      return "Cozy Pause";
    case "covered":
      return "A gentle day, covered for you";
    case "today_open":
      return "Today, whenever you're ready";
    default:
      return "Blank paper";
  }
}

/** Short names for the legend. */
export const STAMP_LEGEND: Record<CozyDayKind, string> = {
  showed_up: "Showed up",
  nap: "Nap",
  blanket: "Blanket",
  paused: "Pause",
  covered: "Gentle day",
  open: "Blank paper",
  today_open: "Today",
};

export function napsLeftLine(napsLeft: number, petName: string): string {
  const n = Math.max(0, Math.floor(Number(napsLeft) || 0));
  if (n === 0) return `${petOr(petName)} has had this week's naps. New ones come on Monday`;
  return `${n === 1 ? "1 nap" : `${n} naps`} left this week`;
}

export function blanketsLine(blankets: number): string {
  const n = Math.max(0, Math.floor(Number(blankets) || 0));
  if (n === 0) return "A warm blanket comes with every 7 care days";
  return `${n === 1 ? "1 warm blanket" : `${n} warm blankets`} folded and ready`;
}

export const PACE_OPTIONS: Array<{ id: CozyPace; label: string; naps: number; blurb: string }> = [
  { id: "gentle", label: "Gentle", naps: NAPS_PER_WEEK.gentle, blurb: "3 naps a week, for full or wobbly weeks." },
  { id: "steady", label: "Steady", naps: NAPS_PER_WEEK.steady, blurb: "2 naps a week. Most people start here." },
  { id: "daily", label: "Daily", naps: NAPS_PER_WEEK.daily, blurb: "1 nap a week, for when you like a daily rhythm." },
];

export function pauseOptionLabel(days: number): string {
  if (days === 1) return "1 day";
  if (days === 7) return "1 week";
  if (days === 14) return "2 weeks";
  return `${days} days`;
}

export function milestoneLine(next: CozyRunResult["nextMilestone"]): string | null {
  return next ? `Next little celebration: ${next.label}` : null;
}

/** "Chapter 2: 41 days with Biscuit" (chapters are numbered from 1, oldest first). */
export function chapterLine(index: number, chapter: CozyChapter, petName: string): string {
  return `Chapter ${index + 1}: ${chapter.length === 1 ? "1 day" : `${chapter.length} days`} with ${petOr(petName)}`;
}

export function chapterRange(chapter: CozyChapter): string {
  const from = shortDayLabel(chapter.from).slice(4);
  const to = shortDayLabel(chapter.to).slice(4);
  return from === to ? from : `${from} – ${to}`;
}

/** The mend invitation, when one is open: an effort, never a price. */
export function mendLine(result: CozyRunResult, petName: string): string | null {
  if (!result.mend.available) return null;
  const last = result.chapters[result.chapters.length - 1];
  const joined = last ? `your last run (${last.length === 1 ? "1 day" : `${last.length} days`})` : "your last run";
  return `Come by on 3 of your first 5 days back and ${joined} joins this one. ${petOr(petName)} is holding the thread.`;
}
