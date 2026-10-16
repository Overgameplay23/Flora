// Journeys: the pacing rules. One journey at a time, one step per calendar day, and a missed day costs
// nothing: the journey simply takes longer (no streaks, no "broken" journeys). Pure; the device store is
// src/services/journeyStore.ts.
import { addDaysToDateKey, parseDateKey } from "../../utils/dateKeys";
import type { FocusArea } from "../plan/types";
import { JOURNEYS, JOURNEY_DAYS, type Journey, type JourneyDay, journeyById } from "./catalog";

export { JOURNEYS, JOURNEY_DAYS, journeyById };
export type { Journey, JourneyDay };

export type JourneyProgress = {
  journeyId: string;
  /** the local day it was started */
  startedOn: string;
  /** day index (0-6) -> the local day it was done */
  doneDays: Record<string, string>;
};

export type CompletedJourney = { journeyId: string; startedOn: string; finishedOn: string };

export type JourneyState = {
  version: 1;
  active: JourneyProgress | null;
  completed: CompletedJourney[];
};

export const EMPTY_JOURNEY_STATE: JourneyState = { version: 1, active: null, completed: [] };

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function normalizeProgress(raw: unknown): JourneyProgress | null {
  if (!isRecord(raw)) return null;
  const journeyId = typeof raw.journeyId === "string" ? raw.journeyId : "";
  const startedOn = typeof raw.startedOn === "string" ? raw.startedOn : "";
  if (!journeyById(journeyId) || !parseDateKey(startedOn)) return null;
  const doneDays: Record<string, string> = {};
  if (isRecord(raw.doneDays)) {
    for (const [index, day] of Object.entries(raw.doneDays)) {
      const n = Number(index);
      if (Number.isInteger(n) && n >= 0 && n < JOURNEY_DAYS && typeof day === "string" && parseDateKey(day)) doneDays[String(n)] = day;
    }
  }
  return { journeyId, startedOn, doneDays };
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
      if (journeyById(journeyId) && parseDateKey(startedOn) && parseDateKey(finishedOn)) completed.push({ journeyId, startedOn, finishedOn });
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
 * Marks today's step done. The seventh step finishes the journey: it moves to `completed` and nothing is
 * active any more. Doing it twice on one day changes nothing.
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
      completed: [...state.completed, { journeyId: progress.journeyId, startedOn: progress.startedOn, finishedOn: today }],
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

/**
 * The journeys to offer, the person's own areas first (in their order), then the rest. The rhythm journey
 * is only listed when the person tracks their cycle or picked the area (it is private like the tracker).
 */
export function journeysFor(areas: FocusArea[], options: { cycleVisible: boolean }): Journey[] {
  const rank = new Map<FocusArea, number>();
  areas.forEach((area, index) => {
    if (!rank.has(area)) rank.set(area, index);
  });
  return JOURNEYS.filter((journey) => journey.area !== "cycle" || options.cycleVisible || areas.includes("cycle")).sort((a, b) => {
    const ra = rank.has(a.area) ? (rank.get(a.area) as number) : 99;
    const rb = rank.has(b.area) ? (rank.get(b.area) as number) : 99;
    return ra - rb;
  });
}

/** Fills {pet} in a line. */
export function journeyLine(text: string, petName: string): string {
  return text.replace(/\{pet\}/g, petName || "your pet");
}
