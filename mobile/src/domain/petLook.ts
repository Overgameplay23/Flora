// The parametric pet: species + a small set of look parameters that the vector rig draws.
//
// The product strategy research recommends a modular illustrated rig over generated raster art (it
// always looks right, it animates, and it costs nothing per pet). These parameters are what a person
// picks in onboarding ("make it look like Biscuit") and what a photo analysis step can fill in later.

export type Species = "dog" | "cat";
export type EarStyle = "floppy" | "pointy" | "folded";
export type TailStyle = "curl" | "straight" | "fluffy";
export type Marking = "none" | "patch" | "mask" | "socks" | "tuxedo" | "tabby";
export type Build = "round" | "slim";

export type PetLook = {
  species: Species;
  /** main coat colour, hex */
  coat: string;
  /** muzzle / belly / paws, hex */
  secondary: string;
  /** ear tint, hex */
  ear: string;
  /** iris colour, hex */
  eye: string;
  /** nose colour, hex */
  nose: string;
  ears: EarStyle;
  tail: TailStyle;
  marking: Marking;
  build: Build;
  /** "adopted": an illustrated shelter companion, no real animal behind it (memorial and photo features step aside) */
  origin?: "own" | "adopted";
};

export const COAT_SWATCHES: { id: string; label: string; coat: string; secondary: string; ear: string }[] = [
  { id: "golden", label: "Golden", coat: "#e9c184", secondary: "#f8ecd4", ear: "#c99a5b" },
  { id: "cream", label: "Cream", coat: "#f3e3c3", secondary: "#fbf4e6", ear: "#d8bf95" },
  { id: "brown", label: "Brown", coat: "#a86d3f", secondary: "#f1dcc3", ear: "#7d4d2b" },
  { id: "black", label: "Black", coat: "#3b3a45", secondary: "#8d8b99", ear: "#2b2a33" },
  { id: "grey", label: "Grey", coat: "#a8adb8", secondary: "#e2e5ec", ear: "#7f8593" },
  { id: "white", label: "White", coat: "#f7f5f0", secondary: "#e5e0d6", ear: "#e0d4c6" },
  { id: "orange", label: "Orange", coat: "#e8933f", secondary: "#f9e0c2", ear: "#c9712a" },
  { id: "spotted", label: "Chocolate", coat: "#6b4630", secondary: "#e9d5c1", ear: "#4d3122" },
];

export const EYE_SWATCHES: { id: string; label: string; eye: string }[] = [
  { id: "brown", label: "Brown", eye: "#5a3b1e" },
  { id: "amber", label: "Amber", eye: "#c2841f" },
  { id: "green", label: "Green", eye: "#4f9a5c" },
  { id: "blue", label: "Blue", eye: "#4a86c8" },
  { id: "dark", label: "Dark", eye: "#26232b" },
];

export const NOSE_SWATCHES: { id: string; label: string; nose: string }[] = [
  { id: "black", label: "Black", nose: "#2a2530" },
  { id: "brown", label: "Brown", nose: "#6b4630" },
  { id: "pink", label: "Pink", nose: "#e8889b" },
];

export const EAR_STYLES: Record<Species, EarStyle[]> = {
  dog: ["floppy", "pointy", "folded"],
  cat: ["pointy", "folded"],
};

export const TAIL_STYLES: Record<Species, TailStyle[]> = {
  dog: ["curl", "straight", "fluffy"],
  cat: ["straight", "curl", "fluffy"],
};

export const MARKINGS: Record<Species, Marking[]> = {
  dog: ["none", "patch", "mask", "socks", "tuxedo"],
  cat: ["none", "tabby", "mask", "socks", "tuxedo", "patch"],
};

export const DEFAULT_LOOK: Record<Species, PetLook> = {
  dog: { species: "dog", coat: "#e9c184", secondary: "#f8ecd4", ear: "#c99a5b", eye: "#5a3b1e", nose: "#2a2530", ears: "floppy", tail: "curl", marking: "none", build: "round" },
  cat: { species: "cat", coat: "#a8adb8", secondary: "#e2e5ec", ear: "#7f8593", eye: "#4f9a5c", nose: "#e8889b", ears: "pointy", tail: "straight", marking: "none", build: "slim" },
};

