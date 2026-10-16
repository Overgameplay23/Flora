// The person's own care tasks ("Add your own" on Home). A custom task is an ordinary `tasks` row whose title
// is not a catalog title (and not the play row), so it completes through complete_task like everything
// else. The hosted table only has a title, so the colour and minutes live on the device
// (src/services/customTasks.ts); when they are missing, the title's words pick a colour.
import type { CareCategory } from "./plan/types";
import { catalogIdForTitle } from "./plan/catalog";
import { isPlayTask } from "../games/playStatsLogic";

export const CUSTOM_TITLE_MAX = 60;
export const CUSTOM_MINUTES = [1, 2, 5, 10, 15] as const;
export type CustomMinutes = (typeof CUSTOM_MINUTES)[number];

export type CustomTaskMeta = { category: CareCategory; minutes: number };
export type CustomTaskMetaMap = Record<string, CustomTaskMeta>;

const CATEGORIES: CareCategory[] = ["calm", "rest", "energy", "focus", "body", "nourish", "connection", "cycle", "play"];

export function isCareCategory(value: unknown): value is CareCategory {
  return typeof value === "string" && (CATEGORIES as string[]).includes(value);
}

/** Categories offered when adding a task (the rhythm colour stays with the tracker). */
export const CUSTOM_CATEGORIES: Array<{ id: CareCategory; label: string; icon: string }> = [
  { id: "body", label: "Body", icon: "body-outline" },
  { id: "nourish", label: "Nourish", icon: "water-outline" },
  { id: "calm", label: "Calm", icon: "leaf-outline" },
  { id: "rest", label: "Rest", icon: "moon-outline" },
  { id: "energy", label: "Energy", icon: "sunny-outline" },
  { id: "focus", label: "Focus", icon: "checkbox-outline" },
  { id: "connection", label: "Connection", icon: "people-outline" },
  { id: "play", label: "Play", icon: "tennisball-outline" },
];

export function iconForCategory(category: CareCategory | string | null | undefined): string {
  return CUSTOM_CATEGORIES.find((entry) => entry.id === category)?.icon ?? (category === "cycle" ? "flower-outline" : "ellipse-outline");
}

const KEYWORDS: Array<[CareCategory, RegExp]> = [
  ["nourish", /\b(water|drink|eat|meal|snack|cook|breakfast|lunch|dinner|tea|coffee|fruit|veg|hydrat)/i],
  ["rest", /\b(sleep|bed|nap|rest|pause|nothing|lie down|slow|unwind|wind down)/i],
  ["calm", /\b(breath|calm|meditat|worry|anx|quiet|still|ground)/i],
  ["connection", /\b(call|text|friend|mom|mum|dad|family|thank|message|reply|hug|visit|sister|brother|partner)/i],
  ["play", /\b(play|game|fun|music|song|dance|draw|paint|hobby)/i],
  ["focus", /\b(clean|tidy|laundry|dishes|email|bill|work|study|write|read|focus|plan|desk|admin|homework|essay)/i],
  ["energy", /\b(outside|sun|fresh air|window|light|garden)/i],
  ["body", /\b(walk|run|gym|stretch|yoga|steps|shower|teeth|med|vitamin|exercise|swim|bike|skincare|floss)/i],
];

/** A colour for a task from its words, for rows made before this store existed (or elsewhere). */
export function inferCategory(title: unknown): CareCategory {
  const text = String(title ?? "");
  for (const [category, pattern] of KEYWORDS) if (pattern.test(text)) return category;
  return "body";
}

export function normalizeCustomMeta(raw: unknown): CustomTaskMetaMap {
  let value: unknown = raw;
  if (typeof value === "string") {
    try {
      value = JSON.parse(value);
    } catch {
      value = null;
    }
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const out: CustomTaskMetaMap = {};
  for (const [id, meta] of Object.entries(value as Record<string, unknown>)) {
    if (!/^\d+$/.test(id) || !meta || typeof meta !== "object") continue;
    const record = meta as Record<string, unknown>;
    const category = isCareCategory(record.category) ? record.category : null;
    const minutes = Number(record.minutes);
    if (!category) continue;
    out[id] = { category, minutes: Number.isFinite(minutes) && minutes >= 0 ? Math.min(180, Math.round(minutes)) : 0 };
  }
  return out;
}

export function validateCustomTitle(raw: unknown): { ok: true; title: string } | { ok: false; error: string } {
  const title = typeof raw === "string" ? raw.trim().replace(/\s+/g, " ") : "";
  if (!title) return { ok: false, error: "Give it a few words." };
  if (title.length > CUSTOM_TITLE_MAX) return { ok: false, error: `Keep it under ${CUSTOM_TITLE_MAX} characters.` };
  return { ok: true, title };
}

/** A row the person made themselves: not a catalog title under any pet name, and not the play row. */
export function isCustomTaskTitle(title: unknown, petName?: string | null): boolean {
  const text = String(title ?? "").trim();
  if (!text) return false;
  if (isPlayTask(text)) return false;
  return !catalogIdForTitle(text, petName ?? undefined);
}
