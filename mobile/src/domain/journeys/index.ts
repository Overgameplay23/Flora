// Journeys: the pacing rules. One journey at a time, one step per calendar day, and a missed day costs
// nothing: the journey simply takes longer (no streaks, no "broken" journeys). Pure; the device store is
// src/services/journeyStore.ts.
import { addDaysToDateKey, parseDateKey } from "../../utils/dateKeys";
import type { FocusArea } from "../plan/types";
import { JOURNEYS, JOURNEY_DAYS, type Journey, type JourneyDay, journeyById, partOneOf, sequelFor } from "./catalog";

export { JOURNEYS, JOURNEY_DAYS, journeyById, partOneOf, sequelFor };
export type { Journey, JourneyDay };

export type JourneyProgress = {
  journeyId: string;
  /** the local day it was started */
  startedOn: string;
  /** day index (0-6) -> the local day it was done */
  doneDays: Record<string, string>;
};

export type CompletedJourney = {
  journeyId: string;
  startedOn: string;
  finishedOn: string;
  /** day index -> the local day it was done; journeys finished before chapters existed have none */
  doneDays?: Record<string, string>;
};

export type JourneyState = {
  version: 1;
  active: JourneyProgress | null;
  completed: CompletedJourney[];
};

export const EMPTY_JOURNEY_STATE: JourneyState = { version: 1, active: null, completed: [] };

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function normalizeDoneDays(raw: unknown): Record<string, string> {
  const doneDays: Record<string, string> = {};
  if (isRecord(raw)) {
    for (const [index, day] of Object.entries(raw)) {
      const n = Number(index);
      if (Number.isInteger(n) && n >= 0 && n < JOURNEY_DAYS && typeof day === "string" && parseDateKey(day)) doneDays[String(n)] = day;
    }
  }
  return doneDays;
}

function normalizeProgress(raw: unknown): JourneyProgress | null {
  if (!isRecord(raw)) return null;
  const journeyId = typeof raw.journeyId === "string" ? raw.journeyId : "";
  const startedOn = typeof raw.startedOn === "string" ? raw.startedOn : "";
  if (!journeyById(journeyId) || !parseDateKey(startedOn)) return null;
  return { journeyId, startedOn, doneDays: normalizeDoneDays(raw.doneDays) };
}

/** Defensive parse for whatever storage hands back. */
export function normalizeJourneyState(raw: unknown): JourneyState {
  let value: unknown = raw;
  if (typeof value === "string") {
    try {
      value = JSON.parse(value);
    } catch {
      value = null;
    }
  }
  if (!isRecord(value)) return { ...EMPTY_JOURNEY_STATE, completed: [] };
  const completed: CompletedJourney[] = [];
  if (Array.isArray(value.completed)) {
    for (const entry of value.completed) {
      if (!isRecord(entry)) continue;
      const journeyId = typeof entry.journeyId === "string" ? entry.journeyId : "";
      const startedOn = typeof entry.startedOn === "string" ? entry.startedOn : "";
      const finishedOn = typeof entry.finishedOn === "string" ? entry.finishedOn : "";
      if (!journeyById(journeyId) || !parseDateKey(startedOn) || !parseDateKey(finishedOn)) continue;
      const doneDays = normalizeDoneDays(entry.doneDays);
      completed.push(Object.keys(doneDays).length > 0 ? { journeyId, startedOn, finishedOn, doneDays } : { journeyId, startedOn, finishedOn });
    }
  }
  return { version: 1, active: normalizeProgress(value.active), completed };
}

export type JourneyStep = {
  index: number;
  total: number;
  day: JourneyDay;
  /** done today (the next step opens tomorrow) */
  done: boolean;
  /** the step after this one, for "tomorrow: …" */
  next: JourneyDay | null;
};

/** How many days of the journey are done. */
export function journeyDoneCount(progress: JourneyProgress | null | undefined): number {
  return progress ? Object.keys(progress.doneDays).length : 0;
}

/**
 * Today's step: the first undone day, except that only one step is done per calendar day, so after today's
 * step it shows as done until tomorrow. Null once every day is done.
 */
export function todayStep(progress: JourneyProgress | null | undefined, today: string): JourneyStep | null {
  if (!progress) return null;
  const journey = journeyById(progress.journeyId);
  if (!journey) return null;
  const doneIndexes = Object.keys(progress.doneDays)
    .map(Number)
    .filter((n) => Number.isInteger(n))
    .sort((a, b) => a - b);
  const last = doneIndexes.length > 0 ? doneIndexes[doneIndexes.length - 1] : -1;
  const doneToday = last >= 0 && progress.doneDays[String(last)] === today;
  const index = doneToday ? last : Math.min(last + 1, JOURNEY_DAYS - 1);
  if (!doneToday && last >= JOURNEY_DAYS - 1) return null;
  const day = journey.days[index];
  if (!day) return null;
  return { index, total: JOURNEY_DAYS, day, done: doneToday, next: journey.days[index + 1] ?? null };
}

export function isJourneyFinished(progress: JourneyProgress | null | undefined): boolean {
  return journeyDoneCount(progress) >= JOURNEY_DAYS;
}

/** Starts (or restarts) a journey; it becomes the one active journey. */
export function startJourney(state: JourneyState, journeyId: string, today: string): JourneyState {
  if (!journeyById(journeyId) || !parseDateKey(today)) return state;
  return { ...state, active: { journeyId, startedOn: today, doneDays: {} } };
}

