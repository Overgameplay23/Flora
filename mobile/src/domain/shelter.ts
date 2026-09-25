// "Adopt a companion" (product strategy report, edge cases): people without a living pet adopt a
// curated, illustrated rescue pet instead of being turned away. Each companion is a ready-made look
// with a name and a line of character; the name can be changed and the look adjusted later.
import { DEFAULT_LOOK, PetLook, Species, normalizeLook } from "./petLook";

export type Companion = {
  id: string;
  name: string;
  species: Species;
  /** one line of who they are, never a sad backstory */
  bio: string;
  look: PetLook;
};

const dog = (patch: Partial<PetLook>): PetLook => ({ ...DEFAULT_LOOK.dog, ...patch, species: "dog" });
const cat = (patch: Partial<PetLook>): PetLook => ({ ...DEFAULT_LOOK.cat, ...patch, species: "cat" });

export const SHELTER: readonly Companion[] = [
  { id: "pepper", name: "Pepper", species: "dog", bio: "A small brown mutt who naps in sunbeams and barks at leaves.", look: dog({ coat: "#a86d3f", secondary: "#f1dcc3", ear: "#7d4d2b", ears: "floppy", tail: "curl", marking: "patch", build: "slim" }) },
  { id: "maple", name: "Maple", species: "dog", bio: "Golden, gentle, and convinced every walk is the best one yet.", look: dog({ coat: "#e9c184", secondary: "#f8ecd4", ear: "#c99a5b", ears: "floppy", tail: "fluffy", marking: "none", build: "round" }) },
  { id: "ziggy", name: "Ziggy", species: "dog", bio: "Black with white socks; sits when asked, mostly.", look: dog({ coat: "#3b3a45", secondary: "#f7f5f0", ear: "#2b2a33", eye: "#5a3b1e", ears: "pointy", tail: "straight", marking: "socks", build: "slim" }) },
  { id: "clover", name: "Clover", species: "dog", bio: "Grey and thoughtful; likes to lean on you while you read.", look: dog({ coat: "#a8adb8", secondary: "#e2e5ec", ear: "#7f8593", eye: "#26232b", ears: "folded", tail: "curl", marking: "mask", build: "round" }) },
  { id: "olive", name: "Olive", species: "cat", bio: "A grey cat who supervises from the windowsill.", look: cat({ coat: "#a8adb8", secondary: "#e2e5ec", ear: "#7f8593", eye: "#4f9a5c", ears: "pointy", tail: "straight", marking: "none", build: "slim" }) },
  { id: "marmalade", name: "Marmalade", species: "cat", bio: "Orange tabby, loud purr, opinions about breakfast.", look: cat({ coat: "#e8933f", secondary: "#f9e0c2", ear: "#c9712a", eye: "#c2841f", ears: "pointy", tail: "straight", marking: "tabby", build: "round" }) },
  { id: "pickle", name: "Pickle", species: "cat", bio: "Tuxedo cat; formal on the outside, chaos inside.", look: cat({ coat: "#3b3a45", secondary: "#f7f5f0", ear: "#2b2a33", eye: "#4f9a5c", ears: "pointy", tail: "straight", marking: "tuxedo", build: "slim" }) },
  { id: "willow", name: "Willow", species: "cat", bio: "Cream Siamese who talks back and means it kindly.", look: cat({ coat: "#f3e3c3", secondary: "#fbf4e6", ear: "#7d4d2b", eye: "#4a86c8", ears: "pointy", tail: "straight", marking: "mask", build: "slim" }) },
];

export function shelterFor(species: Species): Companion[] {
  return SHELTER.filter((c) => c.species === species);
}

export function companionById(id: string | null | undefined): Companion | null {
  return SHELTER.find((c) => c.id === id) ?? null;
}

/** The look an adopted companion starts with, marked so the app knows there is no real animal behind it. */
export function adoptedLook(companion: Companion): PetLook {
  return { ...normalizeLook(companion.look), origin: "adopted" };
}

export function isAdopted(look: PetLook | null | undefined): boolean {
  return look?.origin === "adopted";
}
