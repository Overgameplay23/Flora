// What the pet says on Home. Designed lines, not open-ended chat (product strategy: "structured, designed
// dialogue trees"), in a warm adult voice: the pet speaks for itself, never scolds, never counts what was
// missed. One line is picked per day and situation, so it holds still while the screen re-renders.

import type { Energy } from "./plan/types";
import type { DayPhase } from "./timeOfDay";

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
};

function pick(lines: string[], seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  return lines[Math.abs(hash) % lines.length];
}

export function homePetLine(input: HomeLineInput): string {
  const { phase, energy, done, total, returning, place, focus, seed } = input;
  const allDone = total > 0 && done >= total;

  if (returning && done === 0) {
    return pick(["You're back. I kept your spot warm.", "There you are. Let's take today easy.", "I missed you. No catching up needed."], seed);
  }
  if (allDone) {
    return pick(["We did it together. Go enjoy your day.", "That's everything. I'm so proud of us.", "All done. The rest of the day is yours."], seed);
  }
  if (energy === "exhausted") {
    return pick(["Low battery days count too. One tiny thing is plenty.", "Let's go slow. I'll stay right here.", "Rest is part of it. Pick the smallest one."], seed);
  }
  if (energy === "anxious") {
    return pick(["Breathe with me for a second. We'll keep it simple.", "One thing at a time. I'm not going anywhere.", "Let's make today smaller. Start anywhere."], seed);
  }
  if (done > 0) {
    return pick([`${done} down. I'm wagging over here.`, "Look at you go. Want to do one more together?", "That felt good, right? I noticed."], `${seed}:${done}`);
  }

  switch (phase) {
    case "dawn":
    case "morning":
      return pick([
        focus ? `Morning. I picked today around ${focus.toLowerCase()}.` : "Morning. I saved you the sunny spot.",
        `The ${place} is waking up. Shall we start small?`,
        "Good morning. Water first? I'll join you.",
      ], seed);
    case "golden":
    case "dusk":
      return pick(["The light's going gold. A gentle evening?", "Long day? Let's do something kind for you.", `The ${place} looks lovely right now. Come sit with me.`], seed);
    case "night":
      return pick(["It's late. Let's wind down together.", "Quiet night. Just one small thing, then rest.", "I'm getting sleepy. You should too, soon."], seed);
    default:
      return pick([
        focus ? `I made today about ${focus.toLowerCase()}. Ready when you are.` : "I'm right here. What should we do first?",
        "Halfway through the day. Let's take a little break.",
        `Come hang out in the ${place} for a minute.`,
      ], seed);
  }
}

/** The line in the floating toast when a care act is done. */
export function careDoneLine(petName: string, sprouts: number, seed: number): string {
  const lines =
    sprouts > 0
      ? [`${petName} is so proud of you. +${sprouts} Sprouts`, `+${sprouts} Sprouts. ${petName} did a happy wiggle.`, `Nice. ${petName} noticed. +${sprouts} Sprouts`]
      : [`${petName} noticed. Small things count.`, `${petName} is glad you did that.`];
  return lines[Math.abs(Math.floor(seed)) % lines.length];
}
