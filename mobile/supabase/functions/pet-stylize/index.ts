import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.3";
import { GoogleGenerativeAI } from "https://esm.sh/@google/generative-ai@0.24.0";
import { decodeBase64, encodeBase64 } from "https://deno.land/std@0.224.0/encoding/base64.ts";
import { Image } from "https://deno.land/x/imagescript@1.3.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

// v3 "portrait": the pet is painted from 1-3 photos of the same animal, faithfully (breed, markings,
// proportions) and in a polished 2.5D illustration style rather than a chibi mascot. The model paints on
// a flat white backdrop, which the function keys out afterwards (keyOutFlatBackground) so the silhouette
// is the painted pet's own, not the photo's.
const PROMPT_V3_PORTRAIT =
  "Create one polished character portrait of the pet in the attached reference photo(s). Every attached photo shows the same animal: " +
  "study all of them and keep this exact pet's breed, body shape, size and proportions, coat colour, markings and patterns, fur length and texture, " +
  "ear shape, eye colour, nose, and any collar or distinctive feature, so the owner recognises their pet instantly. " +
  "Style: a high-quality 2.5D illustration like a still from a modern animated feature film, naturally proportioned (not chibi, not a mascot), " +
  "with soft painterly fur detail, gentle depth and warm, even lighting; appealing and friendly but true to life. " +
  "No thick cartoon outlines, no flat cel shading, no exaggerated eyes or head. " +
  "Pose: the whole pet, sitting upright and facing the viewer with a calm, friendly expression, all four paws visible, centred, " +
  "with the paws resting on the bottom edge of the frame so the pet can stand on the ground of a scene. " +
  "Fill the frame with the pet and leave only a small margin on the left, right and top. " +
  "Background: a solid, uniform, pure white background (#FFFFFF) and nothing else: no scenery, no floor, no shadow, no vignette, " +
  "no gradient, no props, no text, no watermark, no frame.";
const NEGATIVE_PROMPT_V3 =
  "Do not change the pet's colours, markings, breed or proportions. No cartoon mascot style, chibi proportions, thick outlines, " +
  "flat pastel cel shading, oversized eyes, stickers, text, logos, watermarks, borders, multiple animals, extra limbs, cropped or " +
  "cut-off body parts, outfits or props that are not in the photos, scenery, floors, shadows or gradients in the background.";
// The previous mascot style, kept for comparison. Only used when the client asks for stylePreset "cute_max_v2".
const PROMPT_V2_CUTE_MAX =
  "Transform this pet photo into a cute-max storybook mascot that matches a cozy garden world. " +
  "Always draw the WHOLE pet, from the tips of the ears to the paws and tail, sitting upright on the ground and facing the viewer, " +
  "even when the reference photo shows only the head or part of the body; keep the reference pet's markings, colours and ear shape. " +
  "Chibi proportions, soft thick outline, flat pastel colors, simplified shapes, no realistic fur texture. " +
  "Keep the pet centered with a clean silhouette and all four paws visible; the paws rest on the bottom edge of the image so the pet can stand on the ground of a scene. " +
  "Solid pure white background only. No text, UI, watermark, frame, or sticker border.";
const NEGATIVE_PROMPT_V2 =
  "Avoid photorealism, harsh shadows, cluttered or photographic backgrounds, multiple animals, cropped heads, head-only or bust portraits, cut-off paws, text, UI, logos, or watermarks. " +
  "Do not add outfits or props that obscure the pet. No side characters or extra limbs. " +
  "No scenery, no background elements, no framing.";
const PROMPT_VERSION = "v3_portrait";
const RESPONSE_VERSION = "v2";
const BACKGROUND_REMOVAL_SYSTEM_PROMPT =
  "Remove the background and return a PNG with a transparent alpha channel. Keep the subject exactly.\n" +
  "Do not add a new background, do not change pose, do not crop tightly, keep natural edges.";

const MAX_BASE64_LENGTH = 7_000_000;
// up to three photos of the same pet travel in one request (the app shrinks each to ~1024 px first)
const MAX_REFERENCE_IMAGES = 3;
const MAX_TOTAL_BASE64_LENGTH = 12_000_000;
// how far (RGB distance) a pixel may sit from the sampled backdrop colour and still be keyed out
const FLAT_KEY_TOLERANCE = 26;
// share of the border that must match the backdrop before the output counts as "painted on a flat backdrop"
const FLAT_BORDER_SHARE = 0.8;
const GEMINI_IMAGE_ASPECT = (Deno.env.get("GEMINI_IMAGE_ASPECT") ?? "1:1").trim();
// "1K" | "2K" | "4K": only Gemini 3 Pro Image understands this; leave unset for gemini-2.5-flash-image
const GEMINI_IMAGE_SIZE = (Deno.env.get("GEMINI_IMAGE_SIZE") || "").trim();
const GEMINI_IMAGE_TIMEOUT_MS = Math.max(10000, Number(Deno.env.get("GEMINI_IMAGE_TIMEOUT_MS")) || 60000);
// imageUrl may only point at this project's storage (or hosts listed here, comma-separated)
const ALLOWED_IMAGE_HOSTS = (Deno.env.get("PET_STYLIZE_ALLOWED_IMAGE_HOSTS") || "")
  .split(",")
  .map((value) => value.trim().toLowerCase())
  .filter(Boolean);
// Private bucket, one folder per user (<uid>/processed/...). getPublicUrl() below only builds each object's
// locator URL for the pet row; the app signs it before showing it (src/services/petPhotoUrls.ts).
const CACHE_BUCKET = "pets";
const RATE_LIMIT_SECONDS = 45;
const ALPHA_FEATHER_RADIUS = 1;

const BACKGROUND_REMOVAL_URL =
  Deno.env.get("BACKGROUND_REMOVAL_URL") || Deno.env.get("background_removal_url") || "";
const BACKGROUND_REMOVAL_API_KEY =
  Deno.env.get("BACKGROUND_REMOVAL_API_KEY") || Deno.env.get("background_removal_api_key") || "";
const BACKGROUND_REMOVAL_AUTH_HEADER = Deno.env.get("BACKGROUND_REMOVAL_AUTH_HEADER") || "";
const BACKGROUND_REMOVAL_PROVIDER =
  Deno.env.get("BACKGROUND_REMOVAL_PROVIDER") || Deno.env.get("background_removal_provider") || "";

