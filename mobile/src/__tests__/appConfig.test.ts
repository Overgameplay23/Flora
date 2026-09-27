// Backend profiles (app.config.js): APP_ENV picks local or staging, the profile file wins over the process
// environment, and the config refuses anything that would point staging at the wrong place or ship a secret.
import fs from "fs";
import os from "os";
import path from "path";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const appConfig = require("../../app.config.js");
const { resolveBackend } = appConfig;

const LOCAL_URL = "http://127.0.0.1:56321";
const STAGING_URL = "https://abcdefghijklmnopqrst.supabase.co";
const jwt = (payload: object) => `eyJhbGciOiJIUzI1NiJ9.${Buffer.from(JSON.stringify(payload)).toString("base64url")}.sig`;

let dir: string;
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "luna-profile-"));
});
afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});
const write = (name: string, lines: string[]) => fs.writeFileSync(path.join(dir, name), lines.join("\n"));

describe("backend profiles", () => {
  it("defaults to the local profile and reads .env.local", () => {
    write(".env.local", [`EXPO_PUBLIC_SUPABASE_URL=${LOCAL_URL}`, `EXPO_PUBLIC_SUPABASE_ANON_KEY=${jwt({ role: "anon" })}`]);
    const { appEnv, backend } = resolveBackend({}, dir);
    expect(appEnv).toBe("local");
    expect(backend.supabaseUrl).toBe(LOCAL_URL);
    expect(backend.supabaseAnonKey).toMatch(/^eyJ/);
    expect(backend.petTalkPreview).toBe("");
  });

  it("reads .env.staging for APP_ENV=staging, ignoring local values in the environment", () => {
    write(".env.local", [`EXPO_PUBLIC_SUPABASE_URL=${LOCAL_URL}`]);
    write(".env.staging", ["# staging project", `EXPO_PUBLIC_SUPABASE_URL="${STAGING_URL}"`, "EXPO_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_abc"]);
    const env = { APP_ENV: "staging", EXPO_PUBLIC_SUPABASE_URL: LOCAL_URL, EXPO_PUBLIC_SUPABASE_ANON_KEY: "local-key" };
    const { appEnv, backend } = resolveBackend(env, dir);
    expect(appEnv).toBe("staging");
    expect(backend.supabaseUrl).toBe(STAGING_URL);
    expect(backend.supabaseAnonKey).toBe("sb_publishable_abc");
  });

  it("uses the build environment on CI/EAS when there is no profile file", () => {
    const env = { APP_ENV: "staging", EAS_BUILD: "true", EXPO_PUBLIC_SUPABASE_URL: STAGING_URL, EXPO_PUBLIC_SUPABASE_ANON_KEY: "sb_publishable_ci" };
    expect(resolveBackend(env, dir).backend.supabaseAnonKey).toBe("sb_publishable_ci");
  });

  it("refuses staging without its own file outside CI (a plain .env may still name an old project)", () => {
    const env = { APP_ENV: "staging", EXPO_PUBLIC_SUPABASE_URL: "https://olddeadproject00000.supabase.co", EXPO_PUBLIC_SUPABASE_ANON_KEY: "x" };
    expect(() => resolveBackend(env, dir)).toThrow(/needs \.env\.staging/);
  });

  it("refuses a staging profile that points at a local address or plain http", () => {
    write(".env.staging", [`EXPO_PUBLIC_SUPABASE_URL=${LOCAL_URL}`, "EXPO_PUBLIC_SUPABASE_ANON_KEY=k"]);
    expect(() => resolveBackend({ APP_ENV: "staging" }, dir)).toThrow(/hosted https/);
    write(".env.staging", ["EXPO_PUBLIC_SUPABASE_URL=http://staging.example.com", "EXPO_PUBLIC_SUPABASE_ANON_KEY=k"]);
    expect(() => resolveBackend({ APP_ENV: "staging" }, dir)).toThrow(/hosted https/);
  });

  it("refuses an incomplete staging profile", () => {
    write(".env.staging", [`EXPO_PUBLIC_SUPABASE_URL=${STAGING_URL}`]);
    expect(() => resolveBackend({ APP_ENV: "staging" }, dir)).toThrow(/EXPO_PUBLIC_SUPABASE_ANON_KEY/);
  });

  it("refuses the pet-talk preview flag on staging", () => {
    write(".env.staging", [`EXPO_PUBLIC_SUPABASE_URL=${STAGING_URL}`, "EXPO_PUBLIC_SUPABASE_ANON_KEY=k", "EXPO_PUBLIC_PET_TALK_PREVIEW=1"]);
    expect(() => resolveBackend({ APP_ENV: "staging" }, dir)).toThrow(/PET_TALK_PREVIEW/);
  });

  it("refuses a local profile that points at a hosted project", () => {
    expect(() => resolveBackend({ EXPO_PUBLIC_SUPABASE_URL: "https://olddeadproject00000.supabase.co" }, dir)).toThrow(/local stack/);
  });

  it("builds an unconfigured local app when nothing is set (the app shows its not-configured state)", () => {
    expect(resolveBackend({}, dir).backend.supabaseUrl).toBe("");
  });

  it("never lets a server secret into the bundle", () => {
    write(".env.local", [`EXPO_PUBLIC_SUPABASE_URL=${LOCAL_URL}`, `EXPO_PUBLIC_SUPABASE_ANON_KEY=${jwt({ role: "service_role" })}`]);
    expect(() => resolveBackend({}, dir)).toThrow(/server secret/);
    write(".env.local", [`EXPO_PUBLIC_SUPABASE_URL=${LOCAL_URL}`, "EXPO_PUBLIC_SUPABASE_ANON_KEY=sb_secret_abc"]);
    expect(() => resolveBackend({}, dir)).toThrow(/server secret/);
  });

  it("rejects unknown profiles", () => {
    expect(() => resolveBackend({ APP_ENV: "production" }, dir)).toThrow(/local, staging/);
  });

  it("hands the profile to the app through extra.backend and drops nothing else", () => {
    const out = appConfig({ config: { name: "Luna", extra: { other: 1 } } });
    expect(out.name).toBe("Luna");
    expect(out.extra.other).toBe(1);
    expect(out.extra.appEnv).toBe("local");
    expect(Object.keys(out.extra.backend).sort()).toEqual(["apiUrl", "petTalkPreview", "supabaseAnonKey", "supabaseFunctionsUrl", "supabaseUrl"]);
  });
});
