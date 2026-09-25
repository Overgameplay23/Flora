# Pet Stylize (Supabase Edge Function)

## Env setup
- Copy `.env.example` to `.env` and fill `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, and `EXPO_PUBLIC_API_URL`.
- Restart Expo after changing env values (`expo start -c`) so the new values load.

## Supabase CLI
If the CLI is not available in PATH on Windows, install with Scoop:
```powershell
Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
irm get.scoop.sh | iex
scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
scoop install supabase
supabase --version
```

## Deploy (project ref: gghesvpmskjlrlpoosgf)
```powershell
supabase login
supabase link --project-ref gghesvpmskjlrlpoosgf
supabase secrets set gemini_api_key="YOUR_GEMINI_KEY"
supabase functions deploy pet-stylize --no-verify-jwt
```

## Logs
```powershell
supabase functions logs pet-stylize --project-ref gghesvpmskjlrlpoosgf --tail
```

## Health Check
```bash
curl -i https://gghesvpmskjlrlpoosgf.functions.supabase.co/pet-stylize
```

## Notes
- Edge Function reads `gemini_api_key` (fallback `GEMINI_API_KEY`).
- Keep the image payload small; the client enforces a max base64 length.
- Optional override: set `EXPO_PUBLIC_SUPABASE_FUNCTIONS_URL=https://gghesvpmskjlrlpoosgf.functions.supabase.co` (dev-only) if you need to bypass `/functions/v1`.
- If you see HTTP 429 from the function, Gemini quota/rate limits were hit. Check Google AI Studio / Google Cloud billing + quotas and reduce request frequency (caching is enabled in the function).
- Run `supabase/schema_pet_stylize.sql` in SQL editor to create the `pet_stylize_requests` rate limit table.


## 2026-09-25 — strategy report vs. what exists (for Donovan to decide)

Read `docs/product-strategy/PRODUCT_STRATEGY.md` before this list. Nothing below was removed; each is a
call for the owner.

- **Name.** The app is now shown as "Luna" (app.json `name`, onboarding and Profile copy) per the owner's
  2026-09-25 note. The slug, bundle identifier and Android package are unchanged (owner decision; see
  RESTORATION_PLAN Phase 6). The report flags trademark checks before launch ("Flora - Green Focus");
  "Luna" is also a common app name, so the same check applies.
- **Open-ended AI chat.** The report says no open-ended chatbot in v1 (use designed dialogue trees). The
  `pet-chat` Edge Function and the Talk screen still exist and are reachable from the Pet tab; they only
  work with provider keys. Options: keep behind a flag, replace with the daily reflection prompt, or remove.
- **Fertility predictions.** The report says no fertility predictions and "never clinical". The cycle
  tracker's fertile-window estimate was **removed from the UI on 2026-09-25** to match (the phase engine
  keeps period / follicular / luteal / expected). The remaining copy stays non-clinical with the disclaimer.
- **Streaks.** The report warns against punitive streaks. Luna shows streak counts (Home header, Profile)
  but never penalises: nothing is lost, the pet never declines. Consider renaming to "days together" and
  adding the Graceful Hibernation copy ("You're back! Let's take today easy.") on return after 5+ days.
- **Garden vs. sanctuary room.** The report imagines a cozy room; the product identity here is a garden
  that grows. Kept the garden (the owner's original identity); a room could be a later "space".
- **Points vs. Sprouts.** The report names the currency "Sprouts"; the app says "pts". Renaming is a copy
  change once the owner confirms the word.
- **Pet generation.** The report recommends a parametric vector rig over diffusion output. Luna now has a
  dog/cat vector rig with a customisation step (2026-09-25); the Gemini `pet-stylize` portrait path is kept
  as an optional "painted portrait" and still needs provider keys to test.
- **Health/steps, widgets, notifications, SSO.** All require a native strategy and an app identity
  (not possible in Expo Go on the App Store build without the owner's decisions); logged as roadmap items.

- **Alert.alert is a no-op on web** (found 2026-09-25 while testing the memorial). `src/utils/confirm.ts` is the
  replacement (`confirmAsync` / `notify`). Swept the same day: every live screen uses it now; only the superseded
  `PetSetupScreen` still imports `Alert`. Rule for new code: never call `Alert.alert` directly.
- **Journal** (2026-09-25): rebuilt as a private, prompt-led journal. Dropped from the UI: voice entries (no audio
  storage or transcription existed) and the AI "follow-up question" (the `aiPrompt` API is gone, and the report
  argues for designed prompts). If you want voice notes back (report Ph3 "scrapbooks w/ voice notes"), that needs
  a storage bucket and a transcription provider; the original screen is in `docs/baseline/originals`.
- **Weekly recap** (2026-09-25): the report's Sunday "scrapbook" push is not possible without notifications, so
  "Our week" is pull-only for now (Home week card and Profile). The "room item" reward it mentions is not built;
  the garden already rewards points daily. Decide later whether the recap should unlock anything.
- **Memorial mode** (2026-09-25) is built as described in the report; the "pause alerts" part waits for
  notifications to exist. Multi-pet remains out of scope: a new companion archives the memorial on the device.
