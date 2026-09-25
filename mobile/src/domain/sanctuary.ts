// Which sanctuary a pet lives in (product strategy report, "Species Dynamics"): dogs are outdoor and
// kinesthetic, so a dog keeps the garden; cats are interior and calming, so a cat gets a window nook.
// The words the app uses for the place follow from that, so copy stays in one voice per species.

export type SanctuaryTheme = "garden" | "nook";

export function sanctuaryFor(species?: string | null): SanctuaryTheme {
  return String(species || "").toLowerCase() === "cat" ? "nook" : "garden";
}

export type SanctuaryCopy = {
  /** "garden" / "window nook" — used inside sentences */
  place: string;
  /** Garden tab title and subtitle */
  tabTitle: string;
  tabSubtitle: string;
  /** what a plant is called before it is bought, and the verbs for buying and levelling */
  unplanted: string;
  plantVerb: string;
  growVerb: string;
  /** what one growing thing is called: "plant" / "pot" */
  plantWord: string;
  /** the Pet tab stat label */
  plantsStat: string;
  /** what the pet is doing when calm */
  calmLine: (name: string) => string;
  /** what the pet is doing when excited */
  excitedLine: (name: string) => string;
};

const GARDEN: SanctuaryCopy = {
  place: "garden",
  tabTitle: "Your garden",
  tabSubtitle: "Every small thing you do grows something here.",
  unplanted: "Not planted yet",
  plantVerb: "Plant",
  growVerb: "Grow",
  plantWord: "plant",
  plantsStat: "plants growing",
  calmLine: (name) => `${name} is calm, watching the garden.`,
  excitedLine: (name) => `${name} is full of beans today.`,
};

const NOOK: SanctuaryCopy = {
  place: "window nook",
  tabTitle: "Your window nook",
  tabSubtitle: "Pots on the sill, grown by the small things you do.",
  unplanted: "Not potted yet",
  plantVerb: "Pot",
  growVerb: "Grow",
  plantWord: "pot",
  plantsStat: "pots growing",
  calmLine: (name) => `${name} is calm, watching the window.`,
  excitedLine: (name) => `${name} has the zoomies.`,
};

export function sanctuaryCopy(theme: SanctuaryTheme): SanctuaryCopy {
  return theme === "nook" ? NOOK : GARDEN;
}

/** Stage word for a plant card, from the scene's growth stages. */
export function stageWord(stage: "seed" | "sproutSmall" | "sprout" | "bloom" | null, theme: SanctuaryTheme): string {
  if (!stage) return sanctuaryCopy(theme).unplanted;
  switch (stage) {
    case "seed":
      return "Just planted";
    case "sproutSmall":
      return "Sprouting";
    case "sprout":
      return "Growing";
    default:
      return "In bloom";
  }
}
