# Luna TestFlight readiness — 17 October 2026

Status: the app and hosted core backend passed the checks below. **No signed IPA was built or submitted to
TestFlight.** This is preparation evidence, not native-device acceptance or public-release approval.

## Release targets

- App: Luna, `com.lunapet.app`, scheme `luna`, iPhone only.
- Supabase: **Bloom**, `jhrsfogxxexmzauhtjif`, selected explicitly by Donovan in this chat.
- Expo: [@auramindai/luna](https://expo.dev/accounts/auramindai/projects/luna), project
  `dc343898-1e42-484b-9e43-a30a4d3938f4`. Created and linked during this audit.
- Both EAS `production` and `preview` environments now contain Bloom's URL and publishable key; read back after
  saving. No service-role key, database password or AI key was put in EAS or the client bundle.
- `production` uses store distribution and automatic build-number increment. `preview` is internal distribution;
  use **production**, not preview, for TestFlight.
- Local `.env.staging` was recreated with public Bloom values and remains ignored by Git and EAS.

## Fixed

1. **EAS archive selection.** A repository-root `.easignore` excludes historical `mobile/ios` and `mobile/android`,
   local backups, env files, local databases, temporary exports and old applications. Verified with an actual
   `eas build:inspect` archive: app config/assets present; native directories/backups/env files absent.
   The native folders remain intact in the working tree. A `mobile/.easignore` alone was insufficient because
   EAS archives this repository's root. A fresh native project must be generated from Luna's SDK 57 config.
2. **Painting wiring.** Client now uses `<project URL>/functions/v1/pet-stylize`, which works for hosted and local
   Supabase. `pet-stylize` was deployed to Bloom with JWT verification retained. The handler validates the caller
   before inspecting image input or provider configuration. A health response exposes only a `ready` boolean,
   so deployment is distinguishable from having the Gemini key. Retired deployment aliases targeting the deleted
   project were removed; `npm run supabase:deploy:pet` targets Bloom explicitly.
3. **Native session lifecycle.** Token refresh starts when the app becomes active, stops in the background, and
   unsubscribes on provider cleanup. Actual iOS foreground/background behavior still needs a device test.
4. **Account deletion pagination.** Walks every storage page and nested folder, deletes in bounded batches, then
   deletes the account. Tested beyond 1,000 objects and with nested folders.
5. **Journal retries.** New offline saves/deletions have a persistent outbox. Failed deletions stay hidden while
   waiting to sync; retrying an upsert doesn't duplicate entries. Saves serialize per account, old array-format
   device journals remain readable, and device-storage failures are no longer presented as successful saves.
   Retry occurs when opening/using the journal, not in a background service. This does not provide real-time
   cross-device reconciliation or recover historical writes that never reached the server before this update.
6. **Database reproducibility.** Recovered the already-deployed `20261016014418_wardrobe_v1` SQL from Bloom's
   recorded migration statements. Added it to the local migration builder, applied it only locally, and extended
   isolation/deletion fixtures. No hosted schema or existing user data was changed. Local and hosted migration
   inventories now contain 31 versions. Two older generated files have source-hash-header-only changes from
   rebuilding; their SQL bodies are unchanged.
7. **Dependency alignment.** Updated Expo 57.0.29 → 57.0.30, as required by Expo Doctor. Pinned the Supabase client
   to the already-installed 2.117.3, with the lockfile retained.
8. **Support-site draft.** `website/luna/build.cjs` produces a local support page and shared privacy-policy page.
   Desktop rendering and FAQ/privacy navigation were inspected. No domain, mailbox or public hosting was created.

## Evidence

| Check | Result |
|---|---|
| Client TypeScript | Pass |
| Four Edge Functions, Deno typecheck | Pass |
| Jest | **53 suites / 416 tests pass** |
| Local database pgTAP, including recovered wardrobe schema | **5 files / 334 tests pass** |
| Disposable live Bloom integration test | **39 assertions pass** |
| Expo Doctor | **21/21 pass** |
| iOS production Hermes export | Pass; 5.8 MB `.hbc` bundle |
| Web production export | Pass |
| EAS archive inspection | App/assets included; stale native folders, backups and env files excluded |
| Bloom public tables without RLS | **0** |
| Bloom pet-photo bucket | Private; 10 MiB limit and image MIME allowlist |
| Temporary hosted test accounts after cleanup | **0** |
| `git diff --check` | Pass |

Live smoke coverage: sign-in with the release publishable key, profile/default tasks, pet, check-in, journal
upsert replay, cross-account reads and journal overwrite denial, idempotent task rewards, point-forging denial,
catalog, event rollup, pet state, private photo upload/sign/download and cross-account/public access denial,
session refresh, authenticated painting health, unsigned painting request rejection, account deletion and row
cascades. Only synthetic fixture accounts/files were used, then deleted. No email was sent and no AI image was
generated during these tests. Self-signup confirmation and recovery email delivery therefore remain unverified.

Local logs/exports are under ignored `mobile/tmp/launch-*`. The shared checkout received the separately developed
Cozy Run commit `b136457` during this work; final app tests include that commit plus this audit's local changes.
No commit or push was performed by this audit. An exported JS bundle is not a signed native binary.

## Remaining gates

| Gate | Current evidence / action |
|---|---|
| Gemini painting | Function deployed, but final preflight reports `ready: false`. Donovan will add `GEMINI_API_KEY` in [Bloom secrets](https://supabase.com/dashboard/project/jhrsfogxxexmzauhtjif/functions/secrets). Then run a real photo through painting, inspect transparency/fidelity, and verify a relaunch still displays the signed private image. Do not infer success from health HTTP 200. |
| Auth email | Email signup and confirmation are enabled. SMTP provider, sender/domain, confirmation redirect and delivery were not verified. The dashboard opened at sign-in. Paste `local-backend/supabase/templates/recovery.html` into the hosted Reset Password template, and verify signup + password reset with an actual mailbox. No mail-provider account or domain exists for Luna yet. |
| Apple / TestFlight | Confirm Apple Developer membership, ownership of `com.lunapet.app`, App Store Connect app record and signing credentials. No Apple credential validation, signed archive, upload, processing or installation occurred here. |
| Physical iPhone acceptance | First install → signup/confirmation → pet onboarding/painting → care/task rewards → journal offline/reconnect → sign-out/relaunch → password recovery → private photo/account deletion. Also reminders/background return, camera/photo permission denial, games, haptics, sound and memorial behavior. |
| Privacy/support | Contact email still blank. Review the existing policy's provider retention, device-backup and 30-day backup-expiry wording against actual settings; host support and privacy pages publicly. The local draft is not a live support URL or legal compliance review. |
| Dependencies | `npm audit --omit=dev` still reports **56 advisories (39 high, 17 moderate)**, largely inherited toolchain chains, including sharp's native image dependencies. These have not all been assessed for runtime reachability. Suggested automated fixes include incompatible Expo/RN downgrades/upgrades, so no force-fix was used. Review compatible patches/overrides and keep developer tooling isolated before a wider launch. |
| Supabase security | Advisor reports leaked-password protection disabled and eight authenticated SECURITY DEFINER RPC warnings. Privileged RPCs are intentional owner-scoped endpoints and anon EXECUTE is revoked; isolation/grant tests passed. Enable leaked-password protection if supported by the selected plan. JWTs remain subject to Supabase's normal expiry after account deletion; user rows cascade and all client-test accounts were removed. |
| Performance / operations | Four INFO notices: missing FK indexes on `tasks.user_id`, `habit_completions.habit_id`, `garden_unlocks.item_id`, `user_plants.plant_id`. No load test, backup/restore proof, availability guarantee, monitoring setup or paid-plan verification was performed. Painting currently has a per-user cooldown; review concurrency and provider spending limits before broad access. |

Pet Talk stays off. Retired pet-chat/weekly-summary functions were not deployed. The draft plan-engine migration
is intentionally not applied: the current client uses device-side plan storage and does not need that schema.
Payments, social sign-in, Health and widgets are not prerequisites for this scoped free beta.

## Repeatable next steps

From `mobile/`:

```powershell
npm.cmd run check:release
npm.cmd test -- --runInBand --cacheDirectory tmp/jest-launch
npm.cmd run backend:test
# Explicitly creates two disposable Bloom users and cleans up only those users:
npm.cmd run test:hosted
```

After the remaining checks and Apple setup, create a concrete release candidate and record its commit/build id:

```powershell
$env:APP_ENV = 'staging'
eas.cmd build --platform ios --profile production
# After checking the specific build, submit that build id (never an unverified latest build):
eas.cmd submit --platform ios --id <verified-build-id> --profile production
```

References consulted: [Expo EAS ignore rules](https://docs.expo.dev/build-reference/easignore/),
[Supabase native auth lifecycle](https://supabase.com/docs/guides/auth/quickstarts/react-native),
[Edge Function authorization headers](https://supabase.com/docs/guides/functions/auth-headers).
