import { getSupabaseEnv, getValidatedPublicEnv, isPlaceholderValue, isSupabaseUrlConfigured } from "../utils/env";

const KEYS = ["EXPO_PUBLIC_SUPABASE_URL", "EXPO_PUBLIC_SUPABASE_ANON_KEY", "EXPO_PUBLIC_TEST_VALUE"];
const saved: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const key of KEYS) {
    saved[key] = process.env[key];
    delete process.env[key];
  }
});

afterEach(() => {
  for (const key of KEYS) {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
  }
});

describe("isPlaceholderValue", () => {
  it("recognises the app.json placeholder shape only", () => {
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

describe("getSupabaseEnv", () => {
  it("keeps the raw value but nulls the validated value for placeholders", () => {
    process.env.EXPO_PUBLIC_SUPABASE_URL = "https://<your-project>.supabase.co";
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = "<your-anon-key>";
    const env = getSupabaseEnv();
    expect(env.rawUrl).toBe("https://<your-project>.supabase.co");
    expect(env.url).toBeNull();
    expect(env.anonKey).toBeNull();
    expect(isSupabaseUrlConfigured()).toBe(false);
  });

  it("reports configured when a real URL is present", () => {
    process.env.EXPO_PUBLIC_SUPABASE_URL = "https://abcdefghijklmnopqrst.supabase.co";
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = "not-a-placeholder";
    expect(isSupabaseUrlConfigured()).toBe(true);
    expect(getSupabaseEnv().anonKey).toBe("not-a-placeholder");
  });
});
