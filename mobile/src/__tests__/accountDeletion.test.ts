jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);

const mockCalls: string[] = [];
const mockStorage = {
  folders: {} as Record<string, { name: string; id: string | null }[]>,
  listError: null as null | { message: string },
  removed: [] as string[],
};
const mockRpc = { error: null as null | { message: string } };

jest.mock("../lib/supabase", () => ({
  supabase: {
    storage: {
      from: () => ({
        list: async (folder: string, { offset, limit }: { offset: number; limit: number }) => {
          mockCalls.push(`list ${folder}`);
          return mockStorage.listError ? { data: null, error: mockStorage.listError } : { data: (mockStorage.folders[folder] ?? []).slice(offset, offset + limit), error: null };
        },
        remove: async (paths: string[]) => {
          mockCalls.push("remove");
          mockStorage.removed.push(...paths);
          return { data: [], error: null };
        },
      }),
    },
    rpc: async (name: string) => {
      mockCalls.push(`rpc ${name}`);
      return { data: null, error: mockRpc.error };
    },
    auth: {
      signOut: async (options: unknown) => {
        mockCalls.push(`signOut ${JSON.stringify(options)}`);
        return { error: null };
      },
    },
  },
}));
jest.mock("../services/reminders", () => ({
  cancelReminders: async () => {
    mockCalls.push("cancelReminders");
  },
}));

import AsyncStorage from "@react-native-async-storage/async-storage";
import { AccountDeletionError, confirmWordMatches, deleteMyAccount, deviceKeysFor } from "../services/accountDeletion";

const ME = "aaaaaaaa-0000-4000-8000-00000000000a";
const OTHER = "bbbbbbbb-0000-4000-8000-00000000000b";

beforeEach(async () => {
  mockCalls.length = 0;
  mockStorage.folders = {};
  mockStorage.listError = null;
  mockStorage.removed = [];
  mockRpc.error = null;
  await AsyncStorage.clear();
});

describe("account deletion", () => {
  it("removes every page and nested folder before deleting an account", async () => {
    mockStorage.folders[ME] = Array.from({ length: 1001 }, (_, index) => ({ name: `photo-${index}.jpg`, id: String(index) }));
    mockStorage.folders[ME].push({ name: "processed", id: null });
    mockStorage.folders[`${ME}/processed`] = [{ name: "portrait.png", id: "portrait" }];
    await deleteMyAccount(ME);
    expect(mockStorage.removed).toHaveLength(1002);
    expect(new Set(mockStorage.removed).size).toBe(1002);
    expect(mockStorage.removed).toContain(`${ME}/processed/portrait.png`);
    expect(mockCalls.filter((call) => call === "remove")).toHaveLength(2);
    expect(mockCalls.lastIndexOf("remove")).toBeLessThan(mockCalls.indexOf("rpc delete_my_account"));
  });
  it("asks for the word, nothing else", () => {
    expect(confirmWordMatches("delete")).toBe(true);
    expect(confirmWordMatches("  DELETE ")).toBe(true);
    expect(confirmWordMatches("delet")).toBe(false);
    expect(confirmWordMatches("delete everything")).toBe(false);
    expect(confirmWordMatches("")).toBe(false);
    expect(confirmWordMatches(undefined)).toBe(false);
  });

  it("finds this person's keys on the phone, and only theirs", () => {
    const keys = [
      `floura:cycle:${ME}`,
      `floura:journal:${ME}`,
      `floura:energy:${ME}:2026-10-17`,
      `habit_overrides_v1:${ME}`,
      `floura:cycle:${OTHER}`,
      "user_habits_v1",
      "pending_completions",
      "sb-127-auth-token",
    ];
    expect(deviceKeysFor(ME, keys).sort()).toEqual(
      [`floura:cycle:${ME}`, `floura:energy:${ME}:2026-10-17`, `floura:journal:${ME}`, `habit_overrides_v1:${ME}`, "pending_completions", "user_habits_v1"].sort()
    );
    expect(deviceKeysFor("", keys)).toEqual([]);
  });

  it("removes the photos, then the account, then what the phone kept, then signs out locally", async () => {
    mockStorage.folders[ME] = [
      { name: "original.jpg", id: "1" },
      { name: "processed", id: null },
    ];
    mockStorage.folders[`${ME}/processed`] = [
      { name: "stylized.png", id: "2" },
      { name: "cutout.png", id: "3" },
    ];
    await AsyncStorage.multiSet([
      [`floura:cycle:${ME}`, "{}"],
      [`floura:scrapbook:${ME}`, "[]"],
      [`floura:cycle:${OTHER}`, "{}"],
    ]);

    await deleteMyAccount(ME);

    expect(mockStorage.removed.sort()).toEqual([`${ME}/original.jpg`, `${ME}/processed/cutout.png`, `${ME}/processed/stylized.png`]);
    expect(mockCalls).toEqual([`list ${ME}`, `list ${ME}/processed`, "remove", "rpc delete_my_account", "cancelReminders", 'signOut {"scope":"local"}']);
    expect(await AsyncStorage.getAllKeys()).toEqual([`floura:cycle:${OTHER}`]);
  });

  it("stops before the account and keeps the phone as it was when the photos cannot be removed", async () => {
    mockStorage.listError = { message: "offline" };
    await AsyncStorage.setItem(`floura:journal:${ME}`, "[]");

    await expect(deleteMyAccount(ME)).rejects.toMatchObject({ step: "photos" });
    expect(mockCalls).toEqual([`list ${ME}`]);
    expect(await AsyncStorage.getItem(`floura:journal:${ME}`)).toBe("[]");
  });

  it("keeps the phone as it was when the server refuses", async () => {
    mockRpc.error = { message: "network" };
    await AsyncStorage.setItem(`floura:journal:${ME}`, "[]");

    const failure = await deleteMyAccount(ME).catch((error) => error);
    expect(failure).toBeInstanceOf(AccountDeletionError);
    expect(failure.step).toBe("account");
    expect(mockCalls).not.toContain("cancelReminders");
    expect(mockCalls.some((call) => call.startsWith("signOut"))).toBe(false);
    expect(await AsyncStorage.getItem(`floura:journal:${ME}`)).toBe("[]");
  });
});
