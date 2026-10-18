// The games played with VoiceOver: no drags or strokes needed, and enough said aloud to play fairly.
import fs from "fs";
import path from "path";
import { accessibleThrow, type Field } from "../games/fetch/fetchLogic";
import { CATCH_RADIUS_RATIO, isCaught, stepZone, treatCue, zoneCenterRatio, zoneOf, type Zone } from "../games/treats/treatsLogic";
import { flipCue } from "../games/memory/memoryLogic";

const field = (width: number): Field => ({ width, height: 700, groundTop: 520, groundBottom: 640, sideMargin: 36 });

describe("games by ear: Fetch", () => {
  it("throws without a drag, and the long throw goes further than the short one", () => {
    const from = { x: 160, y: 590 };
    const short = accessibleThrow(from, field(375), "short");
    const long = accessibleThrow(from, field(375), "long");
    expect(short).toBeTruthy();
    expect(long).toBeTruthy();
    expect(long.landing.x).toBeGreaterThan(short.landing.x);
    expect(long.distanceRatio).toBeGreaterThan(short.distanceRatio);
    expect(accessibleThrow(from, field(375))).toEqual(short);
  });
});

describe("games by ear: Treat Catch", () => {
  it("splits the lawn in thirds and steps between them", () => {
    expect(zoneOf(0.1)).toBe("left");
    expect(zoneOf(0.5)).toBe("middle");
    expect(zoneOf(0.9)).toBe("right");
    expect(zoneOf(1)).toBe("right");
    expect(zoneOf(Number.NaN)).toBe("middle");
    expect(zoneCenterRatio("left")).toBeCloseTo(1 / 6);
    expect(stepZone("middle", 1)).toBe("right");
    expect(stepZone("right", 1)).toBe("right");
    expect(stepZone("left", -1)).toBe("left");
  });

  it("says where each treat falls", () => {
    expect(treatCue({ xRatio: 0.2, kind: "biscuit" })).toBe("Left");
    expect(treatCue({ xRatio: 0.8, kind: "golden" })).toBe("Golden, right");
  });

  it("is fair: from the middle of a third the pet reaches every treat in it, on every iPhone width", () => {
    const reach = 150 * 1.2 * CATCH_RADIUS_RATIO; // PET_SIZE in TreatsGameScreen
    for (const width of [320, 375, 393, 430, 440]) {
      for (const zone of ["left", "middle", "right"] as Zone[]) {
        const petX = zoneCenterRatio(zone) * width;
        // treats fall between 12% and 88% of the width (spawnTreat)
        for (let ratio = 0.12; ratio <= 0.88; ratio += 0.01) {
          if (zoneOf(ratio) !== zone) continue;
          expect(isCaught(ratio * width, petX, reach)).toBe(true);
        }
      }
    }
  });
});

describe("games by ear: Memory Match", () => {
  it("says the picture and what came of it", () => {
    expect(flipCue("flipped", "Moon")).toBe("Moon");
    expect(flipCue("match", "Moon")).toBe("Moon. A pair!");
    expect(flipCue("mismatch", "Sun")).toMatch(/Not a pair/);
    expect(flipCue("all-cleared", "Leaf")).toMatch(/Every card found/);
    expect(flipCue("ignored", "Leaf")).toBeNull();
  });
});

describe("games by ear: every game", () => {
  const source = (rel: string) => fs.readFileSync(path.join(__dirname, "..", rel), "utf8");

  it("offers an action where sighted players drag or stroke", () => {
    expect(source("games/fetch/FetchGameScreen.tsx")).toMatch(/onAccessibilityAction=/);
    expect(source("games/petting/PettingGameScreen.tsx")).toMatch(/onAccessibilityAction=/);
    expect(source("games/treats/TreatsGameScreen.tsx")).toMatch(/accessibilityRole="adjustable"/);
  });

  it("says aloud what a sighted player would see", () => {
    expect(source("games/treats/TreatsGameScreen.tsx")).toMatch(/announce\(treatCue/);
    expect(source("games/memory/MemoryGameScreen.tsx")).toMatch(/announce\(.*flipCue/);
    expect(source("games/petting/PettingGameScreen.tsx")).toMatch(/announce\(/);
    expect(source("games/GameEndCard.tsx")).toMatch(/announce\(/);
  });
});
