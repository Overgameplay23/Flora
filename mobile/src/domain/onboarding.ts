// Pure rules for the first-run flow and its two shorter cousins ("new photo", "change look").
//
// First run (docs/ROADMAP.md, "Onboarding v2"): the pet comes first, the questions second, and the portrait is
// painted in the background while the person answers them, so the reveal at the end is honest.
//   welcome -> species -> photos (1-3) | shelter | look -> name -> [painting starts] ->
//   quiz: areas -> battery -> hard day -> voice -> [cycle, only if picked] ->
//   reveal (the pet in its sanctuary with the plan it made) -> [reminder, where notifications exist] -> one small thing
// "replace" is photos -> painting -> meet. "look" is species -> look and ends there.
import type { Energy, FocusArea } from "./plan/types";
import { ENERGY_OPTIONS } from "./energy";

export type OnboardingMode = "first" | "replace" | "look";
export type OnboardingStep =
  | "welcome"
  | "species"
  | "shelter"
  | "look"
  | "photo"
  | "name"
  | "painting"
  | "meet"
  | "quizAreas"
  | "quizBattery"
  | "quizHardDay"
  | "quizVoice"
  | "quizCycle"
  | "reveal"
  | "reminder"
  | "firstStep";
/** "own": bring a real pet to life; "adopt": no pet, adopt an illustrated companion (report edge case) */
export type OnboardingTrack = "own" | "adopt";

export const PET_NAME_MAX = 24;
export const NAME_SUGGESTIONS = ["Biscuit", "Mochi", "Pepper", "Luna", "Olive", "Ziggy", "Maple", "Pickle"];
/** How many photos of the real pet the portrait is painted from. */
export const PET_PHOTO_MIN = 1;
export const PET_PHOTO_MAX = 3;

export type StepContext = {
  hasName: boolean;
  hasPhoto: boolean;
  track?: OnboardingTrack;
  /** the rhythm area was among the picks, so the private cycle question is asked */
  pickedCycle?: boolean;
  /** local notifications exist on this platform (false on web): otherwise the reminder step is skipped */
  remindersSupported?: boolean;
};

export const QUIZ_STEPS: OnboardingStep[] = ["quizAreas", "quizBattery", "quizHardDay", "quizVoice", "quizCycle"];

export function firstStepFor(mode: OnboardingMode): OnboardingStep {
  if (mode === "look") return "species";
  return mode === "first" ? "welcome" : "photo";
}

/**
 * Name ideas are for a pet that does not exist yet (an adopted companion, or a look chosen without a
 * photo). A real pet in a photo already has a name, so nothing is suggested.
 */
export function nameSuggestionsFor(context: { hasPhoto: boolean }): string[] {
  return context.hasPhoto ? [] : NAME_SUGGESTIONS;
}

/** The step after `step`, or null when the flow ends. */
export function nextStep(step: OnboardingStep, mode: OnboardingMode, context: StepContext): OnboardingStep | null {
  const adopt = mode === "first" && context.track === "adopt";
  switch (step) {
    case "welcome":
      return "species";
    case "species":
      if (mode === "look") return "look";
      return adopt ? "shelter" : "photo";
    case "shelter":
      return "name";
    case "look":
      return mode === "look" ? null : "name";
    case "photo":
      if (mode === "replace") return context.hasPhoto ? "painting" : null;
      // with photos the portrait comes from the photos; nothing to pick by hand
      return context.hasPhoto ? "name" : "look";
    case "name":
      // the painting (when there are photos) starts here and runs while the questions are answered
      return mode === "first" ? "quizAreas" : "meet";
    case "painting":
      return "meet";
    case "meet":
      return mode === "first" ? "quizAreas" : null;
    case "quizAreas":
      return "quizBattery";
    case "quizBattery":
      return "quizHardDay";
    case "quizHardDay":
      return "quizVoice";
    case "quizVoice":
      return context.pickedCycle ? "quizCycle" : "reveal";
    case "quizCycle":
      return "reveal";
    case "reveal":
      return context.remindersSupported === false ? "firstStep" : "reminder";
    case "reminder":
      return "firstStep";
    default:
      return null;
  }
}

export function previousStep(step: OnboardingStep, mode: OnboardingMode, track: OnboardingTrack = "own", hasPhoto = false): OnboardingStep | null {
  switch (step) {
    case "species":
      return mode === "first" ? "welcome" : null;
    case "shelter":
      return "species";
    case "look":
      return mode === "look" ? "species" : "photo";
    case "photo":
      return mode === "first" ? "species" : null;
    case "name":
      if (mode === "first" && track === "adopt") return "shelter";
      return hasPhoto ? "photo" : "look";
    // inside the quiz the person can go back and change an answer; before it, the name is saved and the
    // painting may already be running, so the quiz does not lead back to the pet steps
    case "quizBattery":
      return "quizAreas";
    case "quizHardDay":
      return "quizBattery";
    case "quizVoice":
      return "quizHardDay";
    case "quizCycle":
      return "quizVoice";
    default:
      // painting, meet, reveal, reminder and the first thing cannot go back
      return null;
  }
}

/** Steps shown in the progress bar, in order, for a mode and the choices made so far. */
export function visibleSteps(mode: OnboardingMode, track: OnboardingTrack = "own", hasPhoto = false, options: { pickedCycle?: boolean; remindersSupported?: boolean } = {}): OnboardingStep[] {
  if (mode === "look") return ["species", "look"];
  if (mode === "replace") return ["photo", "painting", "meet"];
  const pet: OnboardingStep[] = track === "adopt" ? ["welcome", "species", "shelter", "name"] : hasPhoto ? ["welcome", "species", "photo", "name"] : ["welcome", "species", "photo", "look", "name"];
  const quiz: OnboardingStep[] = ["quizAreas", "quizBattery", "quizHardDay", "quizVoice", ...(options.pickedCycle ? (["quizCycle"] as OnboardingStep[]) : [])];
  const finish: OnboardingStep[] = ["reveal", ...(options.remindersSupported === false ? [] : (["reminder"] as OnboardingStep[])), "firstStep"];
  return [...pet, ...quiz, ...finish];
}

