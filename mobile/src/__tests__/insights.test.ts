import { buildMonthInsights, longestRun } from "../domain/insights";

const END = "2026-10-16"; // a Friday; the window starts on Thursday 17 Sep

function metric(day: string, tasks: number, checkins = 1, points = tasks * 10) {
  return { day, tasks_completed: tasks, checkins_completed: checkins, points_earned: points };
}

const EMOJI = /\p{Extended_Pictographic}/u;

describe("buildMonthInsights", () => {
  it("an empty month is quiet, not a failure", () => {
    const month = buildMonthInsights({ endDateKey: END, metrics: [], petName: "Biscuit" });
    expect(month.days).toHaveLength(30);
    expect(month.days[0].dateKey).toBe("2026-09-17");
    expect(month.days[29].isToday).toBe(true);
    expect(month.range).toBe("17 Sep – 16 Oct");
    expect(month.activeDays).toBe(0);
    expect(month.fullestWeekday).toBeNull();
    expect(month.bestRun).toBeNull();
    expect(month.battery).toEqual([]);
    expect(month.headline).toBe("A quiet month, and that's allowed.");
    expect(month.noticed).toEqual(["Nothing logged this month. Biscuit is just glad you came by."]);
    expect(month.closing).toBe("Biscuit is just glad you're here. Tomorrow is a fine place to start.");
  });

  it("lists the weekdays Monday first with how often each one fell in the window", () => {
    const month = buildMonthInsights({ endDateKey: END, metrics: [] });
    expect(month.weekdays.map((w) => w.initial)).toEqual(["M", "T", "W", "T", "F", "S", "S"]);
    // today (a Friday) has nothing on it yet, so it is not counted as a Friday that passed
    expect(month.weekdays.map((w) => w.occurrences)).toEqual([4, 4, 4, 5, 4, 4, 4]);
  });

  it("counts today as a weekday only once something has happened on it", () => {
    const quiet = buildMonthInsights({ endDateKey: END, metrics: [metric("2026-10-09", 1)] });
    expect(quiet.weekdays[4]).toMatchObject({ weekday: "Friday", occurrences: 4, activeDays: 1 });
    const busy = buildMonthInsights({ endDateKey: END, metrics: [metric("2026-10-09", 1), metric(END, 1)] });
    expect(busy.weekdays[4]).toMatchObject({ weekday: "Friday", occurrences: 5, activeDays: 2 });
  });

  it("names the weekday care happens on when one clearly leads", () => {
    const tuesdays = ["2026-09-22", "2026-09-29", "2026-10-06", "2026-10-13"];
    const metrics = [...tuesdays.map((day) => metric(day, 2)), metric("2026-10-01", 1)];
    const month = buildMonthInsights({ endDateKey: END, metrics, petName: "Biscuit" });
    expect(month.fullestWeekday).toMatchObject({ weekday: "Tuesday", occurrences: 4, activeDays: 4, share: 1 });
    expect(month.noticed[0]).toBe("You came by every Tuesday this month.");
    expect(month.headline).toBe("You came by when you could. That counts.");
    expect(month.closing).toBe("Biscuit remembers every one of those days.");
  });

  it("says how many of that weekday when it was not every one", () => {
    const metrics = ["2026-09-22", "2026-10-06", "2026-10-13"].map((day) => metric(day, 1));
    const month = buildMonthInsights({ endDateKey: END, metrics });
    expect(month.noticed[0]).toBe("Tuesdays are when you come by most often: 3 of 4 this month.");
  });

  it("finds the longest stretch with its dates and stays quiet about a tie between weekdays", () => {
    const run = ["2026-10-03", "2026-10-04", "2026-10-05", "2026-10-06", "2026-10-07", "2026-10-08"];
    const metrics = [...run, "2026-10-11", "2026-10-12"].map((day) => metric(day, 1));
    const month = buildMonthInsights({ endDateKey: END, metrics, petName: "Mochi" });
    expect(month.bestRun).toEqual({ length: 6, startDateKey: "2026-10-03", endDateKey: "2026-10-08", atLeast: false });
    expect(month.fullestWeekday).toBeNull(); // Sundays and Mondays tie at two
    expect(month.noticed[0]).toBe("Your longest stretch: 6 days in a row, 3–8 Oct.");
    expect(month.activeDays).toBe(8);
  });

  it("a stretch touching the start of the window is 'at least'", () => {
    const metrics = ["2026-09-17", "2026-09-18", "2026-09-19", "2026-09-20"].map((day) => metric(day, 1));
    const month = buildMonthInsights({ endDateKey: END, metrics });
    expect(month.bestRun).toMatchObject({ length: 4, atLeast: true, endDateKey: "2026-09-20" });
    expect(month.noticed[0]).toBe("Your longest stretch: at least 4 days in a row, ending 20 Sep. It may have begun before the month did.");
  });

  it("a stretch that is still going ends today, and one over the whole window is at least thirty", () => {
    const going = buildMonthInsights({ endDateKey: END, metrics: ["2026-10-14", "2026-10-15", END].map((day) => metric(day, 1)) });
    expect(going.bestRun).toEqual({ length: 3, startDateKey: "2026-10-14", endDateKey: END, atLeast: false });
    expect(going.noticed[0]).toBe("Your longest stretch: 3 days in a row, 14–16 Oct.");
    const whole = buildMonthInsights({ endDateKey: END, metrics: [] });
    const everyDay = whole.days.map((d) => metric(d.dateKey, 1));
    const full = buildMonthInsights({ endDateKey: END, metrics: everyDay });
    expect(full.bestRun).toMatchObject({ length: 30, atLeast: true });
    expect(full.headline).toBe("You showed up nearly every day this month.");
  });

  it("the headline follows the share of active days", () => {
    const quiet = buildMonthInsights({ endDateKey: END, metrics: [] });
    const days = quiet.days.map((d) => d.dateKey);
    const steady = buildMonthInsights({ endDateKey: END, metrics: days.slice(0, 12).map((day) => metric(day, 1)) });
    expect(steady.headline).toBe("A steady month, one small thing at a time.");
    const some = buildMonthInsights({ endDateKey: END, metrics: days.slice(0, 11).map((day) => metric(day, 1)) });
    expect(some.headline).toBe("You came by when you could. That counts.");
    const most = buildMonthInsights({ endDateKey: END, metrics: days.slice(0, 24).map((day) => metric(day, 1)) });
    expect(most.headline).toBe("You showed up nearly every day this month.");
  });

  it("the window is thirty days by default and never shorter than seven", () => {
    expect(buildMonthInsights({ endDateKey: END, metrics: [] }).days).toHaveLength(30);
    expect(buildMonthInsights({ endDateKey: END, metrics: [], days: 3 }).days).toHaveLength(7);
    expect(buildMonthInsights({ endDateKey: END, metrics: [], days: 10 }).days).toHaveLength(10);
  });

  it("a single day is not a stretch", () => {
    const month = buildMonthInsights({ endDateKey: END, metrics: [metric("2026-10-10", 3)] });
    expect(month.bestRun).toBeNull();
    expect(longestRun(month.days)).toBeNull();
  });

  it("sets the battery against the small things done, gently", () => {
    const metrics = [metric("2026-09-23", 1), metric("2026-09-25", 1), metric("2026-10-05", 3), metric("2026-10-07", 3), metric("2026-10-09", 4)];
    const battery = { "2026-09-21": "exhausted", "2026-09-23": "exhausted", "2026-09-25": "anxious", "2026-10-05": "energized", "2026-10-07": "energized", "2026-10-09": "calm" } as const;
    const month = buildMonthInsights({ endDateKey: END, metrics, battery, petName: "Biscuit" });
    expect(month.batteryDays).toBe(6);
    expect(month.battery.map((b) => [b.energy, b.days, b.tasksPerDay])).toEqual([
      ["exhausted", 2, 0.5],
      ["anxious", 1, 1],
      ["calm", 1, 4],
      ["energized", 2, 3],
    ]);
    expect(month.fullestWeekday).toBeNull(); // Wednesdays and Fridays tie
    expect(month.noticed[0]).toBe("On low-battery days you did about 1 small thing; on brighter days about 3. Both are care.");
  });

  it("never scolds a low-battery day that did as much as a bright one", () => {
    const metrics = [metric("2026-10-01", 3), metric("2026-10-02", 3), metric("2026-10-05", 2), metric("2026-10-06", 2)];
    const battery = { "2026-10-01": "exhausted", "2026-10-02": "anxious", "2026-10-05": "calm", "2026-10-06": "energized" } as const;
    const month = buildMonthInsights({ endDateKey: END, metrics, battery });
    expect(month.noticed.join(" ")).toContain("about as much on low-battery days as on bright ones. Some of that effort can be rest.");
  });

  it("with only a few battery checks it just says what they mostly were", () => {
    const battery = { "2026-10-10": "calm", "2026-10-11": "calm", "2026-10-12": "exhausted" } as const;
    const month = buildMonthInsights({ endDateKey: END, metrics: [metric("2026-10-10", 1)], battery });
    expect(month.noticed).toContain("You checked your battery on 3 days; it was mostly steady.");
  });

  it("does not say mostly on a tie or a bare plurality", () => {
    const tie = buildMonthInsights({ endDateKey: END, metrics: [], battery: { "2026-10-10": "calm", "2026-10-11": "calm", "2026-10-12": "energized", "2026-10-13": "energized" } as const });
    expect(tie.noticed).toContain("You checked your battery on 4 days; no single answer led.");
    const plurality = buildMonthInsights({ endDateKey: END, metrics: [], battery: { "2026-10-08": "calm", "2026-10-09": "calm", "2026-10-10": "exhausted", "2026-10-11": "energized", "2026-10-12": "energized" } as const });
    expect(plurality.noticed.join(" ")).not.toContain("mostly");
  });

  it("covers the quieter battery lines", () => {
    const light = buildMonthInsights({ endDateKey: END, metrics: [], battery: { "2026-10-10": "exhausted", "2026-10-11": "anxious", "2026-10-12": "calm", "2026-10-13": "energized" } as const });
    expect(light.noticed[0]).toBe("You checked your battery on 4 days and kept the list light on all of them. That's allowed.");
    const rest = buildMonthInsights({ endDateKey: END, metrics: [metric("2026-10-12", 2), metric("2026-10-13", 2)], battery: { "2026-10-10": "exhausted", "2026-10-11": "anxious", "2026-10-12": "calm", "2026-10-13": "energized" } as const });
    expect(rest.noticed.join(" ")).toContain("On low-battery days you let the list rest; on brighter days about 2 small things. Both are care.");
    const none = buildMonthInsights({ endDateKey: END, metrics: [metric("2026-10-12", 2)] });
    expect(none.noticed).toContain("No battery checks this month, so that line stays blank. That's fine.");
  });

  it("ignores battery values it does not know", () => {
    const month = buildMonthInsights({ endDateKey: END, metrics: [], battery: { "2026-10-10": "tired" as any, "2026-10-11": null } });
    expect(month.batteryDays).toBe(0);
  });

  it("memorial months keep the pet remembered and never cheer", () => {
    const tuesdays = ["2026-09-22", "2026-09-29", "2026-10-06", "2026-10-13"];
    const run = ["2026-10-03", "2026-10-04", "2026-10-05", "2026-10-06", "2026-10-07", "2026-10-08"];
    const month = buildMonthInsights({ endDateKey: END, metrics: [...tuesdays, ...run].map((day) => metric(day, 2)), petName: "Biscuit", memorial: true });
    expect(month.headline).toBe("The month, with Biscuit remembered.");
    expect(month.bestRun).not.toBeNull();
    expect(month.noticed.join(" ")).not.toMatch(/longest stretch|in a row/);
    expect(month.noticed[0]).toBe("Tuesdays are when you come by most often: 4 of 4 this month.");
    expect(month.noticed.join(" ")).not.toContain("every");
    expect(month.closing).toBe("Take the coming month at your own pace.");
  });

  it("keeps at most three observations, none of them emoji, and the headline follows the active days", () => {
    const metrics: ReturnType<typeof metric>[] = [];
    const battery: Record<string, "exhausted" | "energized"> = {};
    for (let i = 0; i < 30; i += 1) {
      const day = `2026-${i < 14 ? "09" : "10"}-${String(i < 14 ? 17 + i : i - 13).padStart(2, "0")}`;
      if (i % 5 !== 4) metrics.push(metric(day, i % 2 === 0 ? 1 : 3));
      battery[day] = i % 2 === 0 ? "exhausted" : "energized";
    }
    const month = buildMonthInsights({ endDateKey: END, metrics, battery, petName: "Biscuit" });
    expect(month.activeDays).toBe(24);
    expect(month.headline).toBe("You showed up nearly every day this month.");
    expect(month.noticed.length).toBeLessThanOrEqual(3);
    for (const text of [month.headline, ...month.noticed, month.closing]) expect(text).not.toMatch(EMOJI);
  });
});
