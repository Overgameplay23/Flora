#!/usr/bin/env node
"use strict";

// Converts an image + segmentation mask into a true RGBA PNG and uploads it.
// - Mask is treated strictly as alpha (soft edges preserved, no thresholding).
// - Mask inversion is auto-detected using border sampling.
// - Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_ANON_KEY) for --pet-id or uploads.

const fs = require("fs/promises");
const path = require("path");
const sharp = require("sharp");
const { createClient } = require("@supabase/supabase-js");

const IMAGE_FIELDS = [
  "photo_url",
  "original_photo_url",
  "photoUrl",
  "originalPhotoUrl",
  "image_url",
  "imageUrl",
  "pet_photo_url",
  "petPhotoUrl",
];
const MASK_FIELDS = [
  "mask_url",
  "maskUrl",
  "segmentation_mask_url",
  "segmentationMaskUrl",
  "processed_mask_url",
  "processedMaskUrl",
];

function getArg(flag) {
  const raw = process.argv.slice(2);
  const exact = raw.indexOf(flag);
  if (exact !== -1 && raw[exact + 1]) return raw[exact + 1];
  const withValue = raw.find((entry) => entry.startsWith(`${flag}=`));
  if (withValue) return withValue.split("=").slice(1).join("=");
  return null;
}

function hasFlag(flag) {
  return process.argv.slice(2).includes(flag);
}

function requireArg(name, value) {
  if (!value) {
    throw new Error(`Missing required argument: ${name}`);
  }
}

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

function pickFirstValue(record, fields) {
  if (!record) return null;
  for (const field of fields) {
    const value = record?.[field];
    if (typeof value === "string" && value.trim().length > 0) {
      return { field, value };
    }
  }
  return null;
}