/**
 * Marks today's step done. The seventh step finishes the journey: it moves to `completed` (with the days it
 * was walked, for its chapter page) and nothing is active any more. Doing it twice on one day changes nothing.
 */
export function completeStep(state: JourneyState, today: string): JourneyState {
  const progress = state.active;
  if (!progress || !parseDateKey(today)) return state;
  const step = todayStep(progress, today);
  if (!step || step.done) return state;
  const doneDays = { ...progress.doneDays, [String(step.index)]: today };
  const next: JourneyProgress = { ...progress, doneDays };
  if (Object.keys(doneDays).length >= JOURNEY_DAYS) {
    return {
      ...state,
      active: null,
      completed: [...state.completed, { journeyId: progress.journeyId, startedOn: progress.startedOn, finishedOn: today, doneDays }],
    };
  }
  return { ...state, active: next };
}

export function leaveJourney(state: JourneyState): JourneyState {
  return { ...state, active: null };
}

/** Days since the journey began, calendar-wise (0 on the first day). */
export function daysOnJourney(progress: JourneyProgress, today: string): number {
  const start = parseDateKey(progress.startedOn);
  const now = parseDateKey(today);
  if (!start || !now) return 0;
  return Math.max(0, Math.round((Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) - Date.UTC(start.getFullYear(), start.getMonth(), start.getDate())) / 86_400_000));
}

/** When a journey done at one step a day would end, for the "about N days left" line. */
export function expectedFinish(progress: JourneyProgress, today: string): string {
  const left = Math.max(0, JOURNEY_DAYS - journeyDoneCount(progress));
  const step = todayStep(progress, today);
  // today's step still open counts as today
  const daysAhead = step && !step.done ? left - 1 : left;
  return addDaysToDateKey(today, Math.max(0, daysAhead));
}

/** The most recent time a journey was finished, if ever. */
export function lastFinished(completed: CompletedJourney[], journeyId: string): CompletedJourney | null {
  let latest: CompletedJourney | null = null;
  for (const entry of completed) {
    if (entry.journeyId !== journeyId) continue;
    if (!latest || entry.finishedOn > latest.finishedOn) latest = entry;
  }
  return latest;
}

/** Whether a journey may be offered: part ones always; a part two only once its part one has been walked. */
export function isJourneyUnlocked(journey: Journey, completed: CompletedJourney[]): boolean {
  if (!journey.sequelOf) return true;
  return completed.some((entry) => entry.journeyId === journey.sequelOf);
}

/**
 * The journeys to offer, the person's own areas first (in their order), then the rest; within an area part one
 * comes before part two, and a part two is listed only once part one has been walked. The rhythm journey is
 * only listed when the person tracks their cycle or picked the area (it is private like the tracker).
 */
export function journeysFor(areas: FocusArea[], options: { cycleVisible: boolean; completed?: CompletedJourney[] }): Journey[] {
  const completed = options.completed ?? [];
  const rank = new Map<FocusArea, number>();
  areas.forEach((area, index) => {
    if (!rank.has(area)) rank.set(area, index);
  });
  return JOURNEYS.filter((journey) => journey.area !== "cycle" || options.cycleVisible || areas.includes("cycle"))
    .filter((journey) => isJourneyUnlocked(journey, completed))
    .sort((a, b) => {
      const ra = rank.has(a.area) ? (rank.get(a.area) as number) : 99;
      const rb = rank.has(b.area) ? (rank.get(b.area) as number) : 99;
      if (ra !== rb) return ra - rb;
      // same area: part one before part two, otherwise catalog order
      const sa = a.sequelOf ? 1 : 0;
      const sb = b.sequelOf ? 1 : 0;
      if (sa !== sb) return sa - sb;
      return JOURNEYS.indexOf(a) - JOURNEYS.indexOf(b);
    });
}

export type ChapterLine = { index: number; title: string; petLine: string; doneOn: string | null; prompt: string | null };

/** The chapter a finished journey leaves behind: when it was walked, and the seven days with their dates. */
export function chapterFor(journey: Journey, entry: CompletedJourney, petName: string): { title: string; walked: string; lines: ChapterLine[]; sequel: Journey | undefined } {
  const lines = journey.days.map((day, index) => ({
    index,
    title: day.title,
    petLine: journeyLine(day.petLine, petName),
    doneOn: entry.doneDays?.[String(index)] ?? null,
    prompt: day.prompt ? day.prompt : null,
  }));
  const days = daysBetween(entry.startedOn, entry.finishedOn) + 1;
  const walked = days <= JOURNEY_DAYS ? "Walked in seven days straight." : `Walked over ${days} days, at your own pace.`;
  return { title: `${journey.title}: a chapter`, walked, lines, sequel: sequelFor(journey.id) };
}

function daysBetween(from: string, to: string): number {
  const a = parseDateKey(from);
  const b = parseDateKey(to);
  if (!a || !b) return 0;
  return Math.max(0, Math.round((Date.UTC(b.getFullYear(), b.getMonth(), b.getDate()) - Date.UTC(a.getFullYear(), a.getMonth(), a.getDate())) / 86_400_000));
}

/** Fills {pet} in a line. */
export function journeyLine(text: string, petName: string): string {
  return text.replace(/\{pet\}/g, petName || "your pet");
}
