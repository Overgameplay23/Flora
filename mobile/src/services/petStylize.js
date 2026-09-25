import * as Crypto from "expo-crypto";
import { supabase } from "../lib/supabase";
import { getValidatedPublicEnv } from "../utils/env";
import { netFetch } from "../utils/net";
import { appendCacheBuster, setPetImageCache } from "../utils/petImageCache";
import { upsertPet } from "./petService";
import { isRecord, safeJsonParse } from "../utils/guards";

const EDGE_FUNCTION = "pet-stylize";
const MAX_BASE64_LENGTH = 7_000_000;
const ORIGINAL_SIGNED_URL_TTL = 60 * 60 * 24 * 365;

function logDebug(message, payload) {
  if (__DEV__) {
    console.log(message, payload ?? "");
  }
}

function stripBase64Prefix(value) {
  if (!value) return "";
  const marker = "base64,";
  const index = value.indexOf(marker);
  return index >= 0 ? value.slice(index + marker.length) : value;
}

function base64ToUint8Array(value) {
  const cleanBase64 = stripBase64Prefix(value || "");
  if (!cleanBase64) return new Uint8Array();
  if (typeof globalThis.atob === "function") {
    const binary = globalThis.atob(cleanBase64);
    const length = binary.length;
    const bytes = new Uint8Array(length);
    for (let i = 0; i < length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }
  if (typeof globalThis.Buffer === "function") {
    return Uint8Array.from(globalThis.Buffer.from(cleanBase64, "base64"));
  }
  try {
    const { Buffer } = require("buffer");
    return Uint8Array.from(Buffer.from(cleanBase64, "base64"));
  } catch (error) {
    throw new Error("No base64 decoder available (missing atob/Buffer).");
  }
}

function base64Preview(value) {
  if (typeof value !== "string") return null;
  const cleanBase64 = stripBase64Prefix(value);
  if (!cleanBase64) return null;
  return {
    length: cleanBase64.length,
    preview: cleanBase64.slice(0, 40),
  };
}

function redactBase64Payload(value) {
  if (Array.isArray(value)) {
    return value.map((item) => redactBase64Payload(item));
  }
  if (isRecord(value)) {
    const next = {};
    Object.entries(value).forEach(([key, item]) => {
      if (key.toLowerCase().includes("base64") && typeof item === "string") {
        next[key] = base64Preview(item);
      } else {
        next[key] = redactBase64Payload(item);
      }
    });
    return next;
  }
  return value;
}

function buildSafeResponseSnippet(payload) {
  const safePayload = redactBase64Payload(payload);
  return JSON.stringify(safePayload || {}).slice(0, 300);
}

function pickExtensionFromMime(mime) {
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  if (mime === "image/jpeg") return "jpg";
  return "png";
}

async function getSignedUrl(path) {
  const { data, error } = await supabase.storage.from("pets").createSignedUrl(path, ORIGINAL_SIGNED_URL_TTL);
  if (error) {
    throw error;
  }
  if (!data?.signedUrl) {
    throw new Error("Failed to retrieve signed URL.");
  }
  return data.signedUrl;
}


async function uploadOriginalForFallback({ userId, base64, mime }) {
  const cleanBase64 = stripBase64Prefix(base64);
  if (!cleanBase64) {
    throw new Error("Empty base64 image for fallback.");
  }
  const ext = pickExtensionFromMime(mime);
  const filePath = `original/${userId}.${ext}`;
  const bytes = Uint8Array.from(atob(cleanBase64), (c) => c.charCodeAt(0));
  const { error: uploadError } = await supabase.storage.from("pets").upload(filePath, bytes, {
    upsert: true,
    contentType: mime || "image/jpeg",
  });
  if (uploadError) {
    throw uploadError;
  }
  return getSignedUrl(filePath);
}

export async function saveOriginalPetPhoto({ userId, imageBase64, mimeType }) { 
  const fallbackUrl = await uploadOriginalForFallback({
    userId,
    base64: imageBase64,
    mime: mimeType || "image/jpeg",
  });
  await updatePetAndProfile({ userId, photoUrl: fallbackUrl });
  const cacheBust = Date.now();
  const originalUrl = appendCacheBuster(fallbackUrl, cacheBust);
  setPetImageCache({
    userId,
    stylized: null,
    cutout: null,
    mask: null,
    original: originalUrl,
    allowOriginal: false,
    alphaCutout: null,
    alphaStylized: null,
    maskReapplied: null,
    providerUsed: null,
    cacheBust,
  });
  return originalUrl;
}

function buildSchemaHint(error) {
  const message = typeof error?.message === "string" ? error.message.toLowerCase() : "";
  if (error?.code === "PGRST205" || message.includes("schema cache")) {
    return " (Hint: run the Supabase schema refresh.)";
  }
  return "";
}

function pickFirstString(payloads, keys) {
  for (const payload of payloads) {
    if (!isRecord(payload)) continue;
    for (const key of keys) {
      const value = payload[key];
      if (typeof value === "string" && value.length > 0) {
        return value;
      }
    }
  }
  return null;
}

async function uploadBase64Image({ base64, path }) {
  const bytes = base64ToUint8Array(base64);
  if (!bytes?.length) {
    throw new Error(`Empty base64 payload for ${path}.`);
  }
  const { error: uploadError } = await supabase.storage.from("pets").upload(path, bytes, {
    upsert: true,
    contentType: "image/png",
  });
  if (uploadError) {
    throw new Error(`Supabase storage upload failed (${path}): ${uploadError.message}`);
  }
  const { data: publicData, error: publicError } = supabase.storage.from("pets").getPublicUrl(path);
  if (publicError) {
    throw new Error(`Supabase storage public URL failed (${path}): ${publicError.message}`);
  }
  if (!publicData?.publicUrl) {
    throw new Error(`Supabase storage public URL missing (${path}).`);
  }
  return publicData.publicUrl;
}

async function computeSourceHash(value) {
  try {
    return await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, value);
  } catch (error) {
    logDebug("PET: hash failed", error);
    return null;
  }
}

