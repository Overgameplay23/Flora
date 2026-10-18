import {
  BLANKET_EVERY,
  MAX_BLANKETS,
  blanketLine,
  chapterLine,
  cozyCover,
  cozyDayKey,
  cozyHeadline,
  cozyRun,
  endPauseEarly,
  makePause,
  mergeChapters,
  normalizeChapters,
  normalizePauses,
  recentSummary,
  weekOf,
} from "../domain/cozyRun";
import { addDaysToDateKey } from "../utils/dateKeys";

// 12 Oct 2026 is a Monday
const range = (from: string, count: number) => Array.from({ length: count }, (_, i) => addDaysToDateKey(from, i));
const kindOf = (state: ReturnType<typeof cozyRun>, day: string) => state.recent.find((d) => d.day === day)?.kind;

describe("Cozy Run: the day", () => {
  it("ends at 3 a.m., so a late-night check-in belongs to the evening before", () => {
    expect(cozyDayKey(new Date(2026, 9, 17, 1, 30))).toBe("2026-10-16");
    expect(cozyDayKey(new Date(2026, 9, 17, 2, 59))).toBe("2026-10-16");
    expect(cozyDayKey(new Date(2026, 9, 17, 3, 0))).toBe("2026-10-17");
    expect(cozyDayKey(new Date(2026, 9, 17, 23, 59))).toBe("2026-10-17");
  });

  it("refreshes Nap Days on Mondays", () => {
    expect(weekOf("2026-10-12")).toBe("2026-10-12");
    expect(weekOf("2026-10-17")).toBe("2026-10-12");
    expect(weekOf("2026-10-18")).toBe("2026-10-12");
    expect(weekOf("2026-10-19")).toBe("2026-10-19");
  });
});

