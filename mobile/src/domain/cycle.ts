// Pure rules for the optional cycle tracker.
//
// Everything is computed from a list of period entries the person logged on this device. Predictions
// are simple averages with sensible bounds and are labelled as estimates in the UI; nothing here is
// medical advice, and the module never sees anything but dates and a few tags.
import { addDaysToDateKey, getLocalDateKey, parseDateKey } from "../utils/dateKeys";

export type DateKey = string; // YYYY-MM-DD, local calendar day

export type Flow = "light" | "medium" | "heavy";

export type CycleEntry = {
  /** first day of bleeding */
  start: DateKey;
  /** last day of bleeding, inclusive; null while ongoing */
  end: DateKey | null;
};

export type DayLog = {
  date: DateKey;
  flow?: Flow | null;
  symptoms?: string[];
  note?: string | null;
};

export type CycleData = {
  version: 1;
  entries: CycleEntry[];
  days: DayLog[];
};

export const SYMPTOMS = ["cramps", "headache", "bloating", "fatigue", "mood swings", "tender", "acne", "cravings"] as const;

export const DEFAULT_CYCLE_LENGTH = 28;
export const DEFAULT_PERIOD_LENGTH = 5;
const MIN_CYCLE = 21;
const MAX_CYCLE = 45;
const MIN_PERIOD = 2;
const MAX_PERIOD = 10;
const HISTORY_FOR_AVERAGE = 6;

export const EMPTY_CYCLE_DATA: CycleData = { version: 1, entries: [], days: [] };

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export function daysBetween(a: DateKey, b: DateKey): number {
  const da = parseDateKey(a);
  const db = parseDateKey(b);
  if (!da || !db) return 0;
  const utcA = Date.UTC(da.getFullYear(), da.getMonth(), da.getDate());
  const utcB = Date.UTC(db.getFullYear(), db.getMonth(), db.getDate());
  return Math.round((utcB - utcA) / 86_400_000);
}

export function normalizeCycleData(raw: unknown): CycleData {
  const value = (raw && typeof raw === "object" ? raw : {}) as Record<string, any>;
  const entries: CycleEntry[] = [];
  for (const item of Array.isArray(value.entries) ? value.entries : []) {
    const start = typeof item?.start === "string" && parseDateKey(item.start) ? item.start : null;
    if (!start) continue;
    const end = typeof item?.end === "string" && parseDateKey(item.end) && item.end >= start ? item.end : null;
    entries.push({ start, end });
  }
  entries.sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : 0));
  // merge overlapping / duplicate entries
  const merged: CycleEntry[] = [];
  for (const entry of entries) {
    const last = merged[merged.length - 1];
    if (last && (last.end == null || entry.start <= addDaysToDateKey(last.end, 1))) {
      last.end = last.end == null || entry.end == null ? (last.end == null && entry.end == null ? null : last.end ?? entry.end) : last.end > entry.end ? last.end : entry.end;
      continue;
    }
    merged.push({ ...entry });
  }
  const days: DayLog[] = [];
  const seen = new Set<string>();
  for (const item of Array.isArray(value.days) ? value.days : []) {
    const date = typeof item?.date === "string" && parseDateKey(item.date) ? item.date : null;
    if (!date || seen.has(date)) continue;
    seen.add(date);
    const flow = item?.flow === "light" || item?.flow === "medium" || item?.flow === "heavy" ? item.flow : null;
    const symptoms = Array.isArray(item?.symptoms) ? item.symptoms.filter((s: unknown) => typeof s === "string").slice(0, 12) : [];
    const note = typeof item?.note === "string" ? item.note.slice(0, 280) : null;
    days.push({ date, flow, symptoms, note });
  }
  days.sort((a, b) => (a.date < b.date ? -1 : 1));
  return { version: 1, entries: merged, days };
}

