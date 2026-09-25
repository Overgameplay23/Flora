# Pet Cartoon v2

## Pipeline
- Stage 1: Background removal produces a transparent PNG cutout and uploads it to `pets/processed/{id}/cutout.png`.
- Stage 2: Gemini stylization runs against the cutout using the centralized `PROMPT_V1_BEST_CUTE` plus the negative constraints for cute-max garden style.
- Stage 3: Alpha polish reapplies the cutout mask (with a light feather + premultiply) to the stylized output, then uploads `pets/processed/{id}/stylized.png` (and also backfills the legacy cache when a source hash is provided).

## Why removal comes first
- Sending Gemini a clean silhouette increases the chance of keeping the pet centered, avoids extra objects, and reduces color bleeding.
- Reusing the same alpha mask for polish removes white halos from model backdrops and keeps outlines crisp.
- The stored cutout gives us a reusable mask for future tweaks without re-running removal.

## Tuning the style prompt
- Edit `PROMPT_V1_BEST_CUTE` / `NEGATIVE_PROMPT_V1` in `supabase/functions/pet-stylize/index.ts`.
- Keep the tone: round shapes, garden storybook palette, transparent (or flat-light) backgrounds, and “no text/UI/watermarks”.
- If you add new constraints, keep them short and positive; put hard bans in the negative prompt.

## End-to-end test
1) Start the function locally (requires Supabase CLI + secrets set):
   ```bash
   supabase functions serve pet-stylize --no-verify-jwt
   ```
2) Run a request with a sample PNG/JPEG (replace `<base64>`):
   ```bash
   curl -X POST http://localhost:54321/functions/v1/pet-stylize \
     -H "Authorization: Bearer <access_token>" \
     -H "Content-Type: application/json" \
     -d '{
       "imageBase64": "<base64>",
       "mimeType": "image/png",
       "outputFormat": "png",
       "stylePreset": "cute_max"
     }'
   ```
3) Expected:
   - Response contains `version: "v2"` and `stylized_base64` (PNG) and, when a source hash is sent, `stylized_url` pointing to `pets/processed/{id}/stylized.png`.
   - Storage contains both `processed/{id}/cutout.png` and `processed/{id}/stylized.png`. Halos should be gone; background transparent.
   - If background removal API is misconfigured or fails, the legacy stylization path returns `version: "v1"` and still uploads to the legacy cache path.