describe("Cozy Run: the rules", () => {
  it("counts the days of care and never holds today against anyone", () => {
    const state = cozyRun({ careDays: range("2026-10-12", 4), today: "2026-10-16" });
    expect(state.status).toBe("active");
    expect(state.days).toBe(4);
    expect(state.napsLeftThisWeek).toBe(2);
    expect(state.recent[state.recent.length - 1]).toEqual({ day: "2026-10-16", kind: "today" });
  });

  it("has nothing to say before the first day of care", () => {
    const state = cozyRun({ careDays: [], today: "2026-10-16" });
    expect(state.status).toBe("none");
    expect(state.days).toBe(0);
    expect(state.recent.every((d) => d.kind === "quiet" || d.kind === "today")).toBe(true);
  });

  it("covers two quiet days a week with Nap Days, on their own", () => {
    const state = cozyRun({ careDays: ["2026-10-12", "2026-10-14", "2026-10-16"], today: "2026-10-16" });
    expect(state.status).toBe("active");
    expect(state.days).toBe(3);
    expect(kindOf(state, "2026-10-13")).toBe("nap");
    expect(kindOf(state, "2026-10-15")).toBe("nap");
    expect(state.napsLeftThisWeek).toBe(0);
  });

  it("earns a Warm Blanket every seven days of care and spends it when the naps are gone", () => {
    // 1-7 Oct: seven days of care; then Thursday and Friday nap, Saturday takes the blanket
    const care = [...range("2026-10-01", 7), "2026-10-11"];
    const state = cozyRun({ careDays: care, today: "2026-10-11" });
    expect(state.status).toBe("active");
    expect(state.days).toBe(8);
    expect(kindOf(state, "2026-10-08")).toBe("nap");
    expect(kindOf(state, "2026-10-09")).toBe("nap");
    expect(kindOf(state, "2026-10-10")).toBe("blanket");
    expect(state.blankets).toBe(0);
    expect(state.blanketProgress).toBe(1);
  });

  it("holds three blankets at most", () => {
    const state = cozyRun({ careDays: range("2026-09-01", 30), today: "2026-09-30" });
    expect(state.days).toBe(30);
    expect(state.blankets).toBe(MAX_BLANKETS);
    expect(state.blanketProgress).toBe(0);
    expect(blanketLine(state)).toMatch(/Three Warm Blankets/);
    const two = cozyRun({ careDays: range("2026-09-01", 2 * BLANKET_EVERY + 3), today: "2026-09-17" });
    expect(two.blankets).toBe(2);
    expect(blanketLine(two)).toBe("4 more days of care for the next Warm Blanket.");
  });

  it("covers logged period days without spending a nap", () => {
    const state = cozyRun({ careDays: ["2026-10-12", "2026-10-15"], periodDays: ["2026-10-13", "2026-10-14"], today: "2026-10-15" });
    expect(kindOf(state, "2026-10-13")).toBe("cycle");
    expect(kindOf(state, "2026-10-14")).toBe("cycle");
    expect(state.napsLeftThisWeek).toBe(2);
    expect(state.days).toBe(2);
  });

  it("covers a Cozy Pause, however long, and still counts care during it", () => {
    const pause = makePause("2026-10-02", 12);
    expect(pause).toEqual({ start: "2026-10-02", end: "2026-10-13" });
    const state = cozyRun({ careDays: ["2026-10-01", "2026-10-06", "2026-10-14"], pauses: [pause], today: "2026-10-14" });
    expect(state.status).toBe("active");
    expect(state.days).toBe(3);
    expect(kindOf(state, "2026-10-13")).toBe("pause");
    expect(kindOf(state, "2026-10-06")).toBe("care");
  });

  it("rests instead of breaking, and says how to mend", () => {
    // Monday care, Tuesday and Wednesday nap, Thursday finds no cover; Friday shows up
    const state = cozyRun({ careDays: ["2026-10-05", "2026-10-09"], today: "2026-10-10" });
    expect(state.status).toBe("resting");
    expect(state.days).toBe(1);
    expect(kindOf(state, "2026-10-08")).toBe("resting");
    expect(state.resting).toEqual({ since: "2026-10-08", mendBy: "2026-10-13", showUpsNeeded: 2 });
    expect(cozyHeadline(state, "Biscuit")).toBe("Your 1-day run is resting. Show up 2 more days by Tuesday and it mends.");
  });

  it("mends with three days of care within five, and the resting day counts as covered", () => {
    const state = cozyRun({ careDays: ["2026-10-05", "2026-10-09", "2026-10-10", "2026-10-11"], today: "2026-10-11" });
    expect(state.status).toBe("active");
    expect(state.days).toBe(4);
    expect(kindOf(state, "2026-10-08")).toBe("mended");
    expect(state.chapters).toEqual([]);
  });

  it("keeps a run that could not mend as a chapter, and starts the next one from the first day back", () => {
    const care = [...range("2026-10-01", 4), "2026-10-09"]; // Thu-Sun, then one day back
    const state = cozyRun({ careDays: care, today: "2026-10-14" });
    expect(state.chapters).toEqual([{ start: "2026-10-01", end: "2026-10-04", days: 4 }]);
    expect(state.start).toBe("2026-10-09");
    expect(state.best).toBe(4);
    expect(chapterLine(state.chapters[0])).toBe("4 days, 1 Oct to 4 Oct");
  });

  it("closes the rest as soon as mending can no longer happen", () => {
    // rests on Thursday 8th; by Tuesday 13th (the last day of the window) nobody has shown up
    const state = cozyRun({ careDays: range("2026-10-03", 3), today: "2026-10-13" });
    expect(state.status).toBe("none");
    expect(state.chapters).toEqual([{ start: "2026-10-03", end: "2026-10-05", days: 3 }]);
  });

  it("waits for a period day inside the mending window instead of using it up", () => {
    const care = ["2026-10-05", "2026-10-10", "2026-10-12", "2026-10-14"];
    const period = ["2026-10-09", "2026-10-11", "2026-10-13"];
    const state = cozyRun({ careDays: care, periodDays: period, today: "2026-10-14" });
    expect(state.status).toBe("active");
    expect(state.days).toBe(4);
    expect(kindOf(state, "2026-10-08")).toBe("mended");
  });

  it("does not keep a two-day beginning as a chapter", () => {
    const state = cozyRun({ careDays: ["2026-09-01", "2026-09-02", "2026-10-14"], today: "2026-10-14" });
    expect(state.chapters).toEqual([]);
    expect(state.days).toBe(1);
  });
});

