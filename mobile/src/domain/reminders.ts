// Gentle reminders in the pet's voice (product strategy report: "[Pet] greets you tomorrow morning",
// no nagging, Graceful Hibernation). Everything here is pure: the settings shape, and the plan of
// local notifications for the next few days. The service schedules the plan on the device; nothing
// goes through a server. The plan is rebuilt every time the app opens, so if the person stops
// opening the app the reminders simply run out after `days` instead of piling up.
import { addDaysToDateKey, getLocalDateKey, parseDateKey } from "../utils/dateKeys";
import { sanctuaryFor } from "./sanctuary";

export type ReminderTime = { hour: number; minute: number };

export type ReminderSettings = {
  /** master switch; off until the person opts in */
  enabled: boolean;
  morning: { enabled: boolean; time: ReminderTime };
  evening: { enabled: boolean; time: ReminderTime };
  /** Sunday: "<pet> put together your week" */
  weekly: { enabled: boolean; time: ReminderTime };
};

export const DEFAULT_REMINDERS: ReminderSettings = {
  enabled: false,
  morning: { enabled: true, time: { hour: 8, minute: 30 } },
  evening: { enabled: true, time: { hour: 20, minute: 30 } },
  weekly: { enabled: true, time: { hour: 18, minute: 0 } },
};

export const MORNING_TIMES: ReminderTime[] = [
  { hour: 7, minute: 0 },
  { hour: 7, minute: 30 },
  { hour: 8, minute: 0 },
  { hour: 8, minute: 30 },
  { hour: 9, minute: 0 },
  { hour: 9, minute: 30 },
  { hour: 10, minute: 0 },
];

export const EVENING_TIMES: ReminderTime[] = [
  { hour: 19, minute: 0 },
  { hour: 19, minute: 30 },
  { hour: 20, minute: 0 },
  { hour: 20, minute: 30 },
  { hour: 21, minute: 0 },
  { hour: 21, minute: 30 },
  { hour: 22, minute: 0 },
];

export function formatTime(t: ReminderTime): string {
  return `${String(t.hour).padStart(2, "0")}:${String(t.minute).padStart(2, "0")}`;
}

function clampTime(raw: unknown, fallback: ReminderTime): ReminderTime {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const hour = Number(r.hour);
  const minute = Number(r.minute);
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) return fallback;
  if (!Number.isInteger(minute) || minute < 0 || minute > 59) return fallback;
  return { hour, minute };
}

export function normalizeReminderSettings(raw: unknown): ReminderSettings {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, any>;
  const part = (key: "morning" | "evening" | "weekly") => ({
    enabled: typeof r[key]?.enabled === "boolean" ? r[key].enabled : DEFAULT_REMINDERS[key].enabled,
    time: clampTime(r[key]?.time, DEFAULT_REMINDERS[key].time),
  });
  return { enabled: r.enabled === true, morning: part("morning"), evening: part("evening"), weekly: part("weekly") };
}

export type ReminderKind = "morning" | "evening" | "weekly";

export type PlannedReminder = {
  /** stable per day and kind, so a rebuilt plan replaces rather than duplicates */
  id: string;
  kind: ReminderKind;
  fireAt: Date;
  title: string;
  body: string;
};

export type ReminderContext = {
  petName: string;
  species?: string | null;
  /** memorial mode: nothing is scheduled */
  memorial?: boolean;
  /** local calendar day the plan starts from */
  today?: string;
  now?: Date;
  /** a check-in already exists for today, so tonight's nudge is skipped */
  checkedInToday?: boolean;
  /** how many days ahead to plan (the plan is rebuilt on every app open) */
  days?: number;
};

