// What someone reads when a painting fails. The painting function's messages are written for developers ("Missing
// gemini_api_key secret.", "Quota exceeded.", "Invalid sourceHash."), and the client passes them through
// (src/services/petStylize.js, left as it is), so they used to land on the Pet tab word for word. This turns a failure,
// or a message already stored in pet.processing_error, into one of a few plain sentences. Pure.

export type PaintingTrouble = "off" | "busy" | "slow" | "offline" | "unsaved" | "photo" | "other";

export const PAINTING_MESSAGES: Record<PaintingTrouble, string> = {
  // the server has no Gemini key (or another setting missing): nothing the person can fix, and it may come back
  off: "Painting isn't switched on yet. Your photo is safe, so try again later.",
  busy: "The painter is busy right now. Your photo is safe; try again in a little while.",
  // a timeout is not a connection problem: the painting may still finish on the server (petStylize.js)
  slow: "The painting is taking longer than usual. Try again in a minute.",
  offline: "We couldn't reach the painter. Check your connection and try again.",
  // the photo itself never made it up, so nothing is safe to promise
  unsaved: "We couldn't save your photo, so there was nothing to paint. Choose it again when you're back online.",
  photo: "That photo didn't work for a painting. Try a different one.",
  other: "The painting didn't come out this time. Your photo is safe; try again in a moment.",
};

/** When even the photo could not be saved (onboarding decides this itself, from what it kept). */
export const PHOTO_NOT_SAVED = PAINTING_MESSAGES.unsaved;

type PaintingFailure = { errorCode?: unknown; code?: unknown; status?: unknown; userMessage?: unknown; message?: unknown } | string | null | undefined;

const OFF_CODES = new Set(["MISSING_KEY", "CONFIG", "RATE_LIMIT_TABLE"]);

export function paintingTrouble(failure: PaintingFailure): PaintingTrouble {
  if (!failure) return "other";
  const code = typeof failure === "string" ? "" : String(failure.errorCode || failure.code || "").toUpperCase();
  const status = typeof failure === "string" ? 0 : Number(failure.status) || 0;
  // both texts: the client's sentence and the error's own message ("Failed to save pet image.")
  const text =
    typeof failure === "string" ? failure : `${String(failure.userMessage || "")} ${String(failure.message || "")}`;
  const known = (Object.keys(PAINTING_MESSAGES) as PaintingTrouble[]).find((key) => PAINTING_MESSAGES[key] === text.trim());
  if (known) return known;

  // the upload of the photo failed before any painting was tried (petStylize.js)
  if (/couldn't save your pet photo|failed to save pet image/i.test(text)) return "unsaved";
  if (OFF_CODES.has(code) || status === 404) return "off";
  if (/missing .*(key|secret|env)|service_role|not deployed|upstream auth|rate limit table/i.test(text)) return "off";
  if (code === "TIMEOUT" || /taking longer than usual|timed? ?out/i.test(text)) return "slow";
  if (code === "RATE_LIMIT" || status === 429 || /rate limit|too many|quota|busy/i.test(text)) return "busy";
  // only a real transport failure: "We could not reach the stylize service" also covers HTTP errors (a 5xx, a 401)
  if (code === "NETWORK_FAIL" || /check your connection|network request failed|failed to fetch/i.test(text)) return "offline";
  if (/too large|image type|mime|empty image/i.test(text)) return "photo";
  return "other";
}

/** The sentence to store in pet.processing_error and to show: never a developer string. */
export function paintingErrorMessage(failure: PaintingFailure): string {
  return PAINTING_MESSAGES[paintingTrouble(failure)];
}