describe("Cozy Run: pauses and the kept chapters", () => {
  it("pauses for 1 to 30 days and can end early without losing the days already paused", () => {
    expect(makePause("2026-10-17", 0)).toEqual({ start: "2026-10-17", end: "2026-10-17" });
    expect(makePause("2026-10-17", 90).end).toBe("2026-11-15");
    const pauses = [{ start: "2026-10-10", end: "2026-10-20" }];
    expect(endPauseEarly(pauses, "2026-10-17")).toEqual([{ start: "2026-10-10", end: "2026-10-16" }]);
    expect(endPauseEarly([{ start: "2026-10-17", end: "2026-10-20" }], "2026-10-17")).toEqual([]);
    expect(normalizePauses([{ start: "2026-10-20", end: "2026-10-10" }, "x", { start: "2026-10-01", end: "2026-10-02" }])).toEqual([
      { start: "2026-10-01", end: "2026-10-02" },
    ]);
  });

  it("keeps every chapter, newest first, one per start", () => {
    const kept = [{ start: "2026-03-01", end: "2026-03-20", days: 18 }];
    const fresh = [
      { start: "2026-09-01", end: "2026-09-09", days: 7 },
      { start: "2026-03-01", end: "2026-03-20", days: 18 },
    ];
    expect(mergeChapters(kept, fresh)).toEqual([fresh[0], kept[0]]);
    expect(normalizeChapters([{ start: "a" }, null, kept[0]])).toEqual(kept);
  });
});

describe("Cozy Run: the words", () => {
  it("never scolds, never counts what was missed", () => {
    const states = [
      cozyRun({ careDays: [], today: "2026-10-16" }),
      cozyRun({ careDays: range("2026-10-12", 4), today: "2026-10-16" }),
      cozyRun({ careDays: ["2026-10-05", "2026-10-09"], today: "2026-10-10" }),
      cozyRun({ careDays: ["2026-10-14"], pauses: [makePause("2026-10-15", 5)], today: "2026-10-15" }),
    ];
    for (const state of states) {
      const words = `${cozyHeadline(state, "Biscuit")} ${cozyCover(state)} ${blanketLine(state)}`.toLowerCase();
      expect(words).not.toMatch(/miss|broke|lost|fail|streak|shame|only \d/);
    }
    expect(cozyHeadline(states[0], "Biscuit")).toBe("Your first day of care starts a cozy run with Biscuit.");
    expect(cozyHeadline(states[3], "Biscuit")).toMatch(/^Paused until /);
    expect(cozyCover(states[1])).toBe("2 Nap Days left this week · no Warm Blankets yet");
  });
});

describe("Cozy Run: privacy", () => {
  const fs = require("fs");
  const path = require("path");
  const read = (rel: string) => fs.readFileSync(path.join(__dirname, "..", rel), "utf8");

  it("reads care events back and never writes anything to the server", () => {
    // the only .delete( in the file is the listener set's
    const store = read("services/cozyRunStore.ts").replace("listeners.delete(", "");
    expect(store).toMatch(/\.from\("user_events"\)\s*\.select\("occurred_at"\)/);
    expect(store).not.toMatch(/\.insert\(|\.update\(|\.upsert\(|\.delete\(|\.rpc\(|functions\.invoke/);
    expect(store).not.toMatch(/cycleStore|useCycle/);
  });

  it("keeps the rules free of the cycle store and the network", () => {
    const domain = read("domain/cozyRun.ts");
    expect(domain).not.toMatch(/lib\/supabase|cycleStore|AsyncStorage|fetch\(/);
  });
});

describe("Cozy Run: what VoiceOver hears", () => {
  it("reads the two-week strip as one sentence, counting what kept the run going", () => {
    const state = cozyRun({ careDays: ["2026-10-12", "2026-10-14", "2026-10-16"], periodDays: [], today: "2026-10-17" });
    expect(recentSummary(state.recent)).toBe("The last two weeks: 3 days of care, 2 Nap Days. Today is still open.");
    const fresh = cozyRun({ careDays: [], today: "2026-10-17" });
    expect(recentSummary(fresh.recent)).toBe("The last two weeks: no days of care yet. Today is still open.");
    const resting = cozyRun({ careDays: ["2026-10-05", "2026-10-09"], today: "2026-10-10" });
    expect(recentSummary(resting.recent)).toMatch(/the run is resting/);
    expect(recentSummary(resting.recent)).not.toMatch(/miss|quiet/);
  });
});
