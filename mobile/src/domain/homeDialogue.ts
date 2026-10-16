// What the pet says on Home. Designed lines, not open-ended chat (product strategy: "structured, designed
// dialogue trees"), in a warm adult voice: the pet speaks for itself, never scolds, never counts what was
// missed. One line is picked per day and situation, so it holds still while the screen re-renders. The
// person chooses the tone in onboarding (src/domain/onboarding.ts VOICE_OPTIONS): soft and gentle, warm and
// upbeat, or plain and practical.

import type { Energy } from "./plan/types";
import type { DayPhase } from "./timeOfDay";
import type { Voice } from "./onboarding";

export type HomeLineInput = {
  petName: string;
  phase: DayPhase;
  energy: Energy | null;
  done: number;
  total: number;
  /** back after two or more days away */
  returning: boolean;
  /** dog in the garden, cat in the window nook */
  place: "garden" | "window nook";
  /** short label of the person's first focus area, e.g. "Sleep"; null before they chose one */
  focus: string | null;
  /** stable per day, e.g. the date key */
  seed: string;
  /** how the pet talks; "warm" when unknown */
  voice?: Voice | null;
};

type Branch = "returning" | "allDone" | "exhausted" | "anxious" | "progress" | "morning" | "evening" | "night" | "day";

type LineContext = { place: string; focus: string | null; done: number };
type Lines = Record<Branch, (ctx: LineContext) => string[]>;

const WARM: Lines = {
  returning: () => ["You're back. I kept your spot warm.", "There you are. Let's take today easy.", "I missed you. No catching up needed."],
  allDone: () => ["We did it together. Go enjoy your day.", "That's everything. I'm so proud of us.", "All done. The rest of the day is yours."],
  exhausted: () => ["Low battery days count too. One tiny thing is plenty.", "Let's go slow. I'll stay right here.", "Rest is part of it. Pick the smallest one."],
  anxious: () => ["Breathe with me for a second. We'll keep it simple.", "One thing at a time. I'm not going anywhere.", "Let's make today smaller. Start anywhere."],
  progress: ({ done }) => [`${done} down. I'm wagging over here.`, "Look at you go. Want to do one more together?", "That felt good, right? I noticed."],
  morning: ({ place, focus }) => [
    focus ? `Morning. I picked today around ${focus.toLowerCase()}.` : "Morning. I saved you the sunny spot.",
    `The ${place} is waking up. Shall we start small?`,
    "Good morning. Water first? I'll join you.",
  ],
  evening: ({ place }) => ["The light's going gold. A gentle evening?", "Long day? Let's do something kind for you.", `The ${place} looks lovely right now. Come sit with me.`],
  night: () => ["It's late. Let's wind down together.", "Quiet night. Just one small thing, then rest.", "I'm getting sleepy. You should too, soon."],
  day: ({ place, focus }) => [
    focus ? `I made today about ${focus.toLowerCase()}. Ready when you are.` : "I'm right here. What should we do first?",
    "Halfway through the day. Let's take a little break.",
    `Come hang out in the ${place} for a minute.`,
  ],
};

