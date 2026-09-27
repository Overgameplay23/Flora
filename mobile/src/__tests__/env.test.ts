jest.mock("expo-constants", () => ({ __esModule: true, default: { expoConfig: null } }));

import { getAppEnv, getRawPublicEnv, getSupabaseEnv, getValidatedPublicEnv, isPlaceholderValue, isSupabaseUrlConfigured } from "../utils/env";

const KEYS = ["EXPO_PUBLIC_SUPABASE_URL", "EXPO_PUBLIC_SUPABASE_ANON_KEY", "EXPO_PUBLIC_TEST_VALUE"];
const saved: Record<string, string | undefined> = {};

const mockConstants: { expoConfig: any } = jest.requireMock("expo-constants").default;

function useBackend(backend: Record<string, string> | null, appEnv?: string) {
  mockConstants.expoConfig = backend ? { extra: { appEnv, backend } } : null;
}

beforeEach(() => {
  for (const key of KEYS) {
    saved[key] = process.env[key];
    delete process.env[key];
  }
  useBackend(null);
});

afterEach(() => {
  for (const key of KEYS) {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
  }
});

describe("isPlaceholderValue", () => {
  it("recognises the placeholder shape only", () => {
    expect(isPlaceholderValue("https://<your-project>.supabase.co")).toBe(true);
    expect(isPlaceholderValue("<YOUR-ANON-KEY>")).toBe(true);
    expect(isPlaceholderValue("https://abcdefghijklmnopqrst.supabase.co")).toBe(false);
    expect(isPlaceholderValue("")).toBe(false);
    expect(isPlaceholderValue(null)).toBe(false);
  });
});

describe("getValidatedPublicEnv", () => {
  it("returns null for missing, empty, or placeholder values", () => {
    expect(getValidatedPublicEnv("EXPO_PUBLIC_TEST_VALUE")).toBeNull();
    process.env.EXPO_PUBLIC_TEST_VALUE = "";
    expect(getValidatedPublicEnv("EXPO_PUBLIC_TEST_VALUE")).toBeNull();
    process.env.EXPO_PUBLIC_TEST_VALUE = "<your-value>";
    expect(getValidatedPublicEnv("EXPO_PUBLIC_TEST_VALUE")).toBeNull();
    process.env.EXPO_PUBLIC_TEST_VALUE = "real";
    expect(getValidatedPublicEnv("EXPO_PUBLIC_TEST_VALUE")).toBe("real");
  });
});

describe("backend values come from app config (app.config.js -> extra.backend)", () => {
  it("reads the profile's URL, key and flags", () => {
    useBackend({ supabaseUrl: "https://abcdefghijklmnopqrst.supabase.co", supabaseAnonKey: "sb_publishable_x", supabaseFunctionsUrl: "", petTalkPreview: "1" }, "staging");
    expect(getSupabaseEnv()).toEqual({
      rawUrl: "https://abcdefghijklmnopqrst.supabase.co",
      rawAnonKey: "sb_publishable_x",
      url: "https://abcdefghijklmnopqrst.supabase.co",
      anonKey: "sb_publishable_x",
    });
    expect(getRawPublicEnv("EXPO_PUBLIC_SUPABASE_FUNCTIONS_URL")).toBeNull();
    expect(getRawPublicEnv("EXPO_PUBLIC_PET_TALK_PREVIEW")).toBe("1");
    expect(getAppEnv()).toBe("staging");
    expect(isSupabaseUrlConfigured()).toBe(true);
  });

  it("ignores stray EXPO_PUBLIC_SUPABASE_* in the process environment", () => {
    process.env.EXPO_PUBLIC_SUPABASE_URL = "http://192.168.1.20:56321";
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = "local-key";
    useBackend({ supabaseUrl: "https://abcdefghijklmnopqrst.supabase.co", supabaseAnonKey: "sb_publishable_x" }, "staging");
    expect(getSupabaseEnv().url).toBe("https://abcdefghijklmnopqrst.supabase.co");
    expect(getSupabaseEnv().anonKey).toBe("sb_publishable_x");
  });

  it("is unconfigured, not guessed, when app config has no backend", () => {
    process.env.EXPO_PUBLIC_SUPABASE_URL = "http://192.168.1.20:56321";
    expect(getSupabaseEnv()).toEqual({ rawUrl: null, rawAnonKey: null, url: null, anonKey: null });
    expect(isSupabaseUrlConfigured()).toBe(false);
    expect(getAppEnv()).toBe("local");
  });

  it("keeps the raw value but nulls the validated value for placeholders", () => {
    useBackend({ supabaseUrl: "https://<your-project>.supabase.co", supabaseAnonKey: "<your-anon-key>" });
    const env = getSupabaseEnv();
    expect(env.rawUrl).toBe("https://<your-project>.supabase.co");
    expect(env.url).toBeNull();
    expect(env.anonKey).toBeNull();
    expect(isSupabaseUrlConfigured()).toBe(false);
  });
});
