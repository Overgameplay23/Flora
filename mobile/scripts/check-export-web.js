#!/usr/bin/env node
// Repeatable, non-interactive Expo web export used as a bundle health check.
// Expo CLI does not support --non-interactive; it honours CI=1 instead. Setting it
// here keeps the check identical on Windows (cmd/PowerShell) and POSIX shells.
const { spawnSync } = require("node:child_process");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const outDir = path.join(root, ".expo-export-check");
const expoBin = path.join(root, "node_modules", "expo", "bin", "cli");

const result = spawnSync(
  process.execPath,
  [expoBin, "export", "--platform", "web", "--output-dir", outDir],
  { cwd: root, stdio: "inherit", env: { ...process.env, CI: "1" } }
);

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}
process.exit(result.status ?? 1);