function jsonResponse(status: number, payload: Record<string, unknown>) {       
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

type ProcessedPayload = {
  stylized_url: string | null;
  cutout_url: string | null;
  mask_url: string | null;
  alpha_stylized: boolean;
  alpha_cutout: boolean;
  mask_reapplied: boolean;
  provider_used: string;
  model_used: string;
  failure_reason?: string;
};

type ResponseDebug = {
  request_id: string;
  reason?: string;
  png_has_alpha?: boolean;
  alpha_sample?: unknown;
};

function buildProcessedPayload(options: {
  stylizedUrl?: string | null;
  cutoutUrl?: string | null;
  maskUrl?: string | null;
  alphaStylized: boolean;
  alphaCutout: boolean;
  maskReapplied: boolean;
  providerUsed: string;
  modelUsed: string;
  failureReason?: string;
}): ProcessedPayload {
  const payload: ProcessedPayload = {
    stylized_url: options.stylizedUrl ?? null,
    cutout_url: options.cutoutUrl ?? null,
    mask_url: options.maskUrl ?? null,
    alpha_stylized: options.alphaStylized,
    alpha_cutout: options.alphaCutout,
    mask_reapplied: options.maskReapplied,
    provider_used: options.providerUsed,
    model_used: options.modelUsed,
  };
  if (options.failureReason) {
    payload.failure_reason = options.failureReason;
  }
  return payload;
}

function buildEmptyProcessed(providerUsed = "none", modelUsed = "none") {
  return buildProcessedPayload({
    stylizedUrl: null,
    cutoutUrl: null,
    maskUrl: null,
    alphaStylized: false,
    alphaCutout: false,
    maskReapplied: false,
    providerUsed,
    modelUsed,
  });
}

function buildResponsePayload(options: {
  ok: boolean;
  petId: string;
  processed: ProcessedPayload;
  requestId: string;
  debug?: Omit<ResponseDebug, "request_id">;
}) {
  return {
    ok: options.ok,
    pet_id: options.petId,
    version: RESPONSE_VERSION,
    processed: options.processed,
    debug: { request_id: options.requestId, ...(options.debug || {}) },
  };
}

function getEnvKey() {
  return Deno.env.get("GEMINI_API_KEY") || Deno.env.get("gemini_api_key") || "";
}

function stripBase64Prefix(value: string) {
  if (!value) return "";
  const marker = "base64,";
  const index = value.indexOf(marker);
  return index >= 0 ? value.slice(index + marker.length) : value;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function pickFirstString(...values: unknown[]) {
  for (const value of values) {
    if (isNonEmptyString(value)) return value;
  }
  return null;
}

function isProbablyUrl(value: string) {
  return /^https?:\/\//i.test(value);
}

function extractMaskCandidate(payload: Record<string, unknown> | null) {
  if (!payload) return null;
  const directUrl = pickFirstString(
    payload.mask_url,
    payload.maskUrl,
    payload.segmentation_mask_url,
    payload.segmentationMaskUrl
  );
  if (directUrl) {
    return { url: directUrl, mime: pickFirstString(payload.mask_mime, payload.maskMime, payload.mime) };
  }
  const directBase64 = pickFirstString(
    payload.mask_base64,
    payload.maskBase64,
    payload.mask,
    payload.mask_image,
    payload.maskImage,
    payload.segmentation_mask,
    payload.segmentationMask
  );
  if (directBase64) {
    if (isProbablyUrl(directBase64)) {
      return { url: directBase64, mime: pickFirstString(payload.mask_mime, payload.maskMime, payload.mime) };
    }
    return { base64: directBase64, mime: pickFirstString(payload.mask_mime, payload.maskMime, payload.mime) };
  }
  if (payload.mask && typeof payload.mask === "object") {
    const maskObj = payload.mask as Record<string, unknown>;
    const objUrl = pickFirstString(maskObj.url, maskObj.mask_url, maskObj.maskUrl, maskObj.href);
    const objBase64 = pickFirstString(maskObj.base64, maskObj.image_base64, maskObj.mask_base64, maskObj.data);
    const objMime = pickFirstString(maskObj.mime, maskObj.content_type, maskObj.contentType);
    if (objUrl || objBase64) {
      return {
        url: objUrl || (isProbablyUrl(objBase64 || "") ? objBase64 : null),
        base64: objUrl ? null : objBase64,
        mime: objMime,
      };
    }
  }
  return null;
}

async function resolveMaskFromPayload(
  payload: Record<string, unknown> | null,
  requestId: string
): Promise<{ bytes: Uint8Array; mime: string } | null> {
  const candidate =
    extractMaskCandidate(payload) ||
    extractMaskCandidate((payload?.data as Record<string, unknown> | null) || null) ||
    extractMaskCandidate((payload?.result as Record<string, unknown> | null) || null);
  if (!candidate) return null;
  if (candidate.base64) {
    try {
      return {
        bytes: decodeBase64(stripBase64Prefix(candidate.base64)),
        mime: candidate.mime || "image/png",
      };
    } catch (error) {
      console.log("PET_STYLIZE: mask base64 decode failed", {
        requestId,
        message: (error as Error)?.message,
      });
      return null;
    }
  }
  if (candidate.url) {
    try {
      const response = await fetchWithTimeout(candidate.url, { method: "GET" }, 15000);
      if (!response.ok) {
        const snippet = (await response.text()).slice(0, 200);
        console.log("PET_STYLIZE: mask url fetch failed", {
          requestId,
          status: response.status,
          snippet,
        });
        return null;
      }
      const buffer = await response.arrayBuffer();
      return {
        bytes: new Uint8Array(buffer),
        mime: response.headers.get("content-type") || candidate.mime || "image/png",
      };
    } catch (error) {
      console.log("PET_STYLIZE: mask url fetch exception", {
        requestId,
        message: (error as Error)?.message,
      });
      return null;
    }
  }
  return null;
}

function buildErrorPayload(options: {
  code: string;
  message: string;
  details?: string | null;
  retryAfterSeconds?: number | null;
  requestId?: string | null;
  petId?: string | null;
  providerUsed?: string | null;
}) {
  const requestId = options.requestId || "unknown";
  const payload = buildResponsePayload({
    ok: false,
    petId: options.petId || "",
    processed: buildEmptyProcessed(options.providerUsed || "none", "none"),
    requestId,
    debug: { reason: options.code },
  });
  return {
    ...payload,
    error: {
      code: options.code,
      message: options.message,
      details: options.details ?? null,
      retryAfterSeconds: options.retryAfterSeconds ?? null,
      requestId,
    },
  };
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs = 20000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

function pickProcessedKey(userId: string, _sourceHash: string | null, _requestId: string) {
  return userId;
}

async function downloadIfExists(admin: any, path: string) {
  const { data, error } = await admin.storage.from(CACHE_BUCKET).download(path);
  if (data && !error) {
    return new Uint8Array(await data.arrayBuffer());
  }
  if (error && error.message && !error.message.includes("not found")) {
    console.log("PET_STYLIZE: cache check error", { path, message: error.message });
  }
  return null;
}

async function uploadAndGetUrl(admin: any, path: string, bytes: Uint8Array, contentType: string) {
  const { error } = await admin.storage.from(CACHE_BUCKET).upload(path, bytes, {
    upsert: true,
    contentType,
  });
  if (error) {
    throw error;
  }
  const { data } = admin.storage.from(CACHE_BUCKET).getPublicUrl(path);
  return data?.publicUrl || null;
}

function mapGeminiHttpError(
  status: number,
  snippet: string,
  requestId: string,
  petId = ""
) {
  const logPayload = { requestId, status, snippet };
  if (status === 429) {
    console.log("PET_STYLIZE: gemini rate limit", logPayload);
    return jsonResponse(
      429,
      buildErrorPayload({
        code: "RATE_LIMIT",
        message: "Quota exceeded.",
        details: `status=${status} ${snippet}`,
        retryAfterSeconds: 60,
        requestId,
        petId,
        providerUsed: "gemini",
      })
    );
  }
  if (status === 401 || status === 403) {
    console.log("PET_STYLIZE: gemini auth error", logPayload);
    return jsonResponse(
      502,
      buildErrorPayload({
        code: "AUTH",
        message: "Upstream auth failure.",
        details: `status=${status}`,
        requestId,
        petId,
        providerUsed: "gemini",
      })
    );
  }
  if (status >= 400 && status < 500) {
    console.log("PET_STYLIZE: gemini bad request", logPayload);
    return jsonResponse(
      400,
      buildErrorPayload({
        code: "BAD_REQUEST",
        message: "Gemini rejected the request.",
        details: `status=${status} ${snippet}`,
        requestId,
        petId,
        providerUsed: "gemini",
      })
    );
  }
  console.log("PET_STYLIZE: gemini upstream error", logPayload);
  return jsonResponse(
    502,
    buildErrorPayload({
      code: "UPSTREAM",
      message: "Gemini upstream error.",
      details: `status=${status} ${snippet}`,
      requestId,
      petId,
      providerUsed: "gemini",
    })
  );
}

function colorDistance(color: [number, number, number], ref: [number, number, number]) {
  const dr = color[0] - ref[0];
  const dg = color[1] - ref[1];
  const db = color[2] - ref[2];
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

function sampleBackgroundColor(bitmap: Uint8ClampedArray, width: number, height: number) {
  const coords = [
    [0, 0],
    [width - 1, 0],
    [0, height - 1],
    [width - 1, height - 1],
    [Math.floor(width / 2), 0],
    [Math.floor(width / 2), height - 1],
    [0, Math.floor(height / 2)],
    [width - 1, Math.floor(height / 2)],
  ];
  let r = 0;
  let g = 0;
  let b = 0;
  let count = 0;
  for (const [x, y] of coords) {
    const idx = (y * width + x) * 4;
    r += bitmap[idx] ?? 0;
    g += bitmap[idx + 1] ?? 0;
    b += bitmap[idx + 2] ?? 0;
    count += 1;
  }
  if (count === 0) return [255, 255, 255] as [number, number, number];
  return [Math.round(r / count), Math.round(g / count), Math.round(b / count)] as [
    number,
    number,
    number,
  ];
}

function isPngSignature(bytes: Uint8Array) {
  if (bytes.length < 8) return false;
  return (
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  );
}

function getPngColorType(bytes: Uint8Array) {
  if (!isPngSignature(bytes)) return null;
  const signatureLength = 8;
  if (bytes.length < signatureLength + 12) return null;
  const length = (bytes[8] << 24) | (bytes[9] << 16) | (bytes[10] << 8) | bytes[11];
  const type = String.fromCharCode(
    bytes[12] ?? 0,
    bytes[13] ?? 0,
    bytes[14] ?? 0,
    bytes[15] ?? 0
  );
  if (type !== "IHDR" || length < 13) return null;
  return bytes[signatureLength + 8 + 9] ?? null;
}

function pngHasAlphaChannel(bytes: Uint8Array) {
  const colorType = getPngColorType(bytes);
  return colorType === 4 || colorType === 6;
}

function scanAlpha(bitmap: Uint8ClampedArray) {
  let min = 255;
  let max = 0;
  for (let i = 3; i < bitmap.length; i += 4) {
    const alpha = bitmap[i];
    if (alpha < min) min = alpha;
    if (alpha > max) max = alpha;
    if (min === 0 && max === 255) break;
  }
  return { min, max, alphaDetected: min < 255 };
}

async function normalizeToPngWithAlphaCheck(bytes: Uint8Array) {
  try {
    const image = await Image.decode(bytes);
    const alphaStats = scanAlpha(image.bitmap);
    const pngBytes = new Uint8Array(await image.encode());
    const pngHasAlpha = pngHasAlphaChannel(pngBytes);
    if (!pngHasAlpha) {
      return {
        ok: false,
        alphaDetected: alphaStats.alphaDetected,
        pngHasAlpha: false,
        alphaSample: { min: alphaStats.min, max: alphaStats.max },
        reason: "missing_alpha_channel" as const,
      };
    }
    if (!alphaStats.alphaDetected) {
      return {
        ok: false,
        alphaDetected: false,
        pngHasAlpha: true,
        alphaSample: { min: alphaStats.min, max: alphaStats.max },
        reason: "opaque_alpha" as const,
      };
    }
    return {
      ok: true,
      alphaDetected: true,
      pngHasAlpha: true,
      alphaSample: { min: alphaStats.min, max: alphaStats.max },
      bytes: pngBytes,
    };
  } catch (_error) {
    return {
      ok: false,
      alphaDetected: false,
      pngHasAlpha: false,
      alphaSample: null,
      reason: "decode_failed" as const,
    };
  }
}

async function ensurePng(bytes: Uint8Array) {
  const decoded = await Image.decode(bytes);
  return new Uint8Array(await decoded.encode());
}

async function normalizeMaskForUpload(bytes: Uint8Array, mimeHint: string | null) {
  const hint = (mimeHint || "").toLowerCase();
  if (hint.includes("png") || isPngSignature(bytes)) {
    return { bytes, ext: "png", contentType: "image/png", converted: false };
  }
  if (hint.includes("webp")) {
    return { bytes, ext: "webp", contentType: "image/webp", converted: false };
  }
  try {
    const pngBytes = await ensurePng(bytes);
    return { bytes: pngBytes, ext: "png", contentType: "image/png", converted: true };
  } catch (_error) {
    return {
      bytes,
      ext: hint.includes("webp") ? "webp" : "png",
      contentType: mimeHint || "image/png",
      converted: false,
    };
  }
}

async function fallbackCutout(sourceBytes: Uint8Array) {
  const image = await Image.decode(sourceBytes);
  const { width, height } = image;
  const cutout = image.clone();
  const data = cutout.bitmap;
  const bgColor = sampleBackgroundColor(data, width, height);
  const softThreshold = 12;
  const hardThreshold = 32;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const distance = colorDistance([r, g, b], bgColor);
    let alpha = data[i + 3];
    if (distance <= softThreshold) {
      alpha = 0;
    } else if (distance < hardThreshold) {
      const ratio = (distance - softThreshold) / (hardThreshold - softThreshold);
      alpha = Math.round(alpha * ratio);
    }
    const factor = alpha / 255;
    data[i] = Math.round(r * factor);
    data[i + 1] = Math.round(g * factor);
    data[i + 2] = Math.round(b * factor);
    data[i + 3] = alpha;
  }

  const bytes = await cutout.encode();
  return { bytes: new Uint8Array(bytes), mime: "image/png", source: "fallback" as const };
}

function parseCustomHeader(value: string) {
  if (!value) return null;
  const [name, ...rest] = value.split(":");
  if (!name || rest.length === 0) return null;
  return { name: name.trim(), value: rest.join(":").trim() };
}

async function callBackgroundRemovalApi(sourceBytes: Uint8Array, sourceMime: string, requestId: string) {
  if (!BACKGROUND_REMOVAL_URL) return null;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (BACKGROUND_REMOVAL_API_KEY) {
    headers["Authorization"] = `Bearer ${BACKGROUND_REMOVAL_API_KEY}`;
  }
  const parsedHeader = parseCustomHeader(BACKGROUND_REMOVAL_AUTH_HEADER);
  if (parsedHeader?.name && parsedHeader.value) {
    headers[parsedHeader.name] = parsedHeader.value;
  }

  const payload = {
    image_base64: encodeBase64(sourceBytes),
    mime: sourceMime,
  };
  const response = await fetchWithTimeout(
    BACKGROUND_REMOVAL_URL,
    { method: "POST", headers, body: JSON.stringify(payload) },
    20000
  );
  if (!response.ok) {
    const snippet = (await response.text()).slice(0, 400);
    const error = new Error(`Background removal API failed (${response.status}). ${snippet}`);
    (error as Error & { status?: number }).status = response.status;
    throw error;
  }
  const contentType = response.headers.get("content-type") || "";
  if (contentType.startsWith("image/")) {
    const buffer = await response.arrayBuffer();
    return {
      bytes: new Uint8Array(buffer),
      mime: contentType.split(";")[0] || "image/png",
      source: "api" as const,
    };
  }
  let json: Record<string, unknown> | null = null;
  try {
    json = await response.json();
  } catch (_e) {
    json = null;
  }
  const outputBase64Candidate: unknown =
    json?.image_base64 ||
    (json?.data as Record<string, unknown> | null)?.image_base64 ||
    (json?.data as Record<string, unknown> | null)?.base64 ||
    (json?.result as Record<string, unknown> | null)?.image_base64 ||
    json?.result ||
    "";
  const outputBase64 = typeof outputBase64Candidate === "string" ? outputBase64Candidate : "";
  const outputMime =
    (json?.mime as string) ||
    ((json?.data as Record<string, unknown> | null)?.mime as string) ||
    "image/png";
  if (!outputBase64) {
    throw new Error("Background removal API response missing image data.");
  }
  const maskPayload = await resolveMaskFromPayload(json, requestId);
  return {
    bytes: decodeBase64(stripBase64Prefix(outputBase64)),
    mime: outputMime,
    source: "api" as const,
    maskBytes: maskPayload?.bytes,
    maskMime: maskPayload?.mime,
  };
}


type CutoutAttempt = {
  ok: boolean;
  bytes?: Uint8Array;
  mime?: string;
  providerUsed: string;
  reason?: string;
  pngHasAlpha?: boolean;
  alphaSample?: { min: number; max: number } | null;
  maskBytes?: Uint8Array;
  maskMime?: string;
};

async function callGeminiNanoBackgroundRemoval(options: {
  sourceBytes: Uint8Array;
  sourceMime: string;
  model: string;
  geminiApiKey: string;
  requestId: string;
}) {
  const { sourceBytes, sourceMime, model, geminiApiKey, requestId } = options;
  const genAI = new GoogleGenerativeAI(geminiApiKey);
  const imageModel = genAI.getGenerativeModel({
    model,
    systemInstruction: BACKGROUND_REMOVAL_SYSTEM_PROMPT,
  });
  const request = {
    contents: [
      {
        role: "user",
        parts: [
          {
            inlineData: {
              data: encodeBase64(sourceBytes),
              mimeType: sourceMime,
            },
          },
        ],
      },
    ],
    generationConfig: {
      temperature: 0.2,
      responseMimeType: "image/png",
    },
  };

  const result = await imageModel.generateContent(request);
  const response = result?.response;
  const parts = response?.candidates?.[0]?.content?.parts || [];
  const imagePart = parts.find(
    (part: { inlineData?: { data?: string; mimeType?: string } }) =>
      part?.inlineData?.data
  );
  const outputData = imagePart?.inlineData?.data || "";
  const outputMime = imagePart?.inlineData?.mimeType || "image/png";
  if (!outputData) {
    console.log("PET_STYLIZE: background removal validation", {
      requestId,
      providerUsed: "gemini_nano",
      alphaDetected: false,
      outputMime,
      reason: "missing_output",
    });
    return {
      ok: false,
      providerUsed: "gemini_nano",
      reason: "missing_output",
    };
  }

  const outputBytes = decodeBase64(outputData);
  const validation = await normalizeToPngWithAlphaCheck(outputBytes);
  console.log("PET_STYLIZE: background removal validation", {
    requestId,
    providerUsed: "gemini_nano",
    alphaDetected: validation.alphaDetected,
    outputMime,
    reason: validation.ok ? null : validation.reason,
    pngHasAlpha: validation.pngHasAlpha,
  });
  if (!validation.ok) {
    return {
      ok: false,
      providerUsed: "gemini_nano",
      reason: validation.reason,
      pngHasAlpha: validation.pngHasAlpha,
      alphaSample: validation.alphaSample ?? null,
    };
  }

  return {
    ok: true,
    bytes: validation.bytes,
    mime: "image/png",
    providerUsed: "gemini_nano",
    pngHasAlpha: validation.pngHasAlpha,
    alphaSample: validation.alphaSample ?? null,
  };
}

async function removeBackground(
  sourceBytes: Uint8Array,
  sourceMime: string,
  requestId: string,
  options: { model: string; geminiApiKey: string }
): Promise<CutoutAttempt> {
  const provider = (BACKGROUND_REMOVAL_PROVIDER || "auto").trim().toLowerCase();
  const useGemini = provider === "gemini_nano" || provider === "auto" || !provider;
  const useRemovebg = provider === "removebg" || provider === "auto" || !provider;
  let lastFailure: CutoutAttempt | null = null;

  if (useGemini) {
    try {
      const nanoResult = await callGeminiNanoBackgroundRemoval({
        sourceBytes,
        sourceMime,
        model: options.model,
        geminiApiKey: options.geminiApiKey,
        requestId,
      });
      if (nanoResult?.ok) {
        return nanoResult;
      }
      lastFailure = nanoResult || {
        ok: false,
        providerUsed: "gemini_nano",
        reason: "no_output",
      };
    } catch (error) {
      console.log("PET_STYLIZE: gemini nano background removal failed", {
        requestId,
        message: (error as Error)?.message,
        providerUsed: "gemini_nano",
        alphaDetected: false,
      });
      lastFailure = {
        ok: false,
        providerUsed: "gemini_nano",
        reason: "gemini_error",
      };
    }
  }

  if (useRemovebg) {
    if (!BACKGROUND_REMOVAL_URL) {
      console.log("PET_STYLIZE: background removal provider missing", {
        requestId,
        providerUsed: "removebg",
        alphaDetected: false,
      });
      lastFailure = {
        ok: false,
        providerUsed: "removebg",
        reason: "removebg_not_configured",
      };
    } else {
      try {
        const apiResult = await callBackgroundRemovalApi(sourceBytes, sourceMime, requestId);
        if (!apiResult) {
          throw new Error("Background removal API returned no result.");
        }
        const validation = await normalizeToPngWithAlphaCheck(apiResult.bytes);
        console.log("PET_STYLIZE: background removal validation", {
          requestId,
          providerUsed: "removebg",
          alphaDetected: validation.alphaDetected,
          reason: validation.ok ? null : validation.reason,
          pngHasAlpha: validation.pngHasAlpha,
        });
        if (validation.ok) {
          return {
            ok: true,
            bytes: validation.bytes,
            mime: "image/png",
            providerUsed: "removebg",
            pngHasAlpha: validation.pngHasAlpha,
            alphaSample: validation.alphaSample ?? null,
            maskBytes: apiResult.maskBytes,
            maskMime: apiResult.maskMime,
          };
        }
        lastFailure = {
          ok: false,
          providerUsed: "removebg",
          reason: validation.reason,
          pngHasAlpha: validation.pngHasAlpha,
          alphaSample: validation.alphaSample ?? null,
          maskBytes: apiResult.maskBytes,
          maskMime: apiResult.maskMime,
        };
      } catch (error) {
        console.log("PET_STYLIZE: background removal API failed", {
          requestId,
          message: (error as Error)?.message,
        });
        lastFailure = {
          ok: false,
          providerUsed: "removebg",
          reason: "removebg_error",
        };
      }
    }
  }

  if (!useGemini && !useRemovebg) {
    return {
      ok: false,
      providerUsed: "none",
      reason: "provider_not_configured",
    };
  }

  return (
    lastFailure || {
      ok: false,
      providerUsed: useGemini ? "gemini_nano" : "removebg",
      reason: "cutout_failed",
    }
  );
}

function featherAlpha(alpha: Uint8ClampedArray, width: number, height: number, radius: number) {
  if (radius <= 0) return alpha;
  const output = new Uint8ClampedArray(alpha.length);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let total = 0;
      let count = 0;
      for (let dy = -radius; dy <= radius; dy++) {
        const ny = y + dy;
        if (ny < 0 || ny >= height) continue;
        for (let dx = -radius; dx <= radius; dx++) {
          const nx = x + dx;
          if (nx < 0 || nx >= width) continue;
          total += alpha[ny * width + nx] ?? 0;
          count++;
        }
      }
      output[y * width + x] = count > 0 ? Math.round(total / count) : alpha[y * width + x] ?? 0;
    }
  }
  return output;
}

type Reference = { base64: string; mime: string };

/** Only this project's storage host (plus PET_STYLIZE_ALLOWED_IMAGE_HOSTS) may be fetched for imageUrl. */
function isAllowedImageUrl(imageUrl: string, supabaseUrl: string) {
  try {
    const target = new URL(imageUrl);
    if (target.protocol !== "https:" && target.protocol !== "http:") return false;
    const host = target.host.toLowerCase();
    if (host === new URL(supabaseUrl).host.toLowerCase()) return true;
    return ALLOWED_IMAGE_HOSTS.includes(host);
  } catch (_error) {
    return false;
  }
}

async function removeObjectsQuietly(admin: any, paths: string[], requestId: string) {
  try {
    const { error } = await admin.storage.from(CACHE_BUCKET).remove(paths);
    if (error) console.log("PET_STYLIZE: stale object cleanup failed", { requestId, paths, message: error.message });
  } catch (error) {
    console.log("PET_STYLIZE: stale object cleanup threw", { requestId, paths, message: (error as Error)?.message });
  }
}

/**
 * The portrait is painted on a flat white backdrop. This keys that backdrop out by flood-filling from the
 * border (so a white chest or a cream coat inside the silhouette survives), then feathers the edge by one
 * pixel. Returns null when the border is not flat (the model ignored the backdrop instruction) or when
 * the result looks wrong (almost nothing or almost everything was keyed), so the caller can fall back.
 */
async function keyOutFlatBackground(sourceBytes: Uint8Array, requestId: string) {
  let image: Image;
  try {
    image = await Image.decode(sourceBytes);
  } catch (error) {
    console.log("PET_STYLIZE: key decode failed", { requestId, message: (error as Error)?.message });
    return null;
  }
  const { width, height, bitmap } = image;
  if (width < 16 || height < 16) return null;

  // backdrop colour: the mean of the outer two rows and columns
  let sr = 0, sg = 0, sb = 0, border = 0;
  const borderIndices: number[] = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (y > 1 && y < height - 2 && x > 1 && x < width - 2) continue;
      const i = (y * width + x) * 4;
      sr += bitmap[i]; sg += bitmap[i + 1]; sb += bitmap[i + 2];
      border += 1;
      borderIndices.push(y * width + x);
    }
  }
  const bg: [number, number, number] = [Math.round(sr / border), Math.round(sg / border), Math.round(sb / border)];
  const tol2 = FLAT_KEY_TOLERANCE * FLAT_KEY_TOLERANCE;
  const near = (p: number) => {
    const i = p * 4;
    const dr = bitmap[i] - bg[0], dg = bitmap[i + 1] - bg[1], db = bitmap[i + 2] - bg[2];
    return dr * dr + dg * dg + db * db <= tol2;
  };
  let flat = 0;
  for (const p of borderIndices) if (near(p)) flat += 1;
  const borderShare = flat / Math.max(1, border);
  if (borderShare < FLAT_BORDER_SHARE) {
    console.log("PET_STYLIZE: backdrop not flat", { requestId, borderShare: Number(borderShare.toFixed(3)), bg });
    return null;
  }

  // flood fill from the border through backdrop-coloured pixels (4-connected)
  const mask = new Uint8Array(width * height); // 1 = backdrop
  const queue = new Int32Array(width * height);
  let head = 0, tail = 0;
  for (const p of borderIndices) {
    if (!mask[p] && near(p)) {
      mask[p] = 1;
      queue[tail++] = p;
    }
  }
  while (head < tail) {
    const p = queue[head++];
    const x = p % width;
    const y = (p - x) / width;
    if (x > 0) { const q = p - 1; if (!mask[q] && near(q)) { mask[q] = 1; queue[tail++] = q; } }
    if (x < width - 1) { const q = p + 1; if (!mask[q] && near(q)) { mask[q] = 1; queue[tail++] = q; } }
    if (y > 0) { const q = p - width; if (!mask[q] && near(q)) { mask[q] = 1; queue[tail++] = q; } }
    if (y < height - 1) { const q = p + width; if (!mask[q] && near(q)) { mask[q] = 1; queue[tail++] = q; } }
  }
  const keyedShare = tail / (width * height);
  if (keyedShare < 0.05 || keyedShare > 0.97) {
    console.log("PET_STYLIZE: keyed share out of range", { requestId, keyedShare: Number(keyedShare.toFixed(3)) });
    return null;
  }

  // alpha: 0 on the backdrop, 255 on the pet, feathered one pixel at the boundary
  const alpha = new Uint8ClampedArray(width * height);
  for (let p = 0; p < alpha.length; p++) alpha[p] = mask[p] ? 0 : 255;
  const feathered = featherAlpha(alpha, width, height, ALPHA_FEATHER_RADIUS);
  for (let p = 0, i = 3; p < feathered.length; p++, i += 4) bitmap[i] = feathered[p];
  const pngBytes = new Uint8Array(await image.encode());
  return { bytes: pngBytes, keyedShare, borderShare, bg };
}

