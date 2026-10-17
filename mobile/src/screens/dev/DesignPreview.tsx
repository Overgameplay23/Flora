import React, { useMemo, useState } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { PreviewAuthProvider } from "../../contexts/AuthContext";
import { pinPetForPreview } from "../../services/petStore";
import { DEFAULT_LOOK } from "../../domain/petLook";
import { ThemeProvider, navigationThemeFor, useTheme } from "../../theme/theme";
import HomePreviewScreen from "./HomePreviewScreen";
import AppNavigator, { stackScreenOptions } from "../../../app/navigation/AppNavigator";
import { SplashScreen, UnreachableScreen } from "../../../app/navigation/RootNavigator";
import LoginScreen from "../LoginScreen";
import SignupScreen from "../SignupScreen";
import OnboardingScreen from "../onboarding/OnboardingScreen";

// Dev-only design previews on web, so every screen can be checked in a browser without signing in:
//   ?preview=<name>   home, garden, pet, profile, checkin, journal, breathing, week, insights, cycle,
//                     reminders, memorial, play, fetch, bubbles, petting, treats, tasks, habits, journeys, keepsakes, talk,
//                     painting, painted, onboarding, login, signup, splash, unreachable
//   &hour=21          pin the time of day (night paper from 21:00 to 05:00)
//   &pet=cat|none     which fixture pet (default: a golden dog called Biscuit)
//   &memorial=1       the pet has passed away
// Screens render for a signed-in looking user with no session behind it, so anything they load from the
// backend comes back empty or fails and they show their empty / error states (onboarding: the steps that
// save stop at "couldn't save"; painting/painted show their no-photo states). Never shipped: App.js only
// routes here under __DEV__ on web.

const ROUTES: Record<string, string> = {
  garden: "Garden",
  pet: "Pet",
  profile: "Profile",
  checkin: "CheckIn",
  journal: "Journal",
  breathing: "Breathing",
  week: "WeeklyReflection",
  scrapbook: "Scrapbook",
  insights: "Insights",
  cycle: "Cycle",
  reminders: "Reminders",
  memorial: "Memorial",
  play: "Play",
  fetch: "PlayFetch",
  bubbles: "PlayBubbles",
  petting: "PlayPetting",
  treats: "PlayTreats",
  memory: "PlayMemory",
  tasks: "Tasks",
  habits: "Habits",
  journeys: "Journeys",
  keepsakes: "Keepsakes",
  talk: "PetTalk",
  painting: "PetStylizeLoading",
  painted: "PetStylizeResult",
};

const PREVIEW_USER = { id: "00000000-0000-4000-8000-00000000d351", email: "preview@floura.app" };

function queryParam(name: string): string | null {
  if (typeof window === "undefined" || !window.location) return null;
  try {
    return new URLSearchParams(window.location.search).get(name);
  } catch (_error) {
    return null;
  }
}

const AuthStack = createNativeStackNavigator();

function PreviewBody({ name }: { name: string }) {
  const theme = useTheme();
  const navigationTheme = useMemo(() => navigationThemeFor(theme), [theme]);
  if (name === "home") return <HomePreviewScreen />;
  if (name === "splash") return <SplashScreen />;
  if (name === "unreachable") return <UnreachableScreen retrying={false} onRetry={() => {}} onSignOut={() => {}} />;
  if (name === "login" || name === "signup") {
    return (
      <NavigationContainer theme={navigationTheme}>
        <AuthStack.Navigator id="preview-auth" initialRouteName={name === "signup" ? "Signup" : "Login"} screenOptions={{ headerShown: false }}>
          <AuthStack.Screen name="Login" component={LoginScreen} />
          <AuthStack.Screen name="Signup" component={SignupScreen} />
        </AuthStack.Navigator>
      </NavigationContainer>
    );
  }
  if (name === "onboarding") {
    // the first run, the way a new account sees it (use &pet=none so no fixture pet stands in)
    return (
      <NavigationContainer theme={navigationTheme}>
        <AuthStack.Navigator id="preview-onboarding" screenOptions={{ headerShown: false }}>
          <AuthStack.Screen name="Onboarding" component={OnboardingScreen} initialParams={{ mode: "first" }} />
        </AuthStack.Navigator>
      </NavigationContainer>
    );
  }
  const route = ROUTES[name] ?? "Home";
  return (
    <NavigationContainer theme={navigationTheme}>
      <AppNavigator initialRoute={route} />
    </NavigationContainer>
  );
}

export default function DesignPreview({ name }: { name: string }) {
  const hourParam = queryParam("hour");
  const hour = hourParam !== null && Number.isFinite(Number(hourParam)) ? Number(hourParam) : null;
  const signedOut = name === "login" || name === "signup" || name === "splash";
  // pin the fixture pet once, before the first render reads the store
  useState(() => {
    const kind = queryParam("pet");
    const look = kind === "none" ? null : kind === "cat" ? { ...DEFAULT_LOOK.cat } : { ...DEFAULT_LOOK.dog };
    pinPetForPreview({
      userId: signedOut ? null : PREVIEW_USER.id,
      pet: null,
      sources: { stylized: null, cutout: null, mask: null, photo: null, original: null },
      name: look ? (kind === "cat" ? "Miso" : "Biscuit") : "",
      look,
      memorial: queryParam("memorial") === "1" ? { since: "2026-09-28", note: "The best boy on every walk." } : null,
      status: "ready",
      error: null,
    });
    return true;
  });
  const profile = useMemo(
    () => ({ user_id: PREVIEW_USER.id, created_at: "2026-10-01T09:00:00Z", current_streak: 4, best_streak: 9, pet_photo_url: null }),
    []
  );
  return (
    <SafeAreaProvider>
      <ThemeProvider hour={hour}>
        <PreviewAuthProvider user={signedOut ? null : PREVIEW_USER} initialProfile={signedOut ? null : profile}>
          <PreviewBody name={name} />
        </PreviewAuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
