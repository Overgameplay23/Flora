// Decodes a picked photo on the device and asks the pure analysis for a look suggestion.
//
// The image picker returns JPEG base64 on every platform we target (quality < 1), which jpeg-js can
// decode in plain JavaScript, so this works in Expo Go and on web without a native module or a server.
// Anything that is not a JPEG (or fails to decode) simply yields no suggestion.
import { decode as decodeJpeg } from "jpeg-js";
import type { Species } from "../domain/petLook";
import { LookSuggestion, PixelSource, suggestLookFromPixels } from "../domain/photoLook";

const MAX_DECODE_BYTES = 6 * 1024 * 1024;

function base64ToBytes(value: string): Uint8Array {
  const clean = value.includes("base64,") ? value.slice(value.indexOf("base64,") + 7) : value;
  if (typeof globalThis.atob === "function") {
    const binary = globalThis.atob(clean);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  }
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { Buffer } = require("buffer");
  return Uint8Array.from(Buffer.from(clean, "base64"));
}

/** Decodes a JPEG (base64) into RGBA pixels, downsampled so the analysis stays cheap. */
export function decodeJpegBase64(base64: string, maxSide = 160): PixelSource | null {
  try {
    const bytes = base64ToBytes(base64);
    if (bytes.length === 0 || bytes.length > MAX_DECODE_BYTES) return null;
    if (bytes[0] !== 0xff || bytes[1] !== 0xd8) return null; // not a JPEG
    const decoded = decodeJpeg(bytes, { useTArray: true, maxResolutionInMP: 12, maxMemoryUsageInMB: 96 });
    const { width, height, data } = decoded;
    const scale = Math.max(1, Math.ceil(Math.max(width, height) / maxSide));
    if (scale === 1) return { width, height, data };
    const w = Math.floor(width / scale);
    const h = Math.floor(height / scale);
    const out = new Uint8Array(w * h * 4);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const si = ((y * scale) * width + x * scale) * 4;
        const di = (y * w + x) * 4;
        out[di] = data[si];
        out[di + 1] = data[si + 1];
        out[di + 2] = data[si + 2];
        out[di + 3] = data[si + 3];
      }
    }
    return { width: w, height: h, data: out };
  } catch (error) {
    if (__DEV__) console.warn("PHOTO_LOOK_DECODE_FAILED", (error as any)?.message || String(error));
    return null;
  }
}

/** A look suggestion from a picked photo, or null when the photo cannot be read. */
export function suggestLookFromPhoto(base64: string | null | undefined, species: Species): LookSuggestion | null {
  if (!base64) return null;
  const pixels = decodeJpegBase64(base64);
  if (!pixels) return null;
  return suggestLookFromPixels(pixels, species);
}
