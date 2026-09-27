#!/usr/bin/env node
// Backs up a Supabase database with the Supabase CLI (`supabase db dump`), into mobile/backups/ (gitignored).
// The original hosted project was deleted with no backup; this exists so that never happens again.
//
//   npm run backend:dump -- --linked            the project linked with `npm run backend:link` (staging)
//   npm run backend:dump -- --local             the local Docker stack
//   npm run backend:dump -- --db-url <url>      any Postgres URL (percent-encoded)
//   add --schema-only to skip the data dump
//   add --with-photos to also copy the pets storage bucket (--linked or --local only)
//
// Writes backups/<target>-<UTC timestamp>/ with the three files Supabase's restore guide expects:
//   roles.sql   cluster roles (--role-only)
//   schema.sql  tables, functions, policies, grants
//   data.sql    every row, including auth users (--data-only --use-copy)  <- personal data: keep private
// plus manifest.json (sizes and SHA-256). Pet photos are NOT in a database dump: --with-photos copies the
// bucket into storage/pets/ with `supabase storage cp` (experimental in CLI 2.67).
const { spawnSync } = require("node:child_process");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const args = process.argv.slice(2);
const schemaOnly = args.includes("--schema-only");
const withPhotos = args.includes("--with-photos");
let target = null;
let targetArgs = [];
if (args.includes("--linked")) {
  target = "linked";
  targetArgs = ["--linked"];
} else if (args.includes("--local")) {
  target = "local";
  targetArgs = ["--local"];
} else if (args.includes("--db-url")) {
  const url = args[args.indexOf("--db-url") + 1];
  if (!url) fail("--db-url needs a connection string");
  target = "db-url";
  targetArgs = ["--db-url", url];
}
if (!target) fail("choose what to dump: --linked (staging), --local, or --db-url <url>");
if (withPhotos && target === "db-url") fail("--with-photos needs --linked or --local (it goes through the Storage API)");

function fail(message) {
  console.error(`backend:dump: ${message}`);
  console.error("usage: npm run backend:dump -- --linked | --local | --db-url <url>  [--schema-only] [--with-photos]");
  process.exit(2);
}

const mobile = path.resolve(__dirname, "..");
const workdir = path.join(mobile, "local-backend");
const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
const outDir = path.join(mobile, "backups", `${target}-${stamp}`);
fs.mkdirSync(outDir, { recursive: true });

const parts = [
  { file: "roles.sql", flags: ["--role-only"] },
  { file: "schema.sql", flags: [] },
  ...(schemaOnly ? [] : [{ file: "data.sql", flags: ["--data-only", "--use-copy"] }]),
];

const manifest = { target, createdAt: new Date().toISOString(), files: {} };
for (const part of parts) {
  const file = path.join(outDir, part.file);
  console.log(`[backend:dump] ${part.file} ...`);
  // absolute -f path: the CLI changes into --workdir before writing
  const result = spawnSync("supabase", ["db", "dump", "--workdir", workdir, ...targetArgs, ...part.flags, "-f", file], {
    stdio: "inherit",
  });
  if (result.status !== 0 || !fs.existsSync(file)) {
    console.error(`backend:dump: ${part.file} failed (exit ${result.status}). Partial output kept in ${path.relative(mobile, outDir)}.`);
    process.exit(result.status || 1);
  }
  const bytes = fs.readFileSync(file);
  manifest.files[part.file] = { bytes: bytes.length, sha256: crypto.createHash("sha256").update(bytes).digest("hex") };
}

if (withPhotos) {
  console.log("[backend:dump] storage/pets ...");
  // `storage cp` resolves a relative destination from the current directory (an absolute Windows path is
  // mistaken for a URL), so run it from the backup folder
  const result = spawnSync(
    "supabase",
    ["storage", "cp", "-r", "ss:///pets", "storage/pets", "--experimental", "--workdir", workdir, ...targetArgs],
    { cwd: outDir, stdio: "inherit" }
  );
  const photoDir = path.join(outDir, "storage", "pets");
  const files = fs.existsSync(photoDir) ? listFiles(photoDir) : [];
  manifest.photos = { exitCode: result.status, files: files.length, bytes: files.reduce((sum, f) => sum + fs.statSync(f).size, 0) };
  if (result.status !== 0) console.error("backend:dump: copying the pets bucket failed; the database dump above is complete.");
}

function listFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? listFiles(full) : [full];
  });
}

const cli = spawnSync("supabase", ["--version"], { encoding: "utf8" });
manifest.supabaseCli = (cli.stdout || "").trim().split(/\r?\n/)[0] || null;
fs.writeFileSync(path.join(outDir, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");

console.log(`\nBackup written to ${path.relative(mobile, outDir)} (gitignored).`);
if (!schemaOnly) console.log("data.sql holds real user data: keep it private and never commit or share it.");
if (!withPhotos) console.log("Pet photos are not included (add --with-photos); see docs/backend/DEPLOY.md, 'Backups'.");
if (manifest.photos && manifest.photos.exitCode !== 0) process.exit(1);