/** Where the progress bar stands: 1-based index of the current step among the visible ones. */
export function stepProgress(step: OnboardingStep, steps: OnboardingStep[]): { index: number; total: number } {
  // on the first run the painting is no step of its own (it runs behind the quiz), so it counts as the name step
  const effective = steps.includes(step) ? step : step === "painting" ? "name" : step;
  const index = Math.max(0, steps.indexOf(effective));
  return { index: index + 1, total: Math.max(1, steps.length) };
}

export function validatePetName(raw: unknown): { ok: true; name: string } | { ok: false; error: string } {
  const name = typeof raw === "string" ? raw.trim().replace(/\s+/g, " ") : "";
  if (!name) return { ok: false, error: "Give them a name, even a silly one." };
  if (name.length > PET_NAME_MAX) return { ok: false, error: `Keep it to ${PET_NAME_MAX} characters.` };
  return { ok: true, name };
}

/** Rotating status lines while the portrait is painted; index by elapsed seconds. */
export function paintingLine(elapsedSeconds: number, name: string): string {
  const lines = [
    `Looking closely at ${name}…`,
    "Sketching the outline…",
    "Mixing the colours…",
    "Adding the soft edges…",
    `Almost there. ${name} is nearly ready.`,
  ];
  const index = Math.min(lines.length - 1, Math.floor(Math.max(0, elapsedSeconds) / 6));
  return lines[index];
}

// ---------- the quiz ----------
// Four short questions (five when the rhythm area is picked). Answers go to the plan engine (focus areas,
// daily count) and to the on-device care preferences (src/domain/carePrefs.ts). Nothing is scored.

export type HardDayMinutes = 1 | 5 | 15;
export type Voice = "gentle" | "warm" | "plain";

export const BATTERY_OPTIONS: Array<{ id: Energy; label: string; blurb: string; icon: string; category: string }> = ENERGY_OPTIONS.map((option) => ({
  id: option.id,
  label: option.label,
  icon: option.icon,
  category: option.category,
  blurb: {
    exhausted: "Running on empty more days than not.",
    anxious: "Wired and tense; hard to settle.",
    calm: "Steady enough, with ups and downs.",
    energized: "Pretty good. I want to build on it.",
  }[option.id],
}));

export const HARD_DAY_OPTIONS: Array<{ id: HardDayMinutes; label: string; blurb: string; icon: string }> = [
  { id: 1, label: "About a minute", blurb: "Something I can do without getting up.", icon: "water-outline" },
  { id: 5, label: "Five minutes", blurb: "A small thing, then back to resting.", icon: "leaf-outline" },
  { id: 15, label: "Fifteen minutes", blurb: "I can usually manage a short walk or a proper pause.", icon: "walk-outline" },
];

export const VOICE_OPTIONS: Array<{ id: Voice; label: string; blurb: string; icon: string; sample: (pet: string) => string }> = [
  { id: "gentle", label: "Soft and gentle", blurb: "Quiet encouragement, and lots of permission to rest.", icon: "cloud-outline", sample: () => "No rush today. I'm right here when you're ready." },
  { id: "warm", label: "Warm and upbeat", blurb: "Cheerful, a little playful, always on your side.", icon: "sunny-outline", sample: () => "Morning! I saved you the sunny spot. Water first?" },
  { id: "plain", label: "Plain and practical", blurb: "Short and clear. Kind, without the fluff.", icon: "checkmark-circle-outline", sample: () => "One glass of water. Then we're done for now." },
];

export function isVoice(value: unknown): value is Voice {
  return value === "gentle" || value === "warm" || value === "plain";
}

export function isHardDayMinutes(value: unknown): value is HardDayMinutes {
  return value === 1 || value === 5 || value === 15;
}

/**
 * How many tasks a day to start with. A drained or anxious baseline starts small; a steadier one grows with
 * what the person says they can give on a hard day. The plan engine still shrinks any day the battery check
 * says so.
 */
export function dailyCountFor(battery: Energy | null | undefined, hardDay: HardDayMinutes | null | undefined): 3 | 4 | 5 {
  if (battery === "exhausted" || battery === "anxious") return 3;
  if (hardDay === 1) return 3;
  if (battery === "energized" && hardDay === 15) return 5;
  return 4;
}

/**
 * The "because you said…" chips on the reveal: the areas picked, in order, then one line for the battery and
 * one for the hard-day answer. Short enough to sit in a row of chips.
 */
export function revealReasons(input: { areas: FocusArea[]; areaLabels: Record<string, string>; battery: Energy | null; hardDay: HardDayMinutes | null }): string[] {
  const reasons: string[] = [];
  for (const area of input.areas) {
    const label = input.areaLabels[area];
    if (label) reasons.push(label);
  }
  const batteryLine: Record<Energy, string> = {
    exhausted: "Small days by default",
    anxious: "Calm first, always",
    calm: "Steady, with room to grow",
    energized: "Room to build on good days",
  };
  if (input.battery) reasons.push(batteryLine[input.battery]);
  if (input.hardDay === 1) reasons.push("Hard days: one tiny thing");
  else if (input.hardDay === 5) reasons.push("Hard days: five minutes");
  else if (input.hardDay === 15) reasons.push("Hard days: a short walk is fine");
  return reasons;
}