/** Average cycle length from recent starts, bounded to a plausible range; the default until two cycles exist. */
export function averageCycleLength(entries: CycleEntry[]): { days: number; sample: number } {
  const starts = entries.map((e) => e.start).slice(-(HISTORY_FOR_AVERAGE + 1));
  const gaps: number[] = [];
  for (let i = 1; i < starts.length; i++) {
    const gap = daysBetween(starts[i - 1], starts[i]);
    if (gap >= MIN_CYCLE - 3 && gap <= MAX_CYCLE + 5) gaps.push(gap);
  }
  if (gaps.length === 0) return { days: DEFAULT_CYCLE_LENGTH, sample: 0 };
  const mean = gaps.reduce((a, b) => a + b, 0) / gaps.length;
  return { days: clamp(Math.round(mean), MIN_CYCLE, MAX_CYCLE), sample: gaps.length };
}

export function averagePeriodLength(entries: CycleEntry[]): number {
  const lengths = entries
    .filter((e) => e.end)
    .slice(-HISTORY_FOR_AVERAGE)
    .map((e) => daysBetween(e.start, e.end as string) + 1)
    .filter((n) => n >= 1 && n <= MAX_PERIOD + 3);
  if (lengths.length === 0) return DEFAULT_PERIOD_LENGTH;
  return clamp(Math.round(lengths.reduce((a, b) => a + b, 0) / lengths.length), MIN_PERIOD, MAX_PERIOD);
}

export type Phase = "period" | "follicular" | "fertile" | "luteal" | "late" | "unknown";

export type CycleStatus = {
  phase: Phase;
  /** 1-based day of the current cycle, null with no data */
  cycleDay: number | null;
  cycleLength: number;
  periodLength: number;
  /** predicted start of the next period */
  nextPeriodStart: DateKey | null;
  /** days from today until the predicted start (negative = overdue) */
  daysUntilNextPeriod: number | null;
  /** rough estimate; not for contraception */
  fertileWindow: { start: DateKey; end: DateKey } | null;
  /** how many cycles the averages are based on */
  sample: number;
  /** the current period entry when bleeding is logged as ongoing today */
  ongoing: CycleEntry | null;
};

/** Where in the cycle a given day falls, from the logged history. */
export function cycleStatus(data: CycleData, today: DateKey = getLocalDateKey()): CycleStatus {
  const { days: cycleLength, sample } = averageCycleLength(data.entries);
  const periodLength = averagePeriodLength(data.entries);
  const past = data.entries.filter((e) => e.start <= today);
  const last = past[past.length - 1] ?? null;
  if (!last) {
    return { phase: "unknown", cycleDay: null, cycleLength, periodLength, nextPeriodStart: null, daysUntilNextPeriod: null, fertileWindow: null, sample, ongoing: null };
  }
  const cycleDay = daysBetween(last.start, today) + 1;
  const nextPeriodStart = addDaysToDateKey(last.start, cycleLength);
  const daysUntilNextPeriod = daysBetween(today, nextPeriodStart);
  // ovulation ~14 days before the next period; fertile window ~5 days before to 1 day after
  const ovulationDay = Math.max(8, cycleLength - 14);
  const fertileWindow = {
    start: addDaysToDateKey(last.start, ovulationDay - 5 - 1),
    end: addDaysToDateKey(last.start, ovulationDay + 1 - 1),
  };
  const bleedingToday =
    (last.end == null && cycleDay <= MAX_PERIOD + 2) || (last.end != null && today <= last.end);
  let phase: Phase;
  if (bleedingToday) phase = "period";
  else if (cycleDay > cycleLength + 1) phase = "late";
  else if (today >= fertileWindow.start && today <= fertileWindow.end) phase = "fertile";
  else if (cycleDay <= ovulationDay) phase = "follicular";
  else phase = "luteal";
  return {
    phase,
    cycleDay,
    cycleLength,
    periodLength,
    nextPeriodStart,
    daysUntilNextPeriod,
    fertileWindow,
    sample,
    ongoing: bleedingToday && last.end == null ? last : null,
  };
}

/** Marks today (or a chosen day) as a period day: extends an ongoing/adjacent period or starts a new one. */
export function logPeriodDay(data: CycleData, date: DateKey): CycleData {
  const entries = data.entries.map((e) => ({ ...e }));
  const touching = entries.find((e) => {
    const end = e.end ?? addDaysToDateKey(e.start, MAX_PERIOD);
    return date >= addDaysToDateKey(e.start, -1) && date <= addDaysToDateKey(end, 1);
  });
  if (touching) {
    if (date < touching.start) touching.start = date;
    if (touching.end != null && date > touching.end) touching.end = date;
    if (touching.end == null && daysBetween(touching.start, date) >= 0) touching.end = touching.end;
  } else {
    entries.push({ start: date, end: date });
  }
  return normalizeCycleData({ ...data, entries });
}

