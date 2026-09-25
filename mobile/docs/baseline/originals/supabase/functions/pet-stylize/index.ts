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

const PROMPT_V1_BEST_CUTE =
  "Transform this pet photo into a cute-max storybook mascot that matches a cozy garden world. " +
  "Use the same sitting pose and orientation as the reference pet image. " +
  "Chibi proportions, soft thick outline, flat pastel colors, simplified shapes, no realistic fur texture. " +
  "Keep the pet centered with a clean silhouette, full body visible, and do not crop tightly. " +
  "Transparent background only. If transparency is impossible, use a flat very light backdrop for easy masking. " +
  "No text, UI, watermark, frame, or sticker border.";
const NEGATIVE_PROMPT_V1 =
  "Avoid photorealism, harsh shadows, cluttered or photographic backgrounds, multiple animals, cropped heads, text, UI, logos, or watermarks. " +
  "Do not add outfits or props that obscure the pet. No side characters or extra limbs. " +
  "No scenery, no background elements, no framing.";
const PROMPT_VERSION = "v1_best_cute";
const RESPONSE_VERSION = "v2";
const BACKGROUND_REMOVAL_SYSTEM_PROMPT =
  "Remove the background and return a PNG with a transparent alpha channel. Keep the subject exactly.\n" +
  "Do not add a new background, do not change pose, do not crop tightly, keep natural edges.";

const MAX_BASE64_LENGTH = 7_000_000;
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
  const outputBase64 =
    (json?.image_base64 as string) ||
    (json?.data as Record<string, unknown> | null)?.image_base64 ||
    (json?.data as Record<string, unknown> | null)?.base64 ||
    (json?.result as Record<string, unknown> | null)?.image_base64 ||
    (json?.result as string) ||
    "";
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

