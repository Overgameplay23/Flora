// The Wardrobe for the signed-in user: what they own, what the pet wears and how it fits. One module-level copy
// shared by every screen (like petStore): the Wardrobe screen loads and changes it through useWardrobe(), and
// every PetPortrait reads the outfit through useEquippedOutfit().
//
// The server is the truth (local-backend/sql/wardrobe_v1.sql): user_wardrobe and pet_outfits are read directly,
// and every write goes through buy_wardrobe_item / equip_outfit, which check the Sprouts balance, ownership and
// slots. The last confirmed state is cached on the device per user, so the pet is dressed instantly on launch
// and offline. A backend without the Wardrobe migration is not an error: serverReady goes false and the screen
// offers try-on only.
import { useCallback, useEffect, useMemo, useSyncExternalStore } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";
import { inSeason, wardrobeItem } from "../domain/wardrobe/catalog";
import { OUTFIT_DRAW_ORDER, normalizeFit } from "../domain/wardrobe/anchors";
import type { FitAdjust, OutfitSelection } from "../domain/wardrobe/types";

export type WardrobeStatus = "idle" | "loading" | "ready" | "error";

export type BuyResult =
  | { ok: true; remainingSprouts: number | null }
  | { ok: false; reason: "insufficient" | "owned" | "unavailable" | "not_ready" | "error"; message: string };

export type WardrobeSnapshot = {
  userId: string | null;
  /** idle: nothing from the server yet this session (the device copy may be showing) */
  status: WardrobeStatus;
  owned: string[];
  outfit: OutfitSelection;
  fit: FitAdjust;
  /** false when this backend has no Wardrobe tables/RPCs yet */
  serverReady: boolean;
  /** the device copy for this user has been read */
  hydrated: boolean;
  error: string | null;
  /** bumps on every change */
  version: number;
};

export const NOT_READY_MESSAGE = "The Wardrobe opens as soon as the latest update reaches the server.";
const MESSAGES = {
  insufficient: "Not quite enough Sprouts yet. A little more care and it's yours.",
  owned: "This one is already in the wardrobe.",
  unavailable: "This piece isn't available right now.",
  outOfSeason: "This one is back in autumn.",
  signedOut: "Sign in to keep what you pick.",
  error: "That didn't go through. Please try again in a moment.",
} as const;

const CACHE_VERSION = 1;
export const wardrobeCacheKey = (userId: string) => `floura:wardrobe:${userId}`;

const NO_IDS: string[] = [];
const NO_OUTFIT: OutfitSelection = Object.freeze({}) as OutfitSelection;
const NO_FIT: FitAdjust = Object.freeze({}) as FitAdjust;

const EMPTY: WardrobeSnapshot = {
  userId: null,
  status: "idle",
  owned: NO_IDS,
  outfit: NO_OUTFIT,
  fit: NO_FIT,
  serverReady: true,
  hydrated: false,
  error: null,
  version: 0,
};

type Listener = (snapshot: WardrobeSnapshot) => void;
type Look = { outfit: OutfitSelection; fit: FitAdjust };

let snapshot: WardrobeSnapshot = EMPTY;
const listeners = new Set<Listener>();

// Per-user session state, reset whenever the user changes. `session` tells a late answer from an old session
// (another user, or the same user before a sign-out) apart from a current one.
let session = 0;
let hydrating: Promise<void> | null = null;
/** the device had a copy for this user, so PetPortrait needs no network */
let cacheFound = false;
let refreshing: Promise<void> | null = null;
/** what the server last confirmed the pet wears; a failed equip rolls back to this */
let confirmed: Look = { outfit: NO_OUTFIT, fit: NO_FIT };
/** purchases the server confirmed this session, kept even if a refresh read the table just before them */
let bought = new Set<string>();
const buying = new Map<string, Promise<BuyResult>>();
let equipSeq = 0;
let equipsPending = 0;
/** equips go to the server in order */
let equipQueue: Promise<boolean> = Promise.resolve(true);
let notReadyLogged = false;

