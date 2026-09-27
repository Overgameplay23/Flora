const mockCreateSignedUrl = jest.fn();
jest.mock("../lib/supabase", () => ({
  supabase: {
    storage: {
      from: (bucket: string) => ({
        createSignedUrl: (path: string, ttl: number) => mockCreateSignedUrl(bucket, path, ttl),
        getPublicUrl: (path: string) => ({ data: { publicUrl: `http://127.0.0.1:56321/storage/v1/object/public/${bucket}/${path}` } }),
      }),
    },
  },
}));

import {
  SIGNED_URL_TTL_SECONDS,
  clearSignedPetPhotoUrls,
  originalPhotoPath,
  peekSignedPetPhotoUrl,
  petPhotoLocator,
  petPhotoPath,
  processedPhotoPath,
  signPetPhotoUrl,
} from "../services/petPhotoUrls";

const UID = "aaaaaaaa-0000-4000-8000-00000000000a";
const HOST = "http://127.0.0.1:56321/storage/v1/object";

function signedFor(path: string, n = 1) {
  return `${HOST}/sign/pets/${path}?token=tok${n}`;
}

beforeEach(() => {
  jest.restoreAllMocks();
  clearSignedPetPhotoUrls();
  mockCreateSignedUrl.mockReset();
  mockCreateSignedUrl.mockImplementation(async (_bucket: string, path: string) => ({ data: { signedUrl: signedFor(path) }, error: null }));
});

describe("pet photo paths", () => {
  it("puts every object under the owner's user id", () => {
    expect(originalPhotoPath(UID, "jpg")).toBe(`${UID}/original.jpg`);
    expect(processedPhotoPath(UID, "cutout")).toBe(`${UID}/processed/cutout.png`);
  });

  it("reads the object path from public, signed and authenticated storage URLs", () => {
    expect(petPhotoPath(`${HOST}/public/pets/${UID}/original.jpg?t=123`)).toBe(`${UID}/original.jpg`);
    expect(petPhotoPath(`${HOST}/sign/pets/${UID}/processed/stylized.png?token=abc&t=9`)).toBe(`${UID}/processed/stylized.png`);
    expect(petPhotoPath(`${HOST}/authenticated/pets/${UID}/original.png`)).toBe(`${UID}/original.png`);
    expect(petPhotoPath(`${HOST}/public/pets/${UID}/my%20pet.jpg`)).toBe(`${UID}/my pet.jpg`);
  });

  it("recognises the older layouts too, so old rows are re-signed rather than broken", () => {
    expect(petPhotoPath(`https://x.supabase.co/storage/v1/object/sign/pets/original/${UID}.jpg?token=year`)).toBe(`original/${UID}.jpg`);
  });

  it("leaves anything that is not in the pets bucket alone", () => {
    for (const value of ["file:///tmp/pet.jpg", "data:image/png;base64,AAAA", "look://chosen", `${HOST}/public/avatars/${UID}.png`, "https://example.com/pets/x.png", "", null, 42]) {
      expect(petPhotoPath(value)).toBeNull();
    }
  });

  it("stores a token-free locator that maps back to its path", () => {
    const locator = petPhotoLocator(`${UID}/original.jpg`);
    expect(locator).not.toMatch(/token=/);
    expect(petPhotoPath(locator)).toBe(`${UID}/original.jpg`);
  });
});

