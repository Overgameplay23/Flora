// Plan Engine v1: the catalog's promises, the daily selection rules, and the device/Supabase glue. The
// Supabase client is a small in-memory fake and AsyncStorage is the library's own mock, so nothing here
// touches the network or a device.
jest.mock("../lib/supabase", () => ({ supabase: { from: (table: string) => mockFrom(table) } }));
jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);

import fs from "fs";
import path from "path";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  DEFAULT_PLAN_SETTINGS,
  FOCUS_AREAS,
  PLAN_CATALOG,
  buildDailyPlan,
  catalogById,
  catalogIdForTitle,
  dayPartForHour,
  normalizePlanSettings,
  planProgress,
  renderTitle,
  type CareCategory,
  type DayPart,
  type FocusArea,
  type PlanInput,
  type TaskKind,
} from "../domain/plan";
import { isPlayTask, playTaskTitle } from "../games/playStatsLogic";
import {
  ensurePlanTaskRows,
  loadPlanHistory,
  loadPlanSettings,
  loadTodayEnergy,
  recordPlanShown,
  savePlanSettings,
  saveTodayEnergy,
} from "../services/planStore";
import { addDaysToDateKey } from "../utils/dateKeys";

// ---------- in-memory Supabase ----------

type Row = Record<string, any>;
let mockDb: { tasks: Row[]; task_completions: Row[]; nextId: number; offline: boolean; deletes: number };

function resetDb() {
  mockDb = { tasks: [], task_completions: [], nextId: 1, offline: false, deletes: 0 };
}

function mockFrom(table: string) {
  const filters: Array<(row: Row) => boolean> = [];
  let op: "select" | "insert" | "update" | "delete" = "select";
  let payload: any = null;
  let columns = "*";
  const run = () => {
    if (mockDb.offline) return { data: null, error: { message: "Network request failed" } };
    const rows: Row[] = (mockDb as any)[table];
    if (op === "insert") {
      for (const row of Array.isArray(payload) ? payload : [payload]) rows.push({ id: mockDb.nextId++, active: true, sort_order: 0, ...row });
      return { data: null, error: null };
    }
    const matching = rows.filter((row) => filters.every((keep) => keep(row)));
    if (op === "update") {
      matching.forEach((row) => Object.assign(row, payload));
      return { data: null, error: null };
    }
    if (op === "delete") {
      mockDb.deletes += 1;
      return { data: null, error: null };
    }
    const cols = columns === "*" ? null : columns.split(",").map((c) => c.trim());
    return { data: matching.map((row) => (cols ? Object.fromEntries(cols.map((c) => [c, row[c]])) : { ...row })), error: null };
  };
  const builder: any = {
    select(cols?: string) {
      if (op === "select") columns = cols || "*";
      return builder;
    },
    eq: (col: string, value: unknown) => (filters.push((row) => row[col] === value), builder),
    gte: (col: string, value: string) => (filters.push((row) => row[col] != null && row[col] >= value), builder),
    lt: (col: string, value: string) => (filters.push((row) => row[col] != null && row[col] < value), builder),
    in: (col: string, values: unknown[]) => (filters.push((row) => values.includes(row[col])), builder),
    order: () => builder,
    insert: (rows: unknown) => ((op = "insert"), (payload = rows), builder),
    update: (patch: unknown) => ((op = "update"), (payload = patch), builder),
    delete: () => ((op = "delete"), builder),
    then: (resolve: any, reject: any) => Promise.resolve().then(run).then(resolve, reject),
  };
  return builder;
}

// ---------- fixtures ----------

const ALL_AREAS: FocusArea[] = ["calm_mind", "burnout", "get_going", "sleep", "body_basics", "self_kindness", "low_mood", "cycle", "connection", "space_admin"];
const ALL_PARTS: DayPart[] = ["morning", "day", "evening", "night"];
const ALL_KINDS: TaskKind[] = ["tap", "timer", "breathing", "journal", "play", "checkin"];
const ALL_CATEGORIES: CareCategory[] = ["calm", "rest", "energy", "focus", "body", "nourish", "connection", "cycle", "play"];
const TODAY = "2026-10-15";
const IONICONS_GLYPHS = path.resolve(__dirname, "..", "..", "node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons/glyphmaps/Ionicons.json");