type PortraitResult =
  | { ok: true; bytes: Uint8Array; mime: string; imageConfigDropped: boolean }
  | { ok: false; reason: string; status?: number; snippet?: string };

/** One Gemini image call with every reference photo attached. */
async function paintPortrait(options: {
  references: Reference[];
  prompt: string;
  negativePrompt: string;
  model: string;
  geminiApiKey: string;
  requestId: string;
}): Promise<PortraitResult> {
  const { references, prompt, negativePrompt, model, geminiApiKey, requestId } = options;
  const parts: Record<string, unknown>[] = [{ text: prompt }];
  references.forEach((reference) => {
    parts.push({ inline_data: { mime_type: reference.mime, data: reference.base64 } });
  });
  parts.push({ text: negativePrompt });

  const imageConfig: Record<string, string> = {};
  if (GEMINI_IMAGE_ASPECT) imageConfig.aspectRatio = GEMINI_IMAGE_ASPECT;
  if (GEMINI_IMAGE_SIZE) imageConfig.imageSize = GEMINI_IMAGE_SIZE;

  const call = async (withImageConfig: boolean) => {
    const generationConfig: Record<string, unknown> = { temperature: 0.4 };
    if (withImageConfig && Object.keys(imageConfig).length > 0) generationConfig.imageConfig = imageConfig;
    return fetchWithTimeout(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiApiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: [{ role: "user", parts }], generationConfig }),
      },
      GEMINI_IMAGE_TIMEOUT_MS
    );
  };

  let imageConfigDropped = false;
  let response = await call(true);
  if (!response.ok && response.status === 400 && Object.keys(imageConfig).length > 0) {
    // an older model or API surface that does not know imageConfig: paint without it rather than fail
    const text = await response.text();
    if (/image_?config|aspect_?ratio|image_?size|unknown name/i.test(text)) {
      console.log("PET_STYLIZE: imageConfig rejected, retrying without it", { requestId, snippet: text.slice(0, 200) });
      imageConfigDropped = true;
      response = await call(false);
    } else {
      return { ok: false, reason: `provider_http_${response.status}`, status: response.status, snippet: text.slice(0, 400) };
    }
  }
  if (!response.ok) {
    const text = await response.text();
    return { ok: false, reason: `provider_http_${response.status}`, status: response.status, snippet: text.slice(0, 400) };
  }
  const payload = await response.json();
  const candidateParts = payload?.candidates?.[0]?.content?.parts || [];
  const imagePart = candidateParts.find(
    (part: { inlineData?: { data?: string; mimeType?: string }; inline_data?: { data?: string; mime_type?: string } }) =>
      part?.inlineData?.data || part?.inline_data?.data
  );
  const outputData: string | undefined = imagePart?.inlineData?.data || imagePart?.inline_data?.data;
  if (!outputData) {
    const finishReason = payload?.candidates?.[0]?.finishReason || payload?.promptFeedback?.blockReason || null;
    console.log("PET_STYLIZE: portrait missing output", { requestId, finishReason });
    return { ok: false, reason: finishReason ? `stylized_missing_output_${String(finishReason).toLowerCase()}` : "stylized_missing_output" };
  }
  return {
    ok: true,
    bytes: decodeBase64(outputData),
    mime: imagePart?.inlineData?.mimeType || imagePart?.inline_data?.mime_type || "image/png",
    imageConfigDropped,
  };
}

