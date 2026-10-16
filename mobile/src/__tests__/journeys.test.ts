jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);

import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  EMPTY_JOURNEY_STATE,
  JOURNEYS,
  JOURNEY_DAYS,
  chapterFor,
  completeStep,
  isJourneyUnlocked,
  lastFinished,
  partOneOf,
  sequelFor,
  daysOnJourney,
  expectedFinish,
  isJourneyFinished,
  journeyDoneCount,
  journeyLine,
  journeysFor,
  leaveJourney,
  normalizeJourneyState,
  startJourney,
  todayStep,
} from "../domain/journeys";
import { FOCUS_AREAS } from "../domain/plan/focusAreas";
import { catalogById } from "../domain/plan/catalog";
import { completeJourneyStep, leaveJourneyForUser, loadJourneyState, startJourneyForUser } from "../services/journeyStore";
import { addDaysToDateKey } from "../utils/dateKeys";

const D0 = "2026-10-16";
const day = (n: number) => addDaysToDateKey(D0, n);

describe("journey catalog", () => {
  it("has one seven-day part one per focus area, with unique ids and real catalog tasks", () => {
    const partOnes = JOURNEYS.filter((j) => !j.sequelOf);
    expect(partOnes.map((j) => j.area).sort()).toEqual(FOCUS_AREAS.map((a) => a.id).sort());
    expect(new Set(JOURNEYS.map((j) => j.id)).size).toBe(JOURNEYS.length);
    for (const journey of JOURNEYS) {
      expect(journey.days).toHaveLength(JOURNEY_DAYS);
      expect(journey.title.length).toBeGreaterThan(3);
      expect(journey.blurb.length).toBeGreaterThan(20);
      for (const d of journey.days) {
        expect(catalogById(d.taskId)).toBeDefined();
        expect(d.title.length).toBeGreaterThan(2);
        expect(d.petLine.length).toBeGreaterThan(10);
        if (d.prompt) expect(d.prompt.trim().endsWith("?")).toBe(true);
      }
      // the last day always asks a question to look back on the week
      expect(journey.days[JOURNEY_DAYS - 1].prompt).toBeTruthy();
    }
  });

  it("speaks warmly: never scolds, never counts what was missed", () => {
    for (const journey of JOURNEYS) {
      for (const d of journey.days) {
        expect(d.petLine).not.toMatch(/\b(should|must|missed|failed|lazy|behind)\b/i);
      }
    }
  });

  it("keeps the rhythm journey on neutral catalog tasks (their titles reach the database)", () => {
    const rhythm = JOURNEYS.find((j) => j.area === "cycle")!;
    for (const d of rhythm.days) {
      const task = catalogById(d.taskId)!;
      expect(task.title).not.toMatch(/period|cycle|menstru|cramp|pms/i);
    }
  });

  it("lists the person's areas first and hides the rhythm journey unless it is theirs", () => {
    const list = journeysFor(["sleep", "connection"], { cycleVisible: false });
    expect(list[0].area).toBe("sleep");
    expect(list[1].area).toBe("connection");
    expect(list.some((j) => j.area === "cycle")).toBe(false);
    expect(journeysFor([], { cycleVisible: true }).some((j) => j.area === "cycle")).toBe(true);
    expect(journeysFor(["cycle"], { cycleVisible: false })[0].area).toBe("cycle");
    // every part one but rhythm (sequels wait for their part one)
    expect(journeysFor([], { cycleVisible: false })).toHaveLength(JOURNEYS.filter((j) => !j.sequelOf).length - 1);
  });

  it("fills the pet's name into lines", () => {
    expect(journeyLine("Sit with {pet} for a bit", "Maple")).toBe("Sit with Maple for a bit");
    expect(journeyLine("Hello {pet}", "")).toBe("Hello your pet");
  });
});

