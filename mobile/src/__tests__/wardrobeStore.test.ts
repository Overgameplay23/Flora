// The Wardrobe store: loading what the user owns and wears, buying, wearing (optimistic, rolled back on failure),
// the device copy, and a backend that does not have the Wardrobe yet. Supabase is a small in-memory fake that
// behaves like the wardrobe_v1 RPCs; AsyncStorage is the library's own mock. Nothing touches the network.
jest.mock("../lib/supabase", () => ({
  supabase: {
    from: (table: string) => mockFrom(table),
    rpc: (name: string, args: any) => mockRpc(name, args),
  },
}));
jest.mock("../contexts/AuthContext", () => ({ useAuth: () => ({ user: null }) }));
jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);

import AsyncStorage from "@react-native-async-storage/async-storage";
import { wardrobeItem } from "../domain/wardrobe/catalog";
import { clampFit } from "../domain/wardrobe/anchors";
import {
  NOT_READY_MESSAGE,
  buyWardrobeItem,
  clearWardrobeStore,
  ensureWardrobe,
  equipWardrobeOutfit,
  getWardrobeSnapshot,
  isWardrobeMissing,
  normalizeOutfit,
  refreshWardrobe,
  subscribeWardrobe,
  wardrobeCacheKey,
} from "../services/wardrobeStore";

// ---------- in-memory Supabase ----------

type Outfit = { slots: Record<string, string>; fit: Record<string, any> };
type Gate = { promise: Promise<void>; open: () => void };

let mockServer: {
  user: string;
  ready: boolean;
  offline: boolean;
  points: Record<string, number>;
  owned: Record<string, Set<string>>;
  outfits: Record<string, Outfit>;
  calls: string[];
  /** when set, the next equip_outfit waits for it and then fails or succeeds */
  equipGate: Gate | null;
  equipFails: boolean;
  /** when set, table reads wait for it */
  readGate: Gate | null;
};

function gate(): Gate {
  let open = () => {};
  const promise = new Promise<void>((resolve) => (open = resolve));
  return { promise, open };
}

function resetServer() {
  mockServer = {
    user: "user-a",
    ready: true,
    offline: false,
    points: { "user-a": 100, "user-b": 100 },
    owned: { "user-a": new Set(), "user-b": new Set() },
    outfits: {},
    calls: [],
    equipGate: null,
    equipFails: false,
    readGate: null,
  };
}

const OFFLINE = { data: null, error: { message: "Network request failed" }, status: 0 };

function mockFrom(table: string) {
  const filters: Record<string, unknown> = {};
  let single = false;
  const run = async () => {
    mockServer.calls.push(`from:${table}`);
    const result = read();
    // the answer is decided now and arrives when the gate opens, like a response already on its way
    if (mockServer.readGate) await mockServer.readGate.promise;
    return result;
  };
  const read = () => {
    if (mockServer.offline) return OFFLINE;
    if (!mockServer.ready) {
      return { data: null, error: { code: "PGRST205", message: `Could not find the table 'public.${table}' in the schema cache` }, status: 404 };
    }
    const uid = String(filters.user_id);
    if (table === "user_wardrobe") {
      return { data: [...(mockServer.owned[uid] || [])].map((item_id) => ({ item_id })), error: null, status: 200 };
    }
    if (table === "pet_outfits") {
      const row = mockServer.outfits[uid];
      return { data: single ? (row ? { ...row } : null) : row ? [row] : [], error: null, status: 200 };
    }
    return { data: null, error: { code: "42P01", message: `relation "${table}" does not exist` }, status: 404 };
  };
  const builder: any = {
    select: () => builder,
    eq: (col: string, value: unknown) => ((filters[col] = value), builder),
    maybeSingle: () => ((single = true), builder),
    then: (resolve: any, reject: any) => run().then(resolve, reject),
  };
  return builder;
}

