// "This month": the pet tells the last thirty days back as patterns (product strategy report: shallow insights,
// told by the pet). Pure rules over the daily metrics roll-up and the on-device battery answers, in the same
// voice as "Our week": observations, never verdicts, and nothing here counts a miss. Cycle data is never read
// here; a cycle insight is the owner's call (docs/dev-notes.md, insights v1).
import { ENERGY_OPTIONS } from "./energy";
import type { Energy } from "./plan/types";
import { humanRange } from "./week";
import { addDaysToDateKey, parseDateKey } from "../utils/dateKeys";

export const MONTH_DAYS = 30;

export type MonthMetric = { day: string; tasks_completed: number; checkins_completed: number; points_earned?: number };
/** battery answers by date key, as Home keeps them on the device */
export type MonthBattery = Record<string, Energy | null | undefined>;

export type MonthDay = {
  dateKey: string;
  weekday: string;
  tasks: number;
  checkins: number;
  points: number;
  active: boolean;
  energy: Energy | null;
  isToday: boolean;
};

export type WeekdayPattern = {
  weekday: string;
  initial: string;
  /** how many of this weekday fell inside the window */
  occurrences: number;
  /** how many of those had any care logged */
  activeDays: number;
  tasks: number;
  /** activeDays over occurrences, for a bar */
  share: number;
};

export type MonthRun = {
  length: number;
  startDateKey: string;
  endDateKey: string;
  /** the run touches the start of the window, so it may have begun earlier */
  atLeast: boolean;
};

export type BatteryPattern = {
  energy: Energy;
  label: string;
  icon: string;
  category: string;
  days: number;
  tasks: number;
  /** mean small things on those days, unrounded (the screen rounds once) */
  tasksPerDay: number;
};

export type MonthInsights = {
  startDateKey: string;
  endDateKey: string;
  range: string;
  days: MonthDay[];
  activeDays: number;
  tasks: number;
  checkins: number;
  points: number;
  /** Monday first */
  weekdays: WeekdayPattern[];
  /** the weekday care happens on most, only when one clearly leads */
  fullestWeekday: WeekdayPattern | null;
  /** the longest stretch of days in a row with care, two days or more */
  bestRun: MonthRun | null;
  /** battery answers grouped by what was picked, with the small things done on those days */
  battery: BatteryPattern[];
  batteryDays: number;
  headline: string;
  noticed: string[];
  closing: string;
};

export type MonthInput = {
  endDateKey: string;
  metrics: MonthMetric[];
  battery?: MonthBattery | null;
  petName?: string | null;
  memorial?: boolean;
  /** window length in days, thirty by default (never under seven) */
  days?: number;
};

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONDAY_FIRST = [1, 2, 3, 4, 5, 6, 0];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const ENERGY_IDS: Energy[] = ENERGY_OPTIONS.map((option) => option.id);

function safeCount(value: unknown): number {
  return Math.max(0, Math.floor(Number(value) || 0));
}

/** "22 Sep" */
function humanDay(dateKey: string): string {
  const d = parseDateKey(dateKey);
  return d ? `${d.getDate()} ${MONTHS[d.getMonth()]}` : dateKey;
}

function things(n: number): string {
  return `${n} small ${n === 1 ? "thing" : "things"}`;
}

/** The longest stretch of consecutive active days, or null when there is no stretch of two or more. */
export function longestRun(days: MonthDay[]): MonthRun | null {
  let best: MonthRun | null = null;
  let start = -1;
  for (let i = 0; i <= days.length; i += 1) {
    const active = i < days.length && days[i].active;
    if (active && start < 0) start = i;
    if (!active && start >= 0) {
      const length = i - start;
      if (!best || length > best.length) {
        best = { length, startDateKey: days[start].dateKey, endDateKey: days[i - 1].dateKey, atLeast: start === 0 };
      }
      start = -1;
    }
  }
  return best && best.length >= 2 ? best : null;
}

