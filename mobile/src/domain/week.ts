// The week as the pet tells it (product strategy report: "[Pet] put together your weekly scrapbook").
// Pure rules over the two stores the app already keeps: check-ins (energy + a win) and the daily
// metrics roll-up. The tone rule is the same as everywhere else: observations, never verdicts.
import { ENERGY_WORDS } from "./reflection";
import { addDaysToDateKey, parseDateKey } from "../utils/dateKeys";

export type WeekCheckin = { date: string; mood: number | null; win: string | null };

export type WeekMetric = {
  day: string;
  tasks_completed: number;
  checkins_completed: number;
  points_earned: number;
  activity_count: number;
};

export type WeekDay = {
  dateKey: string;
  weekday: string;
  initial: string;
  energy: number | null;
  win: string | null;
  tasks: number;
  checkins: number;
  points: number;
  active: boolean;
  isToday: boolean;
};

export type WeekStory = {
  startDateKey: string;
  endDateKey: string;
  range: string;
  days: WeekDay[];
  activeDays: number;
  tasks: number;
  checkins: number;
  points: number;
  energyAverage: number | null;
  energyWord: string | null;
  kept: Array<{ dateKey: string; weekday: string; text: string }>;
  heavier: WeekDay[];
  headline: string;
  noticed: string[];
  closing: string;
  checkedInToday: boolean;
};

export type WeekInput = {
  endDateKey: string;
  checkins: WeekCheckin[];
  metrics: WeekMetric[];
  petName?: string | null;
  memorial?: boolean;
};

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function weekdayOf(dateKey: string): string {
  const d = parseDateKey(dateKey);
  return d ? WEEKDAYS[d.getDay()] : "";
}

function clampEnergy(value: unknown): number | null {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.max(1, Math.min(5, Math.round(n)));
}

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/** "19–25 Sep" or "28 Sep – 4 Oct". */
export function humanRange(startDateKey: string, endDateKey: string): string {
  const a = parseDateKey(startDateKey);
  const b = parseDateKey(endDateKey);
  if (!a || !b) return `${startDateKey} to ${endDateKey}`;
  if (a.getMonth() === b.getMonth()) return `${a.getDate()}–${b.getDate()} ${MONTHS[b.getMonth()]}`;
  return `${a.getDate()} ${MONTHS[a.getMonth()]} – ${b.getDate()} ${MONTHS[b.getMonth()]}`;
}

/** The word for an average energy level (1–5), on the report's Exhausted → Energized scale. */
export function energyWord(averageEnergy: number | null): string | null {
  if (averageEnergy == null || !Number.isFinite(averageEnergy)) return null;
  const idx = Math.max(1, Math.min(5, Math.round(averageEnergy)));
  return ENERGY_WORDS[idx];
}