function emit(patch: Partial<WardrobeSnapshot>) {
  snapshot = { ...snapshot, ...patch, version: snapshot.version + 1 };
  listeners.forEach((listener) => {
    try {
      listener(snapshot);
    } catch {}
  });
}

export function getWardrobeSnapshot(): WardrobeSnapshot {
  return snapshot;
}

export function subscribeWardrobe(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Forgets the signed-in user's wardrobe (sign-out). The device copy stays under that user's own key. */
export function clearWardrobeStore() {
  session += 1;
  hydrating = null;
  cacheFound = false;
  refreshing = null;
  confirmed = { outfit: NO_OUTFIT, fit: NO_FIT };
  bought = new Set();
  buying.clear();
  equipsPending = 0;
  equipQueue = Promise.resolve(true);
  const s = snapshot;
  if (s.userId === null && s.status === "idle" && !s.hydrated && s.owned === NO_IDS && s.outfit === NO_OUTFIT && s.fit === NO_FIT) return;
  emit({ ...EMPTY });
}

/** True when an answer started in session `since` for `userId` no longer belongs in the store. */
function stale(since: number, userId: string) {
  return since !== session || snapshot.userId !== userId;
}

// ---------- shapes ----------

/** One item id per known slot; ids that are not in the catalog, or sit in the wrong slot, are dropped. */
export function normalizeOutfit(raw: unknown): OutfitSelection {
  const outfit: OutfitSelection = {};
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return outfit;
  for (const slot of OUTFIT_DRAW_ORDER) {
    const id = (raw as Record<string, unknown>)[slot];
    const item = typeof id === "string" ? wardrobeItem(id) : undefined;
    if (item && item.slot === slot) outfit[slot] = item.id;
  }
  return outfit;
}

function normalizeOwned(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return [...new Set(raw.filter((id): id is string => typeof id === "string" && id.length > 0))];
}

function toCount(value: unknown): number | null {
  const n = Number(value);
  return value != null && Number.isFinite(n) ? Math.max(0, Math.floor(n)) : null;
}

// ---------- server errors ----------

const MISSING_CODES = new Set(["PGRST205", "PGRST202", "42P01", "42883"]);

/** True when the table or function is not on this backend yet (the Wardrobe migration has not been applied). */
export function isWardrobeMissing(error: any, status?: number | null): boolean {
  if (!error) return false;
  if (MISSING_CODES.has(String(error?.code || "").toUpperCase())) return true;
  if (Number(status ?? error?.status) === 404) return true;
  const message = String(error?.message || "").toLowerCase();
  return (
    message.includes("could not find the table") ||
    message.includes("could not find the function") ||
    (message.includes("does not exist") && (message.includes("relation") || message.includes("function")))
  );
}

/** Logged once per app run, not on every refresh: a backend without the migration is an expected state. */
function noteNotReady() {
  if (notReadyLogged) return;
  notReadyLogged = true;
  if (__DEV__) console.log("WARDROBE_SERVER_NOT_READY", "the Wardrobe migration is not on this backend; try-on only");
}

// ---------- device copy ----------

async function readCache(userId: string): Promise<(Look & { owned: string[]; serverReady: boolean }) | null> {
  try {
    const raw = await AsyncStorage.getItem(wardrobeCacheKey(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || parsed.v !== CACHE_VERSION) return null;
    return {
      owned: normalizeOwned(parsed.owned),
      outfit: normalizeOutfit(parsed.outfit),
      fit: normalizeFit(parsed.fit),
      serverReady: parsed.serverReady !== false,
    };
  } catch {
    return null;
  }
}

/** Saves what the server confirmed (never an optimistic outfit still waiting for its answer). */
async function writeCache(userId: string) {
  if (snapshot.userId !== userId) return;
  try {
    const value = { v: CACHE_VERSION, owned: snapshot.owned, outfit: confirmed.outfit, fit: confirmed.fit, serverReady: snapshot.serverReady };
    await AsyncStorage.setItem(wardrobeCacheKey(userId), JSON.stringify(value));
  } catch {}
}

/** Switches the store to this user (dropping anything from another) and reads their device copy once. */
function hydrate(userId: string): Promise<void> {
  if (snapshot.userId !== userId) {
    clearWardrobeStore();
    emit({ ...EMPTY, userId });
  }
  if (snapshot.hydrated) return Promise.resolve();
  if (hydrating) return hydrating;
  const since = session;
  const run = (async () => {
    const cached = await readCache(userId);
    if (stale(since, userId)) return;
    cacheFound = !!cached;
    if (cached) {
      confirmed = { outfit: cached.outfit, fit: cached.fit };
      emit({ hydrated: true, owned: cached.owned, outfit: cached.outfit, fit: cached.fit, serverReady: cached.serverReady });
    } else {
      emit({ hydrated: true });
    }
  })();
  hydrating = run;
  run.finally(() => {
    if (hydrating === run) hydrating = null;
  });
  return run;
}

// ---------- loading ----------

/** Loads what this user owns and wears from the server. Concurrent calls share one request. Never throws. */
export function refreshWardrobe(userId: string | null | undefined): Promise<void> {
  if (!userId) {
    clearWardrobeStore();
    return Promise.resolve();
  }
  if (refreshing && snapshot.userId === userId) return refreshing;
  const run = (async () => {
    await hydrate(userId);
    const since = session;
    if (stale(since, userId)) return;
    const seqAtStart = equipSeq;
    // an equip already on its way may land after this read and answer before it does
    const pendingAtStart = equipsPending;
    if (snapshot.status !== "ready") emit({ status: "loading", error: null });
    try {
      const [ownedRes, outfitRes] = (await Promise.all([
        supabase.from("user_wardrobe").select("item_id").eq("user_id", userId),
        supabase.from("pet_outfits").select("slots, fit").eq("user_id", userId).maybeSingle(),
      ])) as any[];
      if (stale(since, userId)) return; // signed out or switched while loading
      if (isWardrobeMissing(ownedRes?.error, ownedRes?.status) || isWardrobeMissing(outfitRes?.error, outfitRes?.status)) {
        noteNotReady();
        confirmed = { outfit: NO_OUTFIT, fit: NO_FIT };
        emit({ status: "ready", serverReady: false, owned: NO_IDS, outfit: NO_OUTFIT, fit: NO_FIT, error: null });
        await writeCache(userId);
        return;
      }
      const failure = ownedRes?.error || outfitRes?.error;
      if (failure) throw failure;

      const owned = normalizeOwned([...((ownedRes?.data as any[]) || []).map((row) => row?.item_id), ...bought]);
      const row = (outfitRes?.data ?? null) as { slots?: unknown; fit?: unknown } | null;
      const patch: Partial<WardrobeSnapshot> = { status: "ready", serverReady: true, owned, error: null };
      // an equip made while this was loading is newer than what the server said a moment ago
      if (equipSeq === seqAtStart && equipsPending === 0 && pendingAtStart === 0) {
        confirmed = { outfit: normalizeOutfit(row?.slots), fit: normalizeFit(row?.fit) };
        patch.outfit = confirmed.outfit;
        patch.fit = confirmed.fit;
      }
      emit(patch);
      await writeCache(userId);
    } catch (error: any) {
      if (stale(since, userId)) return;
      console.warn("WARDROBE_LOAD_FAILED", error?.message || String(error));
      emit({ status: "error", error: error?.message || String(error) });
    }
  })();
  refreshing = run;
  run.finally(() => {
    if (refreshing === run) refreshing = null;
  });
  return run;
}

/**
 * Makes sure the store holds this user's wardrobe, without the network when a device copy exists (every
 * PetPortrait calls this on mount). The very first launch, with no copy yet, loads from the server once.
 */
export function ensureWardrobe(userId: string | null | undefined): Promise<void> {
  if (!userId) {
    clearWardrobeStore();
    return Promise.resolve();
  }
  if (snapshot.userId === userId && (snapshot.hydrated || hydrating)) return hydrating ?? Promise.resolve();
  return hydrate(userId).then(async () => {
    if (snapshot.userId === userId && !cacheFound && snapshot.status === "idle") await refreshWardrobe(userId);
  });
}

// ---------- buying ----------

function buyError(reason: Extract<BuyResult, { ok: false }>["reason"], message: string): BuyResult {
  return { ok: false, reason, message };
}

/** Buys (or, at price 0, claims) one item through buy_wardrobe_item. Never throws. */
export function buyWardrobeItem(userId: string | null | undefined, itemId: string): Promise<BuyResult> {
  if (!userId) return Promise.resolve(buyError("error", MESSAGES.signedOut));
  const key = `${userId}:${itemId}`;
  const existing = buying.get(key);
  if (existing) return existing; // a double tap buys once

  const run = (async (): Promise<BuyResult> => {
    await hydrate(userId);
    const since = session;
    const item = wardrobeItem(itemId);
    if (!item || item.premium) return buyError("unavailable", MESSAGES.unavailable);
    // owned first: a seasonal piece already in the wardrobe is theirs all year
    if (snapshot.owned.includes(item.id)) return buyError("owned", MESSAGES.owned);
    if (!inSeason(item)) return buyError("unavailable", MESSAGES.outOfSeason);
    if (!snapshot.serverReady) return buyError("not_ready", NOT_READY_MESSAGE);
    try {
      const { data, error, status } = (await supabase.rpc("buy_wardrobe_item", { p_item_id: item.id })) as any;
      if (stale(since, userId)) return buyError("error", MESSAGES.error);
      if (error) {
        if (isWardrobeMissing(error, status)) {
          noteNotReady();
          emit({ serverReady: false });
          await writeCache(userId);
          return buyError("not_ready", NOT_READY_MESSAGE);
        }
        const message = String(error?.message || "").toLowerCase();
        if (message.includes("not enough points")) return buyError("insufficient", MESSAGES.insufficient);
        if (/premium|inactive|not available|unavailable|unknown item|not found/.test(message)) return buyError("unavailable", MESSAGES.unavailable);
        console.warn("WARDROBE_BUY_FAILED", error?.message || String(error));
        return buyError("error", MESSAGES.error);
      }
      const row = Array.isArray(data) ? data[0] : data;
      // already_owned (bought on another device): nothing was charged, and it is in the wardrobe either way
      bought.add(item.id);
      if (!snapshot.owned.includes(item.id)) emit({ owned: [...snapshot.owned, item.id] });
      await writeCache(userId);
      return { ok: true, remainingSprouts: toCount(row?.remaining_points) };
    } catch (error: any) {
      console.warn("WARDROBE_BUY_FAILED", error?.message || String(error));
      return buyError("error", MESSAGES.error);
    }
  })();
  buying.set(key, run);
  run.finally(() => {
    if (buying.get(key) === run) buying.delete(key);
  });
  return run;
}

// ---------- wearing ----------

/**
 * Saves what the pet wears through equip_outfit. Shown straight away; if the server says no (an item not owned,
 * offline), the pet goes back to what the server last confirmed. `fit` left out keeps the stored fit; null
 * resets it to automatic. Calls reach the server one after another, so the last look picked is the one kept.
 * Never throws.
 */
export async function equipWardrobeOutfit(userId: string | null | undefined, outfit: OutfitSelection, fit?: FitAdjust | null): Promise<boolean> {
  if (!userId) return false;
  await hydrate(userId);
  const since = session;
  if (stale(since, userId) || !snapshot.serverReady) return false;

  const nextOutfit = normalizeOutfit(outfit);
  const nextFit = fit === undefined ? snapshot.fit : normalizeFit(fit);
  const seq = ++equipSeq;
  equipsPending += 1;
  emit({ outfit: nextOutfit, fit: nextFit });
  const run = equipQueue.catch(() => false).then(() => sendEquip(userId, since, seq, nextOutfit, nextFit, fit === undefined));
  equipQueue = run;
  return run;
}

async function sendEquip(userId: string, since: number, seq: number, nextOutfit: OutfitSelection, nextFit: FitAdjust, keepFit: boolean): Promise<boolean> {
  try {
    if (stale(since, userId)) return false;
    const { data, error, status } = (await supabase.rpc("equip_outfit", {
      p_slots: nextOutfit,
      p_fit: keepFit ? null : nextFit,
    })) as any;
    if (stale(since, userId)) return false;
    if (error) {
      if (isWardrobeMissing(error, status)) {
        noteNotReady();
        emit({ serverReady: false });
      } else {
        console.warn("WARDROBE_EQUIP_FAILED", error?.message || String(error));
      }
      // only the latest equip decides what shows; an older one failing under a newer one changes nothing
      if (seq === equipSeq) emit({ outfit: confirmed.outfit, fit: confirmed.fit });
      await writeCache(userId);
      return false;
    }
    const row = Array.isArray(data) ? data[0] : data;
    confirmed = {
      outfit: row && typeof row === "object" && "slots" in row ? normalizeOutfit(row.slots) : nextOutfit,
      fit: row && typeof row === "object" && "fit" in row ? normalizeFit(row.fit) : nextFit,
    };
    if (seq === equipSeq) emit({ outfit: confirmed.outfit, fit: confirmed.fit });
    await writeCache(userId);
    return true;
  } catch (error: any) {
    if (stale(since, userId)) return false;
    console.warn("WARDROBE_EQUIP_FAILED", error?.message || String(error));
    if (seq === equipSeq) emit({ outfit: confirmed.outfit, fit: confirmed.fit });
    return false;
  } finally {
    if (since === session) equipsPending = Math.max(0, equipsPending - 1);
  }
}

// ---------- hooks ----------

function useSnapshot() {
  return useSyncExternalStore(subscribeWardrobe, getWardrobeSnapshot, getWardrobeSnapshot);
}

/** The Wardrobe screen's view: loads from the server on mount and on refresh(). */
export function useWardrobe(): {
  status: WardrobeStatus;
  owned: string[];
  outfit: OutfitSelection;
  fit: FitAdjust;
  serverReady: boolean;
  refresh(): Promise<void>;
  buy(itemId: string): Promise<BuyResult>;
  equip(outfit: OutfitSelection, fit?: FitAdjust): Promise<boolean>;
} {
  const { user } = useAuth();
  const userId: string | null = user?.id ?? null;
  const snap = useSnapshot();

  useEffect(() => {
    void refreshWardrobe(userId);
  }, [userId]);

  const refresh = useCallback(() => refreshWardrobe(userId), [userId]);
  const buy = useCallback((itemId: string) => buyWardrobeItem(userId, itemId), [userId]);
  const equip = useCallback((outfit: OutfitSelection, fit?: FitAdjust) => equipWardrobeOutfit(userId, outfit, fit), [userId]);

  return useMemo(() => {
    const mine = !!userId && snap.userId === userId;
    return {
      status: mine ? snap.status : userId ? "loading" : "idle",
      owned: mine ? snap.owned : NO_IDS,
      outfit: mine ? snap.outfit : NO_OUTFIT,
      fit: mine ? snap.fit : NO_FIT,
      serverReady: mine ? snap.serverReady : true,
      refresh,
      buy,
      equip,
    };
  }, [snap, userId, refresh, buy, equip]);
}

/** What the signed-in user's pet wears, for PetPortrait. Reads the device copy; no network when one exists. */
export function useEquippedOutfit(): { outfit: OutfitSelection; fit: FitAdjust } {
  const { user } = useAuth();
  const userId: string | null = user?.id ?? null;
  const snap = useSnapshot();

  useEffect(() => {
    void ensureWardrobe(userId);
  }, [userId]);

  const mine = !!userId && snap.userId === userId;
  const outfit = mine ? snap.outfit : NO_OUTFIT;
  const fit = mine ? snap.fit : NO_FIT;
  return useMemo(() => ({ outfit, fit }), [outfit, fit]);
}
