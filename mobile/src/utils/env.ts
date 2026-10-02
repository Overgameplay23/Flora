import Constants from "expo-constants";

const PLACEHOLDER_PATTERN = /<your-[^>]+>/i;

export function isPlaceholderValue(value?: string | null): boolean {
  if (!value) return false;
  return PLACEHOLDER_PATTERN.test(value);
}

// The backend profile (APP_ENV=local | staging) is chosen in app.config.js, which reads the profile's
// EXPO_PUBLIC_* values and hands them to the app as `extra.backend`. Reading them from app config, not from
// process.env, means one build-time source of truth: no value from a developer's .env.local can be inlined
// into a staging bundle, and switching profiles needs no code change.
type BackendConfig = {
  supabaseUrl?: string;
  supabaseAnonKey?: string;
  supabaseFunctionsUrl?: string;
  apiUrl?: string;
  petTalkPreview?: string;
  petTalkEnabled?: string;
};

const FROM_APP_CONFIG: Record<string, keyof BackendConfig> = {
  EXPO_PUBLIC_SUPABASE_URL: "supabaseUrl",
  EXPO_PUBLIC_SUPABASE_ANON_KEY: "supabaseAnonKey",
  EXPO_PUBLIC_SUPABASE_FUNCTIONS_URL: "supabaseFunctionsUrl",
  EXPO_PUBLIC_API_URL: "apiUrl",
  EXPO_PUBLIC_PET_TALK_PREVIEW: "petTalkPreview",
  EXPO_PUBLIC_PET_TALK_ENABLED: "petTalkEnabled",
};

function appExtra(): Record<string, any> {
  return (Constants.expoConfig?.extra as Record<string, any> | undefined) ?? {};
}

function readPublicEnv(name: string): string | undefined {
  const field = FROM_APP_CONFIG[name];
  if (field) {
    const value = appExtra().backend?.[field];
    return typeof value === "string" ? value : undefined;
  }
  // Anything else: development and tests only; not available in exported or store bundles.
  return process.env[name];
}

/** The backend profile this build was made for: "local" or "staging". */
export function getAppEnv(): string {
  const value = appExtra().appEnv;
  return typeof value === "string" && value ? value : "local";
}

export function getRawPublicEnv(name: string): string | null {
  const value = readPublicEnv(name);
  if (typeof value !== "string" || value.length === 0) return null;
  return value;
}

export function getValidatedPublicEnv(name: string): string | null {
  const value = getRawPublicEnv(name);
  if (!value || isPlaceholderValue(value)) return null;
  return value;
}

export function getSupabaseEnv() {
  const rawUrl = getRawPublicEnv("EXPO_PUBLIC_SUPABASE_URL");
  const rawAnonKey = getRawPublicEnv("EXPO_PUBLIC_SUPABASE_ANON_KEY");
  return {
    rawUrl,
    rawAnonKey,
    url: rawUrl && !isPlaceholderValue(rawUrl) ? rawUrl : null,
    anonKey: rawAnonKey && !isPlaceholderValue(rawAnonKey) ? rawAnonKey : null,
  };
}

export function isSupabaseUrlConfigured(): boolean {
  return !!getSupabaseEnv().url;
}
