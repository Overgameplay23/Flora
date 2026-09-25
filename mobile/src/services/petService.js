import { supabase } from "../lib/supabase";
import { sanitizeLegacyPetUrl } from "../utils/petImages";

// Do not query pet columns directly; use fetchPet for schema compatibility.
const PET_SELECT_NEW =
  "state, photo_url, stylized_url, cutout_url, mask_url, processing_status, processing_error, original_photo_url, pet_name, species, look";
const PET_SELECT_LEGACY = [
  // before the 2026-09-25 species/look columns
  "state, photo_url, stylized_url, cutout_url, mask_url, processing_status, processing_error, original_photo_url, pet_name",
  "state, photo_url, original_photo_url",
  "state, photo_url, original_url",
  "state, photo_url",
];

let hasLoggedSchemaFallback = false;
let hasLoggedSchemaWriteFallback = false;

function isMissingColumnError(error) {
  const status = Number(error?.status);
  const code = String(error?.code || "");
  const message = typeof error?.message === "string" ? error.message.toLowerCase() : "";
  if (Number.isFinite(status) && status !== 400) return false;
  if (code === "42703") return true;
  if (code.toUpperCase().startsWith("PGRST2")) return true;
  if (message.includes("does not exist")) return true;
  if (message.includes("could not find") && message.includes("column")) return true;
  if (message.includes("schema cache") && message.includes("column")) return true;
  return false;
}

function normalizePetRow(row, schemaFallbackUsed) {
  if (!row) {
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
      processing_status: schemaFallbackUsed ? "legacy" : "idle",
      processing_error: null,
      schema_fallback_used: schemaFallbackUsed,
    };
  }
  return {
    state: row.state || "idle",
    photo_url: row.photo_url || null,
    original_photo_url: row.original_photo_url || row.original_url || row.originalUrl || null,
    stylized_url: row.stylized_url || row.stylizedUrl || null,
    cutout_url: row.cutout_url || row.cutoutUrl || null,
    mask_url: row.mask_url || row.maskUrl || null,
    pet_name: typeof row.pet_name === "string" ? row.pet_name : null,
    species: row.species === "dog" || row.species === "cat" ? row.species : null,
    look: row.look && typeof row.look === "object" ? row.look : null,
    processing_status: schemaFallbackUsed ? "legacy" : row.processing_status || "idle",
    processing_error: schemaFallbackUsed ? null : row.processing_error || null,
    schema_fallback_used: schemaFallbackUsed,
  };
}

function normalizePetWriteResult(patch, options = {}) {
  const { fallbackUsed = false } = options;
  return {
    stylizedUrl: patch?.stylized_url || null,
    cutoutUrl: patch?.cutout_url || null,
    maskUrl: patch?.mask_url || null,
    petName: typeof patch?.pet_name === "string" ? patch.pet_name : null,
    photoUrl: patch?.photo_url || null,
    originalUrl: patch?.original_photo_url || null,
    processingStatus: fallbackUsed ? "legacy" : patch?.processing_status || "idle",
  };
}

async function queryPetRow(userId, selectClause) {
  const { data, error } = await supabase
    .from("pet")
    .select(selectClause)
    .eq("user_id", userId)
    .limit(1);
  if (error) throw error;
  return data?.[0] || null;
}

function pickDefinedFields(patch, allowedKeys) {
  const next = {};
  for (const key of allowedKeys) {
    if (Object.prototype.hasOwnProperty.call(patch, key) && patch[key] !== undefined) {
      next[key] = patch[key];
    }
  }
  return next;
}

function shouldMarkStylizedSaved(patch) {
  return (
    (typeof patch?.stylized_url === "string" && patch.stylized_url.length > 0) ||
    (typeof patch?.cutout_url === "string" && patch.cutout_url.length > 0) ||
    (typeof patch?.mask_url === "string" && patch.mask_url.length > 0)
  );
}

function logSchemaWriteFallbackOnce() {
  if (hasLoggedSchemaWriteFallback) return;
  hasLoggedSchemaWriteFallback = true;
  console.warn("PET_SCHEMA_WRITE_FALLBACK_USED", { reason: "missing columns" });
}

async function upsertLegacyPetPayload(userId, payload = {}) {
  const legacyPayload = {
    user_id: userId,
    ...pickDefinedFields(payload, ["state", "photo_url", "original_photo_url"]),
  };

  let { error } = await supabase.from("pet").upsert(legacyPayload, { onConflict: "user_id" });
  if (
    error &&
    isMissingColumnError(error) &&
    Object.prototype.hasOwnProperty.call(legacyPayload, "original_photo_url")
  ) {
    const minimalLegacyPayload = { ...legacyPayload };
    delete minimalLegacyPayload.original_photo_url;
    const retry = await supabase.from("pet").upsert(minimalLegacyPayload, { onConflict: "user_id" });
    error = retry.error;
  }
  return { error };
}

