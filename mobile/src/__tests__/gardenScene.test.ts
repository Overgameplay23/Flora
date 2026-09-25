import {
  computeSceneFrame,
  fitHeight,
  layoutGardenPlants,
  plantStageForLevel,
  sceneToView,
} from "../domain/gardenScene";

const IMAGE = { w: 1696, h: 2528 };

describe("computeSceneFrame", () => {
  it("always covers the container, whatever the screen shape", () => {
    for (const [cw, ch] of [[390, 338], [430, 372], [320, 300], [768, 400], [388, 320]]) {
      const frame = computeSceneFrame(cw, ch, IMAGE.w, IMAGE.h, { u: 0.56, v: 0.7 }, 1.3);
      expect(frame.left).toBeLessThanOrEqual(0);
      expect(frame.top).toBeLessThanOrEqual(0);
      expect(frame.left + frame.width).toBeGreaterThanOrEqual(cw - 1e-6);
      expect(frame.top + frame.height).toBeGreaterThanOrEqual(ch - 1e-6);
    }
  });

  it("keeps the image aspect ratio and applies the zoom on top of cover-fit", () => {
    const frame = computeSceneFrame(390, 338, IMAGE.w, IMAGE.h, { u: 0.5, v: 0.5 }, 1.3);
    expect(frame.width / frame.height).toBeCloseTo(IMAGE.w / IMAGE.h, 6);
    expect(frame.scale).toBeCloseTo((390 / IMAGE.w) * 1.3, 6);
  });

  it("centres the focus point when the image edges allow it", () => {
    const frame = computeSceneFrame(390, 338, IMAGE.w, IMAGE.h, { u: 0.56, v: 0.7 }, 1.3);
    const focus = sceneToView(frame, { u: 0.56, v: 0.7 });
    expect(focus.x).toBeCloseTo(195, 3);
    expect(focus.y).toBeCloseTo(169, 3);
  });

  it("clamps at the image edge instead of showing empty space", () => {
    const frame = computeSceneFrame(390, 338, IMAGE.w, IMAGE.h, { u: 0, v: 1 }, 1.3);
    expect(frame.left).toBe(0);
    expect(frame.top).toBeCloseTo(338 - frame.height, 6);
  });

  it("never zooms out below cover-fit and survives bad input", () => {
    const frame = computeSceneFrame(390, 338, IMAGE.w, IMAGE.h, { u: Number.NaN, v: 0.5 }, 0.2);
    expect(frame.scale).toBeCloseTo(390 / IMAGE.w, 6);
    expect(Number.isFinite(frame.left)).toBe(true);
  });
});

describe("sceneToView", () => {
  it("moves sprites with the painting: the same scene point lands on the same painted feature at any size", () => {
    const small = computeSceneFrame(320, 300, IMAGE.w, IMAGE.h, { u: 0.56, v: 0.7 }, 1.3);
    const large = computeSceneFrame(430, 372, IMAGE.w, IMAGE.h, { u: 0.56, v: 0.7 }, 1.3);
    const a = sceneToView(small, { u: 0.615, v: 0.679 });
    const b = sceneToView(large, { u: 0.615, v: 0.679 });
    // convert back to image space through each frame: must be the same image pixel
    expect((a.x - small.left) / small.width).toBeCloseTo((b.x - large.left) / large.width, 9);
    expect((a.y - small.top) / small.height).toBeCloseTo((b.y - large.top) / large.height, 9);
  });
});

describe("plantStageForLevel", () => {
  it("starts as a seed and blooms in the last quarter of its levels", () => {
    expect([1, 2, 3, 4, 5].map((level) => plantStageForLevel(level, 5))).toEqual([
      "seed",
      "sproutSmall",
      "sprout",
      "bloom",
      "bloom",
    ]);
    expect([1, 2, 3, 4, 5, 6, 7, 8].map((level) => plantStageForLevel(level, 8))).toEqual([
      "seed",
      "sproutSmall",
      "sproutSmall",
      "sprout",
      "sprout",
      "sprout",
      "bloom",
      "bloom",
    ]);
  });

  it("shows nothing for unowned plants and tolerates bad values", () => {
    expect(plantStageForLevel(0, 5)).toBeNull();
    expect(plantStageForLevel(-2, 5)).toBeNull();
    expect(plantStageForLevel(Number.NaN, 5)).toBeNull();
    expect(plantStageForLevel(3, Number.NaN)).toBe("sprout");
    expect(plantStageForLevel(9, 5)).toBe("bloom");
  });
});

describe("layoutGardenPlants", () => {
  const plant = (id: string, level: number, purchasedAt: string) => ({ id, level, maxLevel: 5, purchasedAt });

  it("plants in purchase order so a plant keeps its spot when it levels up", () => {
    const before = layoutGardenPlants(
      [plant("cactus", 1, "2026-09-02T10:00:00Z"), plant("bamboo", 1, "2026-09-01T10:00:00Z")],
      6
    );
    const after = layoutGardenPlants(
      [plant("cactus", 4, "2026-09-02T10:00:00Z"), plant("bamboo", 1, "2026-09-01T10:00:00Z")],
      6
    );
    expect(before.map((p) => [p.id, p.spotIndex])).toEqual([["bamboo", 0], ["cactus", 1]]);
    expect(after.map((p) => [p.id, p.spotIndex, p.stage])).toEqual([["bamboo", 0, "seed"], ["cactus", 1, "bloom"]]);
  });

  it("ignores unowned plants and shows the most grown ones when spots run out", () => {
    const many = ["a", "b", "c", "d"].map((id, i) => plant(id, i + 1, `2026-09-0${i + 1}T00:00:00Z`));
    const placed = layoutGardenPlants([...many, plant("ghost", 0, "2026-08-01T00:00:00Z")], 2);
    expect(placed.map((p) => p.id)).toEqual(["c", "d"]);
    expect(placed.map((p) => p.spotIndex)).toEqual([0, 1]);
  });

  it("returns nothing for an empty garden or zero spots", () => {
    expect(layoutGardenPlants([], 6)).toEqual([]);
    expect(layoutGardenPlants([plant("bamboo", 2, "2026-09-01T00:00:00Z")], 0)).toEqual([]);
  });
});

describe("fitHeight", () => {
  it("matches the image aspect so a trimmed sprite stands on its bottom edge", () => {
    expect(fitHeight(120, 633, 640)).toEqual({ width: 120 * (633 / 640), height: 120 });
  });
  it("falls back to a square and limits extreme ratios", () => {
    expect(fitHeight(100, 0, 0)).toEqual({ width: 100, height: 100 });
    expect(fitHeight(100, 5000, 100).width).toBeCloseTo(220, 6);
  });
});