function resizeAlphaMask(
  alpha: Uint8ClampedArray,
  srcW: number,
  srcH: number,
  destW: number,
  destH: number
) {
  if (srcW === destW && srcH === destH) return alpha;
  const resized = new Uint8ClampedArray(destW * destH);
  for (let y = 0; y < destH; y++) {
    const srcY = Math.floor((y / destH) * srcH);
    for (let x = 0; x < destW; x++) {
      const srcX = Math.floor((x / destW) * srcW);
      resized[y * destW + x] = alpha[srcY * srcW + srcX] ?? 0;
    }
  }
  return resized;
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

async function applyAlphaPolish(
  stylizedBytes: Uint8Array,
  maskBytes: Uint8Array,
  featherRadius = ALPHA_FEATHER_RADIUS
) {
  const stylized = await Image.decode(stylizedBytes);
  const mask = await Image.decode(maskBytes);

  const maskAlpha = new Uint8ClampedArray(mask.width * mask.height);
  for (let i = 0, p = 0; i < mask.bitmap.length; i += 4, p++) {
    maskAlpha[p] = mask.bitmap[i + 3];
  }

  const resizedMask = resizeAlphaMask(maskAlpha, mask.width, mask.height, stylized.width, stylized.height);
  const feathered = featherAlpha(resizedMask, stylized.width, stylized.height, featherRadius);
  let alphaDetected = false;
  for (let i = 0, p = 0; i < stylized.bitmap.length && p < feathered.length; i += 4, p++) {
    const alpha = feathered[p];
    const factor = alpha / 255;
    if (alpha < 255) {
      alphaDetected = true;
    }
    stylized.bitmap[i] = Math.round(stylized.bitmap[i] * factor);
    stylized.bitmap[i + 1] = Math.round(stylized.bitmap[i + 1] * factor);
    stylized.bitmap[i + 2] = Math.round(stylized.bitmap[i + 2] * factor);
    stylized.bitmap[i + 3] = alpha;
  }

  const pngBytes = await stylized.encode();
  return { bytes: new Uint8Array(pngBytes), alphaDetected };
}

async function getCachedStylized(admin: any, userId: string, sourceHash: string | null, requestId: string) {
  if (!sourceHash) return null;
  const processedKey = pickProcessedKey(userId, sourceHash, requestId);
  const processedPath = `processed/${processedKey}/stylized.png`;
  const processedCutoutPath = `processed/${processedKey}/cutout.png`;
  const processedMaskPath = `processed/${processedKey}/mask.png`;
  const processedMaskWebpPath = `processed/${processedKey}/mask.webp`;

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

    const imageBase64 = (payload?.imageBase64 || payload?.image_base64 || "") as string;
    const imageUrl = (payload?.imageUrl || payload?.image_url || "") as string;
    const mime = payload?.mimeType || payload?.mime;
    const stylePreset = (payload?.stylePreset || payload?.style || "storybook_3") as string;
    const requestedUserId = (payload?.userId || payload?.user_id || "") as string;
    const sourceHash = (payload?.sourceHash || payload?.source_hash || "") as string;

    if (!imageBase64 && !imageUrl) {
      return jsonResponse(
        400,
        buildErrorPayload({
          code: "BAD_REQUEST",
          message: "Provide imageBase64 or imageUrl.",
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

    console.log("PET_STYLIZE: request", {
      requestId,
      userId,
      mimeType: sourceMime,
      imageSize: cleanBase64.length,
      hasGeminiKey: !!geminiApiKey,
      style: stylePreset,
      hasBase64: !!imageBase64,
      hasUrl: !!imageUrl,
      bgRemovalConfigured: !!BACKGROUND_REMOVAL_URL,
      bgRemovalProvider: BACKGROUND_REMOVAL_PROVIDER || "default",
      promptVersion: PROMPT_VERSION,
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
            cutout: `processed/${userId}/cutout.png`,
            stylized: `processed/${userId}/stylized.png`,
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
    const processedPrefix = `processed/${processedKey}`;
    const cutoutPath = `${processedPrefix}/cutout.png`;
    const stylizedPath = `${processedPrefix}/stylized.png`;
    const maskPathPng = `${processedPrefix}/mask.png`;
    const maskPathWebp = `${processedPrefix}/mask.webp`;

    try {
      let cutoutBytes: Uint8Array | null = null;
      let cutoutProviderUsed = "none";
      let cutoutFailureReason: string | undefined;
      let cutoutAlphaSample: { min: number; max: number } | null = null;
      let alphaCutout = false;
      let maskUrl: string | null = null;
      let maskSavedPath: string | null = null;

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
            cutoutFailureReason =
              cutoutAttempt?.reason || fallbackValidation.reason || "cutout_missing_alpha";
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

      const cutoutUrl = await uploadAndGetUrl(admin, cutoutPath, cutoutBytes, "image/png");
      console.log("PET_STYLIZE: cutout saved", {
        requestId,
        providerUsed: cutoutProviderUsed,
        alphaDetected: alphaCutout,
        cutoutPath,
        cutoutUrl,
      });

      let stylizedBytes: Uint8Array | null = null;
      let alphaStylized = false;
      let stylizedFailureReason: string | undefined;
      let maskReapplied = false;
      let stylizedAlphaSample: { min: number; max: number } | null = null;
      let stylizedFromModel = false;

      try {
        const cutoutBase64 = encodeBase64(cutoutBytes);
        const geminiResponse = await fetchWithTimeout(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiApiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [
                {
                  role: "user",
                  parts: [
                    { text: PROMPT_V1_BEST_CUTE },
                    { text: NEGATIVE_PROMPT_V1 },
                    { inline_data: { mime_type: "image/png", data: cutoutBase64 } },
                  ],
                },
              ],
              generationConfig: { temperature: 0.45 },
            }),
          },
          25000
        );

        if (!geminiResponse.ok) {
          const text = await geminiResponse.text();
          const snippet = text ? text.slice(0, 400) : "";
          const status = geminiResponse.status;
          console.log("PET_STYLIZE: gemini error (v2)", { requestId, status, body: snippet });
          stylizedFailureReason = `provider_http_${status}`;
        } else {
          const geminiPayload = await geminiResponse.json();
          const parts = geminiPayload?.candidates?.[0]?.content?.parts || [];
          const imagePart = parts.find(
            (part: {
              inlineData?: { data?: string; mimeType?: string };
              inline_data?: { data?: string; mime_type?: string };
            }) => part?.inlineData?.data || part?.inline_data?.data
          );
          const outputData = imagePart?.inlineData?.data || imagePart?.inline_data?.data;
          if (!outputData) {
            stylizedFailureReason = "stylized_missing_output";
          } else {
            stylizedFromModel = true;
            const stylizedBytesRaw = decodeBase64(outputData);
            const decoded = await Image.decode(stylizedBytesRaw);
            const alphaStats = scanAlpha(decoded.bitmap);
            stylizedBytes = new Uint8Array(await decoded.encode());

            if (!alphaStats.alphaDetected) {
              const polished = await applyAlphaPolish(stylizedBytes, cutoutBytes, ALPHA_FEATHER_RADIUS);
              stylizedBytes = polished.bytes;
              maskReapplied = true;
            }

            const stylizedValidation = await normalizeToPngWithAlphaCheck(stylizedBytes);
            alphaStylized = !!stylizedValidation.ok;
            stylizedAlphaSample = stylizedValidation.alphaSample ?? null;
            if (stylizedValidation.bytes) {
              stylizedBytes = stylizedValidation.bytes;
            }
            if (!alphaStylized) {
              stylizedFailureReason = stylizedFailureReason || "stylized_lost_alpha_after_model";
            }
          }
        }
      } catch (error) {
        console.log("PET_STYLIZE: stylize stage failed", {
          requestId,
          message: (error as Error)?.message,
        });
        stylizedFailureReason = stylizedFailureReason || "stylized_exception";
      }

      if (!stylizedBytes) {
        stylizedBytes = cutoutBytes;
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
        maskReapplied,
        alphaDetected: alphaStylized,
      });

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
        failureReason: failureReason || null,
        savedPaths: {
          cutout: cutoutPath,
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
