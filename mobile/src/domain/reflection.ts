// The daily reflection prompt (product strategy report, MVP capability 3): one approachable question
// from the pet each day, instead of an open-ended chat.
import { parseDateKey } from "../utils/dateKeys";

export const REFLECTION_PROMPTS: readonly string[] = [
  "What was the quietest part of your day?",
  "What's one thing that went a little better than expected?",
  "Who made you smile today, even a little?",
  "What did your body need today, and did it get it?",
  "What's one thing you can put down until tomorrow?",
  "What did you do today that past-you would be glad about?",
  "Where were you when you last felt calm?",
  "What's a small thing you're looking forward to?",
  "What was harder than it looked today?",
  "What would make tomorrow morning 5% easier?",
  "What did you notice outside today?",
  "Which moment today would you keep, if you could keep one?",
  "What's something kind you could say to yourself right now?",
  "What took more energy than it should have?",
];

/** Stable prompt for a calendar day, so it does not change while the person is typing. */
export function reflectionPrompt(dateKey: string, petName?: string | null): string {
  const d = parseDateKey(dateKey);
  const dayNumber = d ? Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86_400_000) : 0;
  const prompt = REFLECTION_PROMPTS[((dayNumber % REFLECTION_PROMPTS.length) + REFLECTION_PROMPTS.length) % REFLECTION_PROMPTS.length];
  return prompt;
}

/** The pet's framing line for the prompt. */
export function reflectionIntro(petName?: string | null): string {
  return `${petName || "Your pet"} asks`;
}

/** Energy words for the 1–5 slider; the report's Exhausted → Energized scale over the existing numbers. */
export const ENERGY_WORDS = ["", "Exhausted", "Low", "Okay", "Good", "Energized"] as const;