export async function upsertPet(userId, patch = {}) {
  if (!userId) {
    throw new Error("Missing userId for upsertPet");
  }

  const fullPayload = { user_id: userId, ...patch };
  const intendsStylizedSave = shouldMarkStylizedSaved(fullPayload);
  const { error } = await supabase.from("pet").upsert(fullPayload, { onConflict: "user_id" });
  if (!error) {
    return { savedStylized: intendsStylizedSave, fullPatchApplied: true, fallbackUsed: false };
  }
  if (!isMissingColumnError(error)) {
    throw error;
  }

  logSchemaWriteFallbackOnce();
  const { error: fallbackError } = await upsertLegacyPetPayload(userId, fullPayload);

  if (fallbackError) {
    throw fallbackError;
  }

  return { savedStylized: false, fullPatchApplied: false, fallbackUsed: true, droppedKeys: Object.keys(patch) };
}

export async function savePetName(userId, petName) {
  const nextName = typeof petName === "string" ? petName.trim() : "";
  if (!userId) {
    throw new Error("Missing userId for savePetName");
  }
  if (!nextName) {
    throw new Error("Pet name cannot be empty.");
  }
  if (nextName.length > 24) {
    throw new Error("Pet name must be 24 characters or fewer.");
  }

  const { error } = await supabase.from("pet").upsert(
    {
      user_id: userId,
      pet_name: nextName,
    },
    { onConflict: "user_id" }
  );
  if (error) {
    throw error;
  }
  return nextName;
}

export async function upsertPetResult(userId, patch = {}) {
  if (!userId) {
    throw new Error("Missing userId for upsertPetResult");
  }

  const fullPayload = { user_id: userId, ...patch };
  const intendsStylizedSave = shouldMarkStylizedSaved(fullPayload);
  const { error } = await supabase.from("pet").upsert(fullPayload, { onConflict: "user_id" });
  if (!error) {
    return {
      savedStylized: intendsStylizedSave,
      fullPatchApplied: true,
      fallbackUsed: false,
      pet: normalizePetWriteResult(fullPayload, { fallbackUsed: false }),
    };
  }
  if (!isMissingColumnError(error)) {
    throw error;
  }

  logSchemaWriteFallbackOnce();
  const legacyPhotoUrl =
    patch?.stylized_url || patch?.cutout_url || patch?.photo_url || patch?.original_photo_url || null;
  const legacyOriginalUrl = patch?.original_photo_url || patch?.photo_url || null;
  const legacyPayload = {
    state: patch?.state,
    photo_url: legacyPhotoUrl,
    original_photo_url: legacyOriginalUrl,
  };
  const { error: fallbackError } = await upsertLegacyPetPayload(userId, legacyPayload);
  if (fallbackError) {
    throw fallbackError;
  }

  return {
    savedStylized: false,
    fullPatchApplied: false,
    fallbackUsed: true,
    pet: normalizePetWriteResult(
      {
        ...fullPayload,
        photo_url: legacyPhotoUrl,
        original_photo_url: legacyOriginalUrl,
      },
      { fallbackUsed: true }
    ),
  };
}

export async function fetchPet(userId) {
  if (!userId) return null;
  try {
    const row = await queryPetRow(userId, PET_SELECT_NEW);
    return normalizePetRow(row, false);
  } catch (error) {
    if (!isMissingColumnError(error)) {
      throw error;
    }

    for (const selectClause of PET_SELECT_LEGACY) {
      try {
        const legacyRow = await queryPetRow(userId, selectClause);
        if (!hasLoggedSchemaFallback) {
          hasLoggedSchemaFallback = true;
          console.warn("PET_SCHEMA_FALLBACK_USED", { reason: "missing columns" });
        }
        return normalizePetRow(legacyRow, true);
      } catch (legacyError) {
        if (isMissingColumnError(legacyError)) {
          continue;
        }
        throw legacyError;
      }
    }

    throw error;
  }
}

export function toPetImageSources(pet, profilePetPhotoUrl = null) {
  const photoUrl = sanitizeLegacyPetUrl(pet?.photo_url || null);
  const originalUrl = sanitizeLegacyPetUrl(pet?.original_photo_url || profilePetPhotoUrl || null);
  return {
    stylized: pet?.stylized_url || null,
    cutout: pet?.cutout_url || null,
    mask: pet?.mask_url || null,
    photo: photoUrl || null,
    original: originalUrl || null,
    allowOriginal: !!(photoUrl || originalUrl),
    alphaCutout: null,
    alphaStylized: null,
    maskReapplied: null,
    providerUsed: null,
  };
}

export function getBestPetRenderUrl(pet, profilePetPhotoUrl = null) {
  const photoUrl = sanitizeLegacyPetUrl(pet?.photo_url || null);
  const originalUrl = sanitizeLegacyPetUrl(pet?.original_photo_url || profilePetPhotoUrl || null);
  return pet?.stylized_url || pet?.cutout_url || photoUrl || originalUrl || null;
}

export function resolvePetAvatarUri(pet, profilePetPhotoUrl = null) {
  const originalUrl = sanitizeLegacyPetUrl(pet?.original_photo_url || profilePetPhotoUrl || null);
  if (pet?.stylized_url) return pet.stylized_url;
  if (originalUrl) return originalUrl;
  return getBestPetRenderUrl(pet, profilePetPhotoUrl);
}
