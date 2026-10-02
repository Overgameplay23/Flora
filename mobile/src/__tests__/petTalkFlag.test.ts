// The pet conversation is feature-flagged in the client (EXPO_PUBLIC_PET_TALK_ENABLED via app config, off by
// default): the pet-talk function may be deployed with its key while the app stays silent and never calls it.
const mockInvoke = jest.fn();
jest.mock("../lib/supabase", () => ({ supabase: { functions: { invoke: (...args: unknown[]) => mockInvoke(...args) } } }));
jest.mock("expo-constants", () => ({ __esModule: true, default: { expoConfig: null } }));

type PetTalkModule = typeof import("../services/petTalk");

function loadWith(backend: Record<string, string>): PetTalkModule {
  jest.requireMock("expo-constants").default.expoConfig = { extra: { appEnv: "staging", backend } };
  let mod: PetTalkModule | undefined;
  jest.isolateModules(() => {
    mod = require("../services/petTalk");
  });
  return mod as PetTalkModule;
}

beforeEach(() => {
  mockInvoke.mockReset();
  mockInvoke.mockResolvedValue({ data: { configured: true }, error: null });
});

describe("pet-talk feature flag", () => {
  it("is off by default: no Talk entry and no request, even when the function has its key", async () => {
    const petTalk = loadWith({});
    expect(petTalk.petTalkEnabled()).toBe(false);
    await expect(petTalk.petTalkAvailable(true)).resolves.toBe(false);
    await expect(petTalk.sendPetTalk([{ role: "user", content: "hi" }], { petName: "Biscuit" } as any)).rejects.toMatchObject({ code: "disabled" });
    expect(mockInvoke).not.toHaveBeenCalled();
  });

  it("only an explicit 1 turns it on", async () => {
    for (const value of ["", "0", "true", "yes"]) {
      await expect(loadWith({ petTalkEnabled: value }).petTalkAvailable(true)).resolves.toBe(false);
    }
    expect(mockInvoke).not.toHaveBeenCalled();
  });

  it("when on, the entry still waits for the function to report a key", async () => {
    const petTalk = loadWith({ petTalkEnabled: "1" });
    await expect(petTalk.petTalkAvailable(true)).resolves.toBe(true);
    expect(mockInvoke).toHaveBeenCalledWith("pet-talk", { body: { ping: true } });

    mockInvoke.mockResolvedValue({ data: { configured: false }, error: null });
    await expect(petTalk.petTalkAvailable(true)).resolves.toBe(false);
  });
});
