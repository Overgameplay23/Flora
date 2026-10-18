// Cozy Run (research B2, R1-R11): the replayed rules, the copy's promises (nothing broken, lost or missed),
// the calendar's shape, and the device/Supabase glue. The Supabase client is a small in-memory fake and
// AsyncStorage is the library's own mock, so nothing here touches the network or a device.
jest.mock("../lib/supabase", () => ({ supabase: { from: (table: string) => mockFrom(table) } }));
jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);

import fs from "fs";
import path from "path";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  CALENDAR_DAYS,
  PACE_OPTIONS,
  PAUSE_OPTIONS,
  STAMP_LEGEND,
  addCareDays,
  blanketsLine,
  careDayKey,
  chapterLine,
  chapterRange,
  computeCozyRun,
  cozyRunHeadline,
  dayLabel,
  daysTogetherLine,
  mendLine,
  milestoneLine,
  napsLeftLine,
  nextMilestone,
  pauseOptionLabel,
  runSubline,
  stampLabel,
  stampWeeks,
  type CozyDayKind,
  type CozyRunInput,
  type CozyRunResult,
} from "../domain/cozyRun";
import { endPause, loadCozyRunInput, markShowedUp, rememberMend, savePace, startPause } from "../services/cozyRunStore";

// ---- fakes -----------------------------------------------------------------------------------------------

type MetricRow = { user_id: string; day: string; tasks_completed: number; checkins_completed: number };
// `gate`, when set, holds every server answer until it resolves (a slow network)
const mockDb: { rows: MetricRow[]; offline: boolean; pages: number; gate: Promise<void> | null } = { rows: [], offline: false, pages: 0, gate: null };

function mockFrom(table: string) {
  const eq: Record<string, unknown> = {};
  let range: [number, number] = [0, Number.MAX_SAFE_INTEGER];
  const run = () => {
    mockDb.pages += 1;
    if (mockDb.offline) return { data: null, error: { message: "Network request failed" } };
    if (table !== "daily_user_metrics") return { data: [], error: null };
    const rows = mockDb.rows
      .filter((row) => Object.entries(eq).every(([column, value]) => (row as any)[column] === value))
      .sort((a, b) => (a.day < b.day ? -1 : 1));
    return { data: rows.slice(range[0], range[1] + 1), error: null };
  };
  const builder: any = {
    select: () => builder,
    eq: (column: string, value: unknown) => {
      eq[column] = value;
      return builder;
    },
    or: () => builder,
    order: () => builder,
    range: (from: number, to: number) => {
      range = [from, to];
      return builder;
    },
    then: (resolve: any, reject: any) => (mockDb.gate ?? Promise.resolve()).then(run).then(resolve, reject),
  };
  return builder;
}

// ---- helpers ---------------------------------------------------------------------------------------------

/** `count` consecutive care days from `from`. */
function span(from: string, count: number): string[] {
  return Array.from({ length: count }, (_, i) => addCareDays(from, i));
}

function compute(partial: Partial<CozyRunInput> & { today: string }): CozyRunResult {
  return computeCozyRun({ showedUp: [], pace: "steady", covered: [], pauses: [], mendUsedOn: null, ...partial });
}

function kindOf(result: CozyRunResult, day: string): CozyDayKind | undefined {
  return result.days.find((entry) => entry.day === day)?.kind;
}

const ALL_KINDS: CozyDayKind[] = ["showed_up", "nap", "blanket", "paused", "covered", "open", "today_open"];
// R9: nothing broken, nothing lost, nothing missed, no streak talk, no countdowns
const BANNED = /\b(broke|broken|break(s|ing)? (the|your) (run|streak)|lost|lose|losing|miss|missed|missing|fail|failed|failure|reset|ruin(ed)?|streak|hurry|expires?|ends in|hours? left|before midnight)\b/i;

// 2026-10-12 is a Monday; the reference "today" is Thursday 2026-10-15.
const MON = "2026-10-12";