export function buildMonthInsights({ endDateKey, metrics, battery, petName, memorial = false, days: span }: MonthInput): MonthInsights {
  const pet = (petName || "Your pet").trim() || "Your pet";
  const length = Math.max(7, Math.floor(Number(span) || MONTH_DAYS));
  const startDateKey = addDaysToDateKey(endDateKey, -(length - 1));

  const metricByDay = new Map<string, MonthMetric>();
  for (const row of metrics || []) {
    if (row?.day) metricByDay.set(row.day, row);
  }

  const days: MonthDay[] = [];
  for (let offset = -(length - 1); offset <= 0; offset += 1) {
    const dateKey = addDaysToDateKey(endDateKey, offset);
    const metric = metricByDay.get(dateKey);
    const tasks = safeCount(metric?.tasks_completed);
    const checkins = safeCount(metric?.checkins_completed);
    const raw = battery?.[dateKey];
    const parsed = parseDateKey(dateKey);
    days.push({
      dateKey,
      weekday: parsed ? WEEKDAYS[parsed.getDay()] : "",
      tasks,
      checkins,
      points: safeCount(metric?.points_earned),
      active: tasks + checkins > 0,
      energy: ENERGY_IDS.includes(raw as Energy) ? (raw as Energy) : null,
      isToday: offset === 0,
    });
  }

  const activeDays = days.filter((d) => d.active).length;
  const tasks = days.reduce((sum, d) => sum + d.tasks, 0);
  const checkins = days.reduce((sum, d) => sum + d.checkins, 0);
  const points = days.reduce((sum, d) => sum + d.points, 0);

  // ---- which weekdays care happens on ------------------------------------------------------------
  const byWeekday = WEEKDAYS.map<WeekdayPattern>((weekday) => ({ weekday, initial: weekday.slice(0, 1), occurrences: 0, activeDays: 0, tasks: 0, share: 0 }));
  for (const day of days) {
    // today only counts once something has happened on it: an empty morning is not a miss
    if (day.isToday && !day.active) continue;
    const parsed = parseDateKey(day.dateKey);
    if (!parsed) continue;
    const pattern = byWeekday[parsed.getDay()];
    pattern.occurrences += 1;
    pattern.tasks += day.tasks;
    if (day.active) pattern.activeDays += 1;
  }
  for (const pattern of byWeekday) pattern.share = pattern.occurrences ? pattern.activeDays / pattern.occurrences : 0;
  const weekdays = MONDAY_FIRST.map((dow) => byWeekday[dow]);
  const ranked = [...weekdays].sort((a, b) => b.activeDays - a.activeDays || b.tasks - a.tasks);
  const fullestWeekday = ranked[0].activeDays >= 2 && ranked[0].activeDays > ranked[1].activeDays ? ranked[0] : null;

  // ---- the longest stretch -----------------------------------------------------------------------
  const bestRun = longestRun(days);

  // ---- battery against small things --------------------------------------------------------------
  const batteryAll = ENERGY_OPTIONS.map<BatteryPattern>((option) => ({
    energy: option.id,
    label: option.label,
    icon: option.icon,
    category: option.category,
    days: 0,
    tasks: 0,
    tasksPerDay: 0,
  }));
  for (const day of days) {
    if (!day.energy) continue;
    const pattern = batteryAll.find((p) => p.energy === day.energy);
    if (!pattern) continue;
    pattern.days += 1;
    pattern.tasks += day.tasks;
  }
  const batteryPatterns = batteryAll.filter((p) => p.days > 0).map((p) => ({ ...p, tasksPerDay: p.tasks / p.days }));
  const batteryDays = batteryPatterns.reduce((sum, p) => sum + p.days, 0);
  const gentle = batteryPatterns.filter((p) => p.energy === "exhausted" || p.energy === "anxious");
  const bright = batteryPatterns.filter((p) => p.energy === "calm" || p.energy === "energized");
  const gentleDays = gentle.reduce((sum, p) => sum + p.days, 0);
  const brightDays = bright.reduce((sum, p) => sum + p.days, 0);
  const gentleTasks = gentle.reduce((sum, p) => sum + p.tasks, 0);
  const brightTasks = bright.reduce((sum, p) => sum + p.tasks, 0);

  // ---- what the pet noticed ----------------------------------------------------------------------
  const noticed: string[] = [];
  let headline: string;
  if (memorial) headline = `The month, with ${pet} remembered.`;
  else if (activeDays === 0) headline = "A quiet month, and that's allowed.";
  else if (activeDays >= Math.round(length * 0.8)) headline = "You showed up nearly every day this month.";
  else if (activeDays >= Math.round(length * 0.4)) headline = "A steady month, one small thing at a time.";
  else headline = "You came by when you could. That counts.";

  if (fullestWeekday) {
    const { weekday, activeDays: active, occurrences } = fullestWeekday;
    if (!memorial && active === occurrences && occurrences >= 3) noticed.push(`You came by every ${weekday} this month.`);
    else noticed.push(`${weekday}s are when you come by most often: ${active} of ${occurrences} this month.`);
  }

  if (bestRun && !memorial) {
    noticed.push(
      bestRun.atLeast
        ? `Your longest stretch: at least ${bestRun.length} days in a row, ending ${humanDay(bestRun.endDateKey)}. It may have begun before the month did.`
        : `Your longest stretch: ${bestRun.length} days in a row, ${humanRange(bestRun.startDateKey, bestRun.endDateKey)}.`
    );
  }

  if (gentleDays >= 2 && brightDays >= 2) {
    const g = Math.round(gentleTasks / gentleDays);
    const b = Math.round(brightTasks / brightDays);
    if (g === 0 && b === 0) noticed.push(`You checked your battery on ${batteryDays} days and kept the list light on all of them. That's allowed.`);
    else if (g >= b) noticed.push("You did about as much on low-battery days as on bright ones. Some of that effort can be rest.");
    else noticed.push(`On low-battery days you ${g === 0 ? "let the list rest" : `did about ${things(g)}`}; on brighter days about ${g === 0 ? things(b) : b}. Both are care.`);
  } else if (batteryDays >= 3) {
    // "mostly" only when one answer clearly leads and is more than half of the checks (as with the weekday)
    const sorted = [...batteryPatterns].sort((a, b) => b.days - a.days);
    const lead = sorted[0];
    const clear = lead.days > (sorted[1]?.days ?? 0) && lead.days * 2 > batteryDays;
    noticed.push(
      clear
        ? `You checked your battery on ${batteryDays} days; it was mostly ${lead.label.toLowerCase()}.`
        : `You checked your battery on ${batteryDays} days; no single answer led.`
    );
  } else if (batteryDays === 0 && activeDays > 0 && !memorial) {
    noticed.push("No battery checks this month, so that line stays blank. That's fine.");
  }

  if (activeDays === 0 && !memorial) noticed.push(`Nothing logged this month. ${pet} is just glad you came by.`);

  let closing: string;
  if (memorial) closing = "Take the coming month at your own pace.";
  else if (activeDays === 0) closing = `${pet} is just glad you're here. Tomorrow is a fine place to start.`;
  else closing = `${pet} remembers every one of those days.`;

  return {
    startDateKey,
    endDateKey,
    range: humanRange(startDateKey, endDateKey),
    days,
    activeDays,
    tasks,
    checkins,
    points,
    weekdays,
    fullestWeekday,
    bestRun,
    battery: batteryPatterns,
    batteryDays,
    headline,
    noticed: noticed.slice(0, 3),
    closing,
  };
}
