import fs from "fs";
import path from "path";
import { CARD_RATIO, canShareAtReveal, canShareCard, paintingOf, realPhotoOf, shareCardCopy } from "../domain/shareCard";

describe("share card", () => {
  it("is offered only when there is a real photo, and never for an adopted companion", () => {
    expect(canShareCard({ original: "pets/u/original.jpg" }, false)).toBe(true);
    expect(canShareCard({ photo: "pets/u/original.jpg" }, false)).toBe(true);
    expect(canShareCard({ stylized: "pets/u/processed/stylized.png" }, false)).toBe(false);
    expect(canShareCard({ original: "pets/u/original.jpg" }, true)).toBe(false);
    expect(canShareCard(null, false)).toBe(false);
  });

  it("puts the real photo first and the painting second, falling back to the drawing", () => {
    const sources = { original: "o", photo: "p", stylized: "s", cutout: "c" };
    expect(realPhotoOf(sources)).toBe("o");
    expect(paintingOf(sources)).toBe("s");
    expect(paintingOf({ cutout: "c" })).toBe("c");
    expect(paintingOf({ original: "o" })).toBeNull();
  });

  it("says what is on the card, painted or drawn, and stays gentle in memorial", () => {
    const painted = shareCardCopy({ petName: "Biscuit", painted: true });
    expect(painted.title).toBe("Meet Biscuit");
    expect(painted.artLabel).toBe("Painted by Luna");
    expect(painted.realLabel).toBe("Real life");
    expect(painted.shareTitle).toBe("The real Biscuit, and Biscuit painted by Luna");
    expect(painted.description).toMatch(/the real photo, and Biscuit painted by Luna/);

    expect(shareCardCopy({ petName: "Biscuit", painted: false }).artLabel).toBe("Drawn by Luna");
    expect(shareCardCopy({ petName: "Biscuit", painted: true, memorial: true }).title).toBe("Always Biscuit");
    expect(shareCardCopy({ petName: "  ", painted: true }).title).toBe("Meet My pet");
  });

  it("is 9:16, the shape of TikTok, Reels and Stories", () => {
    expect(CARD_RATIO).toBeCloseTo(1920 / 1080);
  });

  it("is made on the phone: the screen captures and shares, and never uploads", () => {
    const screen = fs.readFileSync(path.join(__dirname, "..", "screens", "ShareCardScreen.tsx"), "utf8");
    expect(screen).toMatch(/captureRef\(/);
    expect(screen).not.toMatch(/\.upload\(|supabase|functions\.invoke|fetch\(/);
  });

  it("is offered at a painting reveal only once the painting really exists", () => {
    const painted = { original: "o", stylized: "s" };
    expect(canShareAtReveal(painted, false, true)).toBe(true);
    expect(canShareAtReveal(painted, false, false)).toBe(false); // still painting, or kept the photo
    expect(canShareAtReveal({ original: "o" }, false, true)).toBe(false); // no painting stored
    expect(canShareAtReveal(painted, true, true)).toBe(false); // adopted companion
  });

  it("can be opened from onboarding's reveal as well as from the main app", () => {
    const root = fs.readFileSync(path.join(__dirname, "..", "..", "app", "navigation", "RootNavigator.js"), "utf8");
    const main = fs.readFileSync(path.join(__dirname, "..", "..", "app", "navigation", "AppNavigator.js"), "utf8");
    expect(root).toMatch(/name="ShareCard"/);
    expect(main).toMatch(/name="ShareCard"/);
    const onboarding = fs.readFileSync(path.join(__dirname, "..", "screens", "onboarding", "OnboardingScreen.tsx"), "utf8");
    expect(onboarding).toMatch(/canShareAtReveal\(petSources/);
  });
});
