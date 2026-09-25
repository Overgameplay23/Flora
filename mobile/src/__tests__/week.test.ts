import { buildWeekStory, energyWord, humanRange } from "../domain/week";

const END = "2026-09-25"; // a Friday

function metric(day: string, tasks: number, checkins: number, points = tasks * 10) {
  return { day, tasks_completed: tasks, checkins_completed: checkins, points_earned: points, activity_count: tasks + checkins };
}

describe("humanRange / energyWord", () => {
  it("formats ranges inside and across months", () => {
    expect(humanRange("2026-09-19", "2026-09-25")).toBe("19–25 Sep");
    expect(humanRange("2026-09-28", "2026-10-04")).toBe("28 Sep – 4 Oct");
  });

  it("maps average energy onto the words", () => {
    expect(energyWord(null)).toBeNull();
    expect(energyWord(1.2)).toBe("Exhausted");
    expect(energyWord(3.6)).toBe("Good");
    expect(energyWord(5)).toBe("Energized");
  });
});

describe("buildWeekStory", () => {
  it("an empty week is quiet, not a failure", () => {
    const story = buildWeekStory({ endDateKey: END, checkins: [], metrics: [], petName: "Biscuit" });
    expect(story.days).toHaveLength(7);
    expect(story.days[0].dateKey).toBe("2026-09-19");
    expect(story.days[6].isToday).toBe(true);
    expect(story.activeDays).toBe(0);
    expect(story.energyAverage).toBeNull();
    expect(story.headline).toBe("A quiet week, and that's allowed.");
    expect(story.noticed.join(" ")).toContain("glad you came by");
    expect(story.closing).toBe("Today isn't in the scrapbook yet.");
    expect(story.checkedInToday).toBe(false);
  });

  it("tells the seeded week back: energy, heavier day, fullest day, wins in order", () => {
    const moods = [3, 4, 3, 2, 4, 4, 5];
    const wins = ["walk", "sister", "water", "rest", "finished", "dinner", "stretch"];
    const checkins = moods.map((mood, i) => ({ date: `2026-09-${19 + i}`, mood, win: wins[i] }));
    const metrics = [metric("2026-09-19", 2, 1), metric("2026-09-22", 1, 1), metric("2026-09-24", 4, 1), metric("2026-09-25", 1, 1)];
    const story = buildWeekStory({ endDateKey: END, checkins, metrics, petName: "Biscuit" });

    expect(story.range).toBe("19–25 Sep");
    expect(story.energyAverage).toBe(3.6);
    expect(story.energyWord).toBe("Good");
    expect(story.heavier.map((d) => d.weekday)).toEqual(["Tuesday"]);
    expect(story.activeDays).toBe(7); // a check-in counts even where the roll-up has no row
    expect(story.tasks).toBe(8);
    expect(story.checkins).toBe(7);
    expect(story.kept.map((k) => k.text)).toEqual(wins);
    expect(story.headline).toBe("You showed up almost every day.");
    expect(story.noticed[0]).toBe("Energy was mostly good. It climbed towards the end of the week.");
    expect(story.noticed[1]).toBe("Tuesday felt heavier. Biscuit stayed close. You still did something on those days. That counts double.");
    expect(story.noticed[2]).toBe("Thursday was the fullest day: 4 small things.");
    expect(story.closing).toBe("That's the week so far. Biscuit will be here tomorrow.");
  });

  it("dipping energy asks for gentleness and lists several heavy days", () => {
    const moods = [5, 4, 4, 2, 2, 3, 1];
    const checkins = moods.map((mood, i) => ({ date: `2026-09-${19 + i}`, mood, win: null }));
    const story = buildWeekStory({ endDateKey: END, checkins, metrics: [], petName: "Mochi" });
    expect(story.noticed[0]).toBe("Energy was mostly okay. It dipped towards the end of the week, so go gently.");
    expect(story.noticed[1]).toBe("Tuesday, Wednesday and Friday felt heavier. Mochi stayed close.");
    expect(story.kept).toEqual([]);
  });

  it("memorial weeks keep the pet remembered and never cheer", () => {
    const story = buildWeekStory({ endDateKey: END, checkins: [{ date: END, mood: 2, win: "Sat in the garden" }], metrics: [metric(END, 2, 1)], petName: "Biscuit", memorial: true });
    expect(story.headline).toBe("Your week, with Biscuit remembered.");
    expect(story.noticed.join(" ")).not.toContain("fullest");
    expect(story.noticed.join(" ")).not.toContain("stayed close");
    expect(story.closing).toBe("Take the coming week at your own pace.");
  });
});
