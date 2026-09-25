// One in-memory copy of "the user's pet" shared by every screen.
//
// Before this store, Home, Garden, Pet, Chat and Check-in each fetched the pet row and each
// re-implemented the same merge of stylize results from petImageCache. Now the row is loaded once,
// stylize results are merged once, and screens subscribe through usePet().
import AsyncStorage from "@react-native-async-storage/async-storage";
import { fetchPet, toPetImageSources, upsertPet } from "./petService";
import { subscribePetImageCache } from "../utils/petImageCache";
import type { PetImageSources } from "../components/garden/usePetCandidates";
import { PetLook, Species, isSpecies, normalizeLook } from "../domain/petLook";

export type PetProcessingStatus = "idle" | "processing" | "ready" | "error" | "legacy" | string;

export type PetRecord = {
  state: string;
  photo_url: string | null;
  original_photo_url: string | null;
  stylized_url: string | null;
  cutout_url: string | null;
  mask_url: string | null;
  pet_name: string | null;
  species: Species | null;
  look: Record<string, unknown> | null;
  processing_status: PetProcessingStatus;
  processing_error: string | null;
  schema_fallback_used: boolean;
};

export type PetStatus = "idle" | "loading" | "ready" | "error";

export type PetSnapshot = {
  userId: string | null;
  pet: PetRecord | null;
  sources: PetImageSources;
  /** trimmed pet name, "" when unnamed */
  name: string;
  /** the illustrated pet's parameters; null until the person has chosen a species */
  look: PetLook | null;
  status: PetStatus;
  error: string | null;
  /** bumps on every change so memoised consumers can depend on one number */
  version: number;
};

type Listener = (snapshot: PetSnapshot) => void;

const EMPTY_SOURCES: PetImageSources = {
  stylized: null,
  cutout: null,
  mask: null,
  photo: null,
  original: null,
  allowOriginal: false,
  alphaCutout: null,
  alphaStylized: null,
  maskReapplied: null,
  providerUsed: null,
};

const EMPTY: PetSnapshot = {
  userId: null,
  pet: null,
  sources: EMPTY_SOURCES,
  name: "",
  look: null,
  status: "idle",
  error: null,
  version: 0,
};

const LOOK_KEY_PREFIX = "floura:pet-look:";

let snapshot: PetSnapshot = EMPTY;
const listeners = new Set<Listener>();
let inflight: Promise<PetSnapshot> | null = null;
let inflightUserId: string | null = null;

function emit(next: Omit<PetSnapshot, "version">) {
  snapshot = { ...next, version: snapshot.version + 1 };
  listeners.forEach((listener) => listener(snapshot));
}

export function getPetSnapshot(): PetSnapshot {
  return snapshot;
}

