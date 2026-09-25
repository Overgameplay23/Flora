const PLACEHOLDER_PATTERN = /<your-[^>]+>/i;

export function isPlaceholderValue(value?: string | null): boolean {
  if (!value) return false;
  return PLACEHOLDER_PATTERN.test(value);
}

// Expo only inlines STATIC references (process.env.EXPO_PUBLIC_X) into production bundles.
// A dynamic lookup such as process.env[name] works under `expo start` but is undefined in any
// exported or store build, which silently left production unconfigured. Every public variable the
// app reads must therefore be listed here by name.
function readPublicEnv(name: string): string | undefined {
  switch (name) {
    case "EXPO_PUBLIC_SUPABASE_URL":
      return process.env.EXPO_PUBLIC_SUPABASE_URL;
    case "EXPO_PUBLIC_SUPABASE_ANON_KEY":
      return process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
    case "EXPO_PUBLIC_SUPABASE_FUNCTIONS_URL":
      return process.env.EXPO_PUBLIC_SUPABASE_FUNCTIONS_URL;
    case "EXPO_PUBLIC_API_URL":
      return process.env.EXPO_PUBLIC_API_URL;
    default:
      // Development and tests only; not available in production bundles.
      return process.env[name];
  }
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