async function mockRpc(name: string, args: any) {
  mockServer.calls.push(`rpc:${name}`);
  await Promise.resolve();
  if (mockServer.offline) return OFFLINE;
  if (!mockServer.ready) {
    return { data: null, error: { code: "PGRST202", message: `Could not find the function public.${name} in the schema cache` }, status: 404 };
  }
  const uid = mockServer.user;
  const owned = mockServer.owned[uid];
  if (name === "buy_wardrobe_item") {
    const item = wardrobeItem(args?.p_item_id);
    if (!item || item.premium) return { data: null, error: { code: "P0001", message: "Item not available" }, status: 400 };
    if (owned.has(item.id)) {
      return { data: { item_id: item.id, cost_paid: 0, remaining_points: mockServer.points[uid], already_owned: true }, error: null, status: 200 };
    }
    if (mockServer.points[uid] < item.priceSprouts) return { data: null, error: { code: "P0001", message: "Not enough points" }, status: 400 };
    mockServer.points[uid] -= item.priceSprouts;
    owned.add(item.id);
    return { data: { item_id: item.id, cost_paid: item.priceSprouts, remaining_points: mockServer.points[uid], already_owned: false }, error: null, status: 200 };
  }
  if (name === "equip_outfit") {
    const pending = mockServer.equipGate;
    if (pending) {
      mockServer.equipGate = null;
      await pending.promise;
    }
    if (mockServer.equipFails) return { data: null, error: { code: "P0001", message: "Something went wrong" }, status: 400 };
    const slots = args?.p_slots || {};
    for (const [slot, id] of Object.entries(slots)) {
      const item = wardrobeItem(id as string);
      if (!["head", "face", "neck"].includes(slot)) return { data: null, error: { code: "22023", message: `Unknown slot ${slot}` }, status: 400 };
      if (!item || item.slot !== slot || !owned.has(item.id)) return { data: null, error: { code: "P0001", message: "Item not owned" }, status: 400 };
    }
    const previous = mockServer.outfits[uid];
    const fit: Record<string, any> = {};
    if (args?.p_fit == null) Object.assign(fit, previous?.fit || {});
    else for (const [slot, value] of Object.entries(args.p_fit)) fit[slot] = clampFit(value as any);
    mockServer.outfits[uid] = { slots: { ...slots }, fit };
    return { data: { slots: { ...slots }, fit }, error: null, status: 200 };
  }
  return { data: null, error: { code: "PGRST202", message: "Could not find the function" }, status: 404 };
}

// ---------- helpers ----------

const A = "user-a";
const B = "user-b";
const CROWN = "head.daisy_crown"; // free
const BANDANA = "neck.bandana_red"; // free
const BERET = "head.beret_rose"; // 35
const PARTY = "head.party_hat"; // 30
const GOLD = "head.gold_crown"; // 160

