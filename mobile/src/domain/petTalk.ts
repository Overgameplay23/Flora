// Talking with the pet, client side (owner: an API-backed conversation with OpenAI; key to come).
// The system prompt and its guardrails live with the server function (supabase/functions/pet-talk/
// prompt.ts) so they cannot be changed from a phone. What lives here: the context the app sends
// (only what it already holds), history trimming, the crisis intercept, and the pet's opening line.
import { sanctuaryFor } from "./sanctuary";
import type { WeekStory } from "./week";

export type TalkMessage = { role: "user" | "assistant"; content: string };

export type TalkContext = {
  petName: string;
  species?: string | null;
  adopted?: boolean;
  memorial?: boolean;
  hour?: number;
  week?: Pick<WeekStory, "headline" | "noticed" | "energyWord" | "activeDays" | "kept"> | null;
  checkedInToday?: boolean;
  cycleAware?: boolean;
};

export const TALK_MAX_MESSAGES = 12;
export const TALK_MAX_CHARS = 800;
export const TALK_DISCLAIMER = "Not a therapist or a doctor. In a crisis, contact local emergency services or a crisis line.";

const CRISIS_PATTERNS = [/suicid/i, /kill myself/i, /end my life/i, /self[- ]harm/i, /hurt myself/i, /want to die/i, /don'?t want to be alive/i];

/** True when a message needs the fixed crisis reply instead of the model. */
export function needsCrisisReply(text: string): boolean {
  return CRISIS_PATTERNS.some((p) => p.test(text || ""));
}

export function crisisReply(petName: string): string {
  return `${petName} is staying right here with you. This is bigger than a small thing, and you deserve real support right now: please contact your local emergency number or a crisis line, or someone you trust. ${petName} will be here when you're back.`;
}

/** Keeps the last few turns, each cut to a sane length; drops empty and malformed entries. */
export function trimHistory(messages: TalkMessage[]): TalkMessage[] {
  return (messages || [])
    .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.trim())
    .map((m) => ({ role: m.role, content: m.content.trim().slice(0, TALK_MAX_CHARS) }))
    .slice(-TALK_MAX_MESSAGES);
}

/** The context sent with every turn: the pet, the place, the week as the app tells it, nothing else. */
export function talkContextPayload(ctx: TalkContext) {
  return {
    petName: ctx.petName,
    species: ctx.species ?? null,
    adopted: !!ctx.adopted,
    memorial: !!ctx.memorial,
    hour: typeof ctx.hour === "number" ? ctx.hour : null,
    checkedInToday: typeof ctx.checkedInToday === "boolean" ? ctx.checkedInToday : null,
    cycleAware: !!ctx.cycleAware,
    week: ctx.week
      ? {
          headline: ctx.week.headline,
          noticed: ctx.week.noticed,
          energyWord: ctx.week.energyWord,
          activeDays: ctx.week.activeDays,
          kept: (ctx.week.kept || []).slice(-3).map((k) => ({ weekday: k.weekday, text: k.text })),
        }
      : null,
  };
}

/** The pet's first line when the screen opens, before the person says anything. */
export function openingLine(ctx: TalkContext): string {
  const nook = sanctuaryFor(ctx.species) === "nook";
  if (ctx.memorial) return "I'm still here, in the quiet. Tell me anything, or nothing at all.";
  const h = typeof ctx.hour === "number" ? ((Math.floor(ctx.hour) % 24) + 24) % 24 : 12;
  if (h < 5 || h >= 23) return nook ? "Late one. I'm awake anyway; cats are. What's keeping you up?" : "Late one. I'm curled up right here. What's on your mind?";
  if (h < 12) return nook ? "Morning. The sill is warm already. How did you sleep?" : "Morning! I've been out in the garden already. How did you sleep?";
  if (h < 18) return nook ? "Afternoon. I found the sunbeam. How's your day going, honestly?" : "Hey. I've been sniffing around the garden. How's your day going, honestly?";
  return nook ? "Evening. Lamp's on, I'm on the rug. How was today?" : "Evening. I've been waiting by the door. How was today?";
}
