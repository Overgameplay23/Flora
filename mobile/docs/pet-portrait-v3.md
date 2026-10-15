# Pet Portrait v3 (`pet-stylize`)

Replaces `pet-cartoon-v2.md` (kept for history). Since 2026-10-14 the pet's picture is painted from the
person's own photos only: they add 1 to 3 photos, nothing about the pet is picked by hand, and the result
is a polished 2.5D illustration rather than a chibi mascot.

## What the app does
- Onboarding (`src/screens/onboarding/OnboardingScreen.tsx`): welcome → dog or cat → **photos (1-3)** → name
  → painting → meet → first small thing. With photos the look editor is skipped (`src/domain/onboarding.ts`);
  it only appears for someone who skips the photos. The name step shows no name ideas when photos exist
  (`nameSuggestionsFor`): the pet already has a name.
- Picking (`src/utils/pickPetPhotos.ts`): the library picker is multi-select (`selectionLimit`), the camera adds
  one at a time. Every photo is shrunk on the device to a 1024 px long side and re-encoded as JPEG
  (`expo-image-manipulator`) before it is kept, so three photos are ~1 MB of base64 in total.
- Request (`src/services/petStylize.js`): `images: [{ imageBase64, mimeType }, …]` plus the first photo in the
  old single-image fields, so an older deployment of the function still paints from photo 1. `sourceHash`
  covers every photo; the function caches a finished portrait per hash. The first photo is stored as the pet's
  original (`<uid>/original.<ext>`); the others are only used for the request. "Paint again" from the Pet tab
  therefore repaints from photo 1 alone.
- The species and a photo-tinted look are still saved (`savePetLook`) so the illustrated rig can stand in
  while the portrait is painted. **The portrait wins over the rig** once it exists (`PetPortrait`,
  `GardenStage`, `PetTabIcon`): a transparent stylized/cutout image is the pet; the rig only shows when there
  is none, or if the portrait image fails to load. Rig-only features (wander, acted-out routines) are off while
  the portrait is shown.

## Pipeline (`supabase/functions/pet-stylize/index.ts`)
1. **Paint.** One Gemini `generateContent` call with `PROMPT_V3_PORTRAIT`, every reference photo attached,
   then `NEGATIVE_PROMPT_V3`. `generationConfig.imageConfig.aspectRatio` (default `1:1`,
   `GEMINI_IMAGE_ASPECT`) and, when set, `imageSize` (`GEMINI_IMAGE_SIZE`, Gemini 3 Pro Image only). If the
   model rejects `imageConfig` with a 400, the call is retried once without it. Timeout
   `GEMINI_IMAGE_TIMEOUT_MS` (60 s).
2. **Key the backdrop.** The prompt asks for a solid white backdrop. `keyOutFlatBackground` samples the border,
   checks it is flat (≥ 80 % of border pixels within an RGB distance of 26 of the mean), flood-fills the backdrop
   from the border (so a white chest or a cream coat inside the silhouette survives), feathers the edge by one
   pixel and writes the alpha. The silhouette is therefore the painted pet's own, not the photo's: v2 clipped the
   full-body painting with the original photo's cutout mask, which cut off anything the photo did not show.
   If the border is not flat (the model painted a scene) the existing `removeBackground` providers run on the
   painting; if that fails too, the opaque painting is stored but flagged `alpha_stylized: false`.
3. **Fallback cutout.** Only when there is no transparent portrait: the old path (background removal of photo 1,
   then the colour-key fallback) uploads `cutout.png` so the app still has something to show. When the portrait
   succeeded, any older `cutout.png` / `mask.*` is deleted so a cache hit cannot resurrect a stale photo.
4. Upload `<uid>/processed/stylized.png`; respond with the same `processed` shape as before.

`stylePreset` is informational except `cute_max_v2`, which selects the old mascot prompt for comparison.
`imageUrl` (the repaint path) is only fetched from this project's storage host
(`PET_STYLIZE_ALLOWED_IMAGE_HOSTS` adds more), closing the 2026-09-27 note about fetching arbitrary URLs.

## Tuning
- Style and likeness: `PROMPT_V3_PORTRAIT` / `NEGATIVE_PROMPT_V3`. Keep "solid, uniform, pure white
  background … no shadow, no gradient": the keying depends on it. Keep "paws resting on the bottom edge": the
  garden stands the pet on the grass.
- Quality: `GEMINI_IMAGE_MODEL=gemini-3-pro-image-preview` (+ optional `GEMINI_IMAGE_SIZE=2K`) paints finer
  fur and a truer likeness at a higher per-image price; the default stays `gemini-2.5-flash-image`.
- Keying: `FLAT_KEY_TOLERANCE` (26) and `FLAT_BORDER_SHARE` (0.8). A white pet on a white backdrop is the one
  weak case; the flood fill only eats what is connected to the border, so it survives unless the painting
  leaves no edge contrast at all.

## Deploy and test
```powershell
# from mobile/ (secrets from supabase/functions/.env.staging; see .env.example)
npm run functions:secrets -- --env-file ../supabase/functions/.env.staging
npm run functions:deploy -- pet-stylize
```
`local-backend/supabase/config.toml` must declare `[functions.pet-stylize]` with
`entrypoint = "../../supabase/functions/pet-stylize/index.ts"` for the deploy wrapper to find it (the same
pattern as `pet-talk`).

Request shape (POST, bearer token):
```json
{
  "images": [{ "imageBase64": "<b64>", "mimeType": "image/jpeg" }, { "imageBase64": "<b64>", "mimeType": "image/jpeg" }],
  "imageBase64": "<b64 of photo 1>",
  "mimeType": "image/jpeg",
  "stylePreset": "portrait",
  "outputFormat": "png",
  "userId": "<uid>",
  "sourceHash": "<sha256 of all photos>"
}
```
Expected: `processed.stylized_url` set, `processed.alpha_stylized: true`, `processed.cutout_url: null`,
`provider_used: "gemini"`, and the function log shows `backdrop keyed` with a `keyedShare` around 0.4-0.8.