function input(patch: Partial<PlanInput> = {}): PlanInput {
  return {
    settings: { focusAreas: ["sleep", "calm_mind"], dailyCount: 4 },
    dateKey: TODAY,
    hour: 9,
    energy: null,
    returning: false,
    memorial: false,
    cyclePhase: null,
    history: {},
    seed: "user-1",
    ...patch,
  };
}

const ids = (plan: ReturnType<typeof buildDailyPlan>) => plan.map((item) => item.task.id);
const fits = (dayParts: DayPart[] | "any", part: DayPart) => dayParts === "any" || dayParts.includes(part);

// ---------- catalog ----------

describe("plan catalog", () => {
  it("has 45-60 tasks with unique ids and unique titles", () => {
    expect(PLAN_CATALOG.length).toBeGreaterThanOrEqual(45);
    expect(PLAN_CATALOG.length).toBeLessThanOrEqual(60);
    expect(new Set(PLAN_CATALOG.map((t) => t.id)).size).toBe(PLAN_CATALOG.length);
    expect(new Set(PLAN_CATALOG.map((t) => t.title.trim().toLowerCase())).size).toBe(PLAN_CATALOG.length);
    for (const task of PLAN_CATALOG) expect(catalogById(task.id)).toBe(task);
    expect(catalogById("nope")).toBeUndefined();
  });

  it("uses only Ionicons glyphs that exist", () => {
    const glyphs = JSON.parse(fs.readFileSync(IONICONS_GLYPHS, "utf8")) as Record<string, number>;
    const missing = [...PLAN_CATALOG.map((t) => t.icon), ...FOCUS_AREAS.map((a) => a.icon)].filter((name) => !(name in glyphs));
    expect(missing).toEqual([]);
  });

  it("reuses the three seed titles exactly and keeps the play task findable by isPlayTask", () => {
    const titles = PLAN_CATALOG.map((t) => t.title);
    expect(titles).toEqual(expect.arrayContaining(["Drink water", "Go outside / get sunlight", "10-minute focus session"]));
    const play = PLAN_CATALOG.filter((t) => isPlayTask(renderTitle(t, "Biscuit")));
    expect(play.map((t) => t.title)).toEqual(["Play with {pet}"]);
    expect(play[0]).toMatchObject({ kind: "play", route: "PlayFetch", category: "play", memorialSafe: false });
    expect(renderTitle(play[0], "Biscuit")).toBe(playTaskTitle("Biscuit"));
    expect(renderTitle(play[0], "")).toBe(playTaskTitle(""));
    // "$" in a name is text, not a replacement pattern
    expect(renderTitle(play[0], "Ca$$ie $&")).toBe(playTaskTitle("Ca$$ie $&"));
    expect(catalogIdForTitle(playTaskTitle("Ca$$ie $&"), "Ca$$ie $&")).toBe("pet.play");
  });

  it("routes each screen kind to its screen", () => {
    for (const task of PLAN_CATALOG) {
      if (task.kind === "breathing") expect({ id: task.id, route: task.route }).toEqual({ id: task.id, route: "Breathing" });
      if (task.kind === "journal") expect({ id: task.id, route: task.route }).toEqual({ id: task.id, route: "Journal" });
      if (task.kind === "checkin") expect({ id: task.id, route: task.route }).toEqual({ id: task.id, route: "CheckIn" });
      if (task.kind === "play") expect({ id: task.id, route: task.route }).toEqual({ id: task.id, route: "PlayFetch" });
    }
  });

  it("covers every area, part of the day, kind, colour and effort", () => {
    for (const area of ALL_AREAS) expect({ area, n: PLAN_CATALOG.filter((t) => (t.focus[area] || 0) > 0).length > 0 }).toEqual({ area, n: true });
    for (const part of ALL_PARTS) expect(PLAN_CATALOG.some((t) => t.dayParts !== "any" && t.dayParts.includes(part))).toBe(true);
    expect(new Set(PLAN_CATALOG.map((t) => t.kind))).toEqual(new Set(ALL_KINDS));
    expect(new Set(PLAN_CATALOG.map((t) => t.category))).toEqual(new Set(ALL_CATEGORIES));
    expect(new Set(PLAN_CATALOG.map((t) => t.effort))).toEqual(new Set([1, 2, 3]));
    for (const task of PLAN_CATALOG) {
      for (const weight of Object.values(task.focus)) expect(weight).toBeGreaterThan(0);
      for (const weight of Object.values(task.focus)) expect(weight).toBeLessThanOrEqual(1);
      expect(task.minutes).toBeGreaterThan(0);
      if (task.dayParts !== "any") expect(task.dayParts.length).toBeGreaterThan(0);
    }
  });

  it("has at least 4 gentle tasks per area, and gentle always means tiny", () => {
    for (const area of ALL_AREAS) {
      const gentle = PLAN_CATALOG.filter((t) => (t.focus[area] || 0) > 0 && t.lowEnergySafe && !t.premium);
      expect({ area, enough: gentle.length >= 4 }).toEqual({ area, enough: true });
    }
    for (const task of PLAN_CATALOG.filter((t) => t.lowEnergySafe)) {
      expect({ id: task.id, tiny: task.effort === 1 && task.minutes <= 5 }).toEqual({ id: task.id, tiny: true });
    }
  });

  it("keeps rhythm-care tasks neutral, since their titles reach the database", () => {
    const cycleTasks = PLAN_CATALOG.filter((t) => t.category === "cycle");
    expect(cycleTasks.length).toBeGreaterThanOrEqual(4);
    for (const task of cycleTasks) expect(task.focus).toEqual({ cycle: 1 });
    for (const task of PLAN_CATALOG) {
      // the client-side rule plus the pgTAP guard's word list (04_cycle_stays_on_device.test.sql)
      for (const text of [task.id, task.title, task.tinyTitle || ""]) {
        expect({ id: task.id, text, leaks: /period|cycle|menstru|pms|cramp|ovulat|fertil|luteal|follicul/i.test(text) }).toEqual({ id: task.id, text, leaks: false });
      }
    }
  });

  it("writes memorial-safe copy that never speaks as the pet or names it", () => {
    const memorial = PLAN_CATALOG.filter((t) => t.memorialSafe);
    expect(memorial.length).toBeGreaterThanOrEqual(12);
    for (const task of memorial) {
      expect({ id: task.id, ok: !task.title.includes("{pet}") && !task.petLine.includes("{pet}") }).toEqual({ id: task.id, ok: true });
      expect({ id: task.id, firstPerson: /\b(I|I'm|I'll|me|my)\b/.test(task.petLine) }).toEqual({ id: task.id, firstPerson: false });
    }
    expect(memorial.some((t) => t.kind === "journal")).toBe(true);
    expect(memorial.some((t) => t.kind === "play")).toBe(false);
  });

  it("speaks in a warm adult voice", () => {
    for (const task of PLAN_CATALOG) {
      expect(`${task.title} ${task.petLine}`).not.toMatch(/birb|skip|fail|missed|lazy|should have/i);
    }
  });
});

