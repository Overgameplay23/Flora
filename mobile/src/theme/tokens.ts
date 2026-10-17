// Luna's design tokens. One source for colour, type, shape and motion so screens stop hard-coding hex
// values (the old dark-slate look had 162 of them). Direction (docs/design-system.md): the painted scene
// and the pet carry the colour, the UI is warm paper with tinted ink, and every care category has its
// own accent so a task list reads at a glance. Contrast figures are WCAG 2.x, computed against the
// surface each token is meant for.

import type { DayPhase } from "../domain/timeOfDay";
import type { CareCategory } from "../domain/plan/types";

// ---- ink and surfaces ----------------------------------------------------------------------------------

export const ink = {
  /** titles and body on paper: 13.8:1 */
  primary: "#2E2838",
  /** meta and secondary: 6.97:1 */
  secondary: "#5C5468",
  /** captions and placeholders: 4.92:1 (AA) */
  tertiary: "#736B7F",
  /** text on night surfaces */
  night: "#F6F1E9",
  nightSecondary: "#C8C1D6",
  nightTertiary: "#9C95B0",
} as const;

export type Surface = {
  /** the page behind everything */
  canvas: string;
  /** cards and sheets */
  paper: string;
  /** paper laid over the painted scene */
  paperOverScene: string;
  /** wells, inputs, empty tracks */
  sunken: string;
  hairline: string;
  track: string;
  text: string;
  textSecondary: string;
  textTertiary: string;
  /** boxShadow for resting cards and for raised sheets */
  shadow: string;
  shadowRaised: string;
  isNight: boolean;
};

export const surfaces: { light: Surface; night: Surface } = {
  light: {
    canvas: "#FBF4EA",
    paper: "#FFFBF6",
    paperOverScene: "rgba(255,251,246,0.9)",
    sunken: "#F4EBDF",
    hairline: "rgba(74,52,40,0.08)",
    track: "#EADFD2",
    text: ink.primary,
    textSecondary: ink.secondary,
    textTertiary: ink.tertiary,
    shadow: "0px 1px 2px rgba(60,40,30,0.06), 0px 6px 16px rgba(60,40,30,0.08)",
    shadowRaised: "0px 2px 4px rgba(60,40,30,0.08), 0px 12px 28px rgba(60,40,30,0.12)",
    isNight: false,
  },
  night: {
    canvas: "#1F2542",
    paper: "#262D4D",
    paperOverScene: "rgba(38,45,77,0.9)",
    sunken: "#1A2038",
    hairline: "rgba(255,255,255,0.08)",
    track: "#323A5E",
    text: ink.night,
    textSecondary: ink.nightSecondary,
    textTertiary: ink.nightTertiary,
    shadow: "0px 8px 24px rgba(5,8,20,0.35)",
    shadowRaised: "0px 12px 32px rgba(5,8,20,0.45)",
    isNight: true,
  },
};

// ---- brand accents -------------------------------------------------------------------------------------

export const brand = {
  /** primary action fill; label in ink (5.53:1) */
  bloom: "#E58A68",
  bloomPressed: "#DA8465",
  /** primary action on night surfaces; label in ink (6.51:1) */
  bloomNight: "#F09A7A",
  /** serious actions (paywall, memorial); label in cream (9.36:1) */
  plum: "#4B3A6E",
  /** links on light surfaces (5.5:1) */
  ember: "#A84B2B",
  /** Sprouts, the soft currency */
  sprout: "#4E8A3E",
  sproutTint: "#E7F1E0",
  /** the Treat Catch biscuit: body, rim and crumb (sprite fills, never text) */
  biscuit: "#C98B5A",
  biscuitRim: "#F2D9BF",
  biscuitCrumb: "#8A5A3A",
  goldRim: "#FFE9A8",
  /** Days Together; fill only, never text (2.1:1 as text) */
  gold: "#E9A23B",
  /** icons and text on goldTint */
  goldStrong: "#8A5A00",
  goldTint: "#FFF2D1",
  cream: "#FFF8F0",
} as const;

// ---- care categories -----------------------------------------------------------------------------------
// tint: card and chip background with ink text (11.6-12.8:1). mid: illustration accents, and icons/text on
// night cards. strong: text, icons, check fills and progress on light surfaces (5.96-7.86:1 on paper).

export type CategoryTone = { tint: string; mid: string; strong: string; label: string };

export const categories: Record<CareCategory, CategoryTone> = {
  calm: { tint: "#EEE8F8", mid: "#B7A6E0", strong: "#5A4897", label: "Calm" },
  rest: { tint: "#E4E9F7", mid: "#9EB0DE", strong: "#384C8E", label: "Rest" },
  energy: { tint: "#FCEADC", mid: "#F2B489", strong: "#9C4A26", label: "Energy" },
  focus: { tint: "#DEF1EC", mid: "#8ACABC", strong: "#1F6559", label: "Focus" },
  body: { tint: "#E7F1E0", mid: "#A7C898", strong: "#406B36", label: "Body" },
  nourish: { tint: "#E0F1F8", mid: "#90C8E3", strong: "#1D5F80", label: "Nourish" },
  connection: { tint: "#FBE5E8", mid: "#EFA6B2", strong: "#9C3650", label: "Connection" },
  cycle: { tint: "#F7E3EE", mid: "#E09EC0", strong: "#8A2C5F", label: "Gentle care" },
  play: { tint: "#FFF2D1", mid: "#F5CF76", strong: "#7E5A00", label: "Play" },
};

