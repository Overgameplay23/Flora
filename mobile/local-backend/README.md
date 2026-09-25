# Floura local backend

The hosted Supabase project the app was built against (`gghesvpmskjlrlpoosgf`) no longer exists.
This folder runs a **local** Supabase stack in Docker so the app can sign in, persist data and be
demonstrated again. Nothing here touches any hosted project.

## What is in here

| Path | Purpose |
|---|---|
| `supabase/config.toml` | Supabase CLI config, `project_id = "floura-local"`, ports shifted +2000 (API 56321, DB 56322, Studio 56323; the 54xxx and 55xxx ranges are used by other local stacks on this machine) so it can run beside other local stacks. Realtime, analytics, inbucket and the edge runtime are disabled. |
| `build-migrations.js` | Copies the project's existing SQL into correctly named CLI migrations **without modifying the originals** (the real files use `2025_12_31_*.sql` names the CLI cannot version, and the bootstrap DDL lives outside `migrations/`). Each copy is stamped with its source path and SHA-256. |
| `sql/restoration_local_compat.sql` | Objects the client already uses but no SQL ever defined: `pet.original_photo_url` and the `pets` storage bucket with own-path policies. |
| `sql/fix_complete_task_variable_conflict.sql` | Forward fix for the `complete_task` parameter/column ambiguity (2026-09-17). |
| `sql/local_day_rpcs.sql` | Forward migration (2026-09-24): `complete_task`, `log_event_and_rollup` and `recompute_pet_state` accept the client's local calendar day (validated within one day of UTC) so evening activity lands on the right day. |
| `supabase/migrations/` | Generated output of `build-migrations.js` (21 files). Regenerate, never edit. |
| `write-env-local.js` | Writes `mobile/.env.local` (gitignored, overrides `.env`) with the local API URL and the CLI's development anon key. `.env` is never read or changed. |
| `seed-demo.js` | Creates one demo account and a week of gentle activity **through the app's own tables, RPCs and storage policies**, so it doubles as a backend smoke test. |

## Daily use

Requires Docker Desktop running and the Supabase CLI (`supabase --version`).

```bash
npm run backend:start     # build migrations, start the stack, apply all 21 migrations
npm run backend:env       # write .env.local using this machine's LAN IP (add -- --localhost for web-only)
npm run backend:seed      # optional: demo account + sample pet + a week of activity
npx expo start            # then press w for web, or scan the QR code
npm run backend:stop      # stop the containers (data is kept)
npm run backend:reset     # wipe the local database and re-apply every migration
npx supabase migration up --workdir local-backend   # apply only NEW migrations to a running stack (keeps data)
```

Demo login created by the seed: `demo@floura.local` / `floura-demo` (local throwaway fixture).

Studio for inspecting data: http://127.0.0.1:56323

## Phone on the same Wi-Fi

`backend:env` uses the machine's LAN address so a phone can reach the API. Windows Firewall must allow
inbound TCP 56321. If the machine's IP changes, run `backend:env` again and then `backend:seed` again
(stored image URLs contain the host).

## What does not work locally

- **Pet stylization** (`pet-stylize`) and **pet chat** (`pet-chat`) are Edge Functions that need
  provider keys (Gemini, a background-removal service, OpenRouter/Groq). They are not served here.
  Uploading a new pet photo stores the original and then shows the app's stylize error state.
  The seeded demo pet is repo sample art with its background keyed out by `seed-demo.js`; it stands in
  for stylized output.
- The `pets` bucket is **public** because the current client reads processed images with
  `getPublicUrl()`. That mirrors today's code, not the target design (see `docs/RESTORATION_BASELINE.md`,
  risks R-13 and R-14).

## Going from local to hosted

The generated migration set is the proposed reconciliation order for a new hosted project. Do not push
it anywhere without the owner's explicit approval; see `docs/RESTORATION_PLAN.md`, Phase 2.