async function getCachedStylized(admin: any, userId: string, sourceHash: string | null, requestId: string) {
  if (!sourceHash) return null;
  const processedKey = pickProcessedKey(userId, sourceHash, requestId);
  const processedPath = `${processedKey}/processed/stylized.png`;
  const processedCutoutPath = `${processedKey}/processed/cutout.png`;
  const processedMaskPath = `${processedKey}/processed/mask.png`;
  const processedMaskWebpPath = `${processedKey}/processed/mask.webp`;

  const cachedStylized = await downloadIfExists(admin, processedPath);
  const cachedCutout = await downloadIfExists(admin, processedCutoutPath);
  const cachedMaskPng = await downloadIfExists(admin, processedMaskPath);
  const cachedMaskWebp = cachedMaskPng ? null : await downloadIfExists(admin, processedMaskWebpPath);
  if (!cachedStylized && !cachedCutout) return null;

  const cutoutValidation = cachedCutout ? await normalizeToPngWithAlphaCheck(cachedCutout) : null;
  const stylizedValidation = cachedStylized ? await normalizeToPngWithAlphaCheck(cachedStylized) : null;
  const alphaCutout = !!cutoutValidation?.ok;
  const alphaStylized = !!stylizedValidation?.ok;

  const { data: cutoutUrlData } = admin.storage.from(CACHE_BUCKET).getPublicUrl(processedCutoutPath);
  const { data: stylizedUrlData } = admin.storage.from(CACHE_BUCKET).getPublicUrl(processedPath);
  const maskPath = cachedMaskPng ? processedMaskPath : cachedMaskWebp ? processedMaskWebpPath : null;
  const { data: maskUrlData } = maskPath ? admin.storage.from(CACHE_BUCKET).getPublicUrl(maskPath) : { data: null };
  return {
    cutoutUrl: cachedCutout ? cutoutUrlData?.publicUrl || null : null,
    stylizedUrl: cachedStylized ? stylizedUrlData?.publicUrl || null : null,
    maskUrl: maskPath ? maskUrlData?.publicUrl || null : null,
    alphaCutout,
    alphaStylized,
    alphaSample: {
      cutout: cutoutValidation?.alphaSample ?? null,
      stylized: stylizedValidation?.alphaSample ?? null,
    },
    version: alphaStylized ? "v2_cache" : "v2_cutout_cache",
  };
}

