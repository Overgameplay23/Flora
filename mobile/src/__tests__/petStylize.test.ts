const mockNetFetch = jest.fn();
const mockUpsertPet = jest.fn();

jest.mock("expo-crypto", () => ({
  CryptoDigestAlgorithm: { SHA256: "SHA-256" },
  digestStringAsync: async () => "source-hash",
}));
jest.mock("../lib/supabase", () => ({
  supabase: { auth: { getSession: async () => ({ data: { session: { access_token: "token" } } }) } },
}));
jest.mock("../utils/env", () => ({
  getValidatedPublicEnv: (name: string) =>
    ({ EXPO_PUBLIC_SUPABASE_URL: "https://proj.supabase.co", EXPO_PUBLIC_SUPABASE_ANON_KEY: "anon" } as Record<string, string>)[name] ?? null,
}));
jest.mock("../utils/net", () => ({ netFetch: (...args: any[]) => mockNetFetch(...args) }));
jest.mock("../services/petService", () => ({ upsertPet: (...args: any[]) => mockUpsertPet(...args) }));
jest.mock("../services/petPhotoUrls", () => ({
  originalPhotoPath: (uid: string, ext: string) => `${uid}/original.${ext}`,
  processedPhotoPath: (uid: string, name: string) => `${uid}/processed/${name}.png`,
  petPhotoLocator: (path: string) => `https://proj.supabase.co/storage/v1/object/public/pets/${path}`,
  signPetPhotoUrl: async (value: string | null) => (value ? `${value}?token=signed` : null),
}));

import { PET_STYLIZE_TIMEOUT_MS, pickUsablePetImages, stylizePet } from "../services/petStylize";
import { getPetImageCache, setPetImageCache } from "../utils/petImageCache";

(globalThis as any).__DEV__ = false;

const UID = "aaaaaaaa-0000-4000-8000-00000000000a";
const STORE = "https://proj.supabase.co/storage/v1/object/public/pets";
const ORIGINAL = `${STORE}/${UID}/original.jpg`;
const STYLIZED = `${STORE}/${UID}/processed/stylized.png`;
const CUTOUT = `${STORE}/${UID}/processed/cutout.png`;

function respondWith(processed: Record<string, unknown>) {
  mockNetFetch.mockResolvedValueOnce({
    ok: true,
    status: 200,
    text: async () => JSON.stringify({ ok: true, pet_id: UID, version: "v2", processed }),
  });
}

function repaint() {
  return stylizePet({ userId: UID, imageUrl: ORIGINAL, style: "portrait" });
}

