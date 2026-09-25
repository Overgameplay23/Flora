// How the pet carries itself, derived from the stores the app already keeps.
//
// Three signals exist: the live check-in slider (mirrored while the user drags it), the daily mood
// store written by the daily loop, and the time of day. The rule is deliberately simple and the pet
// never looks worse than "sad": it is a companion, not a scoreboard.

export type PetMood = "happy" | "calm" | "sad" | "excited" | "sleepy" | "neutral";

export type PetMoodInput = {
  /** "sad" | "calm" | "happy" | "excited" from the check-in slider mirror, if any */
  liveState?: string | null;
  /** "sad" | "neutral" | "happy" from user_stats.pet_mood_state */
  dailyMood?: string | null;
  /** local hour 0-23; the pet gets sleepy late at night */
  hour?: number | null;
};

export function petMoodFromStores({ liveState, dailyMood, hour }: PetMoodInput): PetMood {
  const live = String(liveState || "").toLowerCase();
  if (live === "sad") return "sad";
  if (live === "excited") return "excited";
  if (live === "happy") return "happy";

  const daily = String(dailyMood || "").toLowerCase();
  if (daily === "sad") return "sad";

  const h = typeof hour === "number" && Number.isFinite(hour) ? hour : null;
  if (h != null && (h >= 22 || h < 6)) return "sleepy";

  if (daily === "happy") return "happy";
  return "calm";
}

export function moodSentence(mood: PetMood, name: string): string {
  switch (mood) {
    case "excited":
      return `${name} is full of beans today.`;
    case "happy":
      return `${name} is happy and settled.`;
    case "sad":
      return `${name} is having a quiet day and wants company.`;
    case "sleepy":
      return `${name} is getting sleepy. Rest is part of it.`;
    default:
      return `${name} is calm, watching the garden.`;
  }
}

export type PetActName = "drink" | "stretch" | "breathe" | "sleep" | "walk";

/** Which routine the illustrated pet acts out for a completed task, from its title. */
export function actForTask(title: unknown): PetActName {
  const text = String(title || "").toLowerCase();
  if (new RegExp("water|drink|hydrat|\btea\b|coffee|\beat\b|meal|breakfast|lunch|dinner|snack").test(text)) return "drink";
  if (/breath|breathe|meditat|calm|pause|quiet|mindful/.test(text)) return "breathe";
  if (new RegExp("sleep|\bbed\b|wind.?down|\brest\b|\bnap\b|night").test(text)) return "sleep";
  if (new RegExp("walk|outside|\bsun|fresh air|\brun\b|\bmove|steps|exercise|stretch|yoga|play|garden").test(text)) return "walk";
  return "stretch";
}

/** Short line for the celebration toast after a task; varies so it does not feel canned. */
export function celebrationLine(name: string, points: number, seed: number): string {
  const lines =
    points > 0
      ? [
          `${name} did a happy dance. +${points} pts`,
          `+${points} pts. ${name} is proud of you.`,
          `${name} wags. That's +${points} for the garden.`,
          `Nice one. +${points} pts and a very happy ${name}.`,
        ]
      : [`${name} noticed. Small things count.`, `${name} is glad you did that.`];
  const index = Math.abs(Math.floor(seed)) % lines.length;
  return lines[index];
}