function listNames(names: string[]): string {
  if (names.length <= 1) return names[0] || "";
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

export function buildWeekStory({ endDateKey, checkins, metrics, petName, memorial = false }: WeekInput): WeekStory {
  const pet = (petName || "Your pet").trim() || "Your pet";
  const startDateKey = addDaysToDateKey(endDateKey, -6);

  const checkinByDay = new Map<string, WeekCheckin>();
  for (const row of checkins || []) {
    if (row?.date && !checkinByDay.has(row.date)) checkinByDay.set(row.date, row);
  }
  const metricByDay = new Map<string, WeekMetric>();
  for (const row of metrics || []) {
    if (row?.day) metricByDay.set(row.day, row);
  }

  const days: WeekDay[] = [];
  for (let offset = -6; offset <= 0; offset += 1) {
    const dateKey = addDaysToDateKey(endDateKey, offset);
    const checkin = checkinByDay.get(dateKey);
    const metric = metricByDay.get(dateKey);
    const tasks = Math.max(0, Math.floor(Number(metric?.tasks_completed) || 0));
    const checkinsCount = Math.max(Math.floor(Number(metric?.checkins_completed) || 0), checkin ? 1 : 0);
    const points = Math.max(0, Math.floor(Number(metric?.points_earned) || 0));
    const weekday = weekdayOf(dateKey);
    const win = typeof checkin?.win === "string" && checkin.win.trim() ? checkin.win.trim() : null;
    days.push({
      dateKey,
      weekday,
      initial: weekday.slice(0, 1),
      energy: clampEnergy(checkin?.mood),
      win,
      tasks,
      checkins: checkinsCount,
      points,
      active: tasks + checkinsCount > 0,
      isToday: offset === 0,
    });
  }

  const activeDays = days.filter((d) => d.active).length;
  const tasks = days.reduce((sum, d) => sum + d.tasks, 0);
  const checkinTotal = days.reduce((sum, d) => sum + d.checkins, 0);
  const points = days.reduce((sum, d) => sum + d.points, 0);
  const energies = days.filter((d) => d.energy != null).map((d) => d.energy as number);
  const energyAverage = average(energies);
  const word = energyWord(energyAverage);
  const kept = days.filter((d) => d.win).map((d) => ({ dateKey: d.dateKey, weekday: d.weekday, text: d.win as string }));
  const heavier = days.filter((d) => d.energy != null && (d.energy as number) <= 2);
  const checkedInToday = days[days.length - 1].checkins > 0;

  // ---- what the pet noticed -----------------------------------------------------------------------
  const noticed: string[] = [];
  let headline: string;
  if (memorial) {
    headline = `Your week, with ${pet} remembered.`;
  } else if (activeDays === 0) {
    headline = "A quiet week, and that's allowed.";
  } else if (activeDays >= 6) {
    headline = "You showed up almost every day.";
  } else if (activeDays >= 3) {
    headline = "A steady week, one small thing at a time.";
  } else {
    headline = "You came by when you could. That counts.";
  }

  if (energyAverage != null && word) {
    const firstHalf = average(days.slice(0, 3).filter((d) => d.energy != null).map((d) => d.energy as number));
    const secondHalf = average(days.slice(4).filter((d) => d.energy != null).map((d) => d.energy as number));
    let trend = "";
    if (firstHalf != null && secondHalf != null) {
      if (secondHalf - firstHalf >= 0.75) trend = " It climbed towards the end of the week.";
      else if (firstHalf - secondHalf >= 0.75) trend = " It dipped towards the end of the week, so go gently.";
    }
    noticed.push(`Energy was mostly ${word.toLowerCase()}.${trend}`);
  } else if (activeDays > 0) {
    noticed.push("No check-ins this week, so the energy line stays blank. That's fine.");
  }

  if (heavier.length > 0) {
    const names = listNames(heavier.map((d) => d.weekday));
    const heavyButActive = heavier.some((d) => d.tasks > 0);
    noticed.push(
      `${names} ${heavier.length === 1 ? "felt" : "felt"} heavier. ${memorial ? "" : `${pet} stayed close.`}${
        heavyButActive ? " You still did something on those days. That counts double." : ""
      }`.trim()
    );
  }

  const fullest = days.reduce<WeekDay | null>((best, d) => (d.tasks > 0 && (!best || d.tasks > best.tasks) ? d : best), null);
  if (fullest && !memorial) {
    noticed.push(`${fullest.weekday} was the fullest day: ${fullest.tasks} small ${fullest.tasks === 1 ? "thing" : "things"}.`);
  }
  if (activeDays === 0 && !memorial) {
    noticed.push(`Nothing logged this week. ${pet} is just glad you opened the garden.`);
  }

  let closing: string;
  if (memorial) closing = "Take the coming week at your own pace.";
  else if (checkedInToday) closing = `That's the week so far. ${pet} will be here tomorrow.`;
  else closing = "Today isn't in the scrapbook yet.";

  return {
    startDateKey,
    endDateKey,
    range: humanRange(startDateKey, endDateKey),
    days,
    activeDays,
    tasks,
    checkins: checkinTotal,
    points,
    energyAverage: energyAverage == null ? null : Number(energyAverage.toFixed(1)),
    energyWord: word,
    kept,
    heavier,
    headline,
    noticed: noticed.slice(0, 3),
    closing,
    checkedInToday,
  };
}