beforeEach(() => {
  mockNetFetch.mockReset();
  mockUpsertPet.mockReset();
  mockUpsertPet.mockResolvedValue({ savedStylized: false, fullPatchApplied: true, fallbackUsed: false });
  setPetImageCache(null);
  jest.spyOn(console, "log").mockImplementation(() => {});
  jest.spyOn(console, "error").mockImplementation(() => {});
  jest.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe("pickUsablePetImages", () => {
  it("keeps a transparent painting as the pet", () => {
    expect(pickUsablePetImages({ stylizedUrl: "s", cutoutUrl: null, alphaStylized: true, alphaCutout: false })).toEqual({
      stylizedUrl: "s",
      cutoutUrl: null,
      renderUrl: "s",
      renderSource: "stylized",
      onlyOpaque: false,
    });
  });

  it("drops an opaque painting and falls back to a transparent cutout", () => {
    expect(pickUsablePetImages({ stylizedUrl: "s", cutoutUrl: "c", alphaStylized: false, alphaCutout: true })).toEqual({
      stylizedUrl: null,
      cutoutUrl: "c",
      renderUrl: "c",
      renderSource: "cutout",
      onlyOpaque: false,
    });
  });

  it("hands on nothing when every image is opaque, and says so", () => {
    const only = pickUsablePetImages({ stylizedUrl: "s", cutoutUrl: null, alphaStylized: false, alphaCutout: null });
    expect(only).toMatchObject({ stylizedUrl: null, cutoutUrl: null, renderUrl: null, renderSource: "missing", onlyOpaque: true });
    const both = pickUsablePetImages({ stylizedUrl: "s", cutoutUrl: "c", alphaStylized: false, alphaCutout: false });
    expect(both).toMatchObject({ stylizedUrl: null, cutoutUrl: null, renderUrl: null, onlyOpaque: true });
  });

  it("trusts an unknown alpha flag (older deployments), like the render ladder", () => {
    expect(pickUsablePetImages({ stylizedUrl: "s", cutoutUrl: "c", alphaStylized: null, alphaCutout: null })).toMatchObject({
      stylizedUrl: "s",
      cutoutUrl: "c",
      renderUrl: "s",
      renderSource: "stylized",
    });
  });

  it("never names a source it has no URL for", () => {
    expect(pickUsablePetImages({ stylizedUrl: null, cutoutUrl: "c", alphaStylized: true, alphaCutout: true })).toMatchObject({
      renderUrl: "c",
      renderSource: "cutout",
    });
    expect(pickUsablePetImages()).toEqual({ stylizedUrl: null, cutoutUrl: null, renderUrl: null, renderSource: "missing", onlyOpaque: false });
  });
});

describe("stylizePet", () => {
  it("gives the painting request its own long timeout and sends it once", async () => {
    respondWith({ stylized_url: STYLIZED, cutout_url: null, mask_url: null, alpha_stylized: true, alpha_cutout: false });
    const result = await repaint();
    expect(mockNetFetch).toHaveBeenCalledTimes(1);
    const [url, init] = mockNetFetch.mock.calls[0];
    expect(url).toBe("https://proj.supabase.co/functions/v1/pet-stylize");
    expect(init).toMatchObject({ method: "POST", timeoutMs: 110_000 });
    expect(PET_STYLIZE_TIMEOUT_MS).toBe(110_000);
    expect(result.stylizedUrl).toMatch(/processed\/stylized\.png\?t=\d+$/);
    expect(result.renderSource).toBe("stylized");
    expect(mockUpsertPet).not.toHaveBeenCalled();
  });

  it("never returns an opaque painting for callers to save; the transparent cutout is the pet", async () => {
    respondWith({ stylized_url: STYLIZED, cutout_url: CUTOUT, mask_url: null, alpha_stylized: false, alpha_cutout: true, failure_reason: "stylized_backdrop_not_keyed" });
    const result = await repaint();
    expect(result.stylizedUrl).toBeNull();
    expect(result.cutoutUrl).toMatch(/processed\/cutout\.png\?t=\d+$/);
    expect(result.renderUrl).toBe(result.cutoutUrl);
    expect(result.renderSource).toBe("cutout");
    // what OnboardingScreen, PetScreen and PetStylizeLoadingScreen write to the pet row
    const saved = {
      stylized_url: result.stylizedUrl,
      cutout_url: result.cutoutUrl,
      photo_url: result.renderUrl || result.stylizedUrl || result.cutoutUrl || null,
    };
    expect(JSON.stringify(saved)).not.toContain("stylized.png");
    // the in-session image bus agrees with the row
    expect(getPetImageCache()).toMatchObject({ stylized: null, cutout: result.cutoutUrl, alphaStylized: false, alphaCutout: true });
  });

  it("when everything came back opaque: fails, and points the row back at the photo", async () => {
    respondWith({ stylized_url: STYLIZED, cutout_url: CUTOUT, mask_url: null, alpha_stylized: false, alpha_cutout: false, failure_reason: "alpha_missing" });
    await expect(repaint()).rejects.toMatchObject({ userMessage: "Stylize did not return a transparent pet image. Please try again." });
    expect(mockUpsertPet).toHaveBeenCalledTimes(1);
    expect(mockUpsertPet).toHaveBeenCalledWith(UID, { stylized_url: null, cutout_url: null, photo_url: ORIGINAL });
    expect(getPetImageCache()).toBeNull();
  });

  it("still fails cleanly if repointing the row fails", async () => {
    mockUpsertPet.mockRejectedValueOnce(new Error("offline"));
    respondWith({ stylized_url: STYLIZED, cutout_url: null, mask_url: null, alpha_stylized: false, alpha_cutout: false });
    await expect(repaint()).rejects.toMatchObject({ userMessage: "Stylize did not return a transparent pet image. Please try again." });
  });

  it("reports a timeout as slow painting, not as a lost connection, and does not retry", async () => {
    mockNetFetch.mockRejectedValueOnce(Object.assign(new Error("Aborted"), { name: "AbortError", errorCode: "NETWORK_FAIL", timedOut: true }));
    await expect(repaint()).rejects.toMatchObject({
      errorCode: "TIMEOUT",
      userMessage: "The painting is taking longer than usual. Please try again in a minute.",
    });
    expect(mockNetFetch).toHaveBeenCalledTimes(1);
  });

  it("treats the platform's own timeout (iOS) as slow painting too", async () => {
    mockNetFetch.mockRejectedValueOnce(Object.assign(new TypeError("Network request timed out"), { errorCode: "NETWORK_FAIL" }));
    await expect(repaint()).rejects.toMatchObject({ errorCode: "TIMEOUT" });
    expect(mockNetFetch).toHaveBeenCalledTimes(1);
  });

  it("keeps the connection message for a transport failure", async () => {
    mockNetFetch.mockRejectedValueOnce(Object.assign(new Error("Network request failed"), { errorCode: "NETWORK_FAIL" }));
    await expect(repaint()).rejects.toMatchObject({
      errorCode: "NETWORK_FAIL",
      userMessage: "We couldn't reach the painting service. Check your connection and try again.",
    });
  });

  it("keeps the rate-limit mapping for server errors", async () => {
    mockNetFetch.mockResolvedValueOnce({
      ok: false,
      status: 429,
      text: async () => JSON.stringify({ ok: false, error: { code: "RATE_LIMIT", message: "Too many", retryAfterSeconds: 30 } }),
    });
    await expect(repaint()).rejects.toMatchObject({
      errorCode: "RATE_LIMIT",
      retryAfterSeconds: 30,
      userMessage: "Stylize is busy right now (rate limit). Try again soon.",
    });
  });
});