const MORNING_LINES: Array<(name: string, place: "garden" | "nook") => string> = [
  (n, p) => (p === "nook" ? `${n} is on the sill watching the street. Whenever you're up.` : `${n} is already out in the garden. Whenever you're up.`),
  (n) => `Morning. ${n} says no rush. One small thing today?`,
  (n, p) => (p === "nook" ? `${n} found the sunbeam and is saving you a spot.` : `${n} stretched, yawned, and is ready when you are.`),
  (n) => `${n} slept well. Hope you did too. Water first?`,
  (n) => `New day. ${n} is glad you're in it.`,
  (n, p) => (p === "nook" ? `${n} is loafing by the window. Take today gently.` : `${n} is sniffing the morning air. Take today gently.`),
  (n) => `${n} would like you to know that showing up is enough.`,
];

const EVENING_LINES: Array<(name: string) => string> = [
  (n) => `How did today go? ${n} would like to hear, in a word or two.`,
  (n) => `${n} is settling in for the night. A quick check-in before you do?`,
  (n) => `One slider, ten seconds. ${n} keeps you company either way.`,
  (n) => `Whatever kind of day it was, ${n} is glad you're here.`,
  (n) => `${n} is curled up and listening. How's your energy tonight?`,
];

function weekdayIndex(dateKey: string): number {
  const d = parseDateKey(dateKey);
  return d ? d.getDay() : 0;
}

function at(dateKey: string, time: ReminderTime): Date | null {
  const d = parseDateKey(dateKey);
  if (!d) return null;
  d.setHours(time.hour, time.minute, 0, 0);
  return d;
}

/**
 * The next `days` days of reminders, in the pet's voice, from the settings. Only future moments are
 * returned. Memorial mode returns nothing (report: pause routine prompts after a loss).
 */
export function buildReminderPlan(settings: ReminderSettings, ctx: ReminderContext): PlannedReminder[] {
  if (!settings.enabled || ctx.memorial) return [];
  const name = (ctx.petName || "Your pet").trim() || "Your pet";
  const place = sanctuaryFor(ctx.species);
  const today = ctx.today || getLocalDateKey();
  const now = ctx.now || new Date();
  const days = Math.max(1, Math.min(14, ctx.days ?? 7));
  const plan: PlannedReminder[] = [];

  for (let offset = 0; offset < days; offset += 1) {
    const dateKey = addDaysToDateKey(today, offset);
    const dow = weekdayIndex(dateKey);
    if (settings.morning.enabled) {
      const fireAt = at(dateKey, settings.morning.time);
      if (fireAt && fireAt > now) {
        plan.push({ id: `morning:${dateKey}`, kind: "morning", fireAt, title: name, body: MORNING_LINES[dow % MORNING_LINES.length](name, place) });
      }
    }
    if (settings.evening.enabled && !(offset === 0 && ctx.checkedInToday)) {
      const fireAt = at(dateKey, settings.evening.time);
      if (fireAt && fireAt > now) {
        plan.push({ id: `evening:${dateKey}`, kind: "evening", fireAt, title: name, body: EVENING_LINES[dow % EVENING_LINES.length](name) });
      }
    }
    if (settings.weekly.enabled && dow === 0) {
      const fireAt = at(dateKey, settings.weekly.time);
      if (fireAt && fireAt > now) {
        plan.push({ id: `weekly:${dateKey}`, kind: "weekly", fireAt, title: name, body: `${name} put together your week. Nothing to fix, just a look back.` });
      }
    }
  }
  return plan.sort((a, b) => a.fireAt.getTime() - b.fireAt.getTime());
}

/** One line for the settings screen: what is on, in words. */
export function remindersSummary(settings: ReminderSettings): string {
  if (!settings.enabled) return "Off";
  const parts: string[] = [];
  if (settings.morning.enabled) parts.push(`Morning ${formatTime(settings.morning.time)}`);
  if (settings.evening.enabled) parts.push(`Evening ${formatTime(settings.evening.time)}`);
  if (settings.weekly.enabled) parts.push("Sunday recap");
  return parts.length ? parts.join(" · ") : "On, nothing chosen";
}
