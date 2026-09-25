#!/usr/bin/env node
"use strict";

// One-off helper to remove checkerboard backgrounds from the garden sprites.
// This derives alpha from the two dominant background colors in the corners.

const path = require("path");
const sharp = require("sharp");

const INPUTS = [
  "assets/garden/flower_seeded.png",
  "assets/garden/flower_sprout.png",
  "assets/garden/flower_bloomed.png",
];

function getArg(flag) {
  const raw = process.argv.slice(2);
  const exact = raw.indexOf(flag);
  if (exact !== -1 && raw[exact + 1]) return raw[exact + 1];
  const withValue = raw.find((entry) => entry.startsWith(`${flag}=`));
  if (withValue) return withValue.split("=").slice(1).join("=");
  return null;
}

function colorDistance(a, b) {
  const dr = a[0] - b[0];
  const dg = a[1] - b[1];
  const db = a[2] - b[2];
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

function pickBackgroundColors(data, width, height, channels) {
  const sampleW = Math.min(8, width);
  const sampleH = Math.min(8, height);
  const samples = [];
  for (let y = 0; y < sampleH; y += 1) {
    for (let x = 0; x < sampleW; x += 1) {
      const idx = (y * width + x) * channels;
      const r = data[idx];
      const g = channels > 1 ? data[idx + 1] : data[idx];
      const b = channels > 2 ? data[idx + 2] : data[idx];
      samples.push([r, g, b]);
    }
  }
  const primary = samples[0] || [0, 0, 0];
  let secondary = primary;
  let maxDistance = -1;
  for (const sample of samples) {
    const distance = colorDistance(primary, sample);
    if (distance > maxDistance) {
      maxDistance = distance;
      secondary = sample;
    }
  }
  return { primary, secondary };
}

async function processSprite(inputPath, outputPath, softThreshold, hardThreshold) {
  const source = await sharp(inputPath).raw().toBuffer({ resolveWithObject: true });
  const { data, info } = source;
  const { width, height, channels } = info;
  const { primary, secondary } = pickBackgroundColors(data, width, height, channels);

  const output = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const idx = (y * width + x) * channels;
      const r = data[idx];
      const g = channels > 1 ? data[idx + 1] : data[idx];
      const b = channels > 2 ? data[idx + 2] : data[idx];
      const distA = colorDistance([r, g, b], primary);
      const distB = colorDistance([r, g, b], secondary);
      const dist = Math.min(distA, distB);

      let alpha = 255;
      if (dist <= softThreshold) {
        alpha = 0;
      } else if (dist < hardThreshold) {
        alpha = Math.round(((dist - softThreshold) / (hardThreshold - softThreshold)) * 255);
      }

      const factor = alpha / 255;
      const outIdx = (y * width + x) * 4;
      output[outIdx] = Math.round(r * factor);
      output[outIdx + 1] = Math.round(g * factor);
      output[outIdx + 2] = Math.round(b * factor);
      output[outIdx + 3] = alpha;
    }
  }

  await sharp(output, { raw: { width, height, channels: 4 } }).png().toFile(outputPath);
}

async function main() {
  const inPlace = Boolean(getArg("--in-place"));
  const outDir = getArg("--out-dir");
  const softThreshold = Number(getArg("--soft") || "12");
  const hardThreshold = Number(getArg("--hard") || "40");

  for (const inputPath of INPUTS) {
    const outputPath = inPlace
      ? inputPath
      : outDir
        ? path.join(outDir, path.basename(inputPath))
        : inputPath.replace(/\.png$/i, "-alpha.png");

    await processSprite(inputPath, outputPath, softThreshold, hardThreshold);
    console.log("Wrote", outputPath);
  }
}

main().catch((error) => {
  console.error("strip-plant-sprite-backgrounds failed:", error.message || error);
  process.exit(1);
});
