# LIFTIQ

## Run

```powershell
cd C:\Users\donov\floura\mobile\liftiq
npm start
```

## Scripts

- `npm start` - Expo dev server
- `npm run ios` - launch iOS target from Expo
- `npm run android` - launch Android target
- `npm run typecheck` - TypeScript validation

## Env

Add Expo extra values in `app.json` or EAS env before enabling Supabase-backed auth and recap calls:

- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`

Without those keys, the app stays local-first and uses deterministic fallback recaps.

## Supabase Scaffold

- Migration: `liftiq/supabase/migrations/2026_03_09_liftiq_mvp.sql`
- Seed catalog: `liftiq/supabase/seed/exercise_catalog.sql`
- Edge Function: `liftiq/supabase/functions/session-recap/index.ts`

Apply/deploy those once the Supabase project exists.
