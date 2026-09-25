// Builds the demo account's pet sprite: a full-body, transparent cutout of the sitting puppy in
// assets/pet.png (repo sample art, same flat storybook style as the garden painting).
// It stands in for the output of the pet-stylize Edge Function, which cannot run locally.
//
// Method: the puppy is cream/brown on a green meadow with a teal sky, so grow a region from the middle
// of its body through every pixel that is NOT meadow-green or sky-teal, fill interior holes (eyes, nose),
// shave the fringe, feather, trim to the body. The result's bottom edge is the paws, which is what the
// scene uses to stand the pet on the ground.
const path = require("node:path");
const sharp = require("sharp");

const SOURCE = path.resolve(__dirname, "..", "assets", "pet.png");

function boxBlur(src, W, H, r) {
  const tmp = new Float32Array(W * H), out = new Float32Array(W * H);
  for (let y = 0; y < H; y++) {
    let sum = 0;
    for (let x = -r; x <= r; x++) sum += src[y * W + Math.min(W - 1, Math.max(0, x))];
    for (let x = 0; x < W; x++) {
      tmp[y * W + x] = sum / (2 * r + 1);
      sum += src[y * W + Math.min(W - 1, x + r + 1)] - src[y * W + Math.max(0, x - r)];
    }
  }
  for (let x = 0; x < W; x++) {
    let sum = 0;
    for (let y = -r; y <= r; y++) sum += tmp[Math.min(H - 1, Math.max(0, y)) * W + x];
    for (let y = 0; y < H; y++) {
      out[y * W + x] = sum / (2 * r + 1);
      sum += tmp[Math.min(H - 1, y + r + 1) * W + x] - tmp[Math.max(0, y - r) * W + x];
    }
  }
  return out;
}

async function buildDemoPet({ height = 640 } = {}) {
  const { data, info } = await sharp(SOURCE).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height;
  const isBackground = (p) => {
    const r = data[p * 3], g = data[p * 3 + 1], b = data[p * 3 + 2];
    const meadow = g > r + 6 && g > b + 6; // greens of every shade
    const sky = b > r + 10 && g > r + 10; // teal sky
    return meadow || sky;
  };

  // Region growing from the middle of the body.
  const mask = new Uint8Array(W * H);
  const start = Math.round(H * 0.62) * W + Math.round(W * 0.5);
  const stack = [start];
  mask[start] = 1;
  while (stack.length) {
    const p = stack.pop();
    const x = p % W, y = (p - x) / W;
    for (const [nx, ny] of [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]]) {
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const n = ny * W + nx;
      if (mask[n] || isBackground(n)) continue;
      mask[n] = 1;
      stack.push(n);
    }
  }

  // Fill interior holes: anything not reachable from the border through non-mask pixels.
  const outside = new Uint8Array(W * H);
  const border = [];
  const pushIf = (p) => { if (!mask[p] && !outside[p]) { outside[p] = 1; border.push(p); } };
  for (let x = 0; x < W; x++) { pushIf(x); pushIf((H - 1) * W + x); }
  for (let y = 0; y < H; y++) { pushIf(y * W); pushIf(y * W + W - 1); }
  while (border.length) {
    const p = border.pop();
    const x = p % W, y = (p - x) / W;
    if (x > 0) pushIf(p - 1);
    if (x < W - 1) pushIf(p + 1);
    if (y > 0) pushIf(p - W);
    if (y < H - 1) pushIf(p + W);
  }
  const solid = new Float32Array(W * H);
  for (let p = 0; p < W * H; p++) solid[p] = outside[p] ? 0 : 1;

  // Shave one pixel of green fringe, then feather.
  const shaved = boxBlur(solid, W, H, 1);
  for (let p = 0; p < W * H; p++) solid[p] = shaved[p] > 0.95 ? 1 : 0;
  const alpha = boxBlur(solid, W, H, 1);

  const rgba = Buffer.alloc(W * H * 4);
  for (let p = 0; p < W * H; p++) {
    rgba[p * 4] = data[p * 3];
    rgba[p * 4 + 1] = data[p * 3 + 1];
    rgba[p * 4 + 2] = data[p * 3 + 2];
    rgba[p * 4 + 3] = Math.round(alpha[p] * 255);
  }
  const trimmed = await sharp(rgba, { raw: { width: W, height: H, channels: 4 } }).trim({ threshold: 6 }).png().toBuffer();
  return sharp(trimmed).resize({ height }).png({ compressionLevel: 9 }).toBuffer();
}

module.exports = { buildDemoPet };

if (require.main === module) {
  const out = process.argv[2] || path.join(__dirname, "demo-pet-preview.png");
  buildDemoPet().then((buffer) => sharp(buffer).toFile(out)).then((info) => console.log(`demo pet ${info.width}x${info.height} -> ${out}`));
}
