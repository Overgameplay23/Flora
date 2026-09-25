import { encode } from "jpeg-js";
import { decodeJpegBase64, suggestLookFromPhoto } from "../services/photoLook";
import { hexToRgb } from "../domain/photoLook";

(globalThis as any).__DEV__ = false;

function jpegBase64(width: number, height: number, paint: (x: number, y: number) => [number, number, number]) {
  const data = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const [r, g, b] = paint(x, y);
      const i = (y * width + x) * 4;
      data[i] = r;
      data[i + 1] = g;
      data[i + 2] = b;
      data[i + 3] = 255;
    }
  }
  return encode({ data, width, height }, 90).data.toString("base64");
}

describe("photo look service", () => {
  it("decodes and downsamples a JPEG", () => {
    const b64 = jpegBase64(400, 300, () => [120, 80, 40]);
    const pixels = decodeJpegBase64(b64, 100)!;
    expect(pixels).not.toBeNull();
    expect(pixels.width).toBeLessThanOrEqual(100);
    expect(pixels.height).toBeLessThanOrEqual(100);
    expect(pixels.data.length).toBe(pixels.width * pixels.height * 4);
  });

  it("suggests a coat colour close to the pet in the photo", () => {
    const b64 = jpegBase64(240, 240, (x, y) => {
      const dx = x - 120, dy = y - 130;
      if (dx * dx + dy * dy < 70 * 70) return [210, 160, 90]; // golden pet
      return [70, 140, 200]; // sky-ish background
    });
    const s = suggestLookFromPhoto(b64, "dog")!;
    expect(s).not.toBeNull();
    const [r, g, b] = hexToRgb(s.coat);
    expect(r).toBeGreaterThan(180);
    expect(g).toBeGreaterThan(130);
    expect(b).toBeLessThan(140);
  });

  it("returns null for junk", () => {
    expect(suggestLookFromPhoto("", "dog")).toBeNull();
    expect(suggestLookFromPhoto("bm90IGEganBlZw==", "dog")).toBeNull();
    expect(decodeJpegBase64("data:image/png;base64,iVBORw0KGgo=")).toBeNull();
  });
});
