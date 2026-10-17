// The Sunday scrapbook (product strategy, weekly loop: "[Pet] put together your weekly scrapbook"; roadmap item
// 8). Once a week, on Sunday, the pet keeps one page about the week: a note in its own voice, a few stickers
// for what happened (a milestone, journey steps, the fullest day, the battery, the heavier days) and the wins the
// person wrote down. Built from the same week story as "Our week" (src/domain/week.ts) plus what the phone
// already keeps (journeys, milestones); pages are kept on the device (src/services/scrapbookStore.ts), so the
// book grows week by week. Pure. The tone rule holds: observations, never verdicts; nothing counts a miss; in
// memorial the page is quiet and never cheers.
import type { WeekStory } from "./week";
import type { Voice } from "./onboarding";
import { journeyById, type JourneyState } from "./journeys";
import { isMilestoneDays, milestoneIcon, milestoneTitle, normalizeMilestoneRecord, type MilestoneRecord } from "./milestones";
import { addDaysToDateKey, parseDateKey } from "../utils/dateKeys";
import type { CozyChapter } from "./cozyRun";

export type ScrapbookSticker = {
  id: string;
  /** Ionicons outline glyph */
  icon: string;
  /** care category that colours it */
  category: string;
  label: string;
  detail: string | null;
};

export type ScrapbookNote = { weekday: string; text: string };

export type ScrapbookPage = {
  version: 1;
  /** the Sunday the page was put together (the last day it covers) */
  endDateKey: string;
  startDateKey: string;
  /** "12–18 Oct" */
  range: string;
  /** the pet's note, first person (third person in memorial) */
  note: string;
  stickers: ScrapbookSticker[];
  /** wins written in the check-ins, as notes taped to the page */
  kept: ScrapbookNote[];
  /** wins beyond the ones on the page */
  moreKept: number;
  activeDays: number;
  memorial: boolean;
  /** ISO time the page was last put together */
  madeAt: string;
};

export type Scrapbook = {
  version: 1;
  /** newest first, one per Sunday */
  pages: ScrapbookPage[];
  /** the Sunday of the newest page the person has opened */
  lastSeenEnd: string | null;
};

export const EMPTY_SCRAPBOOK: Scrapbook = { version: 1, pages: [], lastSeenEnd: null };
/** a year of Sundays */
export const MAX_PAGES = 53;
export const MAX_KEPT_ON_PAGE = 4;
const MAX_NOTE_CHARS = 200;

/** Energy 1-5 as care colours, low to high (the same steps as the check-in picker and Our week). */
const ENERGY_CATEGORIES = ["", "rest", "calm", "focus", "energy", "play"];

/** The Sunday that ends the newest page: today on a Sunday, otherwise the Sunday just gone. */
export function latestPageEnd(today: string): string {
  const date = parseDateKey(today);
  if (!date) return today;
  return addDaysToDateKey(today, -date.getDay());
}

export function isSunday(dateKey: string): boolean {
  return parseDateKey(dateKey)?.getDay() === 0;
}

/**
 * Whether there is a page for the week ending `endDateKey` yet: not for a week that ended before the pet moved
 * in (`firstDay`, the day onboarding finished; unknown for older accounts, which always get one).
 */
export function hasPageFor(endDateKey: string, firstDay: string | null | undefined): boolean {
  if (!parseDateKey(endDateKey)) return false;
  if (!firstDay || !parseDateKey(firstDay)) return true;
  return firstDay <= endDateKey;
}

/** The newest page is new until it is opened. */
export function isPageNew(book: Scrapbook, today: string, firstDay: string | null | undefined): boolean {
  const end = latestPageEnd(today);
  return hasPageFor(end, firstDay) && book.lastSeenEnd !== end;
}

/** Home mentions a new page only on its Sunday and the Monday after; Profile keeps a quiet "New" until opened. */
export function shouldNudgeHome(book: Scrapbook, today: string, firstDay: string | null | undefined): boolean {
  const date = parseDateKey(today);
  if (!date || (date.getDay() !== 0 && date.getDay() !== 1)) return false;
  return isPageNew(book, today, firstDay);
}

