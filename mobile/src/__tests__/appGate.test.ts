import { deriveAppGate } from "../domain/appGate";

describe("deriveAppGate", () => {
  it("shows auth without a user", () => {
    expect(deriveAppGate({ hasUser: false, profileStatus: "ready", profileHasPet: true, cachedHasPet: true })).toBe("auth");
  });

  it("routes on the loaded profile when it is available", () => {
    expect(deriveAppGate({ hasUser: true, profileStatus: "ready", profileHasPet: true, cachedHasPet: null })).toBe("main");
    expect(deriveAppGate({ hasUser: true, profileStatus: "ready", profileHasPet: false, cachedHasPet: true })).toBe("setup");
  });

  it("never sends an existing user to pet setup because the network failed", () => {
    expect(deriveAppGate({ hasUser: true, profileStatus: "error", profileHasPet: null, cachedHasPet: true })).toBe("main");
    expect(deriveAppGate({ hasUser: true, profileStatus: "error", profileHasPet: null, cachedHasPet: false })).toBe("setup");
    expect(deriveAppGate({ hasUser: true, profileStatus: "error", profileHasPet: null, cachedHasPet: null })).toBe("unreachable");
  });

  it("lets a remembered user straight in while the profile is still loading", () => {
    expect(deriveAppGate({ hasUser: true, profileStatus: "loading", profileHasPet: null, cachedHasPet: true })).toBe("main");
    expect(deriveAppGate({ hasUser: true, profileStatus: "loading", profileHasPet: null, cachedHasPet: null })).toBe("splash");
    expect(deriveAppGate({ hasUser: true, profileStatus: "idle", profileHasPet: null, cachedHasPet: false })).toBe("splash");
  });
});