/** Removes a day from a period, splitting or shrinking the entry; removes the entry if it becomes empty. */
export function unlogPeriodDay(data: CycleData, date: DateKey): CycleData {
  const entries: CycleEntry[] = [];
  for (const e of data.entries) {
    const end = e.end ?? date; // an ongoing period ends the day before the removed day
    if (date < e.start || date > end) {
      entries.push({ ...e });
      continue;
    }
    if (date === e.start && date === end) continue; // single-day period removed
    if (date === e.start) {
      entries.push({ start: addDaysToDateKey(date, 1), end: e.end });
    } else if (date === end) {
      entries.push({ start: e.start, end: addDaysToDateKey(date, -1) });
    } else {
      entries.push({ start: e.start, end: addDaysToDateKey(date, -1) });
      entries.push({ start: addDaysToDateKey(date, 1), end: e.end });
    }
  }
  return normalizeCycleData({ ...data, entries });
}

export function isPeriodDay(data: CycleData, date: DateKey): boolean {
  return data.entries.some((e) => date >= e.start && date <= (e.end ?? addDaysToDateKey(e.start, MAX_PERIOD)));
}

export function upsertDayLog(data: CycleData, log: DayLog): CycleData {
  const days = data.days.filter((d) => d.date !== log.date);
  const cleaned: DayLog = { date: log.date, flow: log.flow ?? null, symptoms: (log.symptoms || []).slice(0, 12), note: log.note ?? null };
  const isEmpty = !cleaned.flow && cleaned.symptoms!.length === 0 && !cleaned.note;
  return normalizeCycleData({ ...data, days: isEmpty ? days : [...days, cleaned] });
}

export function dayLogFor(data: CycleData, date: DateKey): DayLog | null {
  return data.days.find((d) => d.date === date) ?? null;
}

/** Predicted period days for the calendar (the next `count` cycles), from the last logged start. */
export function predictedPeriodDays(data: CycleData, today: DateKey, count = 3): Set<DateKey> {
  const result = new Set<DateKey>();
  const status = cycleStatus(data, today);
  if (!status.nextPeriodStart) return result;
  for (let cycle = 0; cycle < count; cycle++) {
    const start = addDaysToDateKey(status.nextPeriodStart, cycle * status.cycleLength);
    for (let d = 0; d < status.periodLength; d++) result.add(addDaysToDateKey(start, d));
  }
  return result;
}

/** Copy for the companion: gentle, factual, never diagnostic. */
export function phaseLine(status: CycleStatus, petName: string): string {
  const name = petName || "Your pet";
  switch (status.phase) {
    case "period":
      return `${name} brought a blanket. Warmth, water and rest are all fair game today.`;
    case "late":
      return `Your period is a few days past the estimate. Cycles vary; ${name} is not worried, but log it when it comes.`;
    case "fertile":
      return `Around the middle of your cycle. ${name} notices you have a bit more energy this week.`;
    case "luteal":
      return status.daysUntilNextPeriod != null && status.daysUntilNextPeriod <= 3
        ? `Your period is expected in about ${Math.max(0, status.daysUntilNextPeriod)} ${status.daysUntilNextPeriod === 1 ? "day" : "days"}. ${name} suggests an easy few days.`
        : `Second half of your cycle. ${name} keeps the pace gentle.`;
    case "follicular":
      return `Fresh cycle. ${name} is up for whatever the day brings.`;
    default:
      return `Log the first day of your period and ${name} will keep track from there.`;
  }
}

export function phaseLabel(phase: Phase): string {
  switch (phase) {
    case "period":
      return "Period";
    case "follicular":
      return "Follicular";
    case "fertile":
      return "Fertile window (estimate)";
    case "luteal":
      return "Luteal";
    case "late":
      return "Period expected";
    default:
      return "No data yet";
  }
}
