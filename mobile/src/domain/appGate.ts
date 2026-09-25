// Which top-level screen the app shows, as a pure rule so it can be tested.
//
// Existing users used to be sent back to pet setup whenever the profile fetch failed (offline, an RLS
// denial, a slow network), because "no profile" and "profile without a pet" looked the same. The gate
// now distinguishes them and uses the last known answer when the network cannot give one.

export type ProfileStatus = "idle" | "loading" | "ready" | "error";

export type AppGateInput = {
  hasUser: boolean;
  profileStatus: ProfileStatus;
  /** the loaded profile's pet photo, when the profile is ready */
  profileHasPet: boolean | null;
  /** what this device remembered from the last successful load: true / false / unknown */
  cachedHasPet: boolean | null;
};

export type AppGate = "auth" | "splash" | "setup" | "main" | "unreachable";

export function deriveAppGate(input: AppGateInput): AppGate {
  if (!input.hasUser) return "auth";
  switch (input.profileStatus) {
    case "ready":
      return input.profileHasPet ? "main" : "setup";
    case "error":
      if (input.cachedHasPet === true) return "main";
      if (input.cachedHasPet === false) return "setup";
      return "unreachable";
    default:
      // still loading: prefer the remembered answer so a returning user is not held on the splash
      if (input.cachedHasPet === true) return "main";
      return "splash";
  }
}
