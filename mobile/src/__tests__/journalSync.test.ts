jest.mock("@react-native-async-storage/async-storage", () => require("@react-native-async-storage/async-storage/jest/async-storage-mock"));
let mockOffline = false;
let mockDeleteFailure = false;
let mockRows: Record<string, any>[] = [];
jest.mock("../lib/supabase", () => ({ supabase: { from: () => ({
  upsert: async (row: any) => {
    if (mockOffline) return { error: { message: "offline" } };
    mockRows = [...mockRows.filter((existing) => existing.id !== row.id), row];
    return { error: null };
  },
  select: () => ({ eq: (_: string, userId: string) => ({ order: () => ({ limit: async () => ({ data: mockRows.filter((row) => row.user_id === userId), error: mockOffline ? { message: "offline" } : null }) }) }) }),
  delete: () => ({ eq: (_: string, userId: string) => ({ eq: async (_: string, id: string) => {
    if (mockOffline || mockDeleteFailure) return { error: { message: "offline" } };
    mockRows = mockRows.filter((row) => row.user_id !== userId || row.id !== id);
    return { error: null };
  } }) }),
}) } }));
import AsyncStorage from "@react-native-async-storage/async-storage";
import { deleteJournalEntry, loadJournal, writeJournalEntry } from "../services/journalStore";

beforeEach(async () => {
  await AsyncStorage.clear(); mockOffline = false; mockDeleteFailure = false; mockRows = [];
  jest.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

it("persists an offline save and retries it without duplicates when the journal reopens", async () => {
  mockOffline = true;
  const saved = await writeJournalEntry("a", "A quiet walk", null);
  expect(mockRows).toHaveLength(0);
  expect(JSON.parse((await AsyncStorage.getItem("floura:journal:a"))!).pending).toEqual([saved[0].id]);
  mockOffline = false;
  expect(await loadJournal("a")).toEqual(saved);
  await loadJournal("a");
  expect(mockRows).toHaveLength(1);
  expect(JSON.parse((await AsyncStorage.getItem("floura:journal:a"))!).pending).toEqual([]);
});
it("hides a deleted entry even when the delete fails but the server read succeeds", async () => {
  const saved = await writeJournalEntry("a", "Private line", null);
  mockDeleteFailure = true;
  expect(await deleteJournalEntry("a", saved[0].id)).toEqual([]);
  expect(mockRows).toHaveLength(1);
  expect(await loadJournal("a")).toEqual([]);
  mockDeleteFailure = false;
  expect(await loadJournal("a")).toEqual([]);
  expect(mockRows).toHaveLength(0);
});
it("never uploads an offline entry removed before reconnecting", async () => {
  mockOffline = true;
  const saved = await writeJournalEntry("a", "Changed my mind", null);
  await deleteJournalEntry("a", saved[0].id);
  mockOffline = false;
  await loadJournal("a");
  expect(mockRows).toEqual([]);
});
it("serializes simultaneous saves and keeps users separate", async () => {
  await Promise.all([writeJournalEntry("a", "One", null), writeJournalEntry("a", "Two", null), writeJournalEntry("b", "Other", null)]);
  expect((await loadJournal("a")).map((entry) => entry.text).sort()).toEqual(["One", "Two"]);
  expect((await loadJournal("b")).map((entry) => entry.text)).toEqual(["Other"]);
});
it("reads the previous array storage format without losing entries", async () => {
  const legacy = [{ id: "legacy", date: "2026-10-17", createdAt: "2026-10-17T12:00:00.000Z", text: "Kept before the update", prompt: null }];
  await AsyncStorage.setItem("floura:journal:a", JSON.stringify(legacy));
  expect(await loadJournal("a")).toEqual(legacy);
});
it("does not report a save when the phone cannot persist it", async () => {
  jest.spyOn(AsyncStorage, "setItem").mockRejectedValueOnce(new Error("storage full"));
  await expect(writeJournalEntry("a", "Keep me", null)).rejects.toThrow("storage full");
  expect(mockRows).toEqual([]);
});
