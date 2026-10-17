import { buildWeekStory } from "../domain/week";
import {
  EMPTY_SCRAPBOOK,
  MAX_KEPT_ON_PAGE,
  MAX_PAGES,
  buildScrapbookPage,
  earlierPages,
  hasPageFor,
  isPageNew,
  isSunday,
  journeyWeek,
  latestPageEnd,
  markPageSeen,
  milestoneInWeek,
  normalizeScrapbook,
  pageFor,
  scrapbookNote,
  shouldNudgeHome,
  upsertPage,
  type Scrapbook,
} from "../domain/scrapbook";
import type { JourneyState } from "../domain/journeys";

const SUNDAY = "2026-10-18";
const MONDAY = "2026-10-12";

function metric(day: string, tasks: number, checkins: number) {
  return { day, tasks_completed: tasks, checkins_completed: checkins, points_earned: tasks * 2, activity_count: tasks + checkins };
}

function weekOn(dates: string[], tasks: number[], moods: Array<number | null>, wins: Array<string | null>) {
  return buildWeekStory({
    endDateKey: SUNDAY,
    checkins: dates.map((date, i) => ({ date, mood: moods[i], win: wins[i] })).filter((c) => c.mood != null || c.win),
    metrics: dates.map((day, i) => metric(day, tasks[i], moods[i] != null || wins[i] ? 1 : 0)),
    petName: "Biscuit",
  });
}

const DAYS = ["2026-10-12", "2026-10-13", "2026-10-14", "2026-10-15", "2026-10-16", "2026-10-17", "2026-10-18"];

describe("scrapbook: which week, and when it is new", () => {
  it("the newest page ends on the Sunday just gone, or today on a Sunday", () => {
    expect(latestPageEnd(SUNDAY)).toBe(SUNDAY);
    expect(latestPageEnd("2026-10-17")).toBe("2026-10-11");
    expect(latestPageEnd(MONDAY)).toBe("2026-10-11");
    expect(latestPageEnd("2026-10-01")).toBe("2026-09-27");
    expect(latestPageEnd("nope")).toBe("nope");
    expect(isSunday(SUNDAY)).toBe(true);
    expect(isSunday(MONDAY)).toBe(false);
  });

  it("has no page for a week that ended before the pet moved in", () => {
    expect(hasPageFor(SUNDAY, null)).toBe(true);
    expect(hasPageFor(SUNDAY, "2026-10-18")).toBe(true);
    expect(hasPageFor(SUNDAY, "2026-10-19")).toBe(false);
    expect(hasPageFor("2026-10-11", "2026-10-14")).toBe(false);
    expect(hasPageFor("bad", null)).toBe(false);
  });

  it("is new until opened; Home mentions it only on its Sunday and the Monday after", () => {
    const book: Scrapbook = { ...EMPTY_SCRAPBOOK, pages: [] };
    expect(isPageNew(book, SUNDAY, null)).toBe(true);
    expect(shouldNudgeHome(book, SUNDAY, null)).toBe(true);
    expect(shouldNudgeHome(book, "2026-10-19", null)).toBe(true);
    expect(shouldNudgeHome(book, "2026-10-20", null)).toBe(false);
    expect(isPageNew(book, "2026-10-20", null)).toBe(true);
    // a person who joined this week has nothing waiting until Sunday
    expect(isPageNew(book, "2026-10-15", "2026-10-13")).toBe(false);
    const seen = markPageSeen(book, SUNDAY);
    expect(isPageNew(seen, SUNDAY, null)).toBe(false);
    expect(shouldNudgeHome(seen, "2026-10-19", null)).toBe(false);
    // an older page never moves the mark back
    expect(markPageSeen(seen, "2026-10-11")).toBe(seen);
    expect(isPageNew(seen, "2026-10-25", null)).toBe(true);
  });
});

