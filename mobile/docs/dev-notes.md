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
