import { useCallback, useEffect, useMemo, useSyncExternalStore } from "react";
import { useAuth } from "../contexts/AuthContext";
import { getPetSnapshot, refreshPet, subscribePet, type PetSnapshot } from "../services/petStore";
import { sanitizeLegacyPetUrl } from "../utils/petImages";
import type { PetImageSources } from "../components/garden/usePetCandidates";
import type { PetLook, Species } from "../domain/petLook";

export type UsePetResult = {
  userId: string | null;
  pet: PetSnapshot["pet"];
  sources: PetImageSources;
  /** "" when the pet has no name yet */
  name: string;
  /** name, or a friendly fallback for copy */
  displayName: string;
  /** the illustrated pet, once a species/look was chosen */
  look: PetLook | null;
  species: Species | null;
  status: PetSnapshot["status"];
  error: string | null;
  /** true once a processed (transparent) image exists */
  hasProcessedImage: boolean;
  /** true when any image at all can be shown */
  hasAnyImage: boolean;
  processingStatus: string;
  refresh: () => Promise<PetSnapshot>;
};

/**
 * The signed-in user's pet, shared across screens. Loads once per user, re-renders on stylize results
 * and name changes, and exposes `refresh()` for focus effects.
 */
export function usePet(): UsePetResult {
  const { user, profile } = useAuth();
  const userId: string | null = user?.id ?? null;
  const profilePhoto = sanitizeLegacyPetUrl(profile?.pet_photo_url || null) as string | null;

  const snapshot = useSyncExternalStore(subscribePet, getPetSnapshot, getPetSnapshot);

  useEffect(() => {
    void refreshPet(userId, profilePhoto);
  }, [userId, profilePhoto]);

  const refresh = useCallback(() => refreshPet(userId, profilePhoto), [userId, profilePhoto]);

  return useMemo(() => {
    const mine = snapshot.userId === userId;
    const sources = mine ? snapshot.sources : getPetSnapshot().sources;
    const name = mine ? snapshot.name : "";
    const pet = mine ? snapshot.pet : null;
    const look = mine ? snapshot.look : null;
    return {
      userId,
      pet,
      sources,
      name,
      displayName: name || "Your pet",
      look,
      species: look?.species ?? null,
      status: mine ? snapshot.status : "idle",
      error: mine ? snapshot.error : null,
      hasProcessedImage: Boolean(sources.stylized || sources.cutout),
      hasAnyImage: Boolean(sources.stylized || sources.cutout || sources.photo || sources.original),
      processingStatus: String(pet?.processing_status || "idle"),
      refresh,
    };
  }, [snapshot, userId, refresh]);
}