/** Ready-made looks so the first screen already shows something close before any tweaking. */
export const PRESETS: { id: string; label: string; look: PetLook }[] = [
  { id: "golden-dog", label: "Golden", look: { ...DEFAULT_LOOK.dog } },
  { id: "beagle", label: "Beagle", look: { ...DEFAULT_LOOK.dog, coat: "#a86d3f", secondary: "#f6ecdd", ear: "#7d4d2b", marking: "patch" } },
  { id: "black-lab", label: "Black lab", look: { ...DEFAULT_LOOK.dog, coat: "#3b3a45", secondary: "#8d8b99", ear: "#2b2a33", eye: "#5a3b1e", ears: "floppy", tail: "straight" } },
  { id: "shiba", label: "Shiba", look: { ...DEFAULT_LOOK.dog, coat: "#e8933f", secondary: "#f9e0c2", ear: "#c9712a", ears: "pointy", tail: "curl", marking: "mask" } },
  { id: "spaniel", label: "Spaniel", look: { ...DEFAULT_LOOK.dog, coat: "#6b4630", secondary: "#e9d5c1", ear: "#4d3122", ears: "floppy", tail: "fluffy", marking: "tuxedo" } },
  { id: "grey-cat", label: "Grey cat", look: { ...DEFAULT_LOOK.cat } },
  { id: "orange-tabby", label: "Orange tabby", look: { ...DEFAULT_LOOK.cat, coat: "#e8933f", secondary: "#f9e0c2", ear: "#c9712a", eye: "#c2841f", nose: "#e8889b", marking: "tabby" } },
  { id: "black-cat", label: "Black cat", look: { ...DEFAULT_LOOK.cat, coat: "#3b3a45", secondary: "#8d8b99", ear: "#2b2a33", eye: "#c2841f", nose: "#2a2530" } },
  { id: "tuxedo-cat", label: "Tuxedo", look: { ...DEFAULT_LOOK.cat, coat: "#3b3a45", secondary: "#f7f5f0", ear: "#2b2a33", eye: "#4f9a5c", nose: "#e8889b", marking: "tuxedo" } },
  { id: "siamese", label: "Siamese", look: { ...DEFAULT_LOOK.cat, coat: "#f3e3c3", secondary: "#fbf4e6", ear: "#5a4638", eye: "#4a86c8", nose: "#6b4630", marking: "mask", ears: "pointy" } },
  { id: "calico", label: "Calico", look: { ...DEFAULT_LOOK.cat, coat: "#f7f5f0", secondary: "#e8933f", ear: "#e0d4c6", eye: "#c2841f", nose: "#e8889b", marking: "patch", build: "round" } },
];

const HEX = /^#[0-9a-f]{6}$/i;

export function isSpecies(value: unknown): value is Species {
  return value === "dog" || value === "cat";
}

/** Coerces anything (a stored row, a form draft, junk) into a valid look for its species. */
export function normalizeLook(raw: unknown, fallbackSpecies: Species = "dog"): PetLook {
  const value = (raw && typeof raw === "object" ? raw : {}) as Record<string, any>;
  const species: Species = isSpecies(value.species) ? value.species : fallbackSpecies;
  const base = DEFAULT_LOOK[species];
  const hex = (v: unknown, fallback: string) => (typeof v === "string" && HEX.test(v) ? v.toLowerCase() : fallback);
  const pick = <T extends string>(v: unknown, allowed: readonly T[], fallback: T): T => (allowed.includes(v as T) ? (v as T) : fallback);
  return {
    species,
    coat: hex(value.coat, base.coat),
    secondary: hex(value.secondary, base.secondary),
    ear: hex(value.ear, base.ear),
    eye: hex(value.eye, base.eye),
    nose: hex(value.nose, base.nose),
    ears: pick(value.ears, EAR_STYLES[species], base.ears),
    tail: pick(value.tail, TAIL_STYLES[species], base.tail),
    marking: pick(value.marking, MARKINGS[species], base.marking),
    build: pick(value.build, ["round", "slim"] as const, base.build),
    ...(value.origin === "adopted" ? { origin: "adopted" as const } : {}),
  };
}

/** Switching species keeps the colours the person chose and fixes anything species-specific. */
export function withSpecies(look: PetLook, species: Species): PetLook {
  if (look.species === species) return look;
  return normalizeLook({ ...look, species, ears: DEFAULT_LOOK[species].ears, tail: DEFAULT_LOOK[species].tail, marking: "none", build: DEFAULT_LOOK[species].build }, species);
}

export function presetsFor(species: Species) {
  return PRESETS.filter((preset) => preset.look.species === species);
}

/** Darkens/lightens a hex colour by a fraction (-1..1) for outlines and shading. */
export function shade(hex: string, amount: number): string {
  const safe = HEX.test(hex) ? hex : "#888888";
  const n = parseInt(safe.slice(1), 16);
  const channel = (c: number) => {
    const v = amount < 0 ? c * (1 + amount) : c + (255 - c) * amount;
    return Math.max(0, Math.min(255, Math.round(v)));
  };
  const r = channel((n >> 16) & 255);
  const g = channel((n >> 8) & 255);
  const b = channel(n & 255);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

export function speciesLabel(species: Species) {
  return species === "cat" ? "Cat" : "Dog";
}

/** What the pet "does" when acting out a completed action; the rig plays these. */
export type PetAct = "drink" | "stretch" | "breathe" | "sleep" | "walk";
