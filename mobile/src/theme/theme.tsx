// The app-wide theme: which paper (light or night) every screen is on, the matching navigation colours and
// status bar, all following the local time of day the way Home's sky does (docs/design-system.md, "Light is
// the brand"). One provider at the root ticks the clock; screens read it with useTheme().

import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { AppState } from "react-native";
import type { Theme as NavigationTheme } from "@react-navigation/native";
import { dayPhase, type DayPhase } from "../domain/timeOfDay";
import { brand, categoryTone, fonts, skyFor, surfaceFor, type CategoryTone, type SkyTone, type Surface } from "./tokens";

export type AppTheme = {
  phase: DayPhase;
  sky: SkyTone;
  surface: Surface;
  night: boolean;
  /** primary action fill for this paper; its label is always ink */
  bloom: string;
  /** links and inline actions */
  link: string;
  /** quiet warnings and "could not save" lines */
  alert: string;
  /** status bar content for this paper */
  statusBar: "dark" | "light";
  /** a category's colours as they sit on this paper: `fill` behind content, `accent` for icons and text */
  tone: (category: string | null | undefined) => CategoryTone & { fill: string; accent: string; tileOnFill: string };
};

export function themeFor(phase: DayPhase): AppTheme {
  const surface = surfaceFor(phase);
  const night = surface.isNight;
  return {
    phase,
    sky: skyFor(phase),
    surface,
    night,
    bloom: night ? brand.bloomNight : brand.bloom,
    // ember is 5.5:1 on light paper; on night paper the rose mid reads (ember would not)
    link: night ? "#F2B489" : brand.ember,
    alert: night ? "#EFA6B2" : "#9C3650",
    statusBar: night ? "light" : "dark",
    tone: (category) => {
      const tone = categoryTone(category);
      return {
        ...tone,
        fill: night ? surface.paper : tone.tint,
        accent: night ? tone.mid : tone.strong,
        tileOnFill: night ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.7)",
      };
    },
  };
}

/** React Navigation colours for the native-stack headers and screen backgrounds. */
export function navigationThemeFor(theme: AppTheme): NavigationTheme {
  const { surface } = theme;
  return {
    dark: theme.night,
    colors: {
      primary: surface.text,
      background: surface.canvas,
      card: surface.canvas,
      text: surface.text,
      border: surface.hairline,
      notification: theme.bloom,
    },
    fonts: {
      regular: { fontFamily: fonts.body, fontWeight: "400" },
      medium: { fontFamily: fonts.bodySemibold, fontWeight: "600" },
      // header titles use `bold`: the storybook serif, as everywhere titles are 20pt and up
      bold: { fontFamily: fonts.display, fontWeight: "600" },
      heavy: { fontFamily: fonts.bodyHeavy, fontWeight: "800" },
    },
  };
}

type ThemeState = { theme: AppTheme; hour: number };

const ThemeContext = createContext<ThemeState | null>(null);

/**
 * Keeps the time-of-day phase current (every minute, and whenever the app comes back to the front).
 * `hour` pins it, for the design previews (?hour=21).
 */
export function ThemeProvider({ hour: fixedHour = null, children }: { hour?: number | null; children: React.ReactNode }) {
  const [hour, setHour] = useState(() => new Date().getHours());
  useEffect(() => {
    if (fixedHour != null) return undefined;
    const tick = () => setHour(new Date().getHours());
    const id = setInterval(tick, 60_000);
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") tick();
    });
    return () => {
      clearInterval(id);
      sub.remove();
    };
  }, [fixedHour]);
  const effective = fixedHour ?? hour;
  const phase = dayPhase(effective);
  const value = useMemo(() => ({ theme: themeFor(phase), hour: effective }), [phase, effective]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

/** The current theme. Outside a provider (tests, isolated renders) it is read from the clock once. */
export function useTheme(): AppTheme {
  const state = useContext(ThemeContext);
  return state?.theme ?? themeFor(dayPhase(new Date().getHours()));
}

/** The hour the theme is following (pinned in previews). */
export function useThemeHour(): number {
  return useContext(ThemeContext)?.hour ?? new Date().getHours();
}