describe("focus areas", () => {
  it("lists the ten areas once each", () => {
    expect(FOCUS_AREAS.map((a) => a.id).sort()).toEqual([...ALL_AREAS].sort());
    for (const area of FOCUS_AREAS) {
      expect(area.label.length).toBeGreaterThan(0);
      expect(area.short.length).toBeGreaterThan(0);
      expect(area.blurb).toMatch(/\.$/);
      expect(ALL_CATEGORIES).toContain(area.category);
    }
    expect(normalizePlanSettings(DEFAULT_PLAN_SETTINGS)).toEqual(DEFAULT_PLAN_SETTINGS);
  });
});

describe("normalizePlanSettings", () => {
  it("falls back to the defaults for junk", () => {
    for (const raw of [null, undefined, 42, "junk", "{", [], { focusAreas: "sleep" }, { focusAreas: ["nope"] }]) {
      expect(normalizePlanSettings(raw)).toEqual(DEFAULT_PLAN_SETTINGS);
    }
  });

  it("keeps order, drops unknowns and duplicates, and stops at three", () => {
    expect(normalizePlanSettings({ focusAreas: ["sleep", "nope", "sleep", "cycle", "burnout", "low_mood"], dailyCount: 5 })).toEqual({
      focusAreas: ["sleep", "cycle", "burnout"],
      dailyCount: 5,
    });
  });

  it("parses JSON strings and the database's snake_case shape", () => {
    expect(normalizePlanSettings(JSON.stringify({ focusAreas: ["connection"], dailyCount: 3 }))).toEqual({ focusAreas: ["connection"], dailyCount: 3 });
    expect(normalizePlanSettings({ focus_areas: ["space_admin"], daily_count: 5 })).toEqual({ focusAreas: ["space_admin"], dailyCount: 5 });
  });

  it("clamps the daily count to 3-5 and ignores values that are not numbers", () => {
    const count = (dailyCount: unknown) => normalizePlanSettings({ focusAreas: ["sleep"], dailyCount }).dailyCount;
    expect(count(9)).toBe(5);
    expect(count(1)).toBe(3);
    expect(count(3.6)).toBe(4);
    expect(count("5")).toBe(5);
    expect(count(null)).toBe(4);
    expect(count("")).toBe(4);
    expect(count(Number.NaN)).toBe(4);
    expect(count(true)).toBe(4);
  });

  it("returns a fresh list, so callers cannot change the defaults", () => {
    const settings = normalizePlanSettings(null);
    settings.focusAreas.push("sleep");
    expect(DEFAULT_PLAN_SETTINGS.focusAreas).toEqual(["body_basics", "calm_mind"]);
  });
});