export function categoryTone(category: string | null | undefined): CategoryTone {
  return (category && (categories as Record<string, CategoryTone>)[category]) || categories.body;
}

// ---- the sky over the scene, by time of day ------------------------------------------------------------
// The painting is graded per phase in code (one day master, never re-generated). `veil` is a soft band at
// the top of the scene so the greeting stays readable whatever the painting does there.

export type SkyTone = {
  top: string;
  mid: string;
  horizon: string;
  /** the greeting and chips over the scene */
  text: string;
  textSecondary: string;
  /** gradient from the top edge, so header text always has contrast */
  veil: [string, string];
  /** which paper the content sheet uses */
  surface: "light" | "night";
  /** status bar content colour */
  statusBar: "dark" | "light";
};

const DAY_VEIL: [string, string] = ["rgba(255,249,240,0.78)", "rgba(255,249,240,0)"];

export const skies: Record<DayPhase, SkyTone> = {
  dawn: { top: "#A7B5DB", mid: "#F0C6CC", horizon: "#FBE4CB", text: ink.primary, textSecondary: ink.secondary, veil: DAY_VEIL, surface: "light", statusBar: "dark" },
  morning: { top: "#9CC7E8", mid: "#CFE3F1", horizon: "#F7F1E2", text: ink.primary, textSecondary: ink.secondary, veil: DAY_VEIL, surface: "light", statusBar: "dark" },
  day: { top: "#86BEE6", mid: "#BFDDF1", horizon: "#F3F0E4", text: ink.primary, textSecondary: ink.secondary, veil: DAY_VEIL, surface: "light", statusBar: "dark" },
  golden: { top: "#8E9CCB", mid: "#F1B48C", horizon: "#FBD9A3", text: ink.primary, textSecondary: ink.secondary, veil: ["rgba(255,240,220,0.78)", "rgba(255,240,220,0)"], surface: "light", statusBar: "dark" },
  dusk: { top: "#3E4878", mid: "#8B6C9C", horizon: "#E7A29F", text: ink.night, textSecondary: ink.nightSecondary, veil: ["rgba(30,30,62,0.72)", "rgba(30,30,62,0)"], surface: "light", statusBar: "light" },
  night: { top: "#121A33", mid: "#212C55", horizon: "#36426F", text: ink.night, textSecondary: ink.nightSecondary, veil: ["rgba(12,16,38,0.78)", "rgba(12,16,38,0)"], surface: "night", statusBar: "light" },
};

export function skyFor(phase: DayPhase): SkyTone {
  return skies[phase] ?? skies.day;
}

export function surfaceFor(phase: DayPhase): Surface {
  return surfaces[skyFor(phase).surface];
}

// ---- type ----------------------------------------------------------------------------------------------
// Fraunces (a soft storybook serif) for display at 20pt and up; Nunito (rounded, never above 800) for UI.
// Family names are the ones registered by useAppFonts(); until they load the system font stands in.

export const fonts = {
  display: "Fraunces_600SemiBold",
  displayMedium: "Fraunces_500Medium",
  body: "Nunito_400Regular",
  bodyMedium: "Nunito_500Medium",
  bodySemibold: "Nunito_600SemiBold",
  bodyBold: "Nunito_700Bold",
  bodyHeavy: "Nunito_800ExtraBold",
} as const;

export const type = {
  display: { fontFamily: fonts.display, fontSize: 32, lineHeight: 38, letterSpacing: -0.4 },
  title: { fontFamily: fonts.display, fontSize: 26, lineHeight: 32, letterSpacing: -0.2 },
  h2: { fontFamily: fonts.display, fontSize: 22, lineHeight: 28 },
  h3: { fontFamily: fonts.bodyBold, fontSize: 18, lineHeight: 24 },
  body: { fontFamily: fonts.body, fontSize: 16, lineHeight: 23 },
  bodyStrong: { fontFamily: fonts.bodyBold, fontSize: 16, lineHeight: 22 },
  callout: { fontFamily: fonts.bodySemibold, fontSize: 15, lineHeight: 21 },
  meta: { fontFamily: fonts.bodySemibold, fontSize: 13, lineHeight: 18 },
  micro: { fontFamily: fonts.bodyBold, fontSize: 11, lineHeight: 14, letterSpacing: 0.4 },
  petVoice: { fontFamily: fonts.bodyMedium, fontSize: 15, lineHeight: 21 },
} as const;

// ---- shape and space -----------------------------------------------------------------------------------

export const radius = { sheet: 32, hero: 28, card: 24, row: 22, tile: 16, chip: 14, pill: 999 } as const;
export const space = { gutter: 20, cardPad: 16, rowGap: 10, sectionGap: 28 } as const;

// ---- motion --------------------------------------------------------------------------------------------
// Springs for Animated.spring (RN core). `bouncy` is reserved for the pet and the check "pop".

export const springs = {
  settle: { damping: 26, stiffness: 220, mass: 1 },
  snappy: { damping: 22, stiffness: 340, mass: 0.9 },
  bouncy: { damping: 11, stiffness: 260, mass: 0.9 },
} as const;

export const timing = { fadeFast: 160, fade: 240, enter: 420 } as const;
