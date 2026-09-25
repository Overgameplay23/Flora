const PLACEHOLDER_PATTERN = /<your-[^>]+>/i;

export function isPlaceholderValue(value?: string | null): boolean {
  if (!value) return false;
  return PLACEHOLDER_PATTERN.test(value);
}

export function getRawPublicEnv(name: string): string | null {
  const value = process.env[name];
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
