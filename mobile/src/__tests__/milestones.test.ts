jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);

import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  MILESTONE_DAYS,
  buildKeepsakes,
  milestoneIcon,
  milestoneLine,
  milestoneTitle,
  nextMilestone,
  normalizeMilestoneRecord,
  reconcileMilestones,
} from "../domain/milestones";
import { loadMilestones, reconcileMilestonesForUser } from "../services/milestoneStore";

const TODAY = "2026-10-16";

describe("milestones", () => {
  it("has a title, a line and an icon for every threshold, in a warm voice", () => {
    for (const days of MILESTONE_DAYS) {
      expect(milestoneTitle(days).length).toBeGreaterThan(5);
      expect(milestoneLine(days, "Maple").length).toBeGreaterThan(10);
      expect(milestoneLine(days, "Maple")).not.toMatch(/\b(missed|streak|should|failed)\b/i);
      expect(milestoneIcon(days)).toMatch(/-outline$/);
    }
    expect(milestoneTitle(7)).toBe("A week together");
    expect(milestoneLine(365, "Maple")).toContain("Maple");
  });

  it("celebrates a new day-one user, then each threshold once", () => {
    const first = reconcileMilestones({}, 1, TODAY);
    expect(first.celebrate).toBe(1);
    expect(first.record).toEqual({ "1": TODAY });
    expect(reconcileMilestones(first.record, 1, TODAY)).toEqual({ record: first.record, celebrate: null });
    expect(reconcileMilestones(first.record, 2, TODAY).celebrate).toBeNull();
    const third = reconcileMilestones(first.record, 3, "2026-10-18");
    expect(third.celebrate).toBe(3);
    expect(third.record).toEqual({ "1": TODAY, "3": "2026-10-18" });
    expect(reconcileMilestones({}, 0, TODAY)).toEqual({ record: {}, celebrate: null });
    expect(reconcileMilestones({}, Number.NaN, TODAY).celebrate).toBeNull();
  });

  it("gives an existing person one moment, not a sheet per threshold they passed long ago", () => {
    const { record, celebrate } = reconcileMilestones({}, 40, TODAY);
    expect(celebrate).toBe(30);
    expect(record).toEqual({ "1": null, "3": null, "7": null, "14": null, "21": null, "30": TODAY });
    // the next real one still lands
    expect(reconcileMilestones(record, 50, "2026-11-05")).toEqual({ record: { ...record, "50": "2026-11-05" }, celebrate: 50 });
  });

  it("knows what is ahead", () => {
    expect(nextMilestone(0)).toEqual({ days: 1, left: 1 });
    expect(nextMilestone(7)).toEqual({ days: 14, left: 7 });
    expect(nextMilestone(400)).toBeNull();
  });

  it("normalizes junk from storage", () => {
    expect(normalizeMilestoneRecord(null)).toEqual({});
    expect(normalizeMilestoneRecord("{nope")).toEqual({});
    expect(normalizeMilestoneRecord({ "7": TODAY, "8": TODAY, "3": null, "14": "soon", abc: TODAY })).toEqual({ "7": TODAY, "3": null });
  });

  it("builds keepsakes newest first, with undated ones last", () => {
    const list = buildKeepsakes({
      milestones: { "1": null, "3": "2026-10-10", "7": "2026-10-14" },
      journeys: [{ journeyId: "sleep.softer_landing", startedOn: "2026-10-05", finishedOn: "2026-10-12" }, { journeyId: "bogus", startedOn: "2026-10-05", finishedOn: "2026-10-12" }],
      firstDay: "2026-10-08",
      petName: "Maple",
    });
    expect(list.map((k) => k.id)).toEqual(["milestone:7", "journey:sleep.softer_landing:2026-10-12", "milestone:3", "first_day", "milestone:1"]);
    expect(list[1].title).toBe("A softer landing: walked");
    expect(list[3].title).toBe("Maple moved in");
    expect(buildKeepsakes({ milestones: {}, journeys: [], firstDay: null, petName: "Maple" })).toEqual([]);
  });
});

describe("milestone store", () => {
  beforeEach(() => AsyncStorage.clear());

  it("keeps the record per user and celebrates each threshold once", async () => {
    expect(await loadMilestones("u1")).toEqual({});
    expect(await reconcileMilestonesForUser("u1", 1, TODAY)).toBe(1);
    expect(await reconcileMilestonesForUser("u1", 1, TODAY)).toBeNull();
    expect(await reconcileMilestonesForUser("u1", 3, "2026-10-18")).toBe(3);
    expect(await loadMilestones("u1")).toEqual({ "1": TODAY, "3": "2026-10-18" });
    expect(await loadMilestones("u2")).toEqual({});
    expect(await reconcileMilestonesForUser("", 3, TODAY)).toBeNull();
  });
});