describe("catalogIdForTitle", () => {
  it("round-trips every catalog title, with and without the pet's name", () => {
    for (const task of PLAN_CATALOG) {
      expect(catalogIdForTitle(renderTitle(task, "Biscuit"), "Biscuit")).toBe(task.id);
      expect(catalogIdForTitle(renderTitle(task, "Biscuit"))).toBe(task.id);
    }
  });

  it("ignores case and spacing and still finds a row written under an earlier pet name", () => {
    expect(catalogIdForTitle("  drink   WATER ")).toBe("body.water");
    expect(catalogIdForTitle("Play with Max", "Biscuit")).toBe("pet.play");
    expect(catalogIdForTitle(playTaskTitle(""), "Biscuit")).toBe("pet.play");
    expect(catalogIdForTitle("Send someone a photo of Sir Fluff III", "Biscuit")).toBe("lift.pet_photo");
    expect(renderTitle(catalogById("pet.play")!, "Biscuit")).toBe("Play with Biscuit");
  });

  it("returns undefined for anything else", () => {
    expect(catalogIdForTitle("")).toBeUndefined();
    expect(catalogIdForTitle("Read 10 pages")).toBeUndefined();
    expect(catalogIdForTitle("Play with")).toBeUndefined();
    expect(catalogIdForTitle(undefined as any)).toBeUndefined();
  });
});

// ---------- selection ----------

