// Days Together milestones and the keepsakes they leave behind (docs/ROADMAP.md, "Cozy Run": milestones on Days
// Together give room items, outfits, scrapbook pages; this is the scrapbook-page half). Days Together only
// ever goes up and never resets, so a milestone is reached once and kept for good. Pure; the device store is
// src/services/milestoneStore.ts.
import type { CompletedJourney } from "./journeys";
import { journeyById } from "./journeys";
import type { CareCategory } from "./plan/types";
import { parseDateKey } from "../utils/dateKeys";

export const MILESTONE_DAYS = [1, 3, 7, 14, 21, 30, 50, 75, 100, 150, 200, 365] as const;
export type MilestoneDays = (typeof MILESTONE_DAYS)[number];

/** threshold -> the local day it was reached; null when it was reached before keepsakes existed */
export type MilestoneRecord = Record<string, string | null>;

export function isMilestoneDays(value: unknown): value is MilestoneDays {
  return (MILESTONE_DAYS as readonly number[]).includes(Number(value));
}

export function milestoneTitle(days: number): string {
  switch (days) {
    case 1:
      return "First day together";
    case 3:
      return "Three days together";
    case 7:
      return "A week together";
    case 14:
      return "Two weeks together";
    case 21:
      return "Three weeks together";
    case 30:
      return "A month together";
    case 365:
      return "A whole year together";
    default:
      return `${days} days together`;
  }
}

/** What the pet says at the moment, in the first person, never counting what was missed. */
export function milestoneLine(days: number, petName: string): string {
  const name = petName || "Your pet";
  switch (days) {
    case 1:
      return `Day one. I'm glad you're here. That's the whole job today.`;
    case 3:
      return `Three days of showing up for yourself. I noticed every one.`;
    case 7:
      return `A whole week. You've been looking after both of us.`;
    case 14:
      return `Two weeks together. The garden feels different with you in it.`;
    case 21:
      return `Three weeks. Small things, done often. That's how it works.`;
    case 30:
      return `A month. I'd wag at you for a full minute if I could.`;
    case 50:
      return `Fifty days. You keep coming back, and I keep being glad.`;
    case 75:
      return `Seventy-five days together. I've saved every one of them.`;
    case 100:
      return `A hundred days. Look at what we grew.`;
    case 150:
      return `A hundred and fifty. You're part of the furniture now, in the best way.`;
    case 200:
      return `Two hundred days. I don't know how to count that high, but I feel it.`;
    case 365:
      return `A whole year. Every season, you came back. ${name} forever.`;
    default:
      return `${days} days together. Thank you for every one.`;
  }
}

export function milestoneIcon(days: number): string {
  if (days >= 365) return "trophy-outline";
  if (days >= 100) return "ribbon-outline";
  if (days >= 30) return "medal-outline";
  if (days >= 7) return "sparkles-outline";
  return "flower-outline";
}

export function normalizeMilestoneRecord(raw: unknown): MilestoneRecord {
  let value: unknown = raw;
  if (typeof value === "string") {
    try {
      value = JSON.parse(value);
    } catch {
      value = null;
    }
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const out: MilestoneRecord = {};
  for (const [key, day] of Object.entries(value as Record<string, unknown>)) {
    if (!isMilestoneDays(key)) continue;
    if (day === null) out[String(Number(key))] = null;
    else if (typeof day === "string" && parseDateKey(day)) out[String(Number(key))] = day;
  }
  return out;
}

/**
 * Which milestone to celebrate now, and the record to keep. Everything at or below `days` that is not in the
 * record is newly reached; only the highest one gets a moment, the rest are written down quietly (so a person
 * who installs this update on day 40 gets one "a month together", not six sheets). A record that already
 * holds the threshold is left alone, so a moment happens once.
 */
export function reconcileMilestones(record: MilestoneRecord, days: number, today: string): { record: MilestoneRecord; celebrate: MilestoneDays | null } {
  const count = Number.isFinite(days) ? Math.floor(days) : 0;
  const unseen = MILESTONE_DAYS.filter((threshold) => threshold <= count && record[String(threshold)] === undefined);
  if (unseen.length === 0) return { record, celebrate: null };
  const top = unseen[unseen.length - 1];
  const next: MilestoneRecord = { ...record };
  for (const threshold of unseen) next[String(threshold)] = threshold === top ? today : null;
  return { record: next, celebrate: top };
}

/** The next milestone ahead, and how many more days of care it takes. */
export function nextMilestone(days: number): { days: MilestoneDays; left: number } | null {
  const count = Number.isFinite(days) ? Math.floor(days) : 0;
  const ahead = MILESTONE_DAYS.find((threshold) => threshold > count);
  return ahead ? { days: ahead, left: ahead - count } : null;
}

// ---------- keepsakes ----------

export type Keepsake = {
  id: string;
  kind: "milestone" | "journey" | "first_day";
  title: string;
  line: string;
  icon: string;
  category: CareCategory;
  /** local day; null for a milestone reached before keepsakes existed */
  date: string | null;
};

/** Every moment worth keeping, newest first; undated ones (from before keepsakes existed) at the end. */
export function buildKeepsakes(input: { milestones: MilestoneRecord; journeys: CompletedJourney[]; firstDay: string | null; petName: string }): Keepsake[] {
  const list: Keepsake[] = [];
  for (const [key, date] of Object.entries(input.milestones || {})) {
    const days = Number(key);
    if (!isMilestoneDays(days)) continue;
    list.push({ id: `milestone:${days}`, kind: "milestone", title: milestoneTitle(days), line: milestoneLine(days, input.petName), icon: milestoneIcon(days), category: "play", date });
  }
  for (const entry of input.journeys || []) {
    const journey = journeyById(entry.journeyId);
    if (!journey) continue;
    list.push({
      id: `journey:${entry.journeyId}:${entry.finishedOn}`,
      kind: "journey",
      title: `${journey.title}: walked`,
      line: `Seven small steps, started ${humanDay(entry.startedOn)}. ${input.petName || "Your pet"} walked every one with you.`,
      icon: journey.icon,
      category: journey.category,
      date: entry.finishedOn,
    });
  }
  if (input.firstDay && parseDateKey(input.firstDay)) {
    list.push({ id: "first_day", kind: "first_day", title: `${input.petName || "Your pet"} moved in`, line: "The day the garden got its best friend.", icon: "home-outline", category: "connection", date: input.firstDay });
  }
  return list.sort((a, b) => {
    if (a.date && b.date) return b.date.localeCompare(a.date) || a.id.localeCompare(b.id);
    if (a.date) return -1;
    if (b.date) return 1;
    return a.id.localeCompare(b.id);
  });
}

export function humanDay(dateKey: string | null | undefined): string {
  if (!dateKey) return "some time ago";
  const parsed = parseDateKey(dateKey);
  if (!parsed) return "some time ago";
  try {
    return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(parsed);
  } catch {
    return dateKey;
  }
}