describe("signing and caching", () => {
  const locator = `${HOST}/public/pets/${UID}/original.jpg`;

  it("passes non-bucket URLs straight through without a request", async () => {
    await expect(signPetPhotoUrl("file:///tmp/pet.jpg")).resolves.toBe("file:///tmp/pet.jpg");
    await expect(signPetPhotoUrl(null)).resolves.toBeNull();
    expect(peekSignedPetPhotoUrl("data:image/png;base64,AAAA")).toBe("data:image/png;base64,AAAA");
    expect(mockCreateSignedUrl).not.toHaveBeenCalled();
  });

  it("signs a bucket locator for one hour and reuses the signature", async () => {
    expect(peekSignedPetPhotoUrl(locator)).toBeNull();
    await expect(signPetPhotoUrl(locator)).resolves.toBe(signedFor(`${UID}/original.jpg`));
    await expect(signPetPhotoUrl(locator)).resolves.toBe(signedFor(`${UID}/original.jpg`));
    expect(peekSignedPetPhotoUrl(locator)).toBe(signedFor(`${UID}/original.jpg`));
    expect(mockCreateSignedUrl).toHaveBeenCalledTimes(1);
    expect(mockCreateSignedUrl).toHaveBeenCalledWith("pets", `${UID}/original.jpg`, SIGNED_URL_TTL_SECONDS);
    expect(SIGNED_URL_TTL_SECONDS).toBe(3600);
  });

  it("shares one request between screens asking at the same time", async () => {
    const [a, b, c] = await Promise.all([signPetPhotoUrl(locator), signPetPhotoUrl(locator), signPetPhotoUrl(`${locator}?t=5`)]);
    expect(a).toBe(b);
    expect(c).toBe(`${a}&t=5`);
    expect(mockCreateSignedUrl).toHaveBeenCalledTimes(1);
  });

  it("keeps the cache-busting stamp so a re-painted portrait is not shown stale", async () => {
    const stamped = `${HOST}/public/pets/${UID}/processed/stylized.png?t=1700`;
    await expect(signPetPhotoUrl(stamped)).resolves.toBe(`${signedFor(`${UID}/processed/stylized.png`)}&t=1700`);
  });

  it("re-signs shortly before the signature expires", async () => {
    const start = 1_000_000;
    jest.spyOn(Date, "now").mockReturnValue(start);
    await signPetPhotoUrl(locator);
    expect(peekSignedPetPhotoUrl(locator, start + 54 * 60 * 1000)).not.toBeNull();
    expect(peekSignedPetPhotoUrl(locator, start + 56 * 60 * 1000)).toBeNull();

    mockCreateSignedUrl.mockImplementationOnce(async (_b: string, path: string) => ({ data: { signedUrl: signedFor(path, 2) }, error: null }));
    (Date.now as jest.Mock).mockReturnValue(start + 56 * 60 * 1000);
    await expect(signPetPhotoUrl(locator)).resolves.toBe(signedFor(`${UID}/original.jpg`, 2));
    expect(mockCreateSignedUrl).toHaveBeenCalledTimes(2);
  });

  it("returns null when the storage policy refuses, and tries again next time", async () => {
    jest.spyOn(console, "warn").mockImplementation(() => {});
    mockCreateSignedUrl.mockResolvedValueOnce({ data: null, error: { message: "Object not found" } });
    await expect(signPetPhotoUrl(locator)).resolves.toBeNull();
    mockCreateSignedUrl.mockRejectedValueOnce(new Error("offline"));
    await expect(signPetPhotoUrl(locator)).resolves.toBeNull();
    await expect(signPetPhotoUrl(locator)).resolves.toBe(signedFor(`${UID}/original.jpg`));
    expect(mockCreateSignedUrl).toHaveBeenCalledTimes(3);
  });

  it("forgets every signature on sign-out", async () => {
    await signPetPhotoUrl(locator);
    clearSignedPetPhotoUrls();
    expect(peekSignedPetPhotoUrl(locator)).toBeNull();
    await signPetPhotoUrl(locator);
    expect(mockCreateSignedUrl).toHaveBeenCalledTimes(2);
  });

  it("re-signs an old year-long signed URL from its path instead of trusting its token", async () => {
    const old = `${HOST}/sign/pets/${UID}/original.jpg?token=year-long`;
    await expect(signPetPhotoUrl(old)).resolves.toBe(signedFor(`${UID}/original.jpg`));
  });
});