describe("buildDailyPlan", () => {
  it("is deterministic: the same inputs give the same list", () => {
    const a = buildDailyPlan(input());
    const b = buildDailyPlan(input());
    expect(b).toEqual(a);
    expect(a.length).toBe(4);
  });

  it("varies between days and people, but keeps the anchor steady day to day", () => {
    const week = Array.from({ length: 7 }, (_, i) => buildDailyPlan(input({ dateKey: addDaysToDateKey(TODAY, i) })));
    expect(new Set(week.map((plan) => ids(plan).join(","))).size).toBeGreaterThan(1);
    const anchors = week.map((plan) => plan.find((item) => item.slot === "anchor")?.task.id);
    expect(anchors[0]).toBeDefined();
    expect(new Set(anchors).size).toBe(1);
    const people = ["a", "b", "c", "d", "e", "f"].map((seed) => ids(buildDailyPlan(input({ seed }))).join(","));
    expect(new Set(people).size).toBeGreaterThan(1);
  });

  it("starts with an anchor from the first area and gives every item a short reason", () => {
    const plan = buildDailyPlan(input());
    expect(plan[0].slot).toBe("anchor");
    expect(plan[0].task.focus.sleep).toBeGreaterThan(0);
    expect(plan[0].reason).toBe("Every day, for your sleep");
    for (const item of plan) {
      expect(item.reason.length).toBeGreaterThan(0);
      expect(item.reason.length).toBeLessThanOrEqual(32);
    }
    expect(plan.map((item) => item.slot)).toEqual(["anchor", "focus", "quick", "pet"]);
    expect(plan.find((item) => item.slot === "quick")!.task.minutes).toBeLessThanOrEqual(2);
  });

  it("stays within bounds, never repeats a task and respects every filter", () => {
    const words = /skip|fail|miss|behind|lazy/i;
    for (const areas of [["sleep"], ["burnout", "low_mood"], ["cycle", "get_going", "connection"], ["space_admin", "self_kindness", "body_basics"]] as FocusArea[][]) {
      for (const hour of [6, 9, 13, 18, 23, 3]) {
        for (const energy of [null, "exhausted", "anxious", "calm", "energized"] as PlanInput["energy"][]) {
          for (const memorial of [false, true]) {
            for (const dailyCount of [3, 4, 5] as const) {
              const plan = buildDailyPlan(input({ settings: { focusAreas: areas, dailyCount }, hour, energy, memorial, seed: `s-${hour}` }));
              const part = dayPartForHour(hour);
              expect(plan.length).toBeGreaterThanOrEqual(1);
              expect(plan.length).toBeLessThanOrEqual(5);
              expect(new Set(ids(plan)).size).toBe(plan.length);
              for (const { task, reason } of plan) {
                expect({ id: task.id, part, fits: fits(task.dayParts, part) }).toEqual({ id: task.id, part, fits: true });
                expect(task.premium).toBeFalsy();
                expect(reason).not.toMatch(words);
                if (memorial) expect({ id: task.id, memorialSafe: task.memorialSafe }).toEqual({ id: task.id, memorialSafe: true });
              }
            }
          }
        }
      }
    }
  });

  it("caps a drained, anxious or returning day at 3 tiny tasks", () => {
    for (const patch of [{ energy: "exhausted" as const }, { energy: "anxious" as const }, { returning: true }]) {
      const plan = buildDailyPlan(input({ settings: { focusAreas: ["get_going", "space_admin"], dailyCount: 5 }, ...patch }));
      expect(plan.length).toBe(3);
      for (const { task } of plan) {
        expect(task.lowEnergySafe).toBe(true);
        expect(task.effort).toBe(1);
        expect(task.minutes).toBeLessThanOrEqual(5);
      }
    }
  });

  it("never puts a night-only task in the morning", () => {
    const nightOnly = PLAN_CATALOG.filter((t) => t.dayParts !== "any" && t.dayParts.length === 1 && t.dayParts[0] === "night").map((t) => t.id);
    expect(nightOnly.length).toBeGreaterThan(0);
    for (const seed of ["a", "b", "c", "d", "e", "f", "g", "h"]) {
      const morning = buildDailyPlan(input({ seed, hour: 9, settings: { focusAreas: ["sleep"], dailyCount: 5 } }));
      expect(ids(morning).filter((id) => nightOnly.includes(id))).toEqual([]);
    }
    expect(dayPartForHour(9)).toBe("morning");
    expect(dayPartForHour(6)).toBe("morning");
    expect(dayPartForHour(14)).toBe("day");
    expect(dayPartForHour(19)).toBe("evening");
    expect(dayPartForHour(23)).toBe("night");
    expect(dayPartForHour(2)).toBe("night");
  });

  it("keeps memorial days to comfort tasks, with no pet slot", () => {
    for (const hour of [8, 13, 20, 23]) {
      const plan = buildDailyPlan(input({ memorial: true, hour, settings: { focusAreas: ["low_mood", "connection"], dailyCount: 5 } }));
      expect(plan.length).toBe(5);
      expect(plan.every((item) => item.task.memorialSafe)).toBe(true);
      expect(plan.some((item) => item.slot === "pet")).toBe(false);
    }
  });

  it("keeps pinned (done) tasks, and ticking one off does not reshuffle the rest", () => {
    const before = buildDailyPlan(input());
    const after = buildDailyPlan(input({ pinned: [before[1].task.id] }));
    expect(ids(after)).toEqual(ids(before));
    expect(after[1].slot).toBe(before[1].slot);

    // a task done earlier that today's plan would not pick (wrong time of day) is kept and counts toward the total
    const plan = buildDailyPlan(input({ hour: 9, pinned: ["sleep.phone_bed"] }));
    expect(plan[0]).toMatchObject({ slot: "pinned", reason: "Done today" });
    expect(plan[0].task.id).toBe("sleep.phone_bed");
    expect(plan.length).toBe(4);
    expect(new Set(ids(plan)).size).toBe(4);

    // more done than the day's count: every one is kept
    const done = ["body.water", "body.stretch", "focus.ten_minutes", "body.walk", "kind.compliment"];
    const busy = buildDailyPlan(input({ energy: "exhausted", pinned: [...done, "body.water", "not-a-task"] }));
    expect(ids(busy).sort()).toEqual([...done].sort());
  });

  it("grows the day after a strong week and shrinks it after a slow one", () => {
    const recent = addDaysToDateKey(TODAY, -2);
    const strong = Object.fromEntries(PLAN_CATALOG.slice(0, 6).map((t) => [t.id, { shown: 3, done: 3, lastShown: recent, consecutiveSkips: 0 }]));
    const slow = Object.fromEntries(PLAN_CATALOG.slice(0, 6).map((t) => [t.id, { shown: 3, done: 0, lastShown: recent, consecutiveSkips: 3 }]));
    expect(buildDailyPlan(input({ history: strong, energy: "energized" })).length).toBe(5);
    expect(buildDailyPlan(input({ history: strong, energy: "calm", settings: { focusAreas: ["sleep"], dailyCount: 5 } })).length).toBe(5);
    expect(buildDailyPlan(input({ history: strong, energy: null })).length).toBe(4);
    expect(buildDailyPlan(input({ history: slow, energy: "energized" })).length).toBe(3);
    // too little to go on: no change
    const thin = { "body.water": { shown: 1, done: 1, lastShown: recent, consecutiveSkips: 0 } };
    expect(buildDailyPlan(input({ history: thin, energy: "energized" })).length).toBe(4);
  });

  it("moves the anchor off a task that keeps being passed over, and toward one that gets done", () => {
    const anchor = buildDailyPlan(input())[0].task.id;
    const yesterday = addDaysToDateKey(TODAY, -1);
    const passedOver = buildDailyPlan(input({ history: { [anchor]: { shown: 4, done: 0, lastShown: yesterday, consecutiveSkips: 4 } } }));
    expect(passedOver[0].task.id).not.toBe(anchor);

    // with no history the 9am sleep anchor is the curtains; a breathing habit that always gets done takes over
    expect(anchor).toBe("sleep.curtains");
    const loved = buildDailyPlan(input({ history: { "calm.box_breath": { shown: 6, done: 6, lastShown: yesterday, consecutiveSkips: 0 } } }));
    expect(loved[0].task.id).toBe("calm.box_breath");
  });

  it("brings rhythm care forward on a period day and leaves it out for people who do not track it", () => {
    for (const seed of ["a", "b", "c", "d"]) {
      const plain = buildDailyPlan(input({ seed, settings: { focusAreas: ["body_basics", "burnout", "calm_mind"], dailyCount: 5 } }));
      expect(plain.some((item) => item.task.category === "cycle")).toBe(false);
    }
    const chosen = buildDailyPlan(input({ settings: { focusAreas: ["cycle", "sleep"], dailyCount: 4 }, cyclePhase: "period" }));
    expect(chosen[0].task.category).toBe("cycle");
    expect(chosen[0].reason).toBe("Every day, for your rhythm");
    const periodDays = ["a", "b", "c", "d", "e", "f"].filter((seed) =>
      buildDailyPlan(input({ seed, cyclePhase: "period", settings: { focusAreas: ["body_basics"], dailyCount: 5 } })).some((item) => item.task.category === "cycle")
    );
    expect(periodDays.length).toBeGreaterThan(0);
    // late in the cycle, big efforts step back
    const luteal = buildDailyPlan(input({ cyclePhase: "luteal", settings: { focusAreas: ["get_going"], dailyCount: 3 } }));
    expect(luteal[0].task.effort).toBeLessThan(3);
  });

  it("drops premium tasks unless the person has premium", () => {
    const evening = (premium: boolean) =>
      ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j"].flatMap((seed) =>
        buildDailyPlan(input({ seed, premium, hour: 21, settings: { focusAreas: ["sleep", "calm_mind"], dailyCount: 5 } })).map((item) => item.task)
      );
    expect(evening(false).some((task) => task.premium)).toBe(false);
    expect(evening(true).some((task) => task.premium)).toBe(true);
  });

  it("always returns at least one task, even from odd input", () => {
    const plan = buildDailyPlan({
      settings: { focusAreas: [], dailyCount: 9 } as any,
      dateKey: "not-a-day",
      hour: Number.NaN,
      energy: "exhausted",
      returning: true,
      memorial: true,
      cyclePhase: "period",
      history: { "body.water": { shown: "x", done: -3, consecutiveSkips: Infinity } } as any,
      seed: "",
      pinned: [42 as any],
    });
    expect(plan.length).toBeGreaterThanOrEqual(1);
    expect(plan.length).toBeLessThanOrEqual(3);
    expect(plan.every((item) => item.task.memorialSafe)).toBe(true);
  });
});