async function fetchBuffer(url) {
  const response = await fetch(url);
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to download ${url} (HTTP ${response.status}): ${text.slice(0, 200)}`);
  }
  const buffer = await response.arrayBuffer();
  return Buffer.from(buffer);
}

function computeBorderMean(maskData, width, height) {
  const step = Math.max(1, Math.floor(Math.min(width, height) / 80));
  let sum = 0;
  let count = 0;
  const rowTop = 0;
  const rowBottom = height - 1;
  for (let x = 0; x < width; x += step) {
    sum += maskData[rowTop * width + x];
    sum += maskData[rowBottom * width + x];
    count += 2;
  }
  for (let y = 0; y < height; y += step) {
    sum += maskData[y * width + 0];
    sum += maskData[y * width + (width - 1)];
    count += 2;
  }
  return count > 0 ? sum / count : 0;
}

function invertMask(maskData) {
  const output = Buffer.alloc(maskData.length);
  for (let i = 0; i < maskData.length; i += 1) {
    output[i] = 255 - maskData[i];
  }
  return output;
}

async function ensureDirForFile(filePath) {
  if (!filePath) return;
  const dir = path.dirname(filePath);
  await fs.mkdir(dir, { recursive: true });
}

async function getSignedUrlForPath(supabase, bucket, storagePath, ttlSeconds = 3600) {
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(storagePath, ttlSeconds);
  if (data?.signedUrl) {
    return { url: data.signedUrl, error: null };
  }
  if (error) {
    return { url: null, error };
  }
  const { data: publicData } = supabase.storage.from(bucket).getPublicUrl(storagePath);
  return { url: publicData?.publicUrl || null, error: null };
}

async function resolvePetInputs({ supabase, bucket, petId }) {
  const lookup = {
    petRowFound: false,
    profileRowFound: false,
    petRowError: null,
    profileRowError: null,
    imageFieldHit: null,
    maskFieldHit: null,
    storageImagePath: null,
    storageMaskPath: null,
  };

  let petRow = null;
  const petByUser = await supabase.from("pet").select("*").eq("user_id", petId).maybeSingle();
  if (petByUser.error) {
    lookup.petRowError = petByUser.error.message || String(petByUser.error);
  } else if (petByUser.data) {
    petRow = petByUser.data;
    lookup.petRowFound = true;
  }

  if (!petRow) {
    const petById = await supabase.from("pet").select("*").eq("id", petId).maybeSingle();
    if (petById.error) {
      lookup.petRowError = lookup.petRowError || petById.error.message || String(petById.error);
    } else if (petById.data) {
      petRow = petById.data;
      lookup.petRowFound = true;
    }
  }

  let profileRow = null;
  const profileByUser = await supabase.from("profiles").select("*").eq("user_id", petId).maybeSingle();
  if (profileByUser.error) {
    lookup.profileRowError = profileByUser.error.message || String(profileByUser.error);
  } else if (profileByUser.data) {
    profileRow = profileByUser.data;
    lookup.profileRowFound = true;
  }

  const imagePick = pickFirstValue(petRow, IMAGE_FIELDS) || pickFirstValue(profileRow, IMAGE_FIELDS);
  if (imagePick) {
    lookup.imageFieldHit = imagePick.field;
  }
  let imageUrl = imagePick?.value || null;

  const maskPick = pickFirstValue(petRow, MASK_FIELDS) || pickFirstValue(profileRow, MASK_FIELDS);
  if (maskPick) {
    lookup.maskFieldHit = maskPick.field;
  }
  let maskUrl = maskPick?.value || null;

  if (!imageUrl) {
    const originalCandidates = [
      `original/${petId}.png`,
      `original/${petId}.jpg`,
      `original/${petId}.jpeg`,
      `original/${petId}.webp`,
    ];
    for (const candidate of originalCandidates) {
      const { url } = await getSignedUrlForPath(supabase, bucket, candidate);
      if (url) {
        imageUrl = url;
        lookup.storageImagePath = candidate;
        break;
      }
    }
    if (!imageUrl) {
      const { data, error } = await supabase.storage.from(bucket).list("original", {
        limit: 100,
        search: petId,
      });
      if (!error && Array.isArray(data)) {
        const match = data.find((entry) => entry?.name?.startsWith(petId));
        if (match?.name) {
          const pathCandidate = `original/${match.name}`;
          const { url } = await getSignedUrlForPath(supabase, bucket, pathCandidate);
          if (url) {
            imageUrl = url;
            lookup.storageImagePath = pathCandidate;
          }
        }
      }
    }
  }

  if (!maskUrl) {
    const maskCandidates = [
      `processed/${petId}/mask.png`,
      `processed/${petId}/mask.webp`,
    ];
    for (const candidate of maskCandidates) {
      const { url } = await getSignedUrlForPath(supabase, bucket, candidate);
      if (url) {
        maskUrl = url;
        lookup.storageMaskPath = candidate;
        break;
      }
    }
    if (!maskUrl) {
      const { data, error } = await supabase.storage.from(bucket).list(`processed/${petId}`, {
        limit: 100,
        search: "mask",
      });
      if (!error && Array.isArray(data)) {
        const match = data.find((entry) => entry?.name?.toLowerCase().includes("mask"));
        if (match?.name) {
          const pathCandidate = `processed/${petId}/${match.name}`;
          const { url } = await getSignedUrlForPath(supabase, bucket, pathCandidate);
          if (url) {
            maskUrl = url;
            lookup.storageMaskPath = pathCandidate;
          }
        }
      }
    }
  }

  return { imageUrl, maskUrl, lookup };
}

function buildMissingMaskMessage({ petId, bucket, lookup }) {
  const lines = [
    `Mask URL not found for pet ${petId}.`,
    "Looked in:",
    `- pet table fields: ${MASK_FIELDS.join(", ")}`,
    `- profiles table fields: ${MASK_FIELDS.join(", ")}`,
    `- storage paths: ${bucket}/processed/${petId}/mask.png or ${bucket}/processed/${petId}/mask.webp`,
  ];
  if (lookup?.petRowError) lines.push(`- pet table error: ${lookup.petRowError}`);
  if (lookup?.profileRowError) lines.push(`- profiles table error: ${lookup.profileRowError}`);
  lines.push(
    "Fix: ensure the pet-stylize Edge function persists processed.mask_url to Storage under the processed path, then re-run."
  );
  return lines.join("\n");
}

function buildMissingImageMessage({ petId, bucket, lookup }) {
  const lines = [
    `Image URL not found for pet ${petId}.`,
    "Looked in:",
    `- pet table fields: ${IMAGE_FIELDS.join(", ")}`,
    `- profiles table fields: ${IMAGE_FIELDS.join(", ")}`,
    `- storage paths: ${bucket}/original/${petId}.{png|jpg|jpeg|webp}`,
  ];
  if (lookup?.petRowError) lines.push(`- pet table error: ${lookup.petRowError}`);
  if (lookup?.profileRowError) lines.push(`- profiles table error: ${lookup.profileRowError}`);
  lines.push("Fix: upload a pet photo or ensure photo_url is populated on the pet/profile row.");
  return lines.join("\n");
}

async function main() {
  const petId = getArg("--pet-id");
  const imageUrlArg = getArg("--image-url");
  const maskUrlArg = getArg("--mask-url");
  const bucket = getArg("--bucket") || process.env.SUPABASE_BUCKET || "pets";
  let outputPath = getArg("--path");
  let outputFile = getArg("--out-file");
  const noUpload = hasFlag("--no-upload");

  let supabase = null;
  if (petId || !noUpload) {
    const supabaseUrl = requireEnv("SUPABASE_URL");
    const supabaseKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
    if (!supabaseKey) {
      throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY or SUPABASE_ANON_KEY.");
    }
    supabase = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false },
    });
  }

  let imageUrl = imageUrlArg;
  let maskUrl = maskUrlArg;
  if (petId) {
    const resolved = await resolvePetInputs({ supabase, bucket, petId });
    imageUrl = resolved.imageUrl;
    maskUrl = resolved.maskUrl;
    if (!outputFile) {
      outputFile = path.join("tmp", `${petId}-cutout.png`);
    }
    if (!outputPath && !noUpload) {
      outputPath = `processed/${petId}/cutout.png`;
    }
    if (!imageUrl) {
      throw new Error(buildMissingImageMessage({ petId, bucket, lookup: resolved.lookup }));
    }
    if (!maskUrl) {
      throw new Error(buildMissingMaskMessage({ petId, bucket, lookup: resolved.lookup }));
    }
    console.log("Resolved pet inputs", {
      petId,
      imageUrl,
      maskUrl,
      imageSource: resolved.lookup.imageFieldHit || resolved.lookup.storageImagePath || "unknown",
      maskSource: resolved.lookup.maskFieldHit || resolved.lookup.storageMaskPath || "unknown",
    });
  } else {
    requireArg("--image-url", imageUrl);
    requireArg("--mask-url", maskUrl);
    if (!outputFile) {
      outputFile = path.join("tmp", "pet-cutout.png");
    }
  }

  if (!noUpload) {
    requireArg("--path", outputPath);
  }

  const [imageBuffer, maskBuffer] = await Promise.all([
    fetchBuffer(imageUrl),
    fetchBuffer(maskUrl),
  ]);

  const baseMeta = await sharp(imageBuffer).rotate().metadata();
  if (!baseMeta.width || !baseMeta.height) {
    throw new Error("Failed to read image dimensions.");
  }

  const maskPipeline = sharp(maskBuffer)
    .rotate()
    .resize(baseMeta.width, baseMeta.height, { fit: "fill" })
    .greyscale();

  const { data: maskData, info: maskInfo } = await maskPipeline.raw().toBuffer({
    resolveWithObject: true,
  });

  const borderMean = computeBorderMean(maskData, maskInfo.width, maskInfo.height);
  const shouldInvert = borderMean > 127;
  const alphaChannel = shouldInvert ? invertMask(maskData) : maskData;

  const outputPng = await sharp(imageBuffer)
    .rotate()
    .removeAlpha()
    .toColourspace("rgb")
    .joinChannel(alphaChannel, {
      raw: { width: maskInfo.width, height: maskInfo.height, channels: 1 },
    })
    .png()
    .toBuffer();

  await ensureDirForFile(outputFile);
  await sharp(outputPng).png().toFile(outputFile);

  const outputMeta = await sharp(outputPng).metadata();
  const alphaInfo = { hasAlpha: outputMeta.hasAlpha ?? false, channels: outputMeta.channels ?? null };

  let publicUrl = null;
  if (!noUpload) {
    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(outputPath, outputPng, { upsert: true, contentType: "image/png" });

    if (uploadError) {
      throw uploadError;
    }

    const { data } = supabase.storage.from(bucket).getPublicUrl(outputPath);
    publicUrl = data?.publicUrl || null;
  }

  console.log("Cutout ready", {
    outputFile,
    outputPath: noUpload ? null : outputPath,
    publicUrl,
    invertedMask: shouldInvert,
    ...alphaInfo,
  });
}

main().catch((error) => {
  console.error("pet-mask-to-alpha failed:", error.message || error);
  process.exit(1);
});
