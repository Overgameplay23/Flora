// Pet photos live in the private `pets` storage bucket (local-backend/sql/pets_bucket_private.sql).
//
// Layout: one folder per person, named by their user id, which is what the storage policies check.
//   <uid>/original.<ext>                         the photo they picked
//   <uid>/processed/{stylized,cutout,mask}.png   the optional painted portrait
//
// The database keeps a token-free *locator* for each image: the bucket's canonical object URL. Once the
// bucket is private that URL no longer loads by itself; the app swaps it for a short-lived signed URL at
// the moment it shows the image. Signed URLs are cached in memory per object and reused until shortly
// before they expire, so a screen full of pets costs one signing request per image per hour.
//
// Older rows may hold a public URL or a long-lived signed URL; both are recognised and re-signed.
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import type { PetImageSources } from "../components/garden/usePetCandidates";

export const PET_PHOTO_BUCKET = "pets";
export const SIGNED_URL_TTL_SECONDS = 60 * 60;
const REFRESH_BEFORE_EXPIRY_MS = 5 * 60 * 1000;

const OBJECT_URL = /\/storage\/v1\/object\/(?:public|sign|authenticated)\/pets\/([^?#]+)/;
const CACHE_BUSTER = /[?&]t=([^&#]+)/;

export function originalPhotoPath(userId: string, ext: string) {
  return `${userId}/original.${ext}`;
}

export function processedPhotoPath(userId: string, name: "stylized" | "cutout" | "mask") {
  return `${userId}/processed/${name}.png`;
}

/** The object path inside the pets bucket for any Storage URL form (public, signed, authenticated), else null. */
export function petPhotoPath(value: unknown): string | null {
  if (typeof value !== "string" || !value) return null;
  const match = value.match(OBJECT_URL);
  if (!match) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}

/** The token-free locator stored in the database for an object in the bucket. */
export function petPhotoLocator(path: string): string {
  return supabase.storage.from(PET_PHOTO_BUCKET).getPublicUrl(path).data.publicUrl;
}

type SignedEntry = { url: string; expiresAt: number };
const signed = new Map<string, SignedEntry>();
const pending = new Map<string, Promise<string | null>>();

// A re-painted portrait keeps its path; the locator's ?t= stamp keeps image caches from showing the old one.
function carryCacheBuster(signedUrl: string, locator: string) {
  const stamp = locator.match(CACHE_BUSTER)?.[1];
  return stamp ? `${signedUrl}${signedUrl.includes("?") ? "&" : "?"}t=${stamp}` : signedUrl;
}

/**
 * A URL that can be shown right now, without waiting: anything that is not in the pets bucket passes through
 * unchanged (device files, data: URIs, other hosts); a bucket object returns its cached signed URL, or null
 * when it has not been signed yet (or is about to expire).
 */
export function peekSignedPetPhotoUrl(value: string | null | undefined, now = Date.now()): string | null {
  if (!value) return null;
  const path = petPhotoPath(value);
  if (!path) return value;
  const hit = signed.get(path);
  return hit && hit.expiresAt - now > REFRESH_BEFORE_EXPIRY_MS ? carryCacheBuster(hit.url, value) : null;
}

/** Resolves a stored locator to a signed URL (cached; concurrent requests for one object share a call). */
export async function signPetPhotoUrl(value: string | null | undefined): Promise<string | null> {
  if (!value) return null;
  const path = petPhotoPath(value);
  if (!path) return value;
  const ready = peekSignedPetPhotoUrl(value);
  if (ready) return ready;

  let job = pending.get(path);
  if (!job) {
    job = (async () => {
      try {
        const { data, error } = await supabase.storage.from(PET_PHOTO_BUCKET).createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
        if (error || !data?.signedUrl) {
          if (__DEV__) console.warn("PET_PHOTO_SIGN_FAILED", { path, message: error?.message });
          return null;
        }
        signed.set(path, { url: data.signedUrl, expiresAt: Date.now() + SIGNED_URL_TTL_SECONDS * 1000 });
        return data.signedUrl;
      } catch (error: any) {
        if (__DEV__) console.warn("PET_PHOTO_SIGN_FAILED", { path, message: error?.message });
        return null;
      } finally {
        pending.delete(path);
      }
    })();
    pending.set(path, job);
  }
  const url = await job;
  return url ? carryCacheBuster(url, value) : null;
}

/** Forget every signed URL (sign-out or account switch). */
export function clearSignedPetPhotoUrls() {
  signed.clear();
  pending.clear();
}

const SOURCE_KEYS = ["stylized", "cutout", "mask", "photo", "original"] as const;

function withUrls(sources: PetImageSources, urls: Array<string | null>): PetImageSources {
  const next: PetImageSources = { ...sources };
  SOURCE_KEYS.forEach((key, i) => {
    next[key] = urls[i];
  });
  return next;
}

function peekSources(sources: PetImageSources | null | undefined) {
  return sources ? withUrls(sources, SOURCE_KEYS.map((key) => peekSignedPetPhotoUrl(sources[key]))) : sources;
}

/**
 * The pet's image sources with every bucket locator swapped for a signed URL. Images that are already signed
 * (cached) show immediately; the rest appear as soon as their URL arrives instead of failing to load.
 */
export function useSignedPetSources(sources: PetImageSources | null | undefined): PetImageSources | null | undefined {
  const [resolved, setResolved] = useState(() => peekSources(sources));
  useEffect(() => {
    let alive = true;
    setResolved(peekSources(sources));
    if (sources) {
      Promise.all(SOURCE_KEYS.map((key) => signPetPhotoUrl(sources[key]))).then((urls) => {
        if (alive) setResolved(withUrls(sources, urls));
      });
    }
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    sources?.stylized,
    sources?.cutout,
    sources?.mask,
    sources?.photo,
    sources?.original,
    sources?.allowOriginal,
    sources?.alphaStylized,
    sources?.alphaCutout,
  ]);
  return resolved;
}

/** One image URL, signed when it points into the pets bucket. */
export function useSignedPetPhotoUrl(value: string | null | undefined): string | null {
  const [url, setUrl] = useState(() => peekSignedPetPhotoUrl(value));
  useEffect(() => {
    let alive = true;
    setUrl(peekSignedPetPhotoUrl(value));
    signPetPhotoUrl(value).then((next) => {
      if (alive) setUrl(next);
    });
    return () => {
      alive = false;
    };
  }, [value]);
  return url;
}
