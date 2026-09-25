import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';
import { createClient, type SupabaseClientOptions } from '@supabase/supabase-js';

const extra = (Constants.expoConfig?.extra ?? {}) as Record<string, string | undefined>;
const supabaseUrl = extra.EXPO_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey = extra.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

const storageAdapter = {
  getItem: (key: string) => SecureStore.getItemAsync(key),
  setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
};

const options: SupabaseClientOptions<'public'> = {
  auth: {
    storage: storageAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
};

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = createClient(
  supabaseUrl || 'https://invalid.supabase.co',
  supabaseAnonKey || 'invalid-anon-key',
  options,
);
