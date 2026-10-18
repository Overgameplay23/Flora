import { cozyRun } from "../domain/cozyRun";
import { welcomeBack } from "../domain/welcomeBack";
import { addDaysToDateKey } from "../utils/dateKeys";

// 12 Oct 2026 is a Monday
const range = (from: string, n: number) => Array.from({ length: n }, (_, i) => addDaysToDateKey(from, i));
const base = { petName: "Biscuit", voice: "warm" as const, daysTogether: 34 };

describe("welcome back", () => {
  it("waits for two days away, and stays quiet in memorial", () => {
    expect(welcomeBack({ ...base, daysAway: 1, lastSeen: "2026-10-16", cozy: null })).toBeNull();
    expect(welcomeBack({ ...base, daysAway: 6, lastSeen: "2026-10-10", cozy: null, memorial: true })).toBeNull();
    expect(welcomeBack({ ...base, daysAway: 2, lastSeen: "2026-10-15", cozy: null })).not.toBeNull();
  });

  it("says the run kept going, and what covered the quiet days", () => {
    const cozy = cozyRun({ careDays: ["2026-10-10", "2026-10-11", "2026-10-12"], today: "2026-10-15" });
    const moment = welcomeBack({ ...base, daysAway: 3, lastSeen: "2026-10-12", cozy, chapters: cozy.chapters })!;
    expect(moment.title).toBe("Biscuit saved your spot");
    expect(moment.lines.map((l) => l.text)).toEqual([
      "Still 34 days together. Nothing was lost.",
      "Your 3-day cozy run kept going: 2 Nap Days covered the quiet days.",
      "Today is small on purpose. One thing is plenty.",
    ]);
    expect(moment.openRun).toBe(true);
  });

  it("names a Warm Blanket and a pause among the cover", () => {
    const care = [...range("2026-10-01", 7), "2026-10-11"];
    const cozy = cozyRun({ careDays: care, today: "2026-10-12" });
    // away from the 7th: naps on the 8th and 9th, the blanket on the 10th; the 11th was a day of care, so no welcome
    const fromSeventh = welcomeBack({ ...base, daysAway: 4, lastSeen: "2026-10-07", cozy: cozyRun({ careDays: range("2026-10-01", 7), today: "2026-10-11" }) })!;
    expect(fromSeventh.lines[1].text).toBe("Your 7-day cozy run kept going: 2 Nap Days and a Warm Blanket covered the quiet days.");
    expect(cozy.status).toBe("active");
    const paused = cozyRun({ careDays: ["2026-10-12"], pauses: [{ start: "2026-10-13", end: "2026-10-20" }], today: "2026-10-21" });
    expect(welcomeBack({ ...base, daysAway: 9, lastSeen: "2026-10-12", cozy: paused })!.lines[1].text).toMatch(/your pause covered/);
  });

  it("says how a resting run mends, today included", () => {
    const cozy = cozyRun({ careDays: ["2026-10-05"], today: "2026-10-09" });
    expect(cozy.status).toBe("resting");
    const moment = welcomeBack({ ...base, daysAway: 4, lastSeen: "2026-10-05", cozy })!;
    expect(moment.lines[1].text).toBe("Your 1-day cozy run is resting. 3 days of care by Tuesday, today included, and it mends.");
  });

  it("keeps a run that came to rest while they were away as a chapter", () => {
    const cozy = cozyRun({ careDays: range("2026-10-01", 4), today: "2026-10-14" });
    expect(cozy.status).toBe("none");
    const moment = welcomeBack({ ...base, daysAway: 10, lastSeen: "2026-10-04", cozy, chapters: cozy.chapters })!;
    expect(moment.title).toBe("Biscuit is so glad you're here");
    expect(moment.lines[1].text).toBe("Your 4-day cozy run is kept as a chapter. Today's first small thing starts a new one.");
  });

  it("speaks in the chosen voice", () => {
    const gentle = welcomeBack({ ...base, voice: "gentle", daysAway: 7, lastSeen: "2026-10-10", cozy: null })!;
    expect(gentle.title).toBe("Welcome home");
    expect(gentle.petLine).toMatch(/right here/);
    const plain = welcomeBack({ ...base, voice: "plain", daysAway: 2, lastSeen: "2026-10-15", cozy: null })!;
    expect(plain.title).toBe("Welcome back");
    const unknown = welcomeBack({ ...base, voice: null, daysAway: 2, lastSeen: "2026-10-15", cozy: null })!;
    expect(unknown.title).toBe("Biscuit saved your spot");
  });

  it("works without a count or a run, and never counts the absence or scolds", () => {
    const bare = welcomeBack({ petName: "", daysTogether: null, daysAway: 3, lastSeen: "2026-10-14", cozy: null })!;
    expect(bare.lines.map((l) => l.id)).toEqual(["today"]);
    expect(bare.openRun).toBe(false);
    expect(bare.title).toBe("Your pet saved your spot");

    const all = [
      welcomeBack({ ...base, daysAway: 12, lastSeen: "2026-10-04", cozy: cozyRun({ careDays: range("2026-10-01", 4), today: "2026-10-16" }) })!,
      welcomeBack({ ...base, daysAway: 4, lastSeen: "2026-10-05", cozy: cozyRun({ careDays: ["2026-10-05"], today: "2026-10-09" }) })!,
    ];
    for (const moment of all) {
      const words = `${moment.title} ${moment.petLine} ${moment.lines.map((l) => l.text).join(" ")}`.toLowerCase();
      expect(words).not.toMatch(/you missed|days away|were gone|been away|streak|broke|behind|catch up|\b1[02] days\b/);
    }
  });
});
