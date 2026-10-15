// The ten things a person can ask Floura for help with (onboarding research, "focus-area taxonomy").
// Fresh air is not its own area: it runs through several as a task, the way the research suggests.
import type { CareCategory, FocusArea, PlanSettings } from "./types";

export const FOCUS_AREAS: Array<{ id: FocusArea; label: string; short: string; blurb: string; category: CareCategory; icon: string }> = [
  { id: "calm_mind", label: "Quiet my anxious mind", short: "Calm", blurb: "Small ways to slow the spin and come back to the room.", category: "calm", icon: "leaf-outline" },
  { id: "burnout", label: "Recover from burnout", short: "Rest", blurb: "Permission to pause, and a little help refilling the cup.", category: "rest", icon: "battery-charging-outline" },
  { id: "get_going", label: "Get things started, gently", short: "Start", blurb: "Tiny first steps for the days when starting is the hard part.", category: "focus", icon: "footsteps-outline" },
  { id: "sleep", label: "Sleep and wind down", short: "Sleep", blurb: "A softer landing at night and an easier start to the morning.", category: "rest", icon: "moon-outline" },
  { id: "body_basics", label: "Take care of my body", short: "Body", blurb: "Water, food and a stretch, the basics that hold everything up.", category: "body", icon: "body-outline" },
  { id: "self_kindness", label: "Be kinder to myself", short: "Kindness", blurb: "Practice talking to yourself the way you would to a friend.", category: "nourish", icon: "heart-outline" },
  { id: "low_mood", label: "Lift a low mood", short: "Mood", blurb: "Little lights for heavy days, one small thing at a time.", category: "energy", icon: "sunny-outline" },
  { id: "cycle", label: "Care with my cycle", short: "Rhythm", blurb: "Comfort and lighter days when your body asks for them.", category: "cycle", icon: "flower-outline" },
  { id: "connection", label: "Feel less alone", short: "Connection", blurb: "Easy ways to reach out, even when your social battery is low.", category: "connection", icon: "people-outline" },
  { id: "space_admin", label: "Tame my space and life admin", short: "Space", blurb: "One surface, one email, one small win against the pile.", category: "focus", icon: "home-outline" },
];

export const DEFAULT_PLAN_SETTINGS: PlanSettings = { focusAreas: ["body_basics", "calm_mind"], dailyCount: 4 };

const FOCUS_IDS = new Set<string>(FOCUS_AREAS.map((area) => area.id));
const MAX_FOCUS_AREAS = 3;

export function isFocusArea(value: unknown): value is FocusArea {
  return typeof value === "string" && FOCUS_IDS.has(value);
}

/**
 * Defensive parse for whatever AsyncStorage (or, later, a user_plans row) hands back: a JSON string, an
 * object in either key style, or junk. Unknown areas are dropped, order is kept, at most three survive, and
 * nothing valid falls back to the defaults.
 */
export function normalizePlanSettings(raw: unknown): PlanSettings {
  let value: unknown = raw;
  if (typeof value === "string") {
    try {
      value = JSON.parse(value);
    } catch {
      value = null;
    }
  }
  const record = (value && typeof value === "object" && !Array.isArray(value) ? value : {}) as Record<string, unknown>;

  const rawAreas = Array.isArray(record.focusAreas) ? record.focusAreas : Array.isArray(record.focus_areas) ? record.focus_areas : [];
  const focusAreas: FocusArea[] = [];
  for (const area of rawAreas) {
    if (isFocusArea(area) && !focusAreas.includes(area)) focusAreas.push(area);
    if (focusAreas.length >= MAX_FOCUS_AREAS) break;
  }

  // only real numbers (or numeric strings) count; Number(null) and Number("") would quietly read as 0
  const countValue = record.dailyCount ?? record.daily_count;
  const rawCount = typeof countValue === "number" || (typeof countValue === "string" && countValue.trim() !== "") ? Number(countValue) : Number.NaN;
  const dailyCount = Number.isFinite(rawCount) ? (Math.min(5, Math.max(3, Math.round(rawCount))) as 3 | 4 | 5) : DEFAULT_PLAN_SETTINGS.dailyCount;

  return {
    focusAreas: focusAreas.length > 0 ? focusAreas : [...DEFAULT_PLAN_SETTINGS.focusAreas],
    dailyCount,
  };
}