export function subscribePet(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function normalizePetName(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/** The look from the row when the database has the columns, otherwise the device copy. */
async function resolveLook(userId: string, pet: PetRecord | null): Promise<PetLook | null> {
  if (pet && (pet.look || isSpecies(pet.species))) {
    return normalizeLook({ ...(pet.look || {}), species: isSpecies(pet.species) ? pet.species : (pet.look as any)?.species }, isSpecies(pet.species) ? pet.species : "dog");
  }
  try {
    const raw = await AsyncStorage.getItem(LOOK_KEY_PREFIX + userId);
    if (raw) return normalizeLook(JSON.parse(raw));
  } catch {}
  return null;
}

/** Loads (or reloads) the pet row for a user. Concurrent calls for the same user share one request. */
export function refreshPet(userId: string | null | undefined, profilePetPhotoUrl: string | null = null): Promise<PetSnapshot> {
  if (!userId) {
    clearPetStore();
    return Promise.resolve(snapshot);
  }
  if (inflight && inflightUserId === userId) return inflight;

  const sameUser = snapshot.userId === userId;
  emit({
    ...snapshot,
    userId,
    // keep showing the previous pet while it reloads; only a user switch starts from scratch
    pet: sameUser ? snapshot.pet : null,
    sources: sameUser ? snapshot.sources : toPetImageSources(null, profilePetPhotoUrl),
    name: sameUser ? snapshot.name : "",
    look: sameUser ? snapshot.look : null,
    status: sameUser && snapshot.status === "ready" ? "ready" : "loading",
    error: null,
  });

  inflightUserId = userId;
  inflight = (async () => {
    try {
      const pet = (await fetchPet(userId)) as PetRecord | null;
      const look = await resolveLook(userId, pet);
      if (snapshot.userId !== userId) return snapshot; // user changed while loading
      emit({
        userId,
        pet,
        sources: toPetImageSources(pet, profilePetPhotoUrl),
        name: normalizePetName(pet?.pet_name),
        look,
        status: "ready",
        error: null,
      });
    } catch (error: any) {
      if (snapshot.userId === userId) {
        emit({
          ...snapshot,
          status: "error",
          error: error?.message || String(error),
          sources: snapshot.pet ? snapshot.sources : toPetImageSources(null, profilePetPhotoUrl),
        });
      }
    } finally {
      inflight = null;
      inflightUserId = null;
    }
    return snapshot;
  })();
  return inflight;
}

/** Optimistic local update after savePetName(); the next refresh confirms it. */
export function setPetNameLocally(userId: string, name: string) {
  if (snapshot.userId !== userId) return;
  const next = normalizePetName(name);
  emit({
    ...snapshot,
    name: next,
    pet: snapshot.pet ? { ...snapshot.pet, pet_name: next || null } : snapshot.pet,
  });
}

/** Optimistic local patch of the pet row (e.g. processing_status) between refreshes. */
export function patchPetLocally(userId: string, patch: Partial<PetRecord>) {
  if (snapshot.userId !== userId) return;
  const pet = { ...(snapshot.pet || emptyPet()), ...patch };
  emit({ ...snapshot, pet, name: normalizePetName(pet.pet_name) });
}

/**
 * Saves the illustrated pet's look: to the pet row (species + look columns) and to the device, so a
 * database without the columns still shows the same pet. Applies locally straight away.
 */
export async function savePetLook(userId: string, rawLook: PetLook) {
  const look = normalizeLook(rawLook);
  if (snapshot.userId === userId) {
    emit({ ...snapshot, look, pet: snapshot.pet ? { ...snapshot.pet, species: look.species, look } : snapshot.pet });
  }
  try {
    await AsyncStorage.setItem(LOOK_KEY_PREFIX + userId, JSON.stringify(look));
  } catch {}
  const result = await upsertPet(userId, { species: look.species, look });
  return { look, storedRemotely: !result?.fallbackUsed };
}

export function clearPetStore() {
  if (snapshot === EMPTY && snapshot.version === 0) return;
  emit({ ...EMPTY });
}

function emptyPet(): PetRecord {
  return {
    state: "idle",
    photo_url: null,
    original_photo_url: null,
    stylized_url: null,
    cutout_url: null,
    mask_url: null,
    pet_name: null,
    species: null,
    look: null,
    processing_status: "idle",
    processing_error: null,
    schema_fallback_used: false,
  };
}

/** The merge every screen used to do by hand when the stylize pipeline publishes new images. */
export function mergeStylizeCache(prev: PetImageSources, cache: any): PetImageSources {
  return {
    ...prev,
    stylized: cache?.stylized ?? null,
    cutout: cache?.cutout ?? null,
    mask: cache?.mask ?? prev.mask ?? null,
    photo: prev.photo ?? null,
    original: cache?.original ?? prev.original ?? null,
    allowOriginal: cache?.original ? true : prev.allowOriginal,
    alphaCutout: cache?.alphaCutout ?? null,
    alphaStylized: cache?.alphaStylized ?? null,
    maskReapplied: cache?.maskReapplied ?? null,
    providerUsed: cache?.providerUsed ?? null,
  };
}

subscribePetImageCache((cache: any) => {
  if (!cache || !snapshot.userId || cache.userId !== snapshot.userId) return;
  const sources = mergeStylizeCache(snapshot.sources, cache);
  const pet = snapshot.pet
    ? {
        ...snapshot.pet,
        stylized_url: sources.stylized ?? null,
        cutout_url: sources.cutout ?? null,
        mask_url: sources.mask ?? null,
        original_photo_url: sources.original ?? snapshot.pet.original_photo_url,
      }
    : snapshot.pet;
  emit({ ...snapshot, sources, pet });
});
