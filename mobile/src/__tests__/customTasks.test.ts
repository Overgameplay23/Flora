jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);
jest.mock("../lib/supabase", () => ({ supabase: { from: () => ({}) } }));

import AsyncStorage from "@react-native-async-storage/async-storage";
import { CUSTOM_CATEGORIES, iconForCategory, inferCategory, isCustomTaskTitle, normalizeCustomMeta, validateCustomTitle } from "../domain/customTasks";
import { forgetCustomTaskMeta, loadCustomTaskMeta, saveCustomTaskMeta } from "../services/customTasks";

describe("custom tasks", () => {
  it("tells the person's own rows from catalog titles and the play row", () => {
    expect(isCustomTaskTitle("Take my meds")).toBe(true);
    expect(isCustomTaskTitle("Drink water")).toBe(false);
    expect(isCustomTaskTitle("drink  WATER ")).toBe(false);
    expect(isCustomTaskTitle("Play with Biscuit", "Biscuit")).toBe(false);
    expect(isCustomTaskTitle("Send someone a photo of Biscuit", "Biscuit")).toBe(false);
    expect(isCustomTaskTitle("Send someone a photo of Max", "Biscuit")).toBe(false);
    expect(isCustomTaskTitle("")).toBe(false);
    expect(isCustomTaskTitle(null)).toBe(false);
  });

  it("picks a colour from the words, with body as the quiet default", () => {
    expect(inferCategory("Drink a glass of water")).toBe("nourish");
    expect(inferCategory("Call Nan")).toBe("connection");
    expect(inferCategory("Wash the dishes")).toBe("focus");
    expect(inferCategory("Nap for 20 minutes")).toBe("rest");
    expect(inferCategory("Breathing before the meeting")).toBe("calm");
    expect(inferCategory("Sit outside with coffee")).toBe("nourish");
    expect(inferCategory("Take my meds")).toBe("body");
    expect(inferCategory("Practise guitar")).toBe("body");
    expect(inferCategory(undefined)).toBe("body");
  });

  it("has an icon for every category it offers", () => {
    for (const option of CUSTOM_CATEGORIES) expect(iconForCategory(option.id)).toBe(option.icon);
    expect(iconForCategory("cycle")).toBe("flower-outline");
    expect(iconForCategory("nope")).toBe("ellipse-outline");
  });

  it("validates titles", () => {
    expect(validateCustomTitle("  Water   the ferns ")).toEqual({ ok: true, title: "Water the ferns" });
    expect(validateCustomTitle("").ok).toBe(false);
    expect(validateCustomTitle("x".repeat(61)).ok).toBe(false);
    expect(validateCustomTitle("x".repeat(60)).ok).toBe(true);
  });

  it("normalizes the device meta and drops junk", () => {
    expect(normalizeCustomMeta(null)).toEqual({});
    expect(normalizeCustomMeta("{nope")).toEqual({});
    expect(normalizeCustomMeta({ "12": { category: "calm", minutes: 5 }, "13": { category: "loud", minutes: 5 }, abc: { category: "calm", minutes: 1 }, "14": { category: "rest", minutes: "7" }, "15": { category: "play", minutes: -3 } })).toEqual({
      "12": { category: "calm", minutes: 5 },
      "14": { category: "rest", minutes: 7 },
      "15": { category: "play", minutes: 0 },
    });
  });

  it("remembers a row's look per user on the device", async () => {
    await AsyncStorage.clear();
    expect(await loadCustomTaskMeta("u1")).toEqual({});
    await saveCustomTaskMeta("u1", 12, { category: "connection", minutes: 2 });
    await saveCustomTaskMeta("u1", "13", { category: "focus", minutes: 10 });
    expect(await loadCustomTaskMeta("u1")).toEqual({ "12": { category: "connection", minutes: 2 }, "13": { category: "focus", minutes: 10 } });
    expect(await loadCustomTaskMeta("u2")).toEqual({});
    await forgetCustomTaskMeta("u1", 12);
    expect(await loadCustomTaskMeta("u1")).toEqual({ "13": { category: "focus", minutes: 10 } });
  });
});
