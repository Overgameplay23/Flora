# Floura Mobile

## Supabase CLI (Windows)

The Supabase CLI is required to deploy Edge Functions like `pet-stylize`. The npm global install is not supported.

Install with Scoop:
```powershell
Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
irm get.scoop.sh | iex
scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
scoop install supabase
supabase --version
```

If you prefer manual install, download the CLI from:
https://github.com/supabase/cli/releases

## Pet Chat Deploy Checklist

1. Use the correct workdir so deploy picks up `supabase/functions/pet-chat/index.ts`:
```powershell
supabase functions deploy pet-chat --project-ref gghesvpmskjlrlpoosgf --workdir C:\Users\donov\floura\mobile --use-api
```

2. Ensure required secrets are set:
```powershell
supabase secrets set OPENROUTER_API_KEY=<value> GROQ_API_KEY=<value> PET_CHAT_ALLOW_FALLBACK_REPLY=false --project-ref gghesvpmskjlrlpoosgf --workdir C:\Users\donov\floura\mobile
```

3. Confirm the function is active:
```powershell
supabase functions list --project-ref gghesvpmskjlrlpoosgf --workdir C:\Users\donov\floura\mobile
```

4. Health check (GET):
```bash
curl -i "https://gghesvpmskjlrlpoosgf.supabase.co/functions/v1/pet-chat"
```

5. Chat check (POST with auth token):
```bash
curl -i -X POST "https://gghesvpmskjlrlpoosgf.supabase.co/functions/v1/pet-chat" \
  -H "Authorization: Bearer <USER_ACCESS_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"hello"}]}'
```

## Retention Engine v1

This repo now includes a retention foundation with:
- `public.user_events` as source-of-truth event log
- `public.daily_user_metrics` UTC daily rollups
- `public.pet_state` cached streak/risk/mood
- `public.weekly_summaries` AI-generated weekly summaries
- `public.user_memories` high-signal memory rows
- RPCs:
  - `public.log_event_and_rollup(...)`
  - `public.recompute_pet_state()`
- Edge Function:
  - `weekly-summary` (user-callable + admin/batch mode)

### Run migrations locally

```powershell
supabase start
supabase db reset
```

If your local DB is already running and you only want new migrations:

```powershell
supabase migration up
```

### Deploy function

```powershell
npm run supabase:deploy:weekly-summary
```

### Weekly summary invoke examples

User mode (requires user access token):

```bash
curl -X POST "https://<project-ref>.supabase.co/functions/v1/weekly-summary" \
  -H "Authorization: Bearer <USER_ACCESS_TOKEN>" \
  -H "Content-Type: application/json"
```

Admin/batch mode:
- Option A: `Authorization: Bearer <SERVICE_ROLE_KEY>`
- Option B: set `WEEKLY_SUMMARY_ADMIN_SECRET` and pass `x-admin-secret` header

### Quick manual test steps

1. Complete one task in the app and submit one check-in.
2. Open Home and confirm Pet Retention section shows streak/mood/risk plus 7 days of rows.
3. Verify `daily_user_metrics` increments for UTC today after each event.
4. Call `recompute_pet_state` from the app (`Home` focus already does this) and confirm `pet_state` upsert exists.
5. Call `weekly-summary` and confirm rows appear in `weekly_summaries` and `user_memories`.

### SQL sanity checks

Run `scripts/retention_sanity.sql` in SQL editor (replace `<USER_ID>`). It includes:
- object existence checks
- rollup verification queries
- pet state checks
- weekly summary + memories checks
