# pet-talk

The pet's conversation, backed by OpenAI. Written 2026-09-26 ahead of the owner's API key so that
setting the key is the only step left. `pet-chat` (the older coach/chat function) is untouched.

## What it does

- Verifies the user's Supabase session (Bearer JWT), so only signed-in users can talk.
- Builds the pet's voice server-side from `prompt.ts` (character by species, adopted or real,
  garden or window nook, the week as the app tells it, memorial and cycle guardrails). The app sends
  facts, never the prompt, so the guardrails cannot be edited from a phone.
- Caps each user per day with the existing `consume_pet_chat_quota` counter.
- Calls OpenAI's chat completions endpoint and returns one short reply. Nothing is stored.

## Secrets (hosted project only; never in the app bundle or `.env`)

| Name | Required | Meaning |
| --- | --- | --- |
| `OPENAI_API_KEY` | yes | the key; without it the function answers `configured: false` and the app shows no "Talk" entry |
| `OPENAI_MODEL` | no | model name (defaults to `gpt-4o-mini`; set it to the model the owner chooses) |
| `PET_TALK_MAX_PER_DAY` | no | per-user daily cap (default 30) |
| `PET_TALK_TIMEOUT_MS` | no | provider timeout (default 20000) |

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are provided by the platform.

## Turning it on (owner actions, each needs a hosted Supabase project)

```bash
npx supabase secrets set OPENAI_API_KEY=... OPENAI_MODEL=... --project-ref <ref>
npx supabase functions deploy pet-talk --project-ref <ref>
```

The app asks the function `{ "ping": true }` once per session; when it answers `configured: true`,
"Talk to <pet>" appears on the Pet tab and in Profile.

## Trying the screen before the key exists

Build with `EXPO_PUBLIC_PET_TALK_PREVIEW=1` and the entry points appear with a stand-in reply that
echoes the message. This flag must never be set for a real build.

## Local runs

The local stack has the edge runtime disabled (`local-backend/supabase/config.toml`). To run this
function locally, enable it, put the secrets in `supabase/functions/.env` (git-ignored) and use
`npx supabase functions serve pet-talk --env-file supabase/functions/.env --workdir local-backend`.
