import * as AppleAuthentication from 'expo-apple-authentication';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';

import { isSupabaseConfigured, supabase } from '@/lib/supabase';

WebBrowser.maybeCompleteAuthSession();

export async function signInWithApple() {
  if (!isSupabaseConfigured) {
    return { ok: false as const, message: 'Supabase env is not configured yet.' };
  }

  const available = await AppleAuthentication.isAvailableAsync();
  if (!available) {
    return { ok: false as const, message: 'Apple sign-in is only available on a supported iPhone build.' };
  }

  const credential = await AppleAuthentication.signInAsync({
    requestedScopes: [
      AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
      AppleAuthentication.AppleAuthenticationScope.EMAIL,
    ],
  });

  if (!credential.identityToken) {
    return { ok: false as const, message: 'Apple did not return an identity token.' };
  }

  const { error } = await supabase.auth.signInWithIdToken({
    provider: 'apple',
    token: credential.identityToken,
  });

  if (error) {
    return { ok: false as const, message: error.message };
  }

  return { ok: true as const };
}

export async function sendMagicLink(email: string) {
  if (!isSupabaseConfigured) {
    return { ok: false as const, message: 'Supabase env is not configured yet.' };
  }

  const redirectTo = AuthSession.makeRedirectUri({
    path: 'auth',
    preferLocalhost: true,
  });

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: redirectTo },
  });

  if (error) {
    return { ok: false as const, message: error.message };
  }

  return { ok: true as const };
}

