// Client for the pet-talk Edge Function. Nothing here holds a key. The "Talk" entry appears only when the
// feature flag is on AND the function reports it is set up (`petTalkAvailable` asks once per session).
import { supabase } from "../lib/supabase";
import { TalkContext, TalkMessage, talkContextPayload, trimHistory } from "../domain/petTalk";
import { getRawPublicEnv } from "../utils/env";

const FUNCTION = "pet-talk";
// from app config (app.config.js), which refuses it for the staging profile
const PREVIEW = String(getRawPublicEnv("EXPO_PUBLIC_PET_TALK_PREVIEW") || "").trim() === "1";
// Feature flag, off by default: the function can be deployed (even with its key set) while the app keeps the
// conversation hidden and never calls it. EXPO_PUBLIC_PET_TALK_ENABLED=1 turns it on; the local preview implies it.
const ENABLED = PREVIEW || String(getRawPublicEnv("EXPO_PUBLIC_PET_TALK_ENABLED") || "").trim() === "1";

export function petTalkEnabled(): boolean {
  return ENABLED;
}

let availability: { checkedAt: number; available: boolean } | null = null;

export class PetTalkError extends Error {
  code: string | null;
  constructor(message: string, code: string | null = null) {
    super(message);
    this.name = "PetTalkError";
    this.code = code;
  }
}

/** True when the flag is on and the function exists and has a key. Cached for the session; `force` re-asks. */
export async function petTalkAvailable(force = false): Promise<boolean> {
  if (!ENABLED) return false;
  if (PREVIEW) return true;
  if (!force && availability && Date.now() - availability.checkedAt < 30 * 60 * 1000) return availability.available;
  let available = false;
  try {
    const { data, error } = await supabase.functions.invoke(FUNCTION, { body: { ping: true } });
    available = !error && data?.configured === true;
  } catch {
    available = false;
  }
  availability = { checkedAt: Date.now(), available };
  return available;
}

export type PetTalkReply = { reply: string; remaining: number | null };

export async function sendPetTalk(messages: TalkMessage[], context: TalkContext): Promise<PetTalkReply> {
  if (!ENABLED) throw new PetTalkError("Talking with your pet isn't turned on in this build.", "disabled");
  if (PREVIEW) {
    // a stand-in so the screen can be exercised before the key exists
    await new Promise((resolve) => setTimeout(resolve, 600));
    const last = messages[messages.length - 1]?.content || "";
    return { reply: `(preview) ${context.petName} heard: "${last.slice(0, 80)}". When the key is set, this is where ${context.petName} answers.`, remaining: null };
  }
  const { data, error } = await supabase.functions.invoke(FUNCTION, { body: { messages: trimHistory(messages), context: talkContextPayload(context) } });
  if (error) {
    let code: string | null = null;
    let message = "Couldn't reach the pet's voice. Check your connection and try again.";
    try {
      const body = await (error as any).context?.json?.();
      if (body?.error) message = String(body.error);
      if (body?.code) code = String(body.code);
    } catch {}
    throw new PetTalkError(message, code);
  }
  const reply = typeof data?.reply === "string" ? data.reply.trim() : "";
  if (!reply) throw new PetTalkError("The reply came back empty. Try again.", "empty");
  return { reply, remaining: Number.isFinite(Number(data?.remaining)) ? Number(data.remaining) : null };
}
