// The bottom tabs (app/navigation/tabs.js): the owner's order, the route names other screens navigate to, and
// a measured check that five labels fit a 375 pt phone without being clipped.
import fs from "fs";
import path from "path";
import { TABS, TAB_NAMES, isTabRoute, navigateToTab } from "../../app/navigation/tabs";
import { finchTabBarLabelStyle } from "../components/finchHome/FinchTabBarStyles";
import { fonts } from "../theme/tokens";

const MOBILE = path.resolve(__dirname, "..", "..");

/** Advance width of `text` in a TrueType font at `size` pt (cmap format 4 + hmtx; no kerning, which only narrows). */
function measure(fontFile: string, text: string, size: number): number {
  const b = fs.readFileSync(fontFile);
  const tables: Record<string, number> = {};
  for (let i = 0; i < b.readUInt16BE(4); i++) tables[b.toString("ascii", 12 + i * 16, 16 + i * 16)] = b.readUInt32BE(20 + i * 16);
  const unitsPerEm = b.readUInt16BE(tables.head + 18);
  const metrics = b.readUInt16BE(tables.hhea + 34);
  let sub = 0;
  for (let i = 0; i < b.readUInt16BE(tables.cmap + 2); i++) {
    const at = tables.cmap + 4 + i * 8;
    if (b.readUInt16BE(at) === 3 && b.readUInt16BE(at + 2) === 1) sub = tables.cmap + b.readUInt32BE(at + 4);
  }
  const segX2 = b.readUInt16BE(sub + 6);
  const ends = sub + 14;
  const starts = ends + segX2 + 2;
  const deltas = starts + segX2;
  const ranges = deltas + segX2;
  const glyph = (code: number) => {
    for (let i = 0; i < segX2 / 2; i++) {
      if (code > b.readUInt16BE(ends + i * 2)) continue;
      const start = b.readUInt16BE(starts + i * 2);
      if (code < start) return 0;
      const delta = b.readInt16BE(deltas + i * 2);
      const range = b.readUInt16BE(ranges + i * 2);
      if (!range) return (code + delta) & 0xffff;
      const g = b.readUInt16BE(ranges + i * 2 + range + (code - start) * 2);
      return g ? (g + delta) & 0xffff : 0;
    }
    return 0;
  };
  let units = 0;
  for (const ch of text) units += b.readUInt16BE(tables.hmtx + Math.min(glyph(ch.codePointAt(0)!), metrics - 1) * 4);
  return (units / unitsPerEm) * size;
}

describe("bottom tabs", () => {
  it("are Today · Garden · Play · Wardrobe · You, on the route names other screens already use", () => {
    expect(TABS.map((tab) => tab.label)).toEqual(["Today", "Garden", "Play", "Wardrobe", "You"]);
    expect(TAB_NAMES).toEqual(["Home", "Garden", "Play", "Wardrobe", "Pet"]);
  });

  it("draw the pet's face on You and a Feather glyph everywhere else", () => {
    const glyphs = JSON.parse(fs.readFileSync(path.join(MOBILE, "node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons/glyphmaps/Feather.json"), "utf8"));
    expect(TABS.filter((tab) => tab.petFace).map((tab) => tab.name)).toEqual(["Pet"]);
    expect(TABS.map((tab) => tab.icon)).toEqual(["sun", "feather", "play-circle", "shopping-bag", "heart"]);
    for (const tab of TABS) expect(glyphs[tab.icon]).toBeDefined();
  });

  it("know which routes are tabs (Profile is a stack screen now, Play a tab)", () => {
    expect(isTabRoute("Play")).toBe(true);
    expect(isTabRoute("Wardrobe")).toBe(true);
    expect(isTabRoute("Profile")).toBe(false);
    expect(isTabRoute("CheckIn")).toBe(false);
    expect(isTabRoute(undefined as any)).toBe(false);
    expect(isTabRoute(null as any)).toBe(false);
  });

  it("are opened from the stack through MainTabs", () => {
    const navigation = { navigate: jest.fn() };
    navigateToTab(navigation, "Play");
    navigateToTab(navigation, "Wardrobe", { slot: "head" });
    navigateToTab(navigation, "Profile");
    expect(navigation.navigate.mock.calls).toEqual([
      ["MainTabs", { screen: "Play" }],
      ["MainTabs", { screen: "Wardrobe", params: { slot: "head" } }],
    ]);
  });

  it("fit five labels on a 375 pt phone without clipping", () => {
    // each tab gets a fifth of the width, less the tab item's own 5 pt padding a side (bottom-tabs uikit)
    const available = 375 / TABS.length - 2 * 5;
    expect(finchTabBarLabelStyle.fontFamily).toBe(fonts.bodyBold);
    expect(fonts.bodyBold).toBe("Nunito_700Bold");
    const font = path.join(MOBILE, "node_modules/@expo-google-fonts/nunito/700Bold/Nunito_700Bold.ttf");
    for (const tab of TABS) {
      const width = measure(font, tab.label, finchTabBarLabelStyle.fontSize);
      expect({ label: tab.label, fits: width <= available }).toEqual({ label: tab.label, fits: true });
    }
    // sanity: the measurer is reading real metrics ("Wardrobe" is about 52 pt at 11 pt)
    expect(measure(font, "Wardrobe", 11)).toBeGreaterThan(45);
    expect(measure(font, "Wardrobe", 11)).toBeLessThan(60);
  });
});
