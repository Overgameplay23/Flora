import 'react-native-url-polyfill/auto';
import * as SecureStore from 'expo-secure-store';
import { createClient, SupabaseClientOptions } from '@supabase/supabase-js';
import { getSupabaseEnv } from '../utils/env';
import { resilientFetch } from '../utils/net';

// Define a type for the secure store adapter to ensure it adheres to the expected interface.
interface SecureStoreAdapter {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

// Implement the adapter with promises, as required by Supabase.
const ExpoSecureStoreAdapter: SecureStoreAdapter = {
  async getItem(key: string) {
    try {
      return await SecureStore.getItemAsync(key);
    } catch (error) {
      console.error('ExpoSecureStoreAdapter.getItem error:', error);
      return null;
    }
  },
  async setItem(key: string, value: string) {
    try {
      await SecureStore.setItemAsync(key, value);
    } catch (error) {
      console.error('ExpoSecureStoreAdapter.setItem error:', error);
    }
  },
  async removeItem(key: string) {
    try {
      await SecureStore.deleteItemAsync(key);
    } catch (error) {
      console.error('ExpoSecureStoreAdapter.removeItem error:', error);
    }
  },
};

const { rawUrl, rawAnonKey, url: supabaseUrl, anonKey: supabaseAnonKey } = getSupabaseEnv();

if (__DEV__) {
  if (!supabaseUrl) {
    console.error("SUPABASE_URL_NOT_CONFIGURED", { value: rawUrl });
  }
  if (!supabaseAnonKey) {
    console.error("SUPABASE_ANON_KEY_NOT_CONFIGURED", { value: rawAnonKey ? "set" : "missing" });
  }
}

const supabaseOptions: SupabaseClientOptions<'public'> = {
  auth: {
    storage: ExpoSecureStoreAdapter, // Persist session tokens in secure device storage.
    autoRefreshToken: true, // Refresh tokens in the background to keep sessions valid.
    persistSession: true, // Keep users signed in across app restarts.
    detectSessionInUrl: false, // Disable URL-based session parsing (web-only behavior).
  },
  global: {
    fetch: resilientFetch, // Ensure Supabase auth/storage calls use resilient fetch handling.
  },
};

const supabaseUrlForClient = supabaseUrl || "https://invalid.supabase.co";
const supabaseAnonKeyForClient = supabaseAnonKey || "invalid-anon-key";

export const supabase = createClient(
  supabaseUrlForClient,
  supabaseAnonKeyForClient,
  supabaseOptions
);
