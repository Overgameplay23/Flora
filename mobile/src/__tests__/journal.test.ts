import { addEntry, groupByDay, humanDay, makeEntryId, mergeEntries, normalizeEntries, removeEntry } from "../domain/journal";

describe("journal entries", () => {
  it("normalises device and server rows alike, newest first, dropping junk and duplicates", () => {
    const rows = [
      { id: "a", entry_text: "  server row ", entry_date: "2026-09-24", created_at: "2026-09-24T10:00:00.000Z" },
      { id: "b", text: "device row", date: "2026-09-25", prompt: " Who made you smile? ", createdAt: "2026-09-25T08:00:00.000Z" },
      { id: "b", text: "duplicate", createdAt: "2026-09-25T09:00:00.000Z" },
      { id: "c", text: "   " },
      null,
      { text: "no id" },
    ];
    const entries = normalizeEntries(rows);
    expect(entries.map((e) => e.id)).toEqual(["b", "a"]);
    expect(entries[0].prompt).toBe("Who made you smile?");
    expect(entries[1]).toEqual({ id: "a", date: "2026-09-24", text: "server row", prompt: null, createdAt: "2026-09-24T10:00:00.000Z" });
  });

  it("falls back to the created timestamp for the day when the date is missing", () => {
    const [entry] = normalizeEntries([{ id: "x", text: "hi", created_at: "2026-09-20T23:30:00.000Z" }]);
    expect(entry.date).toBe("2026-09-20");
  });

  it("adds, removes and merges by id", () => {
    let entries = addEntry([], { text: "first", date: "2026-09-25", createdAt: "2026-09-25T07:00:00.000Z", id: "one" });
    entries = addEntry(entries, { text: "second", prompt: "Q?", date: "2026-09-25", createdAt: "2026-09-25T09:00:00.000Z", id: "two" });
    expect(addEntry(entries, { text: "   " })).toBe(entries);
    expect(entries.map((e) => e.id)).toEqual(["two", "one"]);
    expect(removeEntry(entries, "one").map((e) => e.id)).toEqual(["two"]);
    const server = [{ id: "one", text: "first", date: "2026-09-25", prompt: null, createdAt: "2026-09-25T07:00:00.000Z" }, { id: "three", text: "older", date: "2026-09-01", prompt: null, createdAt: "2026-09-01T07:00:00.000Z" }];
    expect(mergeEntries(entries, server).map((e) => e.id)).toEqual(["two", "one", "three"]);
  });

  it("makes uuid-shaped ids", () => {
    expect(makeEntryId()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(makeEntryId()).not.toBe(makeEntryId());
  });

  it("groups by day with human labels", () => {
    const entries = [
      { id: "1", text: "a", date: "2026-09-25", prompt: null, createdAt: "2026-09-25T09:00:00.000Z" },
      { id: "2", text: "b", date: "2026-09-25", prompt: null, createdAt: "2026-09-25T08:00:00.000Z" },
      { id: "3", text: "c", date: "2026-09-24", prompt: null, createdAt: "2026-09-24T08:00:00.000Z" },
      { id: "4", text: "d", date: "2026-09-20", prompt: null, createdAt: "2026-09-20T08:00:00.000Z" },
    ];
    const days = groupByDay(entries, "2026-09-25");
    expect(days.map((d) => [d.label, d.entries.length])).toEqual([
      ["Today", 2],
      ["Yesterday", 1],
      ["Sun 20 Sep", 1],
    ]);
    expect(humanDay("2026-09-25", "2026-09-25")).toBe("Today");
  });
});