async function readCache(userId: string) {
  const raw = await AsyncStorage.getItem(wardrobeCacheKey(userId));
  return raw ? JSON.parse(raw) : null;
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
const snap = () => getWardrobeSnapshot();
let warn: jest.SpyInstance;
let log: jest.SpyInstance;

beforeEach(async () => {
  resetServer();
  clearWardrobeStore();
  await AsyncStorage.clear();
  warn = jest.spyOn(console, "warn").mockImplementation(() => {});
  log = jest.spyOn(console, "log").mockImplementation(() => {});
});

afterEach(() => {
  warn.mockRestore();
  log.mockRestore();
});

// ---------- tests ----------

describe("loading", () => {
  it("loads what the user owns and wears, and keeps a device copy", async () => {
    mockServer.owned[A] = new Set([CROWN, BERET]);
    mockServer.outfits[A] = { slots: { head: BERET }, fit: { head: { dx: 0.05, dy: -0.02, scale: 1.2 } } };
    const seen: string[] = [];
    const unsubscribe = subscribeWardrobe((s) => seen.push(s.status));
    await refreshWardrobe(A);
    unsubscribe();

    expect(snap()).toMatchObject({
      userId: A,
      status: "ready",
      serverReady: true,
      outfit: { head: BERET },
      fit: { head: { dx: 0.05, dy: -0.02, scale: 1.2 } },
    });
    expect([...snap().owned].sort()).toEqual([BERET, CROWN].sort());
    expect(seen).toContain("loading");
    expect(await readCache(A)).toMatchObject({ v: 1, outfit: { head: BERET }, serverReady: true });
  });

  it("starts empty for a user with nothing yet", async () => {
    await refreshWardrobe(A);
    expect(snap()).toMatchObject({ status: "ready", serverReady: true, owned: [], outfit: {}, fit: {} });
  });

  it("shares one request between concurrent refreshes", async () => {
    await Promise.all([refreshWardrobe(A), refreshWardrobe(A), refreshWardrobe(A)]);
    expect(mockServer.calls.filter((c) => c === "from:user_wardrobe")).toHaveLength(1);
  });

  it("keeps the device copy and says error when offline, without throwing", async () => {
    await AsyncStorage.setItem(wardrobeCacheKey(A), JSON.stringify({ v: 1, owned: [CROWN], outfit: { head: CROWN }, fit: {}, serverReady: true }));
    mockServer.offline = true;
    await expect(refreshWardrobe(A)).resolves.toBeUndefined();
    expect(snap()).toMatchObject({ status: "error", outfit: { head: CROWN }, owned: [CROWN] });
  });

  it("drops unknown or misplaced ids the server or cache hands back", async () => {
    mockServer.owned[A] = new Set([BERET]);
    mockServer.outfits[A] = { slots: { head: "head.retired_hat", neck: BERET, face: "face.round_glasses" }, fit: {} };
    await refreshWardrobe(A);
    expect(snap().outfit).toEqual({ face: "face.round_glasses" });
    expect(normalizeOutfit({ head: 4, tail: CROWN, neck: BANDANA })).toEqual({ neck: BANDANA });
    expect(normalizeOutfit(null)).toEqual({});
  });
});

describe("a backend without the Wardrobe migration", () => {
  it("is try-on only: serverReady false, no error state, no warnings", async () => {
    mockServer.ready = false;
    await refreshWardrobe(A);
    expect(snap()).toMatchObject({ status: "ready", serverReady: false, error: null, owned: [], outfit: {} });
    expect(warn).not.toHaveBeenCalled();
    await refreshWardrobe(A);
    expect(warn).not.toHaveBeenCalled();
    expect(log.mock.calls.filter((call) => call[0] === "WARDROBE_SERVER_NOT_READY").length).toBeLessThanOrEqual(1);
  });

  it("answers buy with not_ready (without asking the server again) and refuses to equip", async () => {
    mockServer.ready = false;
    await refreshWardrobe(A);
    mockServer.calls = [];
    await expect(buyWardrobeItem(A, BERET)).resolves.toEqual({ ok: false, reason: "not_ready", message: NOT_READY_MESSAGE });
    await expect(equipWardrobeOutfit(A, { head: CROWN })).resolves.toBe(false);
    expect(mockServer.calls).toEqual([]);
    expect(snap().outfit).toEqual({});
  });

  it("is noticed by a buy before anything was loaded", async () => {
    mockServer.ready = false;
    await expect(buyWardrobeItem(A, BERET)).resolves.toEqual({ ok: false, reason: "not_ready", message: NOT_READY_MESSAGE });
    expect(snap().serverReady).toBe(false);
    expect(warn).not.toHaveBeenCalled();
  });

  it("recognizes PostgREST and Postgres missing-schema errors, and nothing else", () => {
    expect(isWardrobeMissing({ code: "PGRST205", message: "Could not find the table" })).toBe(true);
    expect(isWardrobeMissing({ code: "PGRST202", message: "Could not find the function" })).toBe(true);
    expect(isWardrobeMissing({ code: "42P01", message: 'relation "pet_outfits" does not exist' })).toBe(true);
    expect(isWardrobeMissing({ code: "42883", message: "function buy_wardrobe_item(text) does not exist" })).toBe(true);
    expect(isWardrobeMissing({ message: "Not Found" }, 404)).toBe(true);
    expect(isWardrobeMissing({ code: "P0001", message: "Not enough points" }, 400)).toBe(false);
    expect(isWardrobeMissing({ code: "42501", message: "permission denied for table user_wardrobe" }, 403)).toBe(false);
    expect(isWardrobeMissing({ message: "Network request failed" }, 0)).toBe(false);
    expect(isWardrobeMissing(null, 404)).toBe(false);
  });
});

describe("buying", () => {
  it("buys with Sprouts and reports what is left", async () => {
    await refreshWardrobe(A);
    await expect(buyWardrobeItem(A, BERET)).resolves.toEqual({ ok: true, remainingSprouts: 65 });
    expect(snap().owned).toContain(BERET);
    expect(mockServer.points[A]).toBe(65);
    expect((await readCache(A)).owned).toContain(BERET);
  });

  it("claims a free starter through the same call", async () => {
    await refreshWardrobe(A);
    await expect(buyWardrobeItem(A, CROWN)).resolves.toEqual({ ok: true, remainingSprouts: 100 });
    expect(mockServer.calls).toContain("rpc:buy_wardrobe_item");
    expect(snap().owned).toContain(CROWN);
  });

  it("says insufficient when the server says Not enough points, and changes nothing", async () => {
    mockServer.points[A] = 20;
    await refreshWardrobe(A);
    const result = await buyWardrobeItem(A, GOLD);
    expect(result).toMatchObject({ ok: false, reason: "insufficient" });
    expect((result as any).message).toMatch(/Sprouts/);
    expect(snap().owned).not.toContain(GOLD);
    expect(mockServer.points[A]).toBe(20);
    expect(warn).not.toHaveBeenCalled();
  });

  it("says owned for something already in the wardrobe, without charging", async () => {
    mockServer.owned[A] = new Set([BERET]);
    await refreshWardrobe(A);
    mockServer.calls = [];
    await expect(buyWardrobeItem(A, BERET)).resolves.toMatchObject({ ok: false, reason: "owned" });
    expect(mockServer.calls).toEqual([]);
  });

  it("treats already_owned from the server (bought elsewhere) as done, and remembers it", async () => {
    await refreshWardrobe(A);
    mockServer.owned[A].add(PARTY); // bought on another device since the last load
    await expect(buyWardrobeItem(A, PARTY)).resolves.toEqual({ ok: true, remainingSprouts: 100 });
    expect(snap().owned).toContain(PARTY);
  });

  it("refuses unknown and premium items without asking the server", async () => {
    await refreshWardrobe(A);
    mockServer.calls = [];
    await expect(buyWardrobeItem(A, "head.not_a_hat")).resolves.toMatchObject({ ok: false, reason: "unavailable" });
    expect(mockServer.calls).toEqual([]);
  });

  it("buys once on a double tap", async () => {
    await refreshWardrobe(A);
    const [first, second] = await Promise.all([buyWardrobeItem(A, BERET), buyWardrobeItem(A, BERET)]);
    expect(first).toEqual(second);
    expect(mockServer.calls.filter((c) => c === "rpc:buy_wardrobe_item")).toHaveLength(1);
    expect(mockServer.points[A]).toBe(65);
  });

  it("returns a kind error, not an exception, when offline or signed out", async () => {
    await refreshWardrobe(A);
    mockServer.offline = true;
    await expect(buyWardrobeItem(A, BERET)).resolves.toMatchObject({ ok: false, reason: "error" });
    await expect(buyWardrobeItem(null, BERET)).resolves.toMatchObject({ ok: false, reason: "error" });
  });
});

describe("wearing", () => {
  beforeEach(() => {
    mockServer.owned[A] = new Set([CROWN, BANDANA, BERET]);
    mockServer.outfits[A] = { slots: { head: CROWN }, fit: { head: { dx: 0, dy: 0.05, scale: 1 } } };
  });

  it("saves the outfit and takes the server's clamped fit", async () => {
    await refreshWardrobe(A);
    await expect(equipWardrobeOutfit(A, { head: BERET, neck: BANDANA }, { head: { dx: 0.1, dy: 0, scale: 5 } })).resolves.toBe(true);
    expect(snap().outfit).toEqual({ head: BERET, neck: BANDANA });
    expect(snap().fit).toEqual({ head: { dx: 0.1, dy: 0, scale: 2 } });
    expect(mockServer.outfits[A].slots).toEqual({ head: BERET, neck: BANDANA });
    expect(await readCache(A)).toMatchObject({ outfit: { head: BERET, neck: BANDANA }, fit: { head: { scale: 2 } } });
  });

  it("keeps the stored fit when none is given", async () => {
    await refreshWardrobe(A);
    await expect(equipWardrobeOutfit(A, { neck: BANDANA })).resolves.toBe(true);
    expect(snap().outfit).toEqual({ neck: BANDANA });
    expect(snap().fit).toEqual({ head: { dx: 0, dy: 0.05, scale: 1 } });
  });

  it("shows the new outfit at once and rolls back when the server says no", async () => {
    await refreshWardrobe(A);
    const answer = gate();
    mockServer.equipGate = answer;
    mockServer.equipFails = true;
    const pending = equipWardrobeOutfit(A, { head: BERET, neck: BANDANA }, { neck: { dx: 0, dy: 0.1, scale: 1 } });
    await flush();
    expect(snap().outfit).toEqual({ head: BERET, neck: BANDANA }); // optimistic
    expect(snap().fit).toEqual({ neck: { dx: 0, dy: 0.1, scale: 1 } });
    // the device copy only ever holds what the server confirmed
    expect((await readCache(A)).outfit).toEqual({ head: CROWN });
    answer.open();
    await expect(pending).resolves.toBe(false);
    expect(snap().outfit).toEqual({ head: CROWN });
    expect(snap().fit).toEqual({ head: { dx: 0, dy: 0.05, scale: 1 } });
    expect((await readCache(A)).outfit).toEqual({ head: CROWN });
  });

  it("rolls back when an item is not owned (the server checks)", async () => {
    await refreshWardrobe(A);
    await expect(equipWardrobeOutfit(A, { head: "head.gold_crown" })).resolves.toBe(false);
    expect(snap().outfit).toEqual({ head: CROWN });
  });

  it("sends overlapping equips in order, so the last look picked is the one kept", async () => {
    await refreshWardrobe(A);
    const slow = gate();
    mockServer.equipGate = slow;
    const first = equipWardrobeOutfit(A, { head: BERET });
    await flush();
    const second = equipWardrobeOutfit(A, { neck: BANDANA });
    await flush();
    expect(snap().outfit).toEqual({ neck: BANDANA });
    slow.open();
    await expect(Promise.all([first, second])).resolves.toEqual([true, true]);
    expect(snap().outfit).toEqual({ neck: BANDANA });
    expect(mockServer.outfits[A].slots).toEqual({ neck: BANDANA });
  });

  it("does not let a refresh that was already loading undo a new outfit", async () => {
    await refreshWardrobe(A);
    mockServer.readGate = gate();
    const refreshing = refreshWardrobe(A);
    await flush();
    const read = mockServer.readGate;
    mockServer.readGate = null;
    await equipWardrobeOutfit(A, { head: BERET });
    read.open();
    await refreshing;
    expect(snap().outfit).toEqual({ head: BERET });
  });

  it("does not let a refresh that read the table before an equip landed undo it", async () => {
    await refreshWardrobe(A);
    const answer = gate();
    mockServer.equipGate = answer;
    const equipping = equipWardrobeOutfit(A, { head: BERET });
    await flush();
    // the refresh reads the old outfit while the equip is still on its way, and its answer arrives last
    const read = gate();
    mockServer.readGate = read;
    const refreshing = refreshWardrobe(A);
    await flush();
    mockServer.readGate = null;
    answer.open();
    await expect(equipping).resolves.toBe(true);
    read.open();
    await refreshing;
    expect(snap().outfit).toEqual({ head: BERET });
    expect((await readCache(A)).outfit).toEqual({ head: BERET });
  });
});

describe("the device copy", () => {
  it("dresses the pet from the cache with no network", async () => {
    await AsyncStorage.setItem(
      wardrobeCacheKey(A),
      JSON.stringify({ v: 1, owned: [CROWN], outfit: { head: CROWN }, fit: { head: { dx: 0.1, dy: 0, scale: 1 } }, serverReady: true })
    );
    await ensureWardrobe(A);
    expect(snap()).toMatchObject({ userId: A, hydrated: true, outfit: { head: CROWN }, fit: { head: { dx: 0.1, dy: 0, scale: 1 } } });
    expect(mockServer.calls).toEqual([]);
    // a second PetPortrait mounting changes nothing
    await ensureWardrobe(A);
    expect(mockServer.calls).toEqual([]);
  });

  it("loads from the server once when there is no copy yet", async () => {
    mockServer.outfits[A] = { slots: { neck: BANDANA }, fit: {} };
    mockServer.owned[A] = new Set([BANDANA]);
    await Promise.all([ensureWardrobe(A), ensureWardrobe(A)]);
    await flush();
    expect(snap().outfit).toEqual({ neck: BANDANA });
    expect(mockServer.calls.filter((c) => c === "from:pet_outfits")).toHaveLength(1);
  });

  it("survives a broken or old copy", async () => {
    await AsyncStorage.setItem(wardrobeCacheKey(A), "{not json");
    await expect(ensureWardrobe(A)).resolves.toBeUndefined();
    clearWardrobeStore();
    await AsyncStorage.setItem(wardrobeCacheKey(A), JSON.stringify({ v: 0, outfit: { head: CROWN } }));
    await ensureWardrobe(A);
    await flush();
    expect(snap().outfit).toEqual({});
  });
});

describe("users", () => {
  it("never shows one user's wardrobe to another, and forgets it on sign-out", async () => {
    mockServer.owned[A] = new Set([BERET]);
    mockServer.outfits[A] = { slots: { head: BERET }, fit: {} };
    await refreshWardrobe(A);
    expect(snap().outfit).toEqual({ head: BERET });

    mockServer.user = B;
    await ensureWardrobe(B);
    await flush();
    expect(snap().userId).toBe(B);
    expect(snap().outfit).toEqual({});
    expect(snap().owned).toEqual([]);

    await ensureWardrobe(null);
    expect(snap()).toMatchObject({ userId: null, status: "idle", owned: [], outfit: {} });
    // A's copy stays on the device under A's own key
    expect((await readCache(A)).outfit).toEqual({ head: BERET });
  });

  it("drops a late answer that belongs to the previous user", async () => {
    mockServer.owned[A] = new Set([BERET]);
    mockServer.outfits[A] = { slots: { head: BERET }, fit: {} };
    mockServer.readGate = gate();
    const late = refreshWardrobe(A);
    await flush();
    const read = mockServer.readGate;
    mockServer.readGate = null;
    clearWardrobeStore(); // sign-out
    mockServer.user = B;
    await refreshWardrobe(B);
    read.open();
    await late;
    expect(snap().userId).toBe(B);
    expect(snap().outfit).toEqual({});
  });
});
