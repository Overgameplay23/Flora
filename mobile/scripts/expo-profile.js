#!/usr/bin/env node
// Runs the Expo CLI against one backend profile:
//   node scripts/expo-profile.js <local|staging> <expo arguments...>
//   npm run start:local / npm run start:staging
//
// Sets APP_ENV, which app.config.js uses to pick .env.local or .env.staging, and always adds --clear:
// Metro caches the app config it inlines into web bundles, so without it a build can silently keep the
// previous profile's backend (reproduced 2026-09-27: a "local" export carried the staging URL).
const { spawnSync } = require("node:child_process");
const path = require("node:path");

const PROFILES = ["local", "staging"];
const [profile, ...args] = process.argv.slice(2);
if (!PROFILES.includes(profile) || args.length === 0) {
  console.error(`usage: node scripts/expo-profile.js <${PROFILES.join("|")}> <expo arguments...>`);
  process.exit(2);
}

const root = path.resolve(__dirname, "..");
const expoBin = path.join(root, "node_modules", "expo", "bin", "cli");
const expoArgs = args.includes("--clear") || args.includes("-c") ? args : [...args, "--clear"];

console.log(`[expo-profile] APP_ENV=${profile}: expo ${expoArgs.join(" ")}`);
const result = spawnSync(process.execPath, [expoBin, ...expoArgs], {
  cwd: root,
  stdio: "inherit",
  env: { ...process.env, APP_ENV: profile },
});
if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}
process.exit(result.status ?? 1);