describe("scrapbook: the page", () => {
  it("keeps the wins as notes and puts stickers on what happened, without counting a miss", () => {
    const story = weekOn(DAYS, [2, 0, 4, 1, 0, 3, 1], [3, null, 2, 2, 4, null, 4], ["walked", null, "called mum", null, "slept in", null, "cooked"]);
    const page = buildScrapbookPage({ story, petName: "Biscuit", voice: "warm", madeAt: "2026-10-18T18:00:00.000Z" });
    expect(page.endDateKey).toBe(SUNDAY);
    expect(page.startDateKey).toBe(MONDAY);
    expect(page.range).toBe("12–18 Oct");
    expect(page.kept.map((k) => k.text)).toEqual(["walked", "called mum", "slept in", "cooked"]);
    expect(page.kept[0].weekday).toBe("Monday");
    expect(page.moreKept).toBe(0);
    const ids = page.stickers.map((s) => s.id);
    expect(ids).toEqual(["fullest", "energy", "days", "heavier"]);
    const fullest = page.stickers.find((s) => s.id === "fullest")!;
    expect(fullest.label).toBe("Wednesday");
    expect(fullest.detail).toBe("The fullest day: 4 small things");
    expect(page.stickers.find((s) => s.id === "heavier")!.label).toBe("Wednesday and Thursday felt heavier");
    expect(page.stickers.find((s) => s.id === "heavier")!.detail).toBe("Biscuit stayed close");
    expect(page.stickers.find((s) => s.id === "days")!.label).toBe("6 days of care");
    // two heavier days: the gentler note
    expect(page.note).toMatch(/heavier/);
    const text = [page.note, ...page.stickers.flatMap((s) => [s.label, s.detail ?? ""])].join(" ");
    expect(text).not.toMatch(/miss|only|fail|should|didn't|of 7/i);
    for (const sticker of page.stickers) expect(sticker.icon).toMatch(/-outline$/);
  });

  it("a quiet week still gets a page, and nothing on it reads as a failure", () => {
    const story = buildWeekStory({ endDateKey: SUNDAY, checkins: [], metrics: [], petName: "Biscuit" });
    const page = buildScrapbookPage({ story, petName: "Biscuit", voice: "warm", madeAt: "" });
    expect(page.stickers).toEqual([]);
    expect(page.kept).toEqual([]);
    expect(page.note).toBe("A quiet week, and that's allowed. I saved you a page anyway.");
    expect(scrapbookNote(story, "gentle", "Biscuit", false)).toMatch(/Rest counts too/);
    expect(scrapbookNote(story, "plain", "Biscuit", false)).toMatch(/quiet week/);
    expect(scrapbookNote(story, null, "Biscuit", false)).toBe(page.note);
  });

  it("picks the note by how the week went, in the chosen voice", () => {
    const full = weekOn(DAYS, [1, 1, 1, 1, 1, 0, 0], [4, 4, 3, 4, 4, null, null], [null, null, null, null, null, null, null]);
    expect(scrapbookNote(full, "warm", "Biscuit", false)).toMatch(/full week/);
    expect(scrapbookNote(full, "plain", "Biscuit", false)).toMatch(/most days/);
    const light = weekOn(DAYS, [1, 0, 0, 0, 0, 0, 0], [null, null, null, null, null, null, null], [null, null, null, null, null, null, null]);
    expect(scrapbookNote(light, "warm", "Biscuit", false)).toMatch(/came by when you could/);
  });

  it("adds a milestone and the journey steps walked that week", () => {
    const story = weekOn(DAYS, [1, 1, 1, 0, 0, 0, 0], [null, null, null, null, null, null, null], [null, null, null, null, null, null, null]);
    const journeys: JourneyState = {
      version: 1,
      active: { journeyId: "sleep.softer_landing", startedOn: "2026-10-10", doneDays: { "0": "2026-10-10", "1": "2026-10-12", "2": "2026-10-14" } },
      completed: [{ journeyId: "calm.back_to_the_room", startedOn: "2026-10-01", finishedOn: "2026-10-07", doneDays: { "6": "2026-10-07" } }],
    };
    expect(journeyWeek(journeys, MONDAY, SUNDAY)).toEqual({ steps: 2, finished: null, activeId: "sleep.softer_landing" });
    expect(journeyWeek(null, MONDAY, SUNDAY)).toEqual({ steps: 0, finished: null, activeId: null });
    expect(milestoneInWeek({ "7": "2026-10-13", "14": "2026-10-16", "30": null }, MONDAY, SUNDAY)).toBe(14);
    expect(milestoneInWeek({ "7": "2026-10-01" }, MONDAY, SUNDAY)).toBeNull();
    const page = buildScrapbookPage({ story, petName: "Biscuit", journeys, milestones: { "14": "2026-10-16" }, madeAt: "" });
    expect(page.stickers[0]).toMatchObject({ id: "milestone", label: "Two weeks together" });
    const journey = page.stickers.find((s) => s.id === "journey")!;
    expect(journey.label).toBe("2 journey steps");
    // a journey finished that week is named instead
    const finishedState: JourneyState = { version: 1, active: null, completed: [{ journeyId: "calm.back_to_the_room", startedOn: "2026-10-10", finishedOn: "2026-10-16", doneDays: { "6": "2026-10-16" } }] };
    const finished = buildScrapbookPage({ story, petName: "Biscuit", journeys: finishedState, madeAt: "" });
    expect(finished.stickers.find((s) => s.id === "journey")!.detail).toBe("Walked to the end");
  });

  it("in memorial the page is quiet: no milestone, no fullest day, no cheering", () => {
    const story = buildWeekStory({
      endDateKey: SUNDAY,
      checkins: [{ date: "2026-10-14", mood: 1, win: "lit a candle" }],
      metrics: [metric("2026-10-14", 2, 1), metric("2026-10-15", 3, 0)],
      petName: "Biscuit",
      memorial: true,
    });
    const page = buildScrapbookPage({ story, petName: "Biscuit", memorial: true, milestones: { "30": "2026-10-15" }, madeAt: "" });
    expect(page.memorial).toBe(true);
    expect(page.note).toBe("A page for this week, kept in Biscuit's memory. Take the next one at your own pace.");
    const ids = page.stickers.map((s) => s.id);
    expect(ids).not.toContain("milestone");
    expect(ids).not.toContain("fullest");
    expect(page.stickers.find((s) => s.id === "heavier")!.detail).toBeNull();
    expect(page.kept.map((k) => k.text)).toEqual(["lit a candle"]);
  });

  it("caps the notes on the page and trims long ones", () => {
    const long = "x".repeat(400);
    const story = weekOn(DAYS, [1, 1, 1, 1, 1, 1, 1], [3, 3, 3, 3, 3, 3, 3], ["a", "b", "c", "d", "e", "f", long]);
    const page = buildScrapbookPage({ story, petName: "Biscuit", madeAt: "" });
    expect(page.kept).toHaveLength(MAX_KEPT_ON_PAGE);
    expect(page.moreKept).toBe(3);
    const withLong = buildScrapbookPage({ story: { ...story, kept: [{ dateKey: SUNDAY, weekday: "Sunday", text: long }] }, petName: "Biscuit", madeAt: "" });
    expect(withLong.kept[0].text.length).toBeLessThanOrEqual(200);
    expect(withLong.kept[0].text.endsWith("…")).toBe(true);
  });
});

describe("scrapbook: the book on the device", () => {
  const story = buildWeekStory({ endDateKey: SUNDAY, checkins: [], metrics: [metric("2026-10-14", 1, 0)], petName: "Biscuit" });
  const page = buildScrapbookPage({ story, petName: "Biscuit", madeAt: "2026-10-18T10:00:00.000Z" });
  const lastWeek = { ...page, endDateKey: "2026-10-11", startDateKey: "2026-10-05", range: "5–11 Oct" };

  it("keeps one page per Sunday, newest first, a year at most", () => {
    let book = upsertPage({ ...EMPTY_SCRAPBOOK, pages: [] }, lastWeek);
    book = upsertPage(book, page);
    expect(book.pages.map((p) => p.endDateKey)).toEqual([SUNDAY, "2026-10-11"]);
    const refreshed = upsertPage(book, { ...page, note: "later" });
    expect(refreshed.pages).toHaveLength(2);
    expect(pageFor(refreshed, SUNDAY)!.note).toBe("later");
    expect(earlierPages(refreshed, SUNDAY).map((p) => p.endDateKey)).toEqual(["2026-10-11"]);
    let big = { ...EMPTY_SCRAPBOOK, pages: [] } as Scrapbook;
    for (let i = 0; i < MAX_PAGES + 5; i++) big = upsertPage(big, { ...page, endDateKey: `20${String(10 + Math.floor(i / 12)).padStart(2, "0")}-${String((i % 12) + 1).padStart(2, "0")}-01` });
    expect(big.pages).toHaveLength(MAX_PAGES);
  });

  it("survives a round trip and tolerates junk", () => {
    const book = markPageSeen(upsertPage(upsertPage({ ...EMPTY_SCRAPBOOK, pages: [] }, page), lastWeek), SUNDAY);
    expect(normalizeScrapbook(JSON.stringify(book))).toEqual(book);
    expect(normalizeScrapbook("not json")).toEqual(EMPTY_SCRAPBOOK);
    expect(normalizeScrapbook(null)).toEqual(EMPTY_SCRAPBOOK);
    const messy = normalizeScrapbook({
      pages: [{ endDateKey: "2026-13-40", note: "x" }, { endDateKey: SUNDAY }, { ...page, stickers: [{ id: "a" }, page.stickers[0]], kept: [{ text: "" }, { weekday: "Monday", text: "ok" }] }, page],
      lastSeenEnd: 42,
    });
    expect(messy.pages).toHaveLength(1);
    expect(messy.pages[0].stickers).toHaveLength(page.stickers.length > 0 ? 1 : 0);
    expect(messy.pages[0].kept).toEqual([{ weekday: "Monday", text: "ok" }]);
    expect(messy.lastSeenEnd).toBeNull();
  });
});
