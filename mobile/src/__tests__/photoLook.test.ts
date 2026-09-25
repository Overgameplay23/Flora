import { DEFAULT_LOOK } from "../domain/petLook";
import { applySuggestion, hexToRgb, kmeans, suggestLookFromPixels, type PixelSource, type RGB } from "../domain/photoLook";

/** Builds a synthetic photo: a background colour with a blob of "pet" colours in the middle. */
function synthetic(width: number, height: number, background: RGB, paint: (x: number, y: number) => RGB | null): PixelSource {
  const data = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const c = paint(x, y) ?? background;
      const i = (y * width + x) * 4;
      data[i] = c[0];
      data[i + 1] = c[1];
      data[i + 2] = c[2];
      data[i + 3] = 255;
    }
  }
  return { width, height, data };
}

describe("kmeans", () => {
  it("finds the obvious clusters and orders them by share", () => {
    const points: RGB[] = [];
    for (let i = 0; i < 60; i++) points.push([200 + (i % 3), 150, 80]);
    for (let i = 0; i < 30; i++) points.push([30, 30 + (i % 2), 35]);
    const clusters = kmeans(points, 2);
    expect(clusters).toHaveLength(2);
    expect(clusters[0].share).toBeCloseTo(2 / 3, 1);
    expect(Math.round(clusters[0].color[0])).toBeGreaterThan(190);
    expect(Math.round(clusters[1].color[0])).toBeLessThan(40);
    expect(kmeans([], 3)).toEqual([]);
  });
});

describe("suggestLookFromPixels", () => {
  it("ignores the background and picks coat, lighter belly and darker ears", () => {
    const green: RGB = [90, 160, 90];
    const coat: RGB = [200, 150, 80];
    const belly: RGB = [245, 235, 210];
    const ears: RGB = [110, 70, 35];
    const src = synthetic(120, 120, green, (x, y) => {
      const dx = x - 60, dy = y - 65;
      if (dx * dx + dy * dy > 40 * 40) return null;
      if (dy > 12 && Math.abs(dx) < 14) return belly;
      if (dy < -22) return ears;
      return coat;
    });
    const s = suggestLookFromPixels(src, "dog")!;
    expect(s).not.toBeNull();
    expect(hexToRgb(s.coat)[0]).toBeGreaterThan(170);
    expect(hexToRgb(s.coat)[1]).toBeGreaterThan(120);
    expect(hexToRgb(s.secondary)[0]).toBeGreaterThan(220);
    expect(hexToRgb(s.ear)[0]).toBeLessThan(150);
    expect(s.palette.some((c) => Math.abs(c.color[1] - 160) < 12 && Math.abs(c.color[0] - 90) < 12)).toBe(false);
    expect(s.confidence).toBeGreaterThan(0.3);
  });

  it("keeps everything when the pet fills the frame, and gives up on tiny inputs", () => {
    const black: RGB = [40, 40, 45];
    const src = synthetic(64, 64, black, () => black);
    const s = suggestLookFromPixels(src, "cat")!;
    expect(s).not.toBeNull();
    expect(hexToRgb(s.coat)[0]).toBeLessThan(60);
    expect(s.eye).toBe("#c2841f");
    expect(suggestLookFromPixels({ width: 4, height: 4, data: new Uint8Array(64) })).toBeNull();
  });

  it("applies colours without touching structure", () => {
    const suggestion = { coat: "#123456", secondary: "#abcdef", ear: "#0a0b0c", nose: "#e8889b", eye: "#4a86c8", palette: [], confidence: 1 };
    const look = applySuggestion({ ...DEFAULT_LOOK.cat, ears: "folded", marking: "tabby" }, suggestion);
    expect(look.coat).toBe("#123456");
    expect(look.ears).toBe("folded");
    expect(look.marking).toBe("tabby");
    expect(look.species).toBe("cat");
  });
});
