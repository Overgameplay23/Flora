jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);

import AsyncStorage from "@react-native-async-storage/async-storage";
import { DEFAULT_CARE_PREFS, normalizeCarePrefs } from "../domain/carePrefs";
import { loadCarePrefs, saveCarePrefs } from "../services/carePrefs";

describe("normalizeCarePrefs", () => {
  it("falls back to the defaults for junk and keeps only known values", () => {
    expect(normalizeCarePrefs(null)).toEqual(DEFAULT_CARE_PREFS);
    expect(normalizeCarePrefs("{not json")).toEqual(DEFAULT_CARE_PREFS);
    expect(normalizeCarePrefs({ usualBattery: "furious", hardDayMinutes: 7, voice: "shouty", completedAt: "yesterday" })).toEqual(DEFAULT_CARE_PREFS);
    expect(normalizeCarePrefs(JSON.stringify({ usualBattery: "calm", hardDayMinutes: 5, voice: "plain", completedAt: "2026-10-16T12:00:00.000Z" }))).toEqual({
      version: 1,
      usualBattery: "calm",
      hardDayMinutes: 5,
      voice: "plain",
      completedAt: "2026-10-16T12:00:00.000Z",
    });
  });
});

describe("carePrefs store", () => {
  beforeEach(() => AsyncStorage.clear());

  it("is per user, merges patches and never leaves the phone", async () => {
    expect(await loadCarePrefs("u1")).toEqual(DEFAULT_CARE_PREFS);
    expect(await loadCarePrefs(null)).toEqual(DEFAULT_CARE_PREFS);
    await saveCarePrefs("u1", { usualBattery: "anxious", voice: "gentle" });
    await saveCarePrefs("u1", { hardDayMinutes: 1 });
    expect(await loadCarePrefs("u1")).toEqual({ version: 1, usualBattery: "anxious", hardDayMinutes: 1, voice: "gentle", completedAt: null });
    expect(await loadCarePrefs("u2")).toEqual(DEFAULT_CARE_PREFS);
    expect(await AsyncStorage.getItem("floura:care-prefs:u1")).toContain("anxious");
    // only the floura key for this user exists
    expect((await AsyncStorage.getAllKeys()).filter((key) => key.includes("care-prefs"))).toEqual(["floura:care-prefs:u1"]);
  });
});