describe("journey pacing", () => {
  const id = "sleep.softer_landing";

  it("opens one step per calendar day and finishes on the seventh", () => {
    let state = startJourney(EMPTY_JOURNEY_STATE, id, D0);
    expect(state.active?.journeyId).toBe(id);
    let step = todayStep(state.active, D0)!;
    expect(step.index).toBe(0);
    expect(step.done).toBe(false);
    expect(step.next?.title).toBe("Tomorrow's note");

    state = completeStep(state, D0);
    step = todayStep(state.active, D0)!;
    expect(step.index).toBe(0);
    expect(step.done).toBe(true);
    // a second tap the same day changes nothing
    expect(completeStep(state, D0)).toEqual(state);
    // the next day opens day two
    expect(todayStep(state.active, day(1))!.index).toBe(1);
    expect(journeyDoneCount(state.active)).toBe(1);

    for (let n = 1; n < JOURNEY_DAYS; n++) state = completeStep(state, day(n));
    expect(state.active).toBeNull();
    expect(state.completed).toHaveLength(1);
    expect(state.completed[0]).toMatchObject({ journeyId: id, startedOn: D0, finishedOn: day(6) });
    expect(Object.keys(state.completed[0].doneDays ?? {})).toHaveLength(JOURNEY_DAYS);
    expect(todayStep(null, day(7))).toBeNull();
  });

  it("costs nothing to miss a day: the journey waits and takes longer", () => {
    let state = startJourney(EMPTY_JOURNEY_STATE, id, D0);
    state = completeStep(state, D0);
    // three days away: still day two, no penalty, no reset
    const step = todayStep(state.active, day(4))!;
    expect(step.index).toBe(1);
    expect(step.done).toBe(false);
    expect(daysOnJourney(state.active!, day(4))).toBe(4);
    expect(expectedFinish(state.active!, day(4))).toBe(day(4 + 5));
    state = completeStep(state, day(4));
    expect(expectedFinish(state.active!, day(4))).toBe(day(4 + 5));
    expect(isJourneyFinished(state.active)).toBe(false);
  });

  it("starting another journey replaces the active one; leaving keeps what was finished", () => {
    let state = startJourney(EMPTY_JOURNEY_STATE, id, D0);
    state = completeStep(state, D0);
    state = startJourney(state, "calm.back_to_the_room", day(1));
    expect(state.active?.journeyId).toBe("calm.back_to_the_room");
    expect(todayStep(state.active, day(1))!.index).toBe(0);
    state = leaveJourney(state);
    expect(state.active).toBeNull();
    expect(startJourney(state, "not.a.journey", day(1))).toEqual(state);
    expect(startJourney(state, id, "nonsense")).toEqual(state);
  });

  it("normalizes junk from storage", () => {
    expect(normalizeJourneyState(null)).toEqual({ version: 1, active: null, completed: [] });
    expect(normalizeJourneyState("{nope")).toEqual({ version: 1, active: null, completed: [] });
    const messy = normalizeJourneyState({
      active: { journeyId: id, startedOn: D0, doneDays: { "0": D0, "9": D0, x: D0, "1": "soon" } },
      completed: [{ journeyId: "bogus", startedOn: D0, finishedOn: D0 }, { journeyId: id, startedOn: D0, finishedOn: day(6) }, 7],
    });
    expect(messy.active).toEqual({ journeyId: id, startedOn: D0, doneDays: { "0": D0 } });
    expect(messy.completed).toEqual([{ journeyId: id, startedOn: D0, finishedOn: day(6) }]);
    expect(normalizeJourneyState({ active: { journeyId: "bogus", startedOn: D0, doneDays: {} } }).active).toBeNull();
  });
});

describe("journey store", () => {
  beforeEach(() => AsyncStorage.clear());

  it("keeps the state per user on the device", async () => {
    expect(await loadJourneyState("u1")).toEqual({ version: 1, active: null, completed: [] });
    await startJourneyForUser("u1", "sleep.softer_landing", D0);
    await completeJourneyStep("u1", D0);
    const state = await loadJourneyState("u1");
    expect(state.active?.doneDays).toEqual({ "0": D0 });
    expect((await loadJourneyState("u2")).active).toBeNull();
    await leaveJourneyForUser("u1");
    expect((await loadJourneyState("u1")).active).toBeNull();
    expect(await AsyncStorage.getItem("floura:journeys:u1")).toContain('"active":null');
  });
});