type NoteBranch = "full" | "steady" | "light" | "quiet" | "heavy";

const NOTES: Record<Voice, Record<NoteBranch, string>> = {
  warm: {
    full: "We had a full week, you and me. I saved the best bits on this page.",
    steady: "A steady week. I kept a few things I noticed along the way.",
    light: "You came by when you could, and I kept every bit of it.",
    quiet: "A quiet week, and that's allowed. I saved you a page anyway.",
    heavy: "Some days were heavier this week. I stayed close, and I kept the small things too.",
  },
  gentle: {
    full: "You showed up almost every day. I tucked the week in here, softly.",
    steady: "A steady, gentle week. Here's what I gathered.",
    light: "A few visits this week. Each one is in here.",
    quiet: "A quiet week. Rest counts too. Your page is here whenever you want it.",
    heavy: "This week asked a lot. I kept the softer moments here for you.",
  },
  plain: {
    full: "Care on most days this week. Here's the page.",
    steady: "A steady week. Here's what I noticed.",
    light: "A couple of days of care. Here's the page.",
    quiet: "A quiet week. The page is here anyway.",
    heavy: "A heavier week. Here's what still happened.",
  },
};

function noteBranch(story: WeekStory): NoteBranch {
  if (story.activeDays === 0 && story.kept.length === 0) return "quiet";
  if (story.heavier.length >= 2) return "heavy";
  if (story.activeDays >= 5) return "full";
  if (story.activeDays >= 3) return "steady";
  return "light";
}

export function scrapbookNote(story: WeekStory, voice: Voice | null | undefined, petName: string, memorial: boolean): string {
  if (memorial) return `A page for this week, kept in ${petName}'s memory. Take the next one at your own pace.`;
  const lines = NOTES[voice && NOTES[voice] ? voice : "warm"];
  return lines[noteBranch(story)];
}

function inRange(dateKey: unknown, start: string, end: string): boolean {
  return typeof dateKey === "string" && dateKey >= start && dateKey <= end;
}

/** Journey steps walked in the week, and a journey finished in it, from the device's journey state. */
export function journeyWeek(state: JourneyState | null | undefined, start: string, end: string): { steps: number; finished: string | null; activeId: string | null } {
  if (!state) return { steps: 0, finished: null, activeId: null };
  let steps = 0;
  let finished: string | null = null;
  for (const entry of state.completed || []) {
    steps += Object.values(entry.doneDays || {}).filter((day) => inRange(day, start, end)).length;
    if (inRange(entry.finishedOn, start, end)) finished = entry.journeyId;
  }
  const active = state.active;
  if (active) steps += Object.values(active.doneDays || {}).filter((day) => inRange(day, start, end)).length;
  return { steps, finished, activeId: active?.journeyId ?? null };
}

/** The biggest Days Together milestone reached in the week, if any. */
export function milestoneInWeek(record: MilestoneRecord | null | undefined, start: string, end: string): number | null {
  const normalized = normalizeMilestoneRecord(record ?? {});
  let best: number | null = null;
  for (const [days, day] of Object.entries(normalized)) {
    const n = Number(days);
    if (isMilestoneDays(n) && inRange(day, start, end) && (best == null || n > best)) best = n;
  }
  return best;
}

function trimText(text: string): string {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length > MAX_NOTE_CHARS ? `${clean.slice(0, MAX_NOTE_CHARS - 1).trimEnd()}…` : clean;
}