async function updatePetAndProfile({ userId, photoUrl }) {
  await upsertPet(userId, {
    photo_url: photoUrl,
    original_photo_url: photoUrl,
  });
  const petUpdated = true;

  const { data: updatedProfile, error: profileError } = await supabase
    .from("profiles")
    .update({ pet_photo_url: photoUrl })
    .eq("user_id", userId)
    .select()
    .single();
  if (profileError) {
    throw profileError;
  }

  return { updatedProfile, petUpdated };
}

function buildEdgeErrorDetails(error, data, keysSent) {
  let parsedBody = null;
  if (typeof error?.context?.body === "string") {
    try {
      parsedBody = JSON.parse(error.context.body);
    } catch (_e) {
      parsedBody = error.context.body;
    }
  }
  const details = {
    message: error?.message,
    name: error?.name,
    status: error?.context?.status,
    contextBody: parsedBody ?? error?.context?.body,
    dataError: data?.error,
    keysSent,
  };
  return JSON.stringify(details, null, 2);
}

function parseServerError(data, rawBody) {
  const errorPayload = data?.error || null;
  let parsedBody = null;
  if (!errorPayload && typeof rawBody === "string") {
    try {
      parsedBody = JSON.parse(rawBody);
    } catch (_e) {
      parsedBody = null;
    }
  }
  const payload = errorPayload || parsedBody?.error || null;
  const debugPayload = data?.debug || parsedBody?.debug || null;
  return {
    code: payload?.code || debugPayload?.reason,
    message: payload?.message,
    retryAfterSeconds: payload?.retryAfterSeconds,
    requestId: debugPayload?.request_id || payload?.requestId,
  };
}