describe("journey sequels and chapters", () => {
  const id = "sleep.softer_landing";

  it("offers a part two for sleep, calm and burnout, each continuing a real part one in the same area", () => {
    const sequels = JOURNEYS.filter((j) => j.sequelOf);
    expect(sequels.map((j) => j.area).sort()).toEqual(["burnout", "calm_mind", "sleep"]);
    for (const sequel of sequels) {
      const partOne = partOneOf(sequel)!;
      expect(partOne).toBeDefined();
      expect(partOne.sequelOf).toBeUndefined();
      expect(partOne.area).toBe(sequel.area);
      expect(sequel.days).toHaveLength(JOURNEY_DAYS);
      expect(sequelFor(partOne.id)?.id).toBe(sequel.id);
    }
    expect(sequelFor("connect.less_alone")).toBeUndefined();
    expect(partOneOf(JOURNEYS.find((j) => j.id === id))).toBeUndefined();
  });

  it("lists a part two only once part one has been walked, right after it", () => {
    const sequel = sequelFor(id)!;
    const before = journeysFor(["sleep"], { cycleVisible: false, completed: [] });
    expect(before.some((j) => j.id === sequel.id)).toBe(false);
    expect(isJourneyUnlocked(sequel, [])).toBe(false);
    const done = [{ journeyId: id, startedOn: D0, finishedOn: day(6) }];
    const after = journeysFor(["sleep"], { cycleVisible: false, completed: done });
    expect(after[0].id).toBe(id);
    expect(after[1].id).toBe(sequel.id);
    expect(isJourneyUnlocked(sequel, done)).toBe(true);
    // the old call shape (no completed list) still works and hides every sequel
    expect(journeysFor([], { cycleVisible: true }).some((j) => j.sequelOf)).toBe(false);
  });

  it("keeps the days a finished journey was walked, and turns them into a chapter", () => {
    let state = startJourney(EMPTY_JOURNEY_STATE, id, D0);
    for (let n = 0; n < JOURNEY_DAYS; n++) state = completeStep(state, day(n * 2));
    const entry = lastFinished(state.completed, id)!;
    expect(entry.finishedOn).toBe(day(12));
    expect(entry.doneDays).toEqual({ "0": D0, "1": day(2), "2": day(4), "3": day(6), "4": day(8), "5": day(10), "6": day(12) });
    const journey = JOURNEYS.find((j) => j.id === id)!;
    const chapter = chapterFor(journey, entry, "Maple");
    expect(chapter.title).toBe("A softer landing: a chapter");
    expect(chapter.walked).toMatch(/13 days/);
    expect(chapter.lines).toHaveLength(JOURNEY_DAYS);
    expect(chapter.lines[2]).toEqual({ index: 2, title: "Phone to bed", petLine: "Yours gets a bedtime too.", doneOn: day(4), prompt: null });
    expect(chapter.sequel?.id).toBe("sleep.softer_landing_2");
    // an entry from before chapters existed has no dates, and still makes a chapter
    const old = chapterFor(journey, { journeyId: id, startedOn: D0, finishedOn: day(6) }, "Maple");
    expect(old.walked).toMatch(/seven days straight/);
    expect(old.lines.every((line) => line.doneOn === null)).toBe(true);
    expect(normalizeJourneyState({ completed: [{ journeyId: id, startedOn: D0, finishedOn: day(6), doneDays: { "0": D0, "9": D0 } }] }).completed[0]).toEqual({
      journeyId: id,
      startedOn: D0,
      finishedOn: day(6),
      doneDays: { "0": D0 },
    });
    expect(lastFinished([], id)).toBeNull();
  });
});
