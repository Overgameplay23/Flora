// Rainbow Bridge memorial mode (product strategy report): when a real pet has passed away, upbeat
// prompts would be cruel. The garden goes quiet, the daily loop pauses, and the app keeps memories
// instead. Everything here is pure so the copy and the rules can be tested.
import { getLocalDateKey, parseDateKey } from "../utils/dateKeys";

export type DateKey = string;

export type MemorialState = {
  /** the day the person told us; defaults to the day they set the memorial */
  since: DateKey;
  /** an optional line they wrote when setting it */
  note: string | null;
};

export type Memory = {
  id: string;
  /** when it was written */
  date: DateKey;
  text: string;
};

export const MEMORIAL_NOTE_MAX = 280;
export const MEMORY_MAX = 500;

export function normalizeMemorial(raw: unknown): MemorialState | null {
  const value = (raw && typeof raw === "object" ? raw : null) as Record<string, any> | null;
  if (!value) return null;
  const since = typeof value.since === "string" && parseDateKey(value.since) ? value.since : null;
  if (!since) return null;
  const note = typeof value.note === "string" && value.note.trim() ? value.note.trim().slice(0, MEMORIAL_NOTE_MAX) : null;
  return { since, note };
}

/** Builds a memorial from what the person entered; a bad or future date falls back to today. */
export function makeMemorial(sinceRaw: unknown, noteRaw: unknown, today: DateKey = getLocalDateKey()): MemorialState {
  const since = typeof sinceRaw === "string" && parseDateKey(sinceRaw) && sinceRaw <= today ? sinceRaw : today;
  const note = typeof noteRaw === "string" && noteRaw.trim() ? noteRaw.trim().slice(0, MEMORIAL_NOTE_MAX) : null;
  return { since, note };
}

export function normalizeMemories(raw: unknown): Memory[] {
  if (!Array.isArray(raw)) return [];
  const out: Memory[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    const id = typeof item?.id === "string" ? item.id : null;
    const date = typeof item?.date === "string" && parseDateKey(item.date) ? item.date : null;
    const text = typeof item?.text === "string" ? item.text.trim().slice(0, MEMORY_MAX) : "";
    if (!id || !date || !text || seen.has(id)) continue;
    seen.add(id);
    out.push({ id, date, text });
  }
  return out.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}

export function addMemory(memories: Memory[], text: string, date: DateKey = getLocalDateKey(), id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`): Memory[] {
  const clean = text.trim().slice(0, MEMORY_MAX);
  if (!clean) return memories;
  return normalizeMemories([{ id, date, text: clean }, ...memories]);
}

export function removeMemory(memories: Memory[], id: string): Memory[] {
  return memories.filter((m) => m.id !== id);
}

/** Gentle, non-clinical lines; one per day so the screen is calm, not a slot machine. */
export const MEMORIAL_REFLECTIONS: readonly string[] = [
  "Grief is love that still wants somewhere to go. There is no schedule for it.",
  "Some days will be quieter than others. Both kinds are allowed.",
  "You gave them a home and a name. That never goes anywhere.",
  "It is okay to laugh at a memory today, and okay to cry at the same one tomorrow.",
  "Taking care of yourself is still a way of taking care of them.",
  "The garden keeps what you planted together.",
  "You don't have to be over it. You just have to be here.",
  "A slow walk, a glass of water, a moment by the window: small things still count.",
  "Missing them is part of having loved them well.",
  "Whenever you're ready, a memory is a good thing to write down.",
];

export function memorialReflection(dateKey: DateKey): string {
  const d = parseDateKey(dateKey);
  const dayNumber = d ? Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86_400_000) : 0;
  const n = MEMORIAL_REFLECTIONS.length;
  return MEMORIAL_REFLECTIONS[((dayNumber % n) + n) % n];
}

export type MilestoneInput = {
  petName: string;
  /** profile created_at ISO or null */
  togetherSince?: string | null;
  memorialSince: DateKey;
  plantsGrown?: number;
  gamesPlayed?: number;
  checkins?: number;
  tasksCompleted?: number;
};

/** The archive of a life together, from what the app already knows. Only lines with data appear. */
export function milestones(input: MilestoneInput): string[] {
  const lines: string[] = [];
  const name = input.petName || "Your pet";
  const start = input.togetherSince ? new Date(input.togetherSince) : null;
  const end = parseDateKey(input.memorialSince);
  if (start && !Number.isNaN(start.getTime()) && end) {
    const days = Math.max(1, Math.round((Date.UTC(end.getFullYear(), end.getMonth(), end.getDate()) - Date.UTC(start.getFullYear(), start.getMonth(), start.getDate())) / 86_400_000) + 1);
    lines.push(`${days} ${days === 1 ? "day" : "days"} together in Luna`);
  }
  if ((input.tasksCompleted ?? 0) > 0) lines.push(`${input.tasksCompleted} small things done with ${name} cheering`);
  if ((input.checkins ?? 0) > 0) lines.push(`${input.checkins} ${input.checkins === 1 ? "check-in" : "check-ins"} shared`);
  if ((input.plantsGrown ?? 0) > 0) lines.push(`${input.plantsGrown} ${input.plantsGrown === 1 ? "plant" : "plants"} grown in the garden`);
  if ((input.gamesPlayed ?? 0) > 0) lines.push(`${input.gamesPlayed} ${input.gamesPlayed === 1 ? "game" : "games"} of fetch and bubbles`);
  return lines;
}

/** Header copy while the memorial is on. */
export function memorialGreeting(petName: string): { title: string; subtitle: string } {
  const name = petName || "Your pet";
  return { title: `Remembering ${name}`, subtitle: `${name}'s garden is quiet and peaceful. Take today at your own pace.` };
}

/** The check-in prompt while the memorial is on: about them, never about doing more. */
export function memorialPrompt(petName: string): string {
  return `What's one small memory of ${petName || "them"} you'd like to keep today?`;
}