describe("R1 (as built): the care day is the local calendar day, like the server's", () => {
  it("changes at midnight, so one 1 a.m. task is one day everywhere", () => {
    expect(careDayKey(new Date(2026, 9, 15, 0, 0))).toBe("2026-10-15");
    expect(careDayKey(new Date(2026, 9, 15, 2, 59))).toBe("2026-10-15");
    expect(careDayKey(new Date(2026, 9, 14, 23, 59))).toBe("2026-10-14");
    expect(careDayKey(new Date(2026, 9, 15, 23, 59))).toBe("2026-10-15");
  });

  it("uses local dates across month and year edges", () => {
    expect(careDayKey(new Date(2026, 10, 1, 1, 30))).toBe("2026-11-01");
    expect(careDayKey(new Date(2027, 0, 1, 0, 30))).toBe("2027-01-01");
    expect(careDayKey(new Date(2026, 1, 28, 23, 0))).toBe("2026-02-28");
  });

  it("falls back to now for a broken date instead of throwing", () => {
    expect(careDayKey(new Date("nope"))).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe("the run and Days Together", () => {
  it("counts care days in a row, today included once it is cared for", () => {
    const result = compute({ today: "2026-10-15", showedUp: span(MON, 4) });
    expect(result.daysTogether).toBe(4);
    expect(result.run).toMatchObject({ length: 4, startedOn: MON, todayCounted: true, napsLeftThisWeek: 2, blankets: 0 });
    expect(result.days).toHaveLength(CALENDAR_DAYS);
    expect(result.days[CALENDAR_DAYS - 1]).toEqual({ day: "2026-10-15", kind: "showed_up" });
    expect(result.days[0].day).toBe(addCareDays("2026-10-15", -27));
    expect(result.days.slice(-4).map((d) => d.kind)).toEqual(["showed_up", "showed_up", "showed_up", "showed_up"]);
    expect(result.days.slice(0, -4).every((d) => d.kind === "open")).toBe(true);
  });

  it("an empty history is a fresh start, not a zero to be sorry about", () => {
    const result = compute({ today: "2026-10-15" });
    expect(result.daysTogether).toBe(0);
    expect(result.run).toMatchObject({ length: 0, startedOn: null, todayCounted: false, napsLeftThisWeek: 2, blankets: 0 });
    expect(result.days[CALENDAR_DAYS - 1].kind).toBe("today_open");
    expect(result.chapters).toEqual([]);
    expect(result.nextMilestone).toEqual({ at: 1, label: "Your first day together" });
    expect(cozyRunHeadline(result.run.length)).toBe("A fresh cozy run");
  });

  it("Days Together counts every care day ever, ignores repeats and junk, and never drops when a run ends", () => {
    const showedUp = [...span("2026-08-03", 5), "2026-08-03", "nope", "2026-02-30", ...span("2026-10-14", 2)];
    const result = compute({ today: "2026-10-15", showedUp });
    expect(result.daysTogether).toBe(7);
    expect(result.chapters.length).toBe(1);
    expect(result.run.length).toBe(2);
  });

  it("is the same story however the input is ordered", () => {
    const days = [...span("2026-09-20", 6), ...span("2026-10-01", 9)];
    const a = compute({ today: "2026-10-15", showedUp: days });
    const b = compute({ today: "2026-10-15", showedUp: [...days].reverse() });
    expect(b).toEqual(a);
  });
});

describe("today never breaks or shrinks the run", () => {
  it("stays open and the run holds still until today is cared for", () => {
    const before = compute({ today: "2026-10-15", showedUp: span(MON, 3) });
    expect(kindOf(before, "2026-10-15")).toBe("today_open");
    expect(before.run).toMatchObject({ length: 3, startedOn: MON, todayCounted: false });
    const after = compute({ today: "2026-10-15", showedUp: span(MON, 4) });
    expect(after.run.length).toBe(4);
  });

  it("does not spend a nap or a blanket on today, even with none left", () => {
    // daily pace: Tuesday took the week's only nap; Wednesday (today) would have nothing left to cover it
    const result = compute({ today: "2026-10-14", pace: "daily", showedUp: [MON] });
    expect(kindOf(result, "2026-10-13")).toBe("nap");
    expect(kindOf(result, "2026-10-14")).toBe("today_open");
    expect(result.run).toMatchObject({ length: 2, todayCounted: false, napsLeftThisWeek: 0 });
    expect(result.chapters).toEqual([]);
  });
});

describe("R2: Nap Days by pace, per Mon-Sun week", () => {
  // one care day on Monday 2026-10-05, then a quiet week; "today" is the Sunday after
  const quietWeek = (pace: CozyRunInput["pace"]) => compute({ today: "2026-10-11", pace, showedUp: ["2026-10-05"] });

  it("Gentle covers 3 quiet days, Steady 2, Daily 1, then the run is kept as a chapter", () => {
    const gentle = quietWeek("gentle");
    expect(span("2026-10-06", 3).map((d) => kindOf(gentle, d))).toEqual(["nap", "nap", "nap"]);
    expect(gentle.chapters).toEqual([{ from: "2026-10-05", to: "2026-10-08", length: 4 }]);

    const steady = quietWeek("steady");
    expect(span("2026-10-06", 3).map((d) => kindOf(steady, d))).toEqual(["nap", "nap", "open"]);
    expect(steady.chapters).toEqual([{ from: "2026-10-05", to: "2026-10-07", length: 3 }]);

    const daily = quietWeek("daily");
    expect(span("2026-10-06", 2).map((d) => kindOf(daily, d))).toEqual(["nap", "open"]);
    expect(daily.chapters).toEqual([{ from: "2026-10-05", to: "2026-10-06", length: 2 }]);

    for (const result of [gentle, steady, daily]) {
      expect(result.run.length).toBe(0);
      expect(kindOf(result, "2026-10-11")).toBe("today_open");
    }
  });

  it("an unknown pace is Steady", () => {
    expect(compute({ today: "2026-10-11", pace: "turbo" as any, showedUp: ["2026-10-05"] })).toEqual(quietWeek("steady"));
  });

  it("counts naps left in the current week", () => {
    const input = { today: "2026-10-14", showedUp: [MON, "2026-10-14"] }; // Tuesday was quiet
    expect(compute({ ...input, pace: "gentle" }).run.napsLeftThisWeek).toBe(2);
    expect(compute({ ...input, pace: "steady" }).run.napsLeftThisWeek).toBe(1);
    expect(compute({ ...input, pace: "daily" }).run.napsLeftThisWeek).toBe(0);
    expect(compute({ ...input, pace: "steady" }).run.length).toBe(3);
  });

  it("naps do not carry over: a full week leaves the next one with its own 2, no more", () => {
    // 7 care days (Mon 10-05 to Sun 10-11) earn one blanket; the next week: 2 naps, the blanket, then a chapter
    const result = compute({ today: "2026-10-16", showedUp: span("2026-10-05", 7) });
    expect(span(MON, 4).map((d) => kindOf(result, d))).toEqual(["nap", "nap", "blanket", "open"]);
    expect(result.chapters).toEqual([{ from: "2026-10-05", to: "2026-10-14", length: 10 }]);
  });

  it("a new week brings new naps", () => {
    // Thursday care, Fri + Sat napped, Sunday had nothing left; Monday starts a new run with its own naps
    const result = compute({ today: MON, showedUp: ["2026-10-08", MON] });
    expect(span("2026-10-09", 3).map((d) => kindOf(result, d))).toEqual(["nap", "nap", "open"]);
    expect(result.run).toMatchObject({ length: 1, startedOn: MON, napsLeftThisWeek: 2 });
  });
});

describe("R3: Warm Blankets", () => {
  it("are earned 1 per 7 care days and held up to 3", () => {
    const at = (n: number) => compute({ today: addCareDays("2026-09-01", n - 1), showedUp: span("2026-09-01", n) }).run.blankets;
    expect(at(6)).toBe(0);
    expect(at(7)).toBe(1);
    expect(at(14)).toBe(2);
    expect(at(21)).toBe(3);
    expect(at(28)).toBe(3);
    expect(at(35)).toBe(3);
  });

  it("are used only once the week's naps are gone, and keep the run going", () => {
    // 14 care days Mon 09-21 to Sun 10-04 (2 blankets), then a quiet Mon-Thu: nap, nap, blanket, blanket
    const result = compute({ today: "2026-10-09", showedUp: [...span("2026-09-21", 14), "2026-10-09"] });
    expect(span("2026-10-05", 4).map((d) => kindOf(result, d))).toEqual(["nap", "nap", "blanket", "blanket"]);
    expect(kindOf(result, "2026-10-09")).toBe("showed_up");
    expect(result.run).toMatchObject({ length: 19, startedOn: "2026-09-21", blankets: 0, napsLeftThisWeek: 0 });
    expect(result.chapters).toEqual([]);
  });

  it("cover about five quiet days with Steady naps, in line with Graceful Hibernation (R6)", () => {
    // 21 care days ending Sunday 10-04 (3 blankets): Mon-Fri quiet is 2 naps + 3 blankets, Saturday is a chapter
    const result = compute({ today: "2026-10-11", showedUp: span("2026-09-14", 21) });
    expect(span("2026-10-05", 6).map((d) => kindOf(result, d))).toEqual(["nap", "nap", "blanket", "blanket", "blanket", "open"]);
    expect(result.chapters).toEqual([{ from: "2026-09-14", to: "2026-10-09", length: 26 }]);
  });
});

describe("R4: covered days", () => {
  it("cover a quiet day without spending a nap or a blanket, and count toward the run", () => {
    const covered = span("2026-10-06", 4); // Tue-Fri
    const result = compute({ today: MON, showedUp: ["2026-10-05", MON], covered });
    expect(span("2026-10-06", 6).map((d) => kindOf(result, d))).toEqual(["covered", "covered", "covered", "covered", "nap", "nap"]);
    expect(result.run).toMatchObject({ length: 8, startedOn: "2026-10-05", napsLeftThisWeek: 2 });
  });

  it("a care day wins over covered, and covered today counts without being open", () => {
    const result = compute({ today: "2026-10-15", showedUp: span(MON, 3), covered: ["2026-10-13", "2026-10-15"] });
    expect(kindOf(result, "2026-10-13")).toBe("showed_up");
    expect(kindOf(result, "2026-10-15")).toBe("covered");
    expect(result.run).toMatchObject({ length: 4, todayCounted: true });
  });

  it("outside a run they are shown but start nothing", () => {
    const result = compute({ today: "2026-10-15", covered: ["2026-10-13"] });
    expect(kindOf(result, "2026-10-13")).toBe("covered");
    expect(result.run.length).toBe(0);
    expect(result.daysTogether).toBe(0);
  });
});

describe("R5: Cozy Pause", () => {
  it("freezes the run: nothing spent, nothing counted", () => {
    const result = compute({ today: MON, showedUp: ["2026-10-05", MON], pauses: [{ from: "2026-10-06", to: "2026-10-10" }] });
    expect(span("2026-10-06", 6).map((d) => kindOf(result, d))).toEqual(["paused", "paused", "paused", "paused", "paused", "nap"]);
    expect(result.run).toMatchObject({ length: 3, startedOn: "2026-10-05" });
    expect(result.pausedUntil).toBeNull();
  });

  it("ends by itself on her first care day back", () => {
    const result = compute({ today: "2026-10-10", showedUp: ["2026-10-05", "2026-10-08"], pauses: [{ from: "2026-10-06", to: "2026-10-15" }] });
    expect(span("2026-10-06", 5).map((d) => kindOf(result, d))).toEqual(["paused", "paused", "showed_up", "nap", "today_open"]);
    expect(result.pausedUntil).toBeNull();
  });

  it("covers today and says until when; a care day on the day it began does not end it", () => {
    const pauses = [{ from: "2026-10-14", to: "2026-10-20" }];
    const result = compute({ today: "2026-10-15", showedUp: ["2026-10-13", "2026-10-14"], pauses });
    expect(kindOf(result, "2026-10-14")).toBe("showed_up");
    expect(kindOf(result, "2026-10-15")).toBe("paused");
    expect(result.pausedUntil).toBe("2026-10-20");
    expect(result.run).toMatchObject({ length: 2, todayCounted: false });
  });

  it("started on a day that already counted, still covers the quiet days asked for", () => {
    // a 1-day pause chosen after caring today runs today..tomorrow (startPause with todayCounted), so tomorrow is
    // paused rather than spending a nap
    const result = compute({ today: "2026-10-16", showedUp: ["2026-10-14", "2026-10-15"], pauses: [{ from: "2026-10-15", to: "2026-10-16" }] });
    expect(kindOf(result, "2026-10-15")).toBe("showed_up");
    expect(kindOf(result, "2026-10-16")).toBe("paused");
    // and a 30-day pause started on a cared day still covers 30 quiet days, not 29
    const long = compute({ today: "2026-10-15", showedUp: ["2026-09-10", "2026-09-11"], pauses: [{ from: "2026-09-11", to: "2026-12-31" }] });
    expect(kindOf(long, "2026-10-11")).toBe("paused");
    expect(kindOf(long, "2026-10-12")).toBe("nap");
  });

  it("is never longer than 30 days, whatever is stored", () => {
    const result = compute({ today: "2026-10-15", showedUp: ["2026-09-10"], pauses: [{ from: "2026-09-11", to: "2026-12-31" }] });
    expect(kindOf(result, "2026-10-10")).toBe("paused"); // the 30th day
    expect(kindOf(result, "2026-10-11")).toBe("nap");
    expect(result.pausedUntil).toBeNull();
  });

  it("ignores ranges that are not ranges", () => {
    const pauses = [{ from: "2026-10-14", to: "2026-10-13" }, { from: "x", to: "y" }, null] as any;
    expect(compute({ today: "2026-10-15", showedUp: [MON], pauses }).pausedUntil).toBeNull();
  });
});

describe("R6: chapters, never broken", () => {
  it("keeps each run that ran out of protection as a chapter, oldest first", () => {
    // two care days back each time, so no mend joins them up
    const showedUp = [...span("2026-09-01", 3), ...span("2026-09-14", 2), ...span("2026-10-14", 2)];
    const result = compute({ today: "2026-10-15", showedUp });
    expect(result.chapters).toEqual([
      { from: "2026-09-01", to: "2026-09-05", length: 5 },
      { from: "2026-09-14", to: "2026-09-17", length: 4 },
    ]);
    expect(chapterLine(1, result.chapters[1], "Biscuit")).toBe("Chapter 2: 4 days with Biscuit");
    expect(chapterRange(result.chapters[0])).toBe("1 Sep – 5 Sep");
    expect(result.run).toMatchObject({ length: 2, startedOn: "2026-10-14" });
  });
});

describe("R7: mend the thread", () => {
  // Run 1: Tue 09-01 to Thu 09-03, Fri + Sat napped, Sunday 09-06 had nothing left: a 5-day chapter.
  // She is back on Monday 09-14.
  const RUN_ONE = span("2026-09-01", 3);
  const CHAPTER = { from: "2026-09-01", to: "2026-09-05", length: 5 };

  it("3 care days in the first 5 back reconnect the last run", () => {
    const result = compute({ today: "2026-09-17", showedUp: [...RUN_ONE, "2026-09-14", "2026-09-15", "2026-09-17"] });
    expect(kindOf(result, "2026-09-16")).toBe("nap");
    expect(result.chapters).toEqual([]);
    expect(result.run).toMatchObject({ length: 9, startedOn: "2026-09-01", todayCounted: true });
    expect(result.mend).toEqual({ available: false, needed: 3, progress: 0, lastMendedOn: "2026-09-17" });
    // the days between stay blank paper
    expect(span("2026-09-06", 8).every((d) => kindOf(result, d) === "open")).toBe(true);
  });

  it("is offered while it can still happen, with progress", () => {
    const tuesday = compute({ today: "2026-09-15", showedUp: [...RUN_ONE, "2026-09-14", "2026-09-15"] });
    expect(tuesday.chapters).toEqual([CHAPTER]);
    expect(tuesday.mend).toMatchObject({ available: true, needed: 3, progress: 2 });
    expect(mendLine(tuesday, "Biscuit")).toContain("your last run (5 days) joins this one");

    const wednesdayOpen = compute({ today: "2026-09-16", showedUp: [...RUN_ONE, "2026-09-14", "2026-09-15"] });
    expect(wednesdayOpen.mend).toMatchObject({ available: true, progress: 2 });

    // one care day back, then three covered days: on the fifth day 3 care days can no longer fit
    const late = compute({ today: "2026-09-18", showedUp: [...RUN_ONE, "2026-09-14"], covered: span("2026-09-15", 3) });
    expect(late.mend).toMatchObject({ available: false, progress: 0 });
    expect(mendLine(late, "Biscuit")).toBeNull();
  });

  it("does not reach past the first 5 days back", () => {
    const covered = span("2026-09-16", 3); // keeps the new run alive without care days
    const result = compute({ today: "2026-09-19", showedUp: [...RUN_ONE, "2026-09-14", "2026-09-15", "2026-09-19"], covered });
    expect(result.chapters).toEqual([CHAPTER]);
    expect(result.run).toMatchObject({ length: 6, startedOn: "2026-09-14" });
    expect(result.mend.available).toBe(false);

    const fifthDay = compute({ today: "2026-09-18", showedUp: [...RUN_ONE, "2026-09-14", "2026-09-15"], covered });
    expect(fifthDay.mend).toMatchObject({ available: true, progress: 2 });
  });

  it("happens at most once every 30 days, counting the one the device remembers", () => {
    const showedUp = [...RUN_ONE, "2026-09-14", "2026-09-15", "2026-09-17"];
    const recent = compute({ today: "2026-09-17", showedUp, mendUsedOn: "2026-09-01" });
    expect(recent.chapters).toEqual([CHAPTER]);
    expect(recent.run).toMatchObject({ length: 4, startedOn: "2026-09-14" });
    expect(compute({ today: "2026-09-15", showedUp: showedUp.slice(0, 5), mendUsedOn: "2026-09-01" }).mend.available).toBe(false);

    const longAgo = compute({ today: "2026-09-17", showedUp, mendUsedOn: "2026-08-10" });
    expect(longAgo.chapters).toEqual([]);
    expect(longAgo.run.startedOn).toBe("2026-09-01");

    // the remembered mend itself replays as it happened
    expect(compute({ today: "2026-09-17", showedUp, mendUsedOn: "2026-09-17" }).run.startedOn).toBe("2026-09-01");
  });

  it("a second mend inside 30 days of the first does not happen", () => {
    // mended on 09-17; Fri 09-18 napped, Sat 09-19 had nothing left; back Mon 09-21 for three days
    const showedUp = [...RUN_ONE, "2026-09-14", "2026-09-15", "2026-09-17", ...span("2026-09-21", 3)];
    const result = compute({ today: "2026-09-23", showedUp });
    expect(result.chapters).toEqual([{ from: "2026-09-01", to: "2026-09-18", length: 10 }]);
    expect(result.run).toMatchObject({ length: 3, startedOn: "2026-09-21" });
    expect(result.mend).toMatchObject({ available: false, lastMendedOn: "2026-09-17" });
  });
});

describe("pace changes never rewrite weeks already lived", () => {
  // Monday 10-05 care, Tue + Wed napped (Steady), then care every day Thu 10-08 to Thu 10-15. A recent mend
  // is remembered, so no mend can join runs up and hide the difference.
  const showedUp = ["2026-10-05", ...span("2026-10-08", 8)];
  const mendUsedOn = "2026-10-01";

  it("without a history the pace applies to every week", () => {
    const result = compute({ today: "2026-10-15", pace: "daily", showedUp, mendUsedOn });
    expect(result.chapters).toEqual([{ from: "2026-10-05", to: "2026-10-06", length: 2 }]);
    expect(result.run).toMatchObject({ length: 8, startedOn: "2026-10-08" });
  });

  it("with a history each pace holds from the day it was chosen", () => {
    const result = compute({ today: "2026-10-15", pace: "daily", paceHistory: [{ from: "2026-10-15", pace: "daily" }], showedUp, mendUsedOn });
    expect(result.chapters).toEqual([]);
    expect(result.run).toMatchObject({ length: 11, startedOn: "2026-10-05", napsLeftThisWeek: 1 });
  });

  it("a change mid-week keeps the naps already taken", () => {
    // Sunday care, Mon + Tue napped on Steady, Gentle from Wednesday: one more nap this week
    const result = compute({
      today: "2026-10-14",
      pace: "gentle",
      paceHistory: [{ from: "2026-10-14", pace: "gentle" }],
      showedUp: ["2026-10-11", "2026-10-14"],
    });
    expect(result.run).toMatchObject({ length: 4, napsLeftThisWeek: 1 });
  });
});

describe("R8: Days Together milestones", () => {
  it("celebrates every day of the first week, then the bigger moments", () => {
    expect(nextMilestone(0)).toEqual({ at: 1, label: "Your first day together" });
    expect(nextMilestone(1)).toEqual({ at: 2, label: "2 days together" });
    expect(nextMilestone(6)).toEqual({ at: 7, label: "A whole week together" });
    expect(nextMilestone(7)).toEqual({ at: 14, label: "Two weeks together" });
    expect(nextMilestone(29)).toEqual({ at: 30, label: "A month together" });
    expect(nextMilestone(30)?.at).toBe(50);
    expect(nextMilestone(100)?.at).toBe(150);
    expect(nextMilestone(200)).toEqual({ at: 365, label: "A whole year together" });
    expect(nextMilestone(365)).toBeNull();
    expect(nextMilestone(Number.NaN)?.at).toBe(1);
  });

  it("follow Days Together, not the run", () => {
    const showedUp = [...span("2026-09-01", 3), ...span("2026-10-14", 2)];
    const result = compute({ today: "2026-10-15", showedUp });
    expect(result.run.length).toBe(2);
    expect(result.nextMilestone?.at).toBe(6);
    expect(milestoneLine(result.nextMilestone)).toBe("Next little celebration: 6 days together");
  });
});

describe("the calendar", () => {
  it("lays the last weeks out Monday to Sunday, the current week last, days ahead empty", () => {
    const result = compute({ today: "2026-10-15", showedUp: span(MON, 3) });
    const weeks = stampWeeks(result.days, "2026-10-15");
    expect(weeks).toHaveLength(4);
    expect(weeks.every((row) => row.length === 7)).toBe(true);
    expect(weeks[0][0].day).toBe("2026-09-21");
    expect(dayLabel(weeks[0][0].day)).toBe("Monday 21 September");
    expect(weeks[3].map((cell) => cell.kind)).toEqual(["showed_up", "showed_up", "showed_up", "today_open", null, null, null]);
    expect(weeks[3][3].isToday).toBe(true);
    expect(weeks.flat().filter((cell) => cell.isToday)).toHaveLength(1);
  });

  it("works when today is a Sunday or a Monday", () => {
    expect(stampWeeks([], "2026-10-18")[3].map((cell) => cell.kind)).toEqual(Array(7).fill("open"));
    expect(stampWeeks([], MON)[3][0]).toEqual({ day: MON, kind: "open", isToday: true });
    expect(stampWeeks([], "not a day")).toEqual([]);
  });
});

describe("R9: the words", () => {
  const varied = compute({
    today: "2026-10-15",
    showedUp: [...span("2026-09-01", 3), ...span("2026-09-14", 2), "2026-09-28", ...span("2026-10-12", 2)],
    covered: ["2026-10-01"],
    pauses: [{ from: "2026-10-14", to: "2026-10-20" }],
  });

  it("never calls a quiet day a miss anywhere in the result", () => {
    expect(JSON.stringify(varied)).not.toMatch(/miss|broke|lost|fail/i);
    for (const day of varied.days) expect(ALL_KINDS).toContain(day.kind);
  });

  it("keeps every line warm: no breaking, losing, missing, streaks or countdowns", () => {
    const lines: string[] = [];
    for (const kind of ALL_KINDS) lines.push(stampLabel(kind, "Biscuit"), stampLabel(kind, ""), STAMP_LEGEND[kind]);
    for (const n of [0, 1, 2, 3]) lines.push(napsLeftLine(n, "Biscuit"), blanketsLine(n), cozyRunHeadline(n), daysTogetherLine(n));
    for (const option of PACE_OPTIONS) lines.push(option.label, option.blurb);
    for (const days of PAUSE_OPTIONS) lines.push(pauseOptionLabel(days));
    for (const n of [0, 1, 6, 7, 13, 29, 49, 99, 364]) lines.push(milestoneLine(nextMilestone(n)) ?? "");
    const fresh = compute({ today: "2026-10-15" });
    const counted = compute({ today: "2026-10-15", showedUp: span(MON, 4) });
    const open = compute({ today: "2026-10-15", showedUp: span(MON, 3) });
    const mending = compute({ today: "2026-09-15", showedUp: [...span("2026-09-01", 3), "2026-09-14", "2026-09-15"] });
    for (const result of [fresh, counted, open, varied, mending]) lines.push(runSubline(result, "Biscuit"), mendLine(result, "Biscuit") ?? "");
    lines.push(...varied.chapters.map((chapter, i) => chapterLine(i, chapter, "Biscuit")));
    for (const line of lines) expect(line).not.toMatch(BANNED);
    expect(runSubline(varied, "Biscuit")).toBe("Resting until Tue 20 Oct. Nothing is spent while you rest.");
    expect(runSubline(open, "Biscuit")).toBe("Today is still open, whenever you're ready.");
    expect(stampLabel("nap", "Biscuit")).toBe("Biscuit napped with you");
  });

  it("never says why a day was covered", () => {
    for (const kind of ALL_KINDS) expect(stampLabel(kind, "Biscuit")).not.toMatch(/period|cycle|menstru|bleed|flow/i);
    expect(STAMP_LEGEND.covered).not.toMatch(/period|cycle|menstru/i);
  });

  it("the sheet has no banned words, no red and no hard-coded hex", () => {
    const source = fs.readFileSync(path.resolve(__dirname, "../components/home/CozyRunSheet.tsx"), "utf8");
    const code = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1");
    expect(code).not.toMatch(BANNED);
    expect(code).not.toMatch(/#[0-9a-f]{3,8}\b/i);
    expect(code).not.toMatch(/\.alert\b|close-circle|"close"|\bred\b/i);
    expect(code).not.toMatch(/cycleStore|useCycle/);
  });

  it("the sheet's Ionicons glyphs exist", () => {
    const source = fs.readFileSync(path.resolve(__dirname, "../components/home/CozyRunSheet.tsx"), "utf8");
    const glyphs = JSON.parse(
      fs.readFileSync(path.resolve(__dirname, "../../node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons/glyphmaps/Ionicons.json"), "utf8")
    );
    const used = [...source.matchAll(/(?:icon=|name=\{?)"([a-z-]+-outline)"/g)].map((match) => match[1]);
    expect(used.length).toBeGreaterThanOrEqual(3);
    for (const name of used) expect(glyphs[name]).toBeDefined();
  });
});

// ---- the store -------------------------------------------------------------------------------------------

describe("cozyRunStore", () => {
  const UID = "user-1";
  const metric = (day: string, tasks: number, checkins: number, user = UID): MetricRow => ({ user_id: user, day, tasks_completed: tasks, checkins_completed: checkins });
  let warnSpy: jest.SpyInstance;

  beforeEach(async () => {
    await AsyncStorage.clear();
    mockDb.rows = [];
    mockDb.offline = false;
    mockDb.pages = 0;
    mockDb.gate = null;
    warnSpy = jest.spyOn(console, "warn").mockImplementation(() => undefined);
  });

  afterEach(() => warnSpy.mockRestore());

  it("merges server care days, this person's battery answers and marked days; defaults for the rest", async () => {
    mockDb.rows = [metric("2026-10-10", 2, 0), metric("2026-10-11", 0, 1), metric("2026-10-12", 0, 0), metric("2026-10-09", 3, 0, "someone-else")];
    await AsyncStorage.setItem(`floura:energy:${UID}:2026-10-13`, "calm");
    await AsyncStorage.setItem(`floura:energy:${UID}:2026-10-11`, "anxious");
    await AsyncStorage.setItem("floura:energy:someone-else:2026-10-08", "calm");
    await AsyncStorage.setItem(`floura:energy:${UID}:garbage`, "calm");
    await markShowedUp(UID, "2026-10-14");
    await markShowedUp(UID, "not a day");

    const input = await loadCozyRunInput(UID, "2026-10-15");
    expect(input).toEqual({ showedUp: ["2026-10-10", "2026-10-11", "2026-10-13", "2026-10-14"], pace: "steady", paceHistory: [], pauses: [], mendUsedOn: null, complete: true });
    expect(computeCozyRun({ ...input, today: "2026-10-15", covered: [] }).daysTogether).toBe(4);
  });

  it("degrades to what the device knows when the server cannot be read, and never throws", async () => {
    mockDb.rows = [metric("2026-10-10", 1, 0), metric("2026-10-11", 1, 0)];
    await loadCozyRunInput(UID, "2026-10-15"); // caches the server days
    mockDb.offline = true;
    await AsyncStorage.setItem(`floura:energy:${UID}:2026-10-12`, "calm");
    const input = await loadCozyRunInput(UID, "2026-10-15");
    expect(input.showedUp).toEqual(["2026-10-10", "2026-10-11", "2026-10-12"]);
    expect(warnSpy).toHaveBeenCalled();

    await AsyncStorage.setItem(`floura:cozy-run:${UID}`, "{not json");
    await expect(loadCozyRunInput(UID, "2026-10-15")).resolves.toMatchObject({ pace: "steady", pauses: [] });
    await expect(loadCozyRunInput("", "2026-10-15")).resolves.toMatchObject({ showedUp: [] });
  });

  it("keeps a day marked while the server is still answering", async () => {
    mockDb.rows = [metric("2026-10-10", 1, 0)];
    let answer: () => void = () => undefined;
    mockDb.gate = new Promise<void>((resolve) => (answer = resolve));
    const loading = loadCozyRunInput(UID, "2026-10-15");
    await markShowedUp(UID, "2026-10-15"); // a tap on "I'm here" while Home is still loading
    answer();
    await loading;
    mockDb.gate = null;
    mockDb.offline = true;
    expect((await loadCozyRunInput(UID, "2026-10-15")).showedUp).toEqual(["2026-10-10", "2026-10-15"]);
  });

  it("reads every page of a long history", async () => {
    mockDb.rows = Array.from({ length: 1001 }, (_, i) => metric(addCareDays("2023-01-01", i), 1, 0));
    const input = await loadCozyRunInput(UID, "2026-10-15");
    expect(input.showedUp).toHaveLength(1001);
    expect(mockDb.pages).toBe(2);
  });

  it("leaves out days far ahead of today (a wrong clock), keeps one day ahead (a time-zone hop)", async () => {
    mockDb.rows = [metric("2026-10-16", 1, 0), metric("2026-10-20", 1, 0)];
    expect((await loadCozyRunInput(UID, "2026-10-15")).showedUp).toEqual(["2026-10-16"]);
  });

  it("saves the pace from today on, keeping the weeks before", async () => {
    await savePace(UID, "steady", "2026-10-01"); // the default: nothing to record
    expect(await loadCozyRunInput(UID, "2026-10-15")).toMatchObject({ pace: "steady", paceHistory: [] });
    await savePace(UID, "gentle", "2026-10-05");
    await savePace(UID, "daily", "2026-10-12");
    await savePace(UID, "gentle", "2026-10-12"); // changed her mind the same day
    await savePace(UID, "bogus" as any, "2026-10-13");
    const input = await loadCozyRunInput(UID, "2026-10-15");
    expect(input.pace).toBe("gentle");
    expect(input.paceHistory).toEqual([{ from: "2026-10-05", pace: "gentle" }]);
    await savePace(UID, "daily", "2026-10-15");
    expect((await loadCozyRunInput(UID, "2026-10-15")).paceHistory).toEqual([
      { from: "2026-10-05", pace: "gentle" },
      { from: "2026-10-15", pace: "daily" },
    ]);
  });

  it("starts a 1-30 day pause from today, replaces a running one, and ends it with I'm back", async () => {
    expect(await startPause(UID, "2026-10-01", 0)).toEqual({ from: "2026-10-01", to: "2026-10-01" });
    expect(await startPause(UID, "2026-10-10", 3)).toEqual({ from: "2026-10-10", to: "2026-10-12" });
    // two days in, she picks a longer one: the running pause keeps its past and gives way
    expect(await startPause(UID, "2026-10-12", 99)).toEqual({ from: "2026-10-12", to: "2026-11-10" });
    expect((await loadCozyRunInput(UID, "2026-10-15")).pauses).toEqual([
      { from: "2026-10-01", to: "2026-10-01" },
      { from: "2026-10-10", to: "2026-10-11" },
      { from: "2026-10-12", to: "2026-11-10" },
    ]);
    await endPause(UID, "2026-10-15");
    expect((await loadCozyRunInput(UID, "2026-10-15")).pauses.slice(-1)).toEqual([{ from: "2026-10-12", to: "2026-10-14" }]);

    // a pause begun and ended on the same day leaves nothing behind
    await startPause(UID, "2026-10-20", 7);
    await endPause(UID, "2026-10-20");
    expect((await loadCozyRunInput(UID, "2026-10-20")).pauses).toHaveLength(3);
  });

  it("remembers the latest mend and only moves it forward", async () => {
    await rememberMend(UID, "2026-09-17");
    await rememberMend(UID, "2026-08-01");
    await rememberMend(UID, null);
    expect((await loadCozyRunInput(UID, "2026-10-15")).mendUsedOn).toBe("2026-09-17");
    await rememberMend(UID, "2026-10-20");
    expect((await loadCozyRunInput(UID, "2026-10-21")).mendUsedOn).toBe("2026-10-20");
  });

  it("a paused run read back from the store tells the same story", async () => {
    await markShowedUp(UID, "2026-10-13");
    await markShowedUp(UID, "2026-10-14");
    await startPause(UID, "2026-10-14", 7);
    const input = await loadCozyRunInput(UID, "2026-10-15");
    const result = computeCozyRun({ ...input, today: "2026-10-15", covered: [] });
    expect(result.pausedUntil).toBe("2026-10-20");
    expect(kindOf(result, "2026-10-15")).toBe("paused");
    expect(result.run.length).toBe(2);
  });
});
