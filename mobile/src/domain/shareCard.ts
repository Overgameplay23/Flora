// The shareable card (ROADMAP item 8, the TikTok loop): the real pet next to its painting, ready to post. Made on the
// phone from the pet's own photo and portrait; nothing is uploaded, and only the person decides where it goes.
// Pure; the card itself is src/components/share/PetShareCard.tsx.
import type { PetImageSources } from "../components/garden/usePetCandidates";

/** 9:16, the shape of TikTok, Reels and Stories */
export const CARD_RATIO = 16 / 9;

export type ShareCardCopy = {
  title: string;
  realLabel: string;
  artLabel: string;
  footer: string;
  /** read by VoiceOver for the card as a whole */
  description: string;
  /** the share sheet's subject line where an app shows one */
  shareTitle: string;
};

/** The real photo the person picked, if there is one (adopted companions have none). */
export function realPhotoOf(sources: PetImageSources | null | undefined): string | null {
  return sources?.original || sources?.photo || null;
}

/** The painted portrait, if one exists; otherwise the card shows the drawn pet. */
export function paintingOf(sources: PetImageSources | null | undefined): string | null {
  return sources?.stylized || sources?.cutout || null;
}

export function canShareCard(sources: PetImageSources | null | undefined, adopted: boolean): boolean {
  return !adopted && !!realPhotoOf(sources);
}

/**
 * At a painting reveal (onboarding's reveal step, the painting result screen): offer the card only once the painting
 * really exists, so the first card someone posts is the painted one.
 */
export function canShareAtReveal(sources: PetImageSources | null | undefined, adopted: boolean, painted: boolean): boolean {
  return painted && !!paintingOf(sources) && canShareCard(sources, adopted);
}

export function shareCardCopy({ petName, painted, memorial = false }: { petName: string; painted: boolean; memorial?: boolean }): ShareCardCopy {
  const pet = (petName || "My pet").trim() || "My pet";
  const artLabel = painted ? "Painted by Luna" : "Drawn by Luna";
  return {
    title: memorial ? `Always ${pet}` : `Meet ${pet}`,
    realLabel: "Real life",
    artLabel,
    footer: "Made with Luna · self-care with your pet",
    description: `A card with two pictures of ${pet}: the real photo, and ${pet} ${painted ? "painted" : "drawn"} by Luna.`,
    shareTitle: memorial ? `Always ${pet}` : `The real ${pet}, and ${pet} ${painted ? "painted" : "drawn"} by Luna`,
  };
}