describe("planProgress", () => {
  it("counts done items", () => {
    expect(planProgress([])).toEqual({ done: 0, total: 0, allDone: false });
    expect(planProgress([{ done: true }, { done: false }])).toEqual({ done: 1, total: 2, allDone: false });
    expect(planProgress([{ done: true }, { done: true }])).toEqual({ done: 2, total: 2, allDone: true });
  });
});

// ---------- device and Supabase glue ----------

describe("planStore", () => {
  beforeEach(async () => {
    resetDb();
    await AsyncStorage.clear();
    jest.spyOn(console, "warn").mockImplementation(() => undefined);
  });
  afterEach(() => jest.restoreAllMocks());

  it("saves settings per user and reports whether the person has chosen yet", async () => {
    expect(await loadPlanSettings("u1")).toEqual({ ...DEFAULT_PLAN_SETTINGS, chosen: false });
    await savePlanSettings("u1", { focusAreas: ["sleep", "connection"], dailyCount: 5 });
    expect(await loadPlanSettings("u1")).toEqual({ focusAreas: ["sleep", "connection"], dailyCount: 5, chosen: true });
    expect((await loadPlanSettings("u2")).chosen).toBe(false);
    await AsyncStorage.setItem("floura:plan-settings:u3", "{not json");
    expect(await loadPlanSettings("u3")).toEqual({ ...DEFAULT_PLAN_SETTINGS, chosen: false });
  });

  it("keeps today's battery per user and day", async () => {
    expect(await loadTodayEnergy("u1", TODAY)).toBeNull();
    await saveTodayEnergy("u1", TODAY, "anxious");
    expect(await loadTodayEnergy("u1", TODAY)).toBe("anxious");
    expect(await loadTodayEnergy("u1", addDaysToDateKey(TODAY, 1))).toBeNull();
    await AsyncStorage.setItem(`floura:energy:u1:${TODAY}`, "furious");
    expect(await loadTodayEnergy("u1", TODAY)).toBeNull();
  });

  it("logs what was shown, merges re-plans and forgets days past the window", async () => {
    const old = addDaysToDateKey(TODAY, -40);
    await AsyncStorage.setItem("floura:plan-shown:u1", JSON.stringify({ [old]: ["body.water"], junk: ["x"] }));
    await recordPlanShown("u1", TODAY, ["body.water", "calm.box_breath"]);
    await recordPlanShown("u1", TODAY, ["calm.box_breath", "sleep.dim_lights"]);
    const log = JSON.parse((await AsyncStorage.getItem("floura:plan-shown:u1")) as string);
    expect(Object.keys(log)).toEqual([TODAY]);
    expect(log[TODAY].sort()).toEqual(["body.water", "calm.box_breath", "sleep.dim_lights"]);
  });

  it("rebuilds history from the shown log and completions, leaving today out", async () => {
    const d = (n: number) => addDaysToDateKey(TODAY, -n);
    mockDb.tasks.push({ id: 7, user_id: "u1", title: "Drink water", active: true }, { id: 8, user_id: "u1", title: "Play with Max", active: true });
    mockDb.task_completions.push(
      { task_id: 7, user_id: "u1", completed_date: d(3) },
      { task_id: 7, user_id: "u1", completed_date: d(1) },
      { task_id: 7, user_id: "u1", completed_date: TODAY },
      { task_id: 8, user_id: "u1", completed_date: d(40) },
      { task_id: 7, user_id: "someone-else", completed_date: d(2) }
    );
    await AsyncStorage.setItem(
      "floura:plan-shown:u1",
      JSON.stringify({
        [d(3)]: ["body.water", "calm.box_breath"],
        [d(2)]: ["body.water", "calm.box_breath"],
        [d(1)]: ["calm.box_breath"],
        [TODAY]: ["calm.box_breath"],
      })
    );
    const history = await loadPlanHistory("u1", TODAY, "Biscuit");
    expect(history["body.water"]).toEqual({ shown: 2, done: 2, lastShown: d(2), consecutiveSkips: 0 });
    expect(history["calm.box_breath"]).toEqual({ shown: 3, done: 0, lastShown: d(1), consecutiveSkips: 3 });
    expect(history["pet.play"]).toBeUndefined();

    mockDb.offline = true;
    expect(await loadPlanHistory("u1", TODAY, "Biscuit")).toEqual({});
  });

  it("reuses seed and legacy rows, reactivates them, inserts the rest, and never deletes", async () => {
    mockDb.tasks.push(
      { id: 1, user_id: "u1", title: "Drink water", active: false, sort_order: 2 },
      { id: 2, user_id: "u1", title: "Play with Max", active: true, sort_order: 99 },
      { id: 3, user_id: "u1", title: "Read 10 pages", active: true, sort_order: 4 },
      { id: 4, user_id: "u2", title: "Box breathing for one minute", active: true, sort_order: 100 }
    );
    mockDb.nextId = 10;
    const tasks = ["body.water", "pet.play", "calm.box_breath", "lift.pet_photo"].map((id) => catalogById(id)!);
    const result = await ensurePlanTaskRows("u1", tasks, "Biscuit");
    expect(result["body.water"]).toBe(1);
    expect(result["pet.play"]).toBe(2);
    expect(result["calm.box_breath"]).toBeGreaterThanOrEqual(10);
    expect(result["lift.pet_photo"]).toBeGreaterThanOrEqual(10);
    expect(mockDb.tasks.find((row) => row.id === 1)!.active).toBe(true);
    expect(mockDb.tasks.find((row) => row.id === 3)!.active).toBe(true);

    const inserted = mockDb.tasks.filter((row) => row.id >= 10);
    expect(inserted.map((row) => row.title).sort()).toEqual(["Box breathing for one minute", "Send someone a photo of Biscuit"]);
    for (const row of inserted) {
      expect(Object.keys(row).sort()).toEqual(["active", "id", "sort_order", "title", "user_id"]);
      expect(row.user_id).toBe("u1");
      expect(row.sort_order).toBeGreaterThanOrEqual(100);
    }

    // idempotent
    expect(await ensurePlanTaskRows("u1", tasks, "Biscuit")).toEqual(result);
    expect(mockDb.tasks.length).toBe(6);
    expect(mockDb.deletes).toBe(0);
  });

  it("does not duplicate rows when called twice at once", async () => {
    const tasks = ["body.water", "sleep.dim_lights", "kind.compliment"].map((id) => catalogById(id)!);
    const [a, b] = await Promise.all([ensurePlanTaskRows("u1", tasks, "Biscuit"), ensurePlanTaskRows("u1", tasks, "Biscuit")]);
    expect(a).toEqual(b);
    expect(mockDb.tasks.length).toBe(3);
  });

  it("settles on the oldest row when a duplicate title already exists", async () => {
    mockDb.tasks.push(
      { id: 5, user_id: "u1", title: "Dim the lights", active: true },
      { id: 9, user_id: "u1", title: "dim the lights ", active: true }
    );
    mockDb.nextId = 20;
    expect(await ensurePlanTaskRows("u1", [catalogById("sleep.dim_lights")!], "Biscuit")).toEqual({ "sleep.dim_lights": 5 });
    expect(mockDb.tasks.length).toBe(2);
  });

  it("falls back to the ids it last saw when the server cannot be reached", async () => {
    const tasks = ["body.water", "calm.name_five"].map((id) => catalogById(id)!);
    const online = await ensurePlanTaskRows("u1", tasks, "Biscuit");
    mockDb.offline = true;
    expect(await ensurePlanTaskRows("u1", [...tasks, catalogById("rest.pause")!], "Biscuit")).toEqual(online);
    expect(await ensurePlanTaskRows("", tasks, "Biscuit")).toEqual({});
  });
});