async function invokeEdgeFunction(body) {
  const supabaseUrl = getValidatedPublicEnv("EXPO_PUBLIC_SUPABASE_URL") || "";  
  const functionsOverride = getValidatedPublicEnv("EXPO_PUBLIC_SUPABASE_FUNCTIONS_URL");
  const functionsUrl =
    functionsOverride ||
    (supabaseUrl ? supabaseUrl.replace(".supabase.co", ".functions.supabase.co") : "");

  if (!functionsUrl) {
    const { data, error } = await supabase.functions.invoke(EDGE_FUNCTION, { body });
    return {
      data,
      error,
      status: error?.context?.status || (error ? null : 200),
    };
  }

  const session = await supabase.auth.getSession();
  const accessToken = session?.data?.session?.access_token;
  if (!accessToken) {
    const error = new Error("Missing access token.");
    error.context = { status: 401, body: "No session access token." };
    return { data: null, error, status: error.context?.status || 401 };
  }

  let response;
  try {
    response = await netFetch(`${functionsUrl.replace(/\/$/, "")}/${EDGE_FUNCTION}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: getValidatedPublicEnv("EXPO_PUBLIC_SUPABASE_ANON_KEY") || "",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(body),
    });
  } catch (fetchError) {
    // A transport failure used to escape as a bare "Failed to fetch"; give it the same shape as server errors.
    const error = new Error(`Stylize request failed: ${fetchError?.message || "network error"}`);
    error.context = { status: 0, body: "" };
    error.userMessage = "We couldn't reach the painting service. Check your connection and try again.";
    error.errorCode = "NETWORK_FAIL";
    return { data: null, error, status: 0 };
  }
  const text = await response.text();
  const parsed = safeJsonParse(text);
  let data;
  if (parsed.ok) {
    data = isRecord(parsed.value) ? parsed.value : { value: parsed.value };
  } else {
    data = text ? { raw: text } : null;
    if (__DEV__ && text) {
      console.warn("PET_STYLIZE_PARSE_FAIL", {
        bodyType: typeof text,
        bodyLength: text.length,
        bodySnippet: text.slice(0, 40),
      });
    }
  }
  if (!response.ok) {
    const error = new Error(`Edge function error: ${response.status}`);
    error.context = { status: response.status, body: text };
    return { data, error, status: response.status };
  }
  return { data, error: null, status: response.status };
}

export async function stylizePet({ userId, imageBase64, imageUrl, mimeType, style }) {
  if (!userId) {
    throw new Error("Missing user or image data for pet stylization.");
  }
  if (!imageBase64 && !imageUrl) {
    throw new Error("Missing image data for pet stylization.");
  }
  const cleanBase64 = imageBase64 ? stripBase64Prefix(imageBase64) : "";
  if (cleanBase64 && cleanBase64.length > MAX_BASE64_LENGTH) {
    const tooLarge = new Error("Image too large.");
    tooLarge.userMessage = "Your image is too large. Please choose a smaller photo.";
    tooLarge.devDetails = `base64_length=${cleanBase64.length}`;
    throw tooLarge;
  }
  if (__DEV__) {
    const supabaseUrl = getValidatedPublicEnv("EXPO_PUBLIC_SUPABASE_URL");
    if (supabaseUrl && /localhost|127\.0\.0\.1|192\./i.test(supabaseUrl)) {
      console.warn("PET: Supabase URL appears to be local:", supabaseUrl);
    }
  }

  const sourceHash = await computeSourceHash(cleanBase64 || imageUrl || "");

  let originalUrl = null;
  if (cleanBase64) {
    try {
      originalUrl = await saveOriginalPetPhoto({
        userId,
        imageBase64: cleanBase64,
        mimeType: mimeType || "image/jpeg",
      });
    } catch (error) {
      const hint = buildSchemaHint(error);
      const wrapped = new Error(`Failed to save pet image.${hint}`);
      wrapped.userMessage = "We couldn't save your pet photo yet. Please try again.";
      wrapped.devDetails = JSON.stringify(
        {
          message: error?.message,
          code: error?.code,
          details: error?.details,
          hint: error?.hint,
        },
        null,
        2
      );
      throw wrapped;
    }
  } else {
    originalUrl = imageUrl || null;
  }

  const { data, error, status } = await invokeEdgeFunction({
    imageBase64: cleanBase64 || undefined,
    imageUrl: cleanBase64 ? undefined : imageUrl,
    mimeType: cleanBase64 ? mimeType || "image/jpeg" : undefined,
    stylePreset: style || "cute_max",
    outputFormat: "png",
    userId,
    sourceHash,
  });

  if (error) {
    const serverError = parseServerError(data, error?.context?.body);
    const serverCode = serverError?.code;
    const retryAfterSeconds = serverError?.retryAfterSeconds;
    const wrapped = new Error(`Edge function error: ${error.message}`);
    const responseStatus = error?.context?.status || status;
    const msg = typeof error?.message === "string" ? error.message.toLowerCase() : "";
    const isNetwork =
      msg.includes("failed to fetch") || msg.includes("network") || msg.includes("timed out") || msg.includes("abort");
    let serverMessage = null;
    serverMessage = serverError?.message || null;
    wrapped.userMessage = isNetwork
      ? "We couldn't reach the painting service. Check your connection and try again."
      : serverCode === "RATE_LIMIT"
        ? "Stylize is busy right now (rate limit). Try again soon."
      : responseStatus === 404
        ? "Stylize service is not deployed. Please contact support."
        : serverMessage || "We could not reach the stylize service. Please try again.";
    wrapped.devDetails = buildEdgeErrorDetails(error, data, {
      imageBase64: !!cleanBase64,
      mimeType: mimeType || "image/jpeg",
      stylePreset: style || "cute_max",
      sourceHash,
    });
    wrapped.context = error?.context;
    wrapped.errorCode = serverCode;
    wrapped.retryAfterSeconds = retryAfterSeconds;
    wrapped.requestId = serverError?.requestId;
    wrapped.status = responseStatus;
    throw wrapped;
  }

  if (data?.ok === false) {
    const serverError = parseServerError(data, null);
    const wrapped = new Error("Edge function returned ok=false.");
    wrapped.userMessage = serverError?.message || "We couldn't stylize your pet yet. Please try again.";
    wrapped.devDetails = JSON.stringify(data || {}, null, 2);
    wrapped.errorCode = serverError?.code;
    wrapped.requestId = serverError?.requestId;
    wrapped.status = status || 200;
    throw wrapped;
  }

  const responsePayload = isRecord(data) ? data : {};
  const processed = isRecord(responsePayload?.processed) ? responsePayload.processed : null;
  const responseSnippet = buildSafeResponseSnippet(responsePayload || {});
  console.log("PET_STYLIZE_RESPONSE_KEYS", {
    topLevel: Object.keys(responsePayload || {}),
    processed: processed ? Object.keys(processed) : [],
  });

  const outputMime = "image/png";
  const version = data?.version || null;
  const alphaCutout = processed?.alpha_cutout ?? null;
  const alphaStylized = processed?.alpha_stylized ?? null;
  const maskReapplied = processed?.mask_reapplied ?? null;
  const providerUsed = processed?.provider_used ?? null;
  const modelUsed = processed?.model_used ?? null;
  const failureReason = processed?.failure_reason ?? null;

  const payloads = [processed, responsePayload].filter(Boolean);
  const rawStylized = pickFirstString(payloads, ["stylized_url", "stylizedUrl"]);
  const rawCutout = pickFirstString(payloads, ["cutout_url", "cutoutUrl"]);
  const rawMask = pickFirstString(payloads, ["mask_url", "maskUrl"]);
  const rawStylizedBase64 = pickFirstString(payloads, ["stylized_base64", "stylizedBase64"]);
  const rawCutoutBase64 = pickFirstString(payloads, ["cutout_base64", "cutoutBase64"]);
  const rawMaskBase64 = pickFirstString(payloads, ["mask_base64", "maskBase64"]);

  const cacheBust = Date.now();
  let maskUrl = appendCacheBuster(rawMask || null, cacheBust);
  let stylizedUrl = appendCacheBuster(rawStylized || null, cacheBust);
  let cutoutUrl = appendCacheBuster(rawCutout || null, cacheBust);

  if (stylizedUrl || cutoutUrl || maskUrl) {
    console.log("PET_STYLIZE_HANDLED_AS", "urls");
  } else if (rawStylizedBase64 || rawCutoutBase64 || rawMaskBase64) {
    console.log("PET_STYLIZE_HANDLED_AS", "base64_uploaded");
    console.log("PET_STYLIZE_RESPONSE_BASE64_META", {
      stylized: base64Preview(rawStylizedBase64),
      cutout: base64Preview(rawCutoutBase64),
      mask: base64Preview(rawMaskBase64),
    });
    const uploads = [];
    if (rawStylizedBase64) {
      const path = `processed/${userId}/stylized.png`;
      const publicUrl = await uploadBase64Image({ base64: rawStylizedBase64, path });
      stylizedUrl = appendCacheBuster(publicUrl, cacheBust);
      uploads.push(path);
    }
    if (rawCutoutBase64) {
      const path = `processed/${userId}/cutout.png`;
      const publicUrl = await uploadBase64Image({ base64: rawCutoutBase64, path });
      cutoutUrl = appendCacheBuster(publicUrl, cacheBust);
      uploads.push(path);
    }
    if (rawMaskBase64) {
      const path = `processed/${userId}/mask.png`;
      const publicUrl = await uploadBase64Image({ base64: rawMaskBase64, path });
      maskUrl = appendCacheBuster(publicUrl, cacheBust);
      uploads.push(path);
    }
    console.log("PET_STYLIZE_UPLOAD_RESULT", { paths: uploads });
  } else {
    console.error("PET_STYLIZE_RESPONSE_MISSING_PROCESSED", {
      status: status || 200,
      responseSnippet,
    });
    const wrapped = new Error("Stylize response missing processed payload.");
    wrapped.userMessage = "We couldn't save your pet yet. Please try again.";
    wrapped.devDetails = responseSnippet;
    throw wrapped;
  }
  const fallbackOriginal = originalUrl || null;
  const canUseStylized = alphaStylized === true || (alphaStylized == null && !!stylizedUrl);
  const canUseCutout = alphaCutout === true || (alphaCutout == null && !!cutoutUrl);
  const renderUrl =
    (canUseStylized ? stylizedUrl : null) ||
    (canUseCutout ? cutoutUrl : null) ||
    null;
  const renderSource = canUseStylized
    ? "stylized"
    : canUseCutout
      ? "cutout"
      : "missing";

  logDebug("PET_STYLIZE_OUTPUT_URLS", {
    originalUrl: fallbackOriginal,
    maskUrl,
    cutoutUrl,
    stylizedUrl,
    renderSource,
    renderUrl,
  });

  if (!stylizedUrl && !cutoutUrl) {
    console.error("PET_STYLIZE_RESPONSE_MISSING_URLS", {
      status: status || 200,
      responseKeys: Object.keys(responsePayload || {}),
      responseSnippet,
    });
    const wrapped = new Error("Stylize response missing processed URLs.");
    wrapped.userMessage = "We couldn't save your pet yet. Please try again.";
    wrapped.devDetails = responseSnippet;
    throw wrapped;
  }
  if (!renderUrl) {
    console.error("PET_STYLIZE_RESPONSE_MISSING_RENDER", {
      status: status || 200,
      alphaCutout,
      alphaStylized,
      failureReason,
      responseSnippet,
    });
    const wrapped = new Error("Stylize response missing alpha-safe processed image.");
    wrapped.userMessage = "Stylize did not return a transparent pet image. Please try again.";
    wrapped.devDetails = responseSnippet;
    throw wrapped;
  }

  setPetImageCache({
    userId,
    stylized: stylizedUrl,
    cutout: cutoutUrl,
    mask: maskUrl,
    original: fallbackOriginal,
    allowOriginal: false,
    alphaCutout,
    alphaStylized,
    maskReapplied,
    providerUsed,
    cacheBust,
  });

  return {
    stylizedUrl,
    stylizedBase64: null,
    mimeType: outputMime,
    sourceHash,
    version,
    cutoutUrl,
    maskUrl,
    originalUrl: fallbackOriginal,
    alphaCutout,
    alphaStylized,
    maskReapplied,
    providerUsed,
    modelUsed,
    failureReason,
    renderUrl,
    renderSource,
  };
}