const GENTLE: Lines = {
  returning: () => ["Hello again. Nothing is owed. I'm just glad you're here.", "You came back. That's enough for today.", "No rush at all. I kept everything just as you left it."],
  allDone: () => ["That's everything, softly done. Rest now.", "All done. I hope the rest of your day is kind to you.", "You looked after yourself today. I saw it."],
  exhausted: () => ["If today is only rest, that's a whole day's work.", "No pressure here. The smallest thing, or nothing, is fine.", "I'll sit with you. We don't have to do anything yet."],
  anxious: () => ["It's okay. One slow breath with me, whenever you're ready.", "Nothing here needs you to be okay first.", "We can make today very small. I'm right beside you."],
  progress: ({ done }) => [`${done} done, gently. No need for more unless you want to.`, "That was kind of you, to yourself.", "I noticed. Small things are still things."],
  morning: ({ focus }) => [
    focus ? `Good morning. Today leans toward ${focus.toLowerCase()}, only if you feel like it.` : "Good morning. No rush; the day can start whenever you do.",
    "Morning. A glass of water, maybe, and then we'll see.",
    "Hello. I'm here. Take your time waking up.",
  ],
  evening: () => ["The day is softening. Shall we be gentle with the evening?", "Whatever today was, you got here. That counts.", "Evening. One small kind thing, then rest."],
  night: () => ["It's late. You don't have to finish anything tonight.", "Quiet now. Let's put the day down together.", "Sleep is care too. I'll be here in the morning."],
  day: ({ focus }) => [
    focus ? `I kept today around ${focus.toLowerCase()}. Pick what feels possible.` : "Whenever you're ready. There's no clock on this.",
    "Midday. A pause is allowed.",
    "I'm right here. Nothing to catch up on.",
  ],
};

const PLAIN: Lines = {
  returning: () => ["Welcome back. We start from today.", "You're here. That's the first thing done.", "Back again. Nothing to make up; just today."],
  allDone: () => ["All done. Good work.", "That's the list. Enjoy the rest of the day.", "Done for today. Nothing else needed."],
  exhausted: () => ["Low battery: one small task, then rest.", "Keep it tiny today. One thing.", "Rest counts. Pick the smallest item or skip."],
  anxious: () => ["One slow breath, then one small task.", "Keep today simple. Start with the easiest one.", "Breathe first. The list can wait a minute."],
  progress: ({ done }) => [`${done} done. One more if you like.`, "Good. Next one is small.", "That's progress. Keep it light."],
  morning: ({ focus }) => [focus ? `Morning. Today: ${focus.toLowerCase()}, kept small.` : "Morning. Water first.", "Good morning. Start with the easiest one.", "Morning. Three small things today."],
  evening: () => ["Evening. One kind thing, then wind down.", "Day's nearly done. Something small for you.", "Golden hour. Short walk or a pause?"],
  night: () => ["It's late. Wind down.", "Last small thing, then bed.", "Night. Rest is the task now."],
  day: ({ focus }) => [focus ? `Today is about ${focus.toLowerCase()}. Pick one.` : "What's first?", "Midday. Take a short break.", "One small thing now."],
};

const VOICES: Record<Voice, Lines> = { warm: WARM, gentle: GENTLE, plain: PLAIN };

function pick(lines: string[], seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  return lines[Math.abs(hash) % lines.length];
}

function branchFor(input: HomeLineInput): Branch {
  const { phase, energy, done, total, returning } = input;
  const allDone = total > 0 && done >= total;
  if (returning && done === 0) return "returning";
  if (allDone) return "allDone";
  if (energy === "exhausted") return "exhausted";
  if (energy === "anxious") return "anxious";
  if (done > 0) return "progress";
  switch (phase) {
    case "dawn":
    case "morning":
      return "morning";
    case "golden":
    case "dusk":
      return "evening";
    case "night":
      return "night";
    default:
      return "day";
  }
}

export function homePetLine(input: HomeLineInput): string {
  const voice: Voice = input.voice && VOICES[input.voice] ? input.voice : "warm";
  const branch = branchFor(input);
  const lines = VOICES[voice][branch]({ place: input.place, focus: input.focus, done: input.done });
  return pick(lines, branch === "progress" ? `${input.seed}:${input.done}` : input.seed);
}

/** The line in the floating toast when a care act is done. */
export function careDoneLine(petName: string, sprouts: number, seed: number): string {
  const lines =
    sprouts > 0
      ? [`${petName} is so proud of you. +${sprouts} Sprouts`, `+${sprouts} Sprouts. ${petName} did a happy wiggle.`, `Nice. ${petName} noticed. +${sprouts} Sprouts`]
      : [`${petName} noticed. Small things count.`, `${petName} is glad you did that.`];
  return lines[Math.abs(Math.floor(seed)) % lines.length];
}
