// Dynamic app config: chooses the backend profile and hands its PUBLIC values to the app via `extra.backend`.
// The app reads them with expo-constants (src/utils/env.ts), so switching backends needs no code change.
//
//   APP_ENV=local    (default)  reads .env.local    written by `npm run backend:env` for the local Docker stack
//   APP_ENV=staging             reads .env.staging  copied from .env.example and filled in for the hosted project
//
// A value in the profile file wins over the process environment, so a developer's local values can never
// leak into a staging run. Without a profile file (CI, EAS builds) the process environment is used as-is.
// Everything here is embedded in the app bundle: only the publishable (anon) key belongs here. Server secrets
// live in supabase/functions/.env.* and are set with `npm run functions:secrets`.
const fs = require("fs");
const path = require("path");

const PROFILES = { local: ".env.local", staging: ".env.staging" };

// every public variable the app reads (see .env.example for what each one does)
const PUBLIC_VARS = {
  supabaseUrl: "EXPO_PUBLIC_SUPABASE_URL",
  supabaseAnonKey: "EXPO_PUBLIC_SUPABASE_ANON_KEY",
  supabaseFunctionsUrl: "EXPO_PUBLIC_SUPABASE_FUNCTIONS_URL",
  apiUrl: "EXPO_PUBLIC_API_URL",
  petTalkPreview: "EXPO_PUBLIC_PET_TALK_PREVIEW",
};

function readEnvFile(file) {
  const values = {};
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!match) continue;
    values[match[1]] = match[2].replace(/^(['"])(.*)\1$/, "$2");
  }
  return values;
}

function isPrivateHost(url) {
  try {
    const host = new URL(url).hostname;
    return (
      host === "localhost" ||
      host.endsWith(".localhost") ||
      /^127\./.test(host) ||
      /^10\./.test(host) ||
      /^192\.168\./.test(host) ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(host)
    );
  } catch {
    return false;
  }
}

// a service-role JWT or a secret key must never reach the bundle
function isServerSecret(value) {
  if (/^sb_secret_/.test(value)) return true;
  const parts = value.split(".");
  if (parts.length !== 3) return false;
  try {
    return JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8")).role === "service_role";
  } catch {
    return false;
  }
}

function resolveBackend(env = process.env, dir = __dirname) {
  const appEnv = String(env.APP_ENV || "local").trim().toLowerCase();
  if (!PROFILES[appEnv]) {
    throw new Error(`APP_ENV must be one of: ${Object.keys(PROFILES).join(", ")} (got "${appEnv}").`);
  }
  const profileFile = path.join(dir, PROFILES[appEnv]);
  const hasFile = fs.existsSync(profileFile);
  // Expo also loads a plain .env into the environment (on this machine it still names the deleted project), so
  // outside CI/EAS the staging profile must come from its own file rather than whatever the environment holds.
  const buildService = Boolean(env.CI || env.EAS_BUILD);
  if (appEnv === "staging" && !hasFile && !buildService) {
    throw new Error(`APP_ENV=staging needs ${PROFILES.staging}: copy .env.example to ${PROFILES.staging} and fill in the staging project.`);
  }
  const fromFile = hasFile ? readEnvFile(profileFile) : {};
  const backend = {};
  for (const [field, name] of Object.entries(PUBLIC_VARS)) {
    const raw = name in fromFile ? fromFile[name] : env[name];
    backend[field] = typeof raw === "string" ? raw.trim() : "";
    if (backend[field] && isServerSecret(backend[field])) {
      throw new Error(`${name} holds a server secret (service role or secret key). Only the publishable (anon) key may go in the app.`);
    }
  }

  const problem = (message) => new Error(`APP_ENV=${appEnv}: ${message} (${PROFILES[appEnv]}, see .env.example)`);
  if (appEnv === "staging") {
    if (!backend.supabaseUrl || !backend.supabaseAnonKey) throw problem("set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY");
    if (!/^https:\/\//.test(backend.supabaseUrl) || isPrivateHost(backend.supabaseUrl)) {
      throw problem("EXPO_PUBLIC_SUPABASE_URL must be the hosted https project URL, not a local address");
    }
    if (backend.petTalkPreview === "1") throw problem("EXPO_PUBLIC_PET_TALK_PREVIEW must not be set outside local work (it fakes the pet's replies)");
  } else if (backend.supabaseUrl && !isPrivateHost(backend.supabaseUrl)) {
    throw problem("the local profile must point at the local stack (run `npm run backend:env`); use APP_ENV=staging for a hosted project");
  }
  return { appEnv, backend };
}

module.exports = ({ config }) => {
  const { appEnv, backend } = resolveBackend();
  return {
    ...config,
    extra: { ...(config.extra || {}), appEnv, backend },
  };
};

module.exports.resolveBackend = resolveBackend; // for src/__tests__/appConfig.test.ts