function listDays(names: string[]): string {
  if (names.length <= 1) return names[0] || "";
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

export type PageInput = {
  story: WeekStory;
  petName: string;
  voice?: Voice | null;
  memorial?: boolean;
  journeys?: JourneyState | null;
  milestones?: MilestoneRecord | null;
  /** Cozy Runs kept as chapters (services/cozyRunStore.ts); one that came to rest this week gets its sticker */
  cozyChapters?: readonly CozyChapter[] | null;
  madeAt: string;
};

export function buildScrapbookPage({ story, petName, voice, memorial = false, journeys, milestones, cozyChapters, madeAt }: PageInput): ScrapbookPage {
  const pet = (petName || "Your pet").trim() || "Your pet";
  const start = story.startDateKey;
  const end = story.endDateKey;
  const stickers: ScrapbookSticker[] = [];

  // a milestone is a celebration, so memorial leaves it off the page
  const milestone = memorial ? null : milestoneInWeek(milestones, start, end);
  if (milestone != null) {
    stickers.push({ id: "milestone", icon: milestoneIcon(milestone), category: "play", label: milestoneTitle(milestone), detail: "Days Together" });
  }

  // a run that came to rest this week becomes a chapter of the book, never a "broken" streak
  const chapter = memorial ? null : (cozyChapters ?? []).find((c) => c.end >= start && c.end <= end) ?? null;
  if (chapter) {
    stickers.push({ id: "cozy-run", icon: "moon-outline", category: "rest", label: `A ${chapter.days}-day cozy run`, detail: "Kept as a chapter" });
  }

  const walk = journeyWeek(journeys, start, end);
  const finished = walk.finished ? journeyById(walk.finished) : undefined;
  const active = walk.activeId ? journeyById(walk.activeId) : undefined;
  if (finished) {
    stickers.push({ id: "journey", icon: finished.icon, category: finished.category, label: finished.title, detail: "Walked to the end" });
  } else if (walk.steps > 0) {
    stickers.push({
      id: "journey",
      icon: active?.icon ?? "map-outline",
      category: active?.category ?? "focus",
      label: `${walk.steps} journey ${walk.steps === 1 ? "step" : "steps"}`,
      detail: active?.title ?? null,
    });
  }

  if (!memorial) {
    const fullest = story.days.reduce<WeekStory["days"][number] | null>((best, d) => (d.tasks > 0 && (!best || d.tasks > best.tasks) ? d : best), null);
    if (fullest) {
      stickers.push({ id: "fullest", icon: "leaf-outline", category: "body", label: fullest.weekday, detail: `The fullest day: ${fullest.tasks} small ${fullest.tasks === 1 ? "thing" : "things"}` });
    }
  }

  if (story.energyAverage != null && story.energyWord) {
    const level = Math.max(1, Math.min(5, Math.round(story.energyAverage)));
    stickers.push({ id: "energy", icon: "battery-half-outline", category: ENERGY_CATEGORIES[level], label: `Mostly ${story.energyWord.toLowerCase()}`, detail: "Energy this week" });
  }

  if (story.activeDays > 0) {
    stickers.push({
      id: "days",
      icon: "calendar-outline",
      category: "calm",
      label: `${story.activeDays} ${story.activeDays === 1 ? "day" : "days"} of care`,
      detail: story.tasks > 0 ? `${story.tasks} small ${story.tasks === 1 ? "thing" : "things"} in all` : null,
    });
  }

  if (story.heavier.length > 0) {
    const names = listDays(story.heavier.map((d) => d.weekday));
    stickers.push({
      id: "heavier",
      icon: "cloudy-outline",
      category: "rest",
      label: `${names} felt heavier`,
      detail: memorial ? null : `${pet} stayed close`,
    });
  }

  const kept = story.kept.map((k) => ({ weekday: k.weekday, text: trimText(k.text) })).filter((k) => k.text);
  return {
    version: 1,
    endDateKey: end,
    startDateKey: start,
    range: story.range,
    note: scrapbookNote(story, voice, pet, memorial),
    stickers,
    kept: kept.slice(0, MAX_KEPT_ON_PAGE),
    moreKept: Math.max(0, kept.length - MAX_KEPT_ON_PAGE),
    activeDays: story.activeDays,
    memorial,
    madeAt,
  };
}

// ---- the book on the device ------------------------------------------------------------------------------

function isRecord(value: unknown): value is Record<string, any> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function str(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function normalizeSticker(raw: unknown): ScrapbookSticker | null {
  if (!isRecord(raw)) return null;
  const id = str(raw.id);
  const icon = str(raw.icon);
  const label = str(raw.label);
  if (!id || !icon || !label) return null;
  return { id, icon, category: str(raw.category) ?? "body", label, detail: str(raw.detail) };
}

export function normalizePage(raw: unknown): ScrapbookPage | null {
  if (!isRecord(raw)) return null;
  const endDateKey = str(raw.endDateKey);
  if (!endDateKey || !parseDateKey(endDateKey)) return null;
  const startDateKey = str(raw.startDateKey) && parseDateKey(raw.startDateKey) ? (raw.startDateKey as string) : addDaysToDateKey(endDateKey, -6);
  const note = str(raw.note);
  if (!note) return null;
  const stickers = Array.isArray(raw.stickers) ? raw.stickers.map(normalizeSticker).filter((s): s is ScrapbookSticker => !!s) : [];
  const kept = Array.isArray(raw.kept)
    ? raw.kept
        .filter((k: unknown) => isRecord(k) && typeof k.text === "string" && k.text.trim())
        .map((k: any) => ({ weekday: str(k.weekday) ?? "", text: trimText(k.text) }))
        .slice(0, MAX_KEPT_ON_PAGE)
    : [];
  return {
    version: 1,
    endDateKey,
    startDateKey,
    range: str(raw.range) ?? `${startDateKey} to ${endDateKey}`,
    note,
    stickers,
    kept,
    moreKept: Math.max(0, Math.floor(Number(raw.moreKept) || 0)),
    activeDays: Math.max(0, Math.min(7, Math.floor(Number(raw.activeDays) || 0))),
    memorial: raw.memorial === true,
    madeAt: str(raw.madeAt) ?? "",
  };
}

export function normalizeScrapbook(raw: unknown): Scrapbook {
  let value: unknown = raw;
  if (typeof raw === "string") {
    try {
      value = JSON.parse(raw);
    } catch {
      value = null;
    }
  }
  if (!isRecord(value)) return { ...EMPTY_SCRAPBOOK, pages: [] };
  const byEnd = new Map<string, ScrapbookPage>();
  for (const entry of Array.isArray(value.pages) ? value.pages : []) {
    const page = normalizePage(entry);
    if (page && !byEnd.has(page.endDateKey)) byEnd.set(page.endDateKey, page);
  }
  const pages = [...byEnd.values()].sort((a, b) => (a.endDateKey < b.endDateKey ? 1 : -1)).slice(0, MAX_PAGES);
  const lastSeenEnd = str(value.lastSeenEnd) && parseDateKey(value.lastSeenEnd) ? (value.lastSeenEnd as string) : null;
  return { version: 1, pages, lastSeenEnd };
}

/** Keep (or refresh) the page for its Sunday; newest first, a year at most. */
export function upsertPage(book: Scrapbook, page: ScrapbookPage): Scrapbook {
  const pages = [page, ...book.pages.filter((p) => p.endDateKey !== page.endDateKey)]
    .sort((a, b) => (a.endDateKey < b.endDateKey ? 1 : -1))
    .slice(0, MAX_PAGES);
  return { ...book, pages };
}

/** Opening a page marks it seen; an older page never moves the mark backwards. */
export function markPageSeen(book: Scrapbook, endDateKey: string): Scrapbook {
  if (!parseDateKey(endDateKey)) return book;
  if (book.lastSeenEnd && book.lastSeenEnd >= endDateKey) return book;
  return { ...book, lastSeenEnd: endDateKey };
}

export function pageFor(book: Scrapbook, endDateKey: string): ScrapbookPage | null {
  return book.pages.find((page) => page.endDateKey === endDateKey) ?? null;
}

/** The pages before the one on screen, for the "Earlier pages" list. */
export function earlierPages(book: Scrapbook, endDateKey: string): ScrapbookPage[] {
  return book.pages.filter((page) => page.endDateKey < endDateKey);
}