serve(async (req) => {
  const requestId = crypto.randomUUID();
  if (req.method === "OPTIONS") {
    const payload = buildResponsePayload({
      ok: true,
      petId: "",
      processed: buildEmptyProcessed("none", "none"),
      requestId,
      debug: { reason: "cors_preflight" },
    });
    return jsonResponse(200, payload);
  }
  if (req.method === "GET") {
    const payload = buildResponsePayload({
      ok: true,
      petId: "",
      processed: buildEmptyProcessed("none", "none"),
      requestId,
      debug: { reason: "health_check" },
    });
    return jsonResponse(200, payload);
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const geminiApiKey = getEnvKey();
    const model = Deno.env.get("GEMINI_IMAGE_MODEL") || "gemini-2.5-flash-image";
    const bgRemovalModel = Deno.env.get("GEMINI_BG_REMOVAL_MODEL") || model;

    if (!geminiApiKey) {
      return jsonResponse(
        500,
        buildErrorPayload({
          code: "MISSING_KEY",
          message: "Missing gemini_api_key secret.",
          requestId,
        })
      );
    }
    if (!supabaseUrl || !supabaseAnonKey) {
      return jsonResponse(
        500,
        buildErrorPayload({
          code: "CONFIG",
          message: "Missing Supabase env vars.",
          requestId,
        })
      );
    }
    if (!serviceRoleKey) {
      return jsonResponse(
        500,
        buildErrorPayload({
          code: "CONFIG",
          message: "Missing SUPABASE_SERVICE_ROLE_KEY.",
          requestId,
        })
      );
    }

    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader) {
      return jsonResponse(
        401,
        buildErrorPayload({
          code: "AUTH",
          message: "Missing Authorization header.",
          requestId,
        })
      );
    }

    let payload: Record<string, unknown> | null = null;
    try {
      payload = await req.json();
    } catch (error) {
      console.log("PET_STYLIZE: invalid json", { requestId, error: (error as Error).message });
      return jsonResponse(
        400,
        buildErrorPayload({
          code: "BAD_REQUEST",
          message: "Invalid JSON payload.",
          requestId,
        })
      );
    }

    // up to MAX_REFERENCE_IMAGES photos of the same pet; the first one doubles as the single-image fields
    const rawImages = Array.isArray(payload?.images) ? (payload!.images as unknown[]) : [];
    const extraReferences: Reference[] = [];
    for (const item of rawImages.slice(0, MAX_REFERENCE_IMAGES)) {
      if (!item || typeof item !== "object") continue;
      const record = item as Record<string, unknown>;
      const itemBase64 = stripBase64Prefix(String(record.imageBase64 || record.image_base64 || record.base64 || ""));
      if (!itemBase64) continue;
      const itemMime = String(record.mimeType || record.mime || "image/jpeg");
      if (!itemMime.startsWith("image/")) {
        return jsonResponse(
          400,
          buildErrorPayload({
            code: "BAD_REQUEST",
            message: "images[].mimeType must be an image type.",
            requestId,
          })
        );
      }
      if (itemBase64.length > MAX_BASE64_LENGTH) {
        return jsonResponse(
          400,
          buildErrorPayload({
            code: "BAD_REQUEST",
            message: "Image too large.",
            requestId,
          })
        );
      }
      if (!extraReferences.some((reference) => reference.base64 === itemBase64)) {
        extraReferences.push({ base64: itemBase64, mime: itemMime });
      }
    }
    let imageBase64 = (payload?.imageBase64 || payload?.image_base64 || "") as string;
    const imageUrl = (payload?.imageUrl || payload?.image_url || "") as string;
    let mime = payload?.mimeType || payload?.mime;
    if (!imageBase64 && !imageUrl && extraReferences.length > 0) {
      imageBase64 = extraReferences[0].base64;
      mime = extraReferences[0].mime;
    }
    const stylePreset = (payload?.stylePreset || payload?.style || "portrait") as string;
    const requestedUserId = (payload?.userId || payload?.user_id || "") as string;
    const sourceHash = (payload?.sourceHash || payload?.source_hash || "") as string;

    if (!imageBase64 && !imageUrl) {
      return jsonResponse(
        400,
        buildErrorPayload({
          code: "BAD_REQUEST",
          message: "Provide images, imageBase64 or imageUrl.",
          requestId,
        })
      );
    }
    if (mime && typeof mime !== "string") {
      return jsonResponse(
        400,
        buildErrorPayload({
          code: "BAD_REQUEST",
          message: "Invalid mime.",
          requestId,
        })
      );
    }
    if (mime && !String(mime).startsWith("image/")) {
      return jsonResponse(
        400,
        buildErrorPayload({
          code: "BAD_REQUEST",
          message: "mime must be an image type.",
          requestId,
        })
      );
    }
    if (imageBase64 && !mime) {
      return jsonResponse(
        400,
        buildErrorPayload({
          code: "BAD_REQUEST",
          message: "mimeType is required with imageBase64.",
          requestId,
        })
      );
    }
    if (sourceHash && !/^[a-f0-9]{64}$/i.test(sourceHash)) {
      return jsonResponse(
        400,
        buildErrorPayload({
          code: "BAD_REQUEST",
          message: "Invalid sourceHash.",
          requestId,
        })
      );
    }

    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const {
      data: { user },
      error: userError,
    } = await authClient.auth.getUser();
    if (userError || !user) {
      return jsonResponse(
        401,
        buildErrorPayload({
          code: "AUTH",
          message: "Unauthorized request.",
          requestId,
        })
      );
    }
    const userId = user.id;

    if (requestedUserId && requestedUserId !== userId) {
      return jsonResponse(
        403,
        buildErrorPayload({
          code: "AUTH",
          message: "userId does not match the authenticated user.",
          requestId,
        })
      );
    }

    const admin = createClient(supabaseUrl, serviceRoleKey);

    let cleanBase64 = stripBase64Prefix(imageBase64);
    let sourceMime = (mime as string) || "image/jpeg";
    if (!cleanBase64 && imageUrl) {
      if (!isAllowedImageUrl(imageUrl, supabaseUrl)) {
        console.log("PET_STYLIZE: imageUrl host refused", { requestId });
        return jsonResponse(
          400,
          buildErrorPayload({
            code: "BAD_REQUEST",
            message: "imageUrl must point at this project's storage.",
            requestId,
          })
        );
      }
      const imageResponse = await fetchWithTimeout(imageUrl, { method: "GET" }, 15000);
      if (!imageResponse.ok) {
        const text = await imageResponse.text();
        return jsonResponse(
          400,
          buildErrorPayload({
            code: "BAD_REQUEST",
            message: `Failed to fetch imageUrl (status ${imageResponse.status}).`,
            details: text.slice(0, 200),
            requestId,
          })
        );
      }
      const buffer = await imageResponse.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      if (bytes.length > MAX_BASE64_LENGTH) {
        return jsonResponse(
          400,
          buildErrorPayload({
            code: "BAD_REQUEST",
            message: "Image too large.",
            requestId,
          })
        );
      }
      cleanBase64 = encodeBase64(bytes);
      sourceMime = imageResponse.headers.get("content-type") || sourceMime;
    }
    if (!cleanBase64) {
      return jsonResponse(
        400,
        buildErrorPayload({
          code: "BAD_REQUEST",
          message: "Empty imageBase64 input.",
          requestId,
        })
      );
    }
    if (cleanBase64.length > MAX_BASE64_LENGTH) {
      return jsonResponse(
        400,
        buildErrorPayload({
          code: "BAD_REQUEST",
          message: "Image too large.",
          requestId,
        })
      );
    }

    // every photo the portrait is painted from, the primary first
    const references: Reference[] = [{ base64: cleanBase64, mime: sourceMime }];
    for (const extra of extraReferences) {
      if (references.length >= MAX_REFERENCE_IMAGES) break;
      if (!references.some((reference) => reference.base64 === extra.base64)) references.push(extra);
    }
    const totalBase64Length = references.reduce((sum, reference) => sum + reference.base64.length, 0);
    if (totalBase64Length > MAX_TOTAL_BASE64_LENGTH) {
      return jsonResponse(
        400,
        buildErrorPayload({
          code: "BAD_REQUEST",
          message: "Images too large together.",
          requestId,
        })
      );
    }

    console.log("PET_STYLIZE: request", {
      requestId,
      userId,
      mimeType: sourceMime,
      imageSize: cleanBase64.length,
      references: references.length,
      totalImageSize: totalBase64Length,
      hasGeminiKey: !!geminiApiKey,
      style: stylePreset,
      hasBase64: !!imageBase64,
      hasUrl: !!imageUrl,
      bgRemovalConfigured: !!BACKGROUND_REMOVAL_URL,
      bgRemovalProvider: BACKGROUND_REMOVAL_PROVIDER || "default",
      promptVersion: PROMPT_VERSION,
      model,
      imageAspect: GEMINI_IMAGE_ASPECT || null,
      imageSizeHint: GEMINI_IMAGE_SIZE || null,
    });

    const nowIso = new Date().toISOString();
    const { data: rateRow, error: rateError } = await admin
      .from("pet_stylize_requests")
      .select("last_requested_at, last_source_hash")
      .eq("user_id", userId)
      .maybeSingle();
    if (rateError) {
      console.log("PET_STYLIZE: rate limit lookup error", { requestId, message: rateError.message });
      return jsonResponse(
        500,
        buildErrorPayload({
          code: "RATE_LIMIT_TABLE",
          message: "Rate limit table unavailable.",
          details: rateError.message,
          requestId,
          petId: userId,
        })
      );
    }
    if (sourceHash && rateRow?.last_source_hash && rateRow.last_source_hash === sourceHash) {
      const cached = await getCachedStylized(admin, userId, sourceHash, requestId);
      if (cached) {
        console.log("PET_STYLIZE: cache hit", { requestId, version: cached.version });
        const cachedFailureReason =
          !cached.alphaStylized && !cached.alphaCutout ? "alpha_missing" : !cached.alphaStylized
            ? "stylized_missing_alpha"
            : !cached.alphaCutout
              ? "cutout_missing_alpha"
              : undefined;
        const cachedPayload = buildResponsePayload({
          ok: true,
          petId: userId,
          processed: buildProcessedPayload({
            stylizedUrl: cached.stylizedUrl,
            cutoutUrl: cached.cutoutUrl,
            maskUrl: cached.maskUrl,
            alphaCutout: cached.alphaCutout,
            alphaStylized: cached.alphaStylized,
            maskReapplied: false,
            providerUsed: "cache",
            modelUsed: "cache",
            failureReason: cachedFailureReason,
          }),
          requestId,
          debug: {
            reason: "cache_hit",
            png_has_alpha: cached.alphaCutout || cached.alphaStylized,
            alpha_sample: cached.alphaSample ?? null,
          },
        });
        console.log("PET_STYLIZE: response", {
          requestId,
          providerUsed: cachedPayload.processed.provider_used,
          alphaCutout: cachedPayload.processed.alpha_cutout,
          alphaStylized: cachedPayload.processed.alpha_stylized,
          maskReapplied: cachedPayload.processed.mask_reapplied,
          savedPaths: {
            cutout: `${userId}/processed/cutout.png`,
            stylized: `${userId}/processed/stylized.png`,
          },
        });
        return jsonResponse(200, cachedPayload);
      }
    }

    if (rateRow?.last_requested_at) {
      const last = new Date(rateRow.last_requested_at).getTime();
      const deltaSeconds = Math.round((Date.now() - last) / 1000);
      if (deltaSeconds >= 0 && deltaSeconds < RATE_LIMIT_SECONDS) {
        const retryAfterSeconds = RATE_LIMIT_SECONDS - deltaSeconds;
        return jsonResponse(
          429,
          buildErrorPayload({
            code: "RATE_LIMIT",
            message: "Too many stylize requests. Please retry soon.",
            retryAfterSeconds,
            requestId,
            petId: userId,
          })
        );
      }
    }
    const { error: rateUpsertError } = await admin.from("pet_stylize_requests").upsert(
      {
        user_id: userId,
        last_requested_at: nowIso,
        last_source_hash: sourceHash || null,
      },
      { onConflict: "user_id" }
    );
    if (rateUpsertError) {
      console.log("PET_STYLIZE: rate limit update error", { requestId, message: rateUpsertError.message });
    }

    const sourceBytes = decodeBase64(cleanBase64);
    const processedKey = pickProcessedKey(userId, sourceHash || null, requestId);
    const processedPrefix = `${processedKey}/processed`;
    const cutoutPath = `${processedPrefix}/cutout.png`;
    const stylizedPath = `${processedPrefix}/stylized.png`;
    const maskPathPng = `${processedPrefix}/mask.png`;
    const maskPathWebp = `${processedPrefix}/mask.webp`;
    const legacyStyle = stylePreset === "cute_max_v2";
    const prompt = legacyStyle ? PROMPT_V2_CUTE_MAX : PROMPT_V3_PORTRAIT;
    const negativePrompt = legacyStyle ? NEGATIVE_PROMPT_V2 : NEGATIVE_PROMPT_V3;

    try {
      // ---- 1. paint the portrait from every reference photo ------------------------------------------
      let stylizedBytes: Uint8Array | null = null;
      let alphaStylized = false;
      let stylizedFailureReason: string | undefined;
      let stylizedAlphaSample: { min: number; max: number } | null = null;
      let stylizedFromModel = false;
      let keyingUsed = "none";

      const portrait = await paintPortrait({ references, prompt, negativePrompt, model, geminiApiKey, requestId });
      if (!portrait.ok) {
        console.log("PET_STYLIZE: portrait failed", {
          requestId,
          reason: portrait.reason,
          status: portrait.status ?? null,
          snippet: portrait.snippet ?? null,
        });
        stylizedFailureReason = portrait.reason;
      } else {
        stylizedFromModel = true;
        console.log("PET_STYLIZE: portrait painted", {
          requestId,
          mime: portrait.mime,
          bytes: portrait.bytes.length,
          references: references.length,
          imageConfigDropped: portrait.imageConfigDropped,
        });

        // ---- 2. key the flat backdrop out of the painting (its own silhouette, not the photo's) ---------
        let keyedBytes: Uint8Array | null = null;
        const keyed = await keyOutFlatBackground(portrait.bytes, requestId);
        if (keyed) {
          keyedBytes = keyed.bytes;
          keyingUsed = "flat_key";
          console.log("PET_STYLIZE: backdrop keyed", {
            requestId,
            keyedShare: Number(keyed.keyedShare.toFixed(3)),
            borderShare: Number(keyed.borderShare.toFixed(3)),
            backdrop: keyed.bg,
          });
        } else {
          // the model painted a scene after all: content-aware removal, when a provider is configured
          const removal = await removeBackground(portrait.bytes, portrait.mime, requestId, {
            model: bgRemovalModel,
            geminiApiKey,
          });
          if (removal.ok && removal.bytes) {
            keyedBytes = removal.bytes;
            keyingUsed = removal.providerUsed;
          } else {
            console.log("PET_STYLIZE: portrait background removal failed", { requestId, reason: removal.reason });
          }
        }
        if (keyedBytes) {
          const validation = await normalizeToPngWithAlphaCheck(keyedBytes);
          stylizedBytes = validation.bytes || keyedBytes;
          alphaStylized = !!validation.ok;
          stylizedAlphaSample = validation.alphaSample ?? null;
          if (!alphaStylized) stylizedFailureReason = validation.reason || "stylized_lost_alpha_after_model";
        } else {
          // keep the opaque painting so it is at least stored; the app will not draw it on the grass
          stylizedBytes = await ensurePng(portrait.bytes);
          alphaStylized = false;
          stylizedFailureReason = "stylized_backdrop_not_keyed";
        }
      }

      // ---- 3. cutout of the first photo, only when there is no transparent portrait to show -------------
      let cutoutBytes: Uint8Array | null = null;
      let cutoutUrl: string | null = null;
      let cutoutProviderUsed = "none";
      let cutoutFailureReason: string | undefined;
      let cutoutAlphaSample: { min: number; max: number } | null = null;
      let alphaCutout = false;
      let maskUrl: string | null = null;
      let maskSavedPath: string | null = null;

      if (!alphaStylized) {
        const cutoutAttempt = await removeBackground(sourceBytes, sourceMime, requestId, {
          model: bgRemovalModel,
          geminiApiKey,
        });
        cutoutProviderUsed = cutoutAttempt?.providerUsed || "none";

        if (cutoutAttempt?.maskBytes) {
          const normalizedMask = await normalizeMaskForUpload(cutoutAttempt.maskBytes, cutoutAttempt.maskMime || null);
          const maskPath = normalizedMask.ext === "webp" ? maskPathWebp : maskPathPng;
          maskUrl = await uploadAndGetUrl(admin, maskPath, normalizedMask.bytes, normalizedMask.contentType);
          maskSavedPath = maskPath;
          console.log("PET_STYLIZE: mask saved", {
            requestId,
            maskPath,
            maskUrl,
            converted: normalizedMask.converted,
            maskMime: cutoutAttempt.maskMime || null,
          });
        }

        if (cutoutAttempt?.ok && cutoutAttempt.bytes) {
          cutoutBytes = cutoutAttempt.bytes;
          alphaCutout = true;
          cutoutAlphaSample = cutoutAttempt.alphaSample ?? null;
        } else {
          try {
            const fallback = await fallbackCutout(sourceBytes);
            const fallbackValidation = await normalizeToPngWithAlphaCheck(fallback.bytes);
            cutoutBytes = fallbackValidation.bytes || fallback.bytes;
            alphaCutout = !!fallbackValidation.ok;
            cutoutAlphaSample = fallbackValidation.alphaSample ?? null;
            if (!alphaCutout) {
              cutoutFailureReason = cutoutAttempt?.reason || fallbackValidation.reason || "cutout_missing_alpha";
            }
            cutoutProviderUsed = fallback.source;
          } catch (fallbackError) {
            console.log("PET_STYLIZE: fallback cutout failed", {
              requestId,
              message: (fallbackError as Error)?.message,
            });
            cutoutBytes = await ensurePng(sourceBytes);
            alphaCutout = false;
            cutoutFailureReason = cutoutAttempt?.reason || "cutout_fallback_failed";
            cutoutProviderUsed = cutoutAttempt?.providerUsed || "fallback";
          }
        }

        if (!cutoutBytes) {
          cutoutBytes = await ensurePng(sourceBytes);
          alphaCutout = false;
          cutoutFailureReason = cutoutFailureReason || "cutout_missing_bytes";
        }
        if (!alphaCutout && !cutoutFailureReason) {
          cutoutFailureReason = "cutout_missing_alpha";
        }

        cutoutUrl = await uploadAndGetUrl(admin, cutoutPath, cutoutBytes, "image/png");
        console.log("PET_STYLIZE: cutout saved", {
          requestId,
          providerUsed: cutoutProviderUsed,
          alphaDetected: alphaCutout,
          cutoutPath,
          cutoutUrl,
        });
      } else {
        // a transparent portrait exists: drop any older cutout/mask so a cache hit cannot bring back a stale photo
        await removeObjectsQuietly(admin, [cutoutPath, maskPathPng, maskPathWebp], requestId);
      }

      if (!stylizedBytes) {
        stylizedBytes = cutoutBytes || (await ensurePng(sourceBytes));
      }
      if (!stylizedFromModel) {
        alphaStylized = false;
        if (!stylizedFailureReason) {
          stylizedFailureReason = "stylized_unavailable";
        }
      }
      if (!alphaStylized && !stylizedFailureReason) {
        stylizedFailureReason = "stylized_lost_alpha_after_model";
      }

      const stylizedUrl = await uploadAndGetUrl(admin, stylizedPath, stylizedBytes, "image/png");
      console.log("PET_STYLIZE: stylized saved", {
        requestId,
        stylizedPath,
        stylizedUrl,
        keyingUsed,
        alphaDetected: alphaStylized,
        promptVersion: legacyStyle ? "v2_cute_max" : PROMPT_VERSION,
      });

      const maskReapplied = false;
      const failureReason =
        stylizedFailureReason || cutoutFailureReason || (!alphaStylized && !alphaCutout ? "alpha_missing" : undefined);
      const providerUsed = stylizedFromModel ? "gemini" : cutoutProviderUsed || "fallback";

      const processedPayload = buildProcessedPayload({
        stylizedUrl,
        cutoutUrl,
        maskUrl,
        alphaCutout,
        alphaStylized,
        maskReapplied,
        providerUsed,
        modelUsed: model,
        failureReason,
      });

      const stylizedPayload = buildResponsePayload({
        ok: true,
        petId: userId,
        processed: processedPayload,
        requestId,
        debug: {
          reason: failureReason,
          png_has_alpha: alphaCutout || alphaStylized,
          alpha_sample: {
            cutout: cutoutAlphaSample ?? null,
            stylized: stylizedAlphaSample ?? null,
          },
        },
      });
      console.log("PET_STYLIZE: response", {
        requestId,
        providerUsed,
        alphaCutout,
        alphaStylized,
        maskReapplied,
        keyingUsed,
        failureReason: failureReason || null,
        savedPaths: {
          cutout: cutoutUrl ? cutoutPath : null,
          mask: maskSavedPath,
          stylized: stylizedPath,
        },
      });

      return jsonResponse(200, stylizedPayload);
    } catch (pipelineError) {
      console.log("PET_STYLIZE: v2 pipeline failed", {
        requestId,
        message: (pipelineError as Error)?.message,
      });
      return jsonResponse(
        500,
        buildErrorPayload({
          code: "PIPELINE",
          message: "Stylize pipeline failed.",
          details: (pipelineError as Error)?.message,
          requestId,
          petId: userId,
        })
      );
    }
  } catch (error) {
    console.log("PET_STYLIZE: unexpected error", error);
    return jsonResponse(
      500,
      buildErrorPayload({
        code: "UNEXPECTED",
        message: "Stylize failed.",
        requestId,
      })
    );
  }
});
