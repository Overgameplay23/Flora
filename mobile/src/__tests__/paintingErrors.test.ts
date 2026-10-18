import fs from "fs";
import path from "path";
import { PAINTING_MESSAGES, PHOTO_NOT_SAVED, paintingErrorMessage, paintingTrouble } from "../domain/paintingErrors";

const ROOT = path.join(__dirname, "..", "..");
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), "utf8");

describe("painting errors in plain words", () => {
  it("says painting is switched off when the server has no Gemini key, however the failure arrives", () => {
    // what the deployed function returns without GEMINI_API_KEY (supabase/functions/pet-stylize/index.ts)
    expect(paintingTrouble({ errorCode: "MISSING_KEY", userMessage: "Missing gemini_api_key secret.", status: 500 })).toBe("off");
    // a row already stored on Bloom with the raw text still reads well on the Pet tab
    expect(paintingErrorMessage("Missing gemini_api_key secret.")).toBe(PAINTING_MESSAGES.off);
    expect(paintingTrouble({ errorCode: "CONFIG", userMessage: "Missing SUPABASE_SERVICE_ROLE_KEY." })).toBe("off");
    expect(paintingTrouble({ status: 404, userMessage: "Stylize service is not deployed. Please contact support." })).toBe("off");
    expect(paintingTrouble("Upstream auth failure.")).toBe("off");
  });

  it("reads the client's own failures the way the client means them (src/services/petStylize.js)", () => {
    // a timeout is not a connection problem: the painting may still finish on the server
    const timeout = { errorCode: "TIMEOUT", status: 0, message: "Stylize request failed: Network request timed out", userMessage: "The painting is taking longer than usual. Please try again in a minute." };
    expect(paintingTrouble(timeout)).toBe("slow");
    expect(paintingErrorMessage(timeout)).not.toMatch(/connection/);
    const offline = { errorCode: "NETWORK_FAIL", status: 0, userMessage: "We couldn't reach the painting service. Check your connection and try again." };
    expect(paintingTrouble(offline)).toBe("offline");
    // the catch-all for an HTTP error (a 5xx, an expired session) is not "check your connection"
    expect(paintingTrouble({ status: 546, userMessage: "We could not reach the stylize service. Please try again." })).toBe("other");
    expect(paintingTrouble({ errorCode: "RATE_LIMIT", userMessage: "Stylize is busy right now (rate limit). Try again soon." })).toBe("busy");
    // the photo never made it up, so "your photo is safe" would be untrue
    const unsaved = { message: "Failed to save pet image.", userMessage: "We couldn't save your pet photo yet. Please try again." };
    expect(paintingErrorMessage(unsaved)).toBe(PHOTO_NOT_SAVED);
    expect(paintingErrorMessage("We couldn't save your pet photo yet. Please try again.")).toBe(PHOTO_NOT_SAVED);
  });

  it("tells busy and photo trouble apart, and blames the photo only when it is the photo", () => {
    expect(paintingTrouble("Quota exceeded.")).toBe("busy");
    expect(paintingTrouble("Image too large.")).toBe("photo");
    // Gemini's 400s include an invalid key, so "rejected" says nothing about the photo
    expect(paintingTrouble({ errorCode: "BAD_REQUEST", status: 400, userMessage: "Gemini rejected the request." })).toBe("other");
    expect(paintingTrouble({ errorCode: "PIPELINE", userMessage: "Stylize pipeline failed." })).toBe("other");
    expect(paintingTrouble(null)).toBe("other");
  });

  it("never shows a developer string: every message the painting function can send becomes one of the plain ones", () => {
    const source = read("supabase/functions/pet-stylize/index.ts");
    const serverMessages = [...source.matchAll(/message:\s*"([^"]+)"/g)].map((m) => m[1]);
    expect(serverMessages.length).toBeGreaterThan(10);
    const plain = Object.values(PAINTING_MESSAGES);
    for (const message of serverMessages) {
      const shown = paintingErrorMessage(message);
      expect(plain).toContain(shown);
      expect(shown).not.toMatch(/gemini|secret|supabase|stylize|mime|payload|sourceHash|upstream/i);
    }
  });

  it("promises the photo is safe only where it is", () => {
    for (const trouble of ["unsaved", "offline", "slow", "photo"] as const) expect(PAINTING_MESSAGES[trouble]).not.toMatch(/safe/);
    for (const message of Object.values(PAINTING_MESSAGES)) expect(paintingErrorMessage(message)).toBe(message);
  });

  it("is what the Pet tab, onboarding and the change-photo screen use", () => {
    expect(read("app/screens/PetScreen.js")).toMatch(/\{paintingErrorMessage\(pet\?\.processing_error\)\}/);
    expect(read("app/screens/PetScreen.js")).not.toMatch(/\{pet\?\.processing_error \|\|/);
    expect(read("app/screens/PetStylizeLoadingScreen.js")).toMatch(/setErrorMessage\(paintingErrorMessage\(error\)\)/);
    expect(read("src/screens/onboarding/OnboardingScreen.tsx")).toMatch(/keptPhoto \? paintingErrorMessage\(error\) : PHOTO_NOT_SAVED/);
  });
});
