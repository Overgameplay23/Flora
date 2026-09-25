import { getPointsDebugSnapshot } from "../domain/progressDebug";

const gardenItems = [
  { id: 3, name: "Glow Lantern", tier: 2 },
  { id: 1, name: "Tiny Sprout", tier: 1 },
  { id: 2, name: "Soft Pebble", tier: 1 },
];

describe("getPointsDebugSnapshot", () => {
  it("sums points for today's completed tasks using ids in any accepted shape", () => {
    const snapshot = getPointsDebugSnapshot({
      tasks: [
        { id: 1, title: "Water", points: 2 },
        { id: "remote-2", title: "Deep work", points: 3 },
        { id: 3, title: "Stretch" },
      ],
      completionsToday: [{ task_id: 1 }, "2"],
      gardenItems,
      gardenUnlocks: [],
    });
    expect([...snapshot.completedTaskIdsToday].sort()).toEqual(["1", "2"]);
    expect(snapshot.earnedPointsToday).toBe(5);
    expect(snapshot.unlockedCount).toBe(0);
    expect(snapshot.nextLockedItem).toEqual({ id: 1, name: "Tiny Sprout", requiredPoints: 6 });
    expect(snapshot.requiredPoints).toBe(6);
    expect(snapshot.remaining).toBe(1);
    expect(snapshot.isReady).toBe(false);
  });

  it("skips completion rows explicitly marked not done", () => {
    const snapshot = getPointsDebugSnapshot({
      tasks: [{ id: 1, points: 2 }, { id: 2, points: 2 }],
      completionsToday: [{ task_id: 1, done: false }, { task_id: 2 }],
      gardenItems,
      gardenUnlocks: [],
    });
    expect(snapshot.completedTaskIdsToday).toEqual(["2"]);
    expect(snapshot.earnedPointsToday).toBe(2);
  });

  it("falls back to task done flags when no completion rows exist", () => {
    const snapshot = getPointsDebugSnapshot({
      tasks: [{ id: 1, points: 2, done: true }, { id: 2, points: 3, completed: true }, { id: 3, points: 9 }],
      completionsToday: [],
      gardenItems,
      gardenUnlocks: [],
    });
    expect(snapshot.earnedPointsToday).toBe(5);
  });

  it("orders locked items by tier then id and escalates the requirement per unlock", () => {
    const snapshot = getPointsDebugSnapshot({
      tasks: [{ id: 1, points: 8 }],
      completionsToday: [1],
      gardenItems,
      gardenUnlocks: [{ item_id: 1 }],
    });
    expect(snapshot.unlockedCount).toBe(1);
    expect(snapshot.nextLockedItem?.id).toBe(2);
    expect(snapshot.requiredPoints).toBe(9);
    expect(snapshot.remaining).toBe(1);
    expect(snapshot.isReady).toBe(false);
  });

  it("reports readiness when earned points meet the requirement and no items remain", () => {
    const snapshot = getPointsDebugSnapshot({
      tasks: [{ id: 1, points: 20 }],
      completionsToday: [{ id: 1 }],
      gardenItems,
      gardenUnlocks: [{ itemId: 1 }, { item_id: "2" }, { item_id: 3 }],
    });
    expect(snapshot.unlockedCount).toBe(3);
    expect(snapshot.nextLockedItem).toBeNull();
    expect(snapshot.requiredPoints).toBe(15);
    expect(snapshot.isReady).toBe(true);
  });
});
