#!/usr/bin/env node
// Builds the layered garden scene from the single painted background (assets/garden.png).
//
// The painting already contains a planting patch with four plants in the garden's own art style
// (seed, small sprout, sprout, bloom). To make plants part of the environment instead of stickers:
//   1. each painted plant is lifted out as a sprite together with a feathered rim of its soil,
//   2. the plants are painted out of the patch (smooth soil fill) to produce an EMPTY-patch background,
//   3. scene.json records where the patch, the planting spots and the pet's spot are, in normalized
//      image coordinates, so the app can anchor sprites to the painting at any screen size.
// Placing a sprite back on its own spot reproduces the original painting exactly.
// The source painting is never modified.  Usage: node scripts/build-garden-scene.js
const fs = require("node:fs");
const path = require("node:path");
const sharp = require("sharp");

const root = path.resolve(__dirname, "..");
const source = path.join(root, "assets", "garden.png");
const outDir = path.join(root, "assets", "garden", "scene");

// Rough location of the planting patch in the 1696x2528 painting (centre and radii, px).
const PATCH = { cx: 1036, cy: 1758, rx: 300, ry: 165 };
const STAGE_ORDER = ["seed", "sproutSmall", "sprout", "bloom"]; // assigned by plant height, shortest first

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

function components(mask, W, H) {
  const label = new Int32Array(W * H);
  const found = [];
  const stack = [];
  for (let start = 0; start < W * H; start++) {
    if (!mask[start] || label[start]) continue;
    const id = found.length + 1;
    const c = { id, size: 0, x0: W, y0: H, x1: 0, y1: 0 };
    stack.push(start);
    label[start] = id;
    while (stack.length) {
      const p = stack.pop();
      const x = p % W, y = (p - x) / W;
      c.size++;
      if (x < c.x0) c.x0 = x; if (x > c.x1) c.x1 = x; if (y < c.y0) c.y0 = y; if (y > c.y1) c.y1 = y;
      for (const q of [p - 1, p + 1, p - W, p + W]) {
        if (q < 0 || q >= W * H) continue;
        if (Math.abs((q % W) - x) > 1) continue;
        if (mask[q] && !label[q]) { label[q] = id; stack.push(q); }
      }
    }
    found.push(c);
  }
  return { label, found };
}

(async () => {
  fs.mkdirSync(outDir, { recursive: true });
  const { data, info } = await sharp(source).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const IW = info.width, IH = info.height;

  // Work inside a window around the patch.
  const wx0 = PATCH.cx - PATCH.rx - 60, wy0 = PATCH.cy - PATCH.ry - 120;
  const W = (PATCH.rx + 60) * 2, H = (PATCH.ry + 120) * 2 - 60;
  const px = (x, y) => { const i = ((wy0 + y) * IW + (wx0 + x)) * 3; return [data[i], data[i + 1], data[i + 2]]; };

  // Step 1: plant CORES = pixels well inside the soil that are clearly not soil
  // (soil is brown; leaves are saturated green, petals and glow are bright cream, the seed is tan).
  const plant = new Uint8Array(W * H);
  const colourAt = (x, y) => {
    const [r, g, b] = px(x, y);
    const lum = 0.299 * r + 0.587 * g + 0.114 * b;
    return {
      // The painting has a warm wash: leaves are only slightly greener than red (g - r ~ 5..30), while the
      // surrounding grass is yellowish (r > g) and soil is brown (r >> g).
      leaf: g - r > 3 && g - b > 40 && g > 90,
      cream: r > 205 && g > 175 && lum > 185,
      bright: lum > 150,
      tan: r > 160 && g > 115 && r - b > 50 && lum > 135,
    };
  };
  const stack = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const ex = (wx0 + x - PATCH.cx) / (PATCH.rx * 0.86), ey = (wy0 + y - PATCH.cy) / (PATCH.ry * 0.84);
    if (ex * ex + ey * ey > 1) continue;
    const c = colourAt(x, y);
    if (c.leaf || c.bright || c.tan) { plant[y * W + x] = 1; stack.push(y * W + x); }
  }
  // Step 2: grow each core through CONNECTED leaf-green / petal-cream pixels so parts that reach past the
  // soil edge (the tall sprout's leaves, the bloom's upper petals) are kept, while the grass fringe
  // around the patch, which touches no core, is not.
  while (stack.length) {
    const q = stack.pop();
    const x = q % W, y = (q - x) / W;
    for (const [nx, ny] of [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]]) {
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const n = ny * W + nx;
      if (plant[n]) continue;
      const c = colourAt(nx, ny);
      if (c.leaf || c.cream) { plant[n] = 1; stack.push(n); }
    }
  }
  // Join each plant's parts (leaves, stem, bloom) and ignore specks / firefly dots.
  const joined = boxBlur(Float32Array.from(plant), W, H, 8);
  const joinedMask = new Uint8Array(W * H);
  for (let p = 0; p < W * H; p++) joinedMask[p] = joined[p] > 0.06 ? 1 : 0;
  const { label, found } = components(joinedMask, W, H);
  const plants = found.filter((c) => c.size > 1500).sort((a, b) => b.size - a.size).slice(0, 4);
  if (plants.length !== 4) {
    for (const c of found.filter((c) => c.size > 200)) console.log("component", c.size, "bbox", wx0 + c.x0, wy0 + c.y0, wx0 + c.x1, wy0 + c.y1);
    throw new Error(`expected 4 painted plants in the patch, found ${plants.length}`);
  }
  // Identify each painted plant by where it sits in the patch.
  const EXPECTED = { seed: [870, 1755], sproutSmall: [1040, 1815], sprout: [1033, 1668], bloom: [1204, 1755] };
  const ordered = STAGE_ORDER.map((stage) => {
    const [ex, ey] = EXPECTED[stage];
    return plants.slice().sort((a, b) =>
      Math.hypot(wx0 + (a.x0 + a.x1) / 2 - ex, wy0 + a.y1 - ey) - Math.hypot(wx0 + (b.x0 + b.x1) / 2 - ex, wy0 + b.y1 - ey))[0];
  });
  if (new Set(ordered.map((c) => c.id)).size !== 4) throw new Error("could not match the four painted plants to their stages");
  plants.splice(0, plants.length, ...ordered);

  // Distance-like falloff from each plant: solid near the plant, fading into the surrounding soil.
  const sprites = {};
  const inpaintMask = new Uint8Array(W * H);
  const NEAR = 10, FAR = 22;
  for (let i = 0; i < plants.length; i++) {
    const c = plants[i];
    const own = new Float32Array(W * H);
    for (let p = 0; p < W * H; p++) own[p] = label[p] === c.id ? 1 : 0;
    const near = boxBlur(own, W, H, NEAR), far = boxBlur(own, W, H, FAR);
    const tight = new Float32Array(W * H);
    for (let q = 0; q < W * H; q++) tight[q] = label[q] === c.id && plant[q] ? 1 : 0;
    const outline = boxBlur(tight, W, H, 4);
    const x0 = Math.max(0, c.x0 - FAR), y0 = Math.max(0, c.y0 - FAR), x1 = Math.min(W - 1, c.x1 + FAR), y1 = Math.min(H - 1, c.y1 + FAR);
    const sw = x1 - x0 + 1, sh = y1 - y0 + 1;
    const rgba = Buffer.alloc(sw * sh * 4);
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const p = y * W + x, o = ((y - y0) * sw + (x - x0)) * 4;
      const [r, g, b] = px(x, y);
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;
      const soilish = r - g > 18 && lum < 150; // soil and the dark mound strokes drawn on it
      const core = outline[p] > 0.02; // the plant itself plus ~4 px for its drawn outline
      const rim = soilish ? Math.min(1, Math.max(0, (far[p] - 0.05) / 0.25)) : 0;
      const a = core ? 1 : rim;
      rgba[o] = r; rgba[o + 1] = g; rgba[o + 2] = b; rgba[o + 3] = Math.round(255 * a * a * (3 - 2 * a));
      if (far[p] > (i === plants.length - 1 ? 0.004 : 0.02)) inpaintMask[p] = 1; // the bloom's glow reaches further
    }
    // Close holes: drawn outlines inside the plant (petal edges, the flower's centre ring) are dark and
    // not plant-coloured, so they can end up transparent. Anything fully enclosed by opaque pixels is plant.
    {
      const open = new Uint8Array(sw * sh);
      const todo = [];
      const visit = (q) => { if (!open[q] && rgba[q * 4 + 3] < 128) { open[q] = 1; todo.push(q); } };
      for (let x = 0; x < sw; x++) { visit(x); visit((sh - 1) * sw + x); }
      for (let y = 0; y < sh; y++) { visit(y * sw); visit(y * sw + sw - 1); }
      while (todo.length) {
        const q = todo.pop();
        const x = q % sw, y = (q - x) / sw;
        if (x > 0) visit(q - 1);
        if (x < sw - 1) visit(q + 1);
        if (y > 0) visit(q - sw);
        if (y < sh - 1) visit(q + sw);
      }
      for (let q = 0; q < sw * sh; q++) if (!open[q] && rgba[q * 4 + 3] < 128) rgba[q * 4 + 3] = 255;
    }
    const stage = STAGE_ORDER[i];
    const file = `patch_${stage}.png`;
    await sharp(rgba, { raw: { width: sw, height: sh, channels: 4 } }).png({ compressionLevel: 9 }).toFile(path.join(outDir, file));
    // Anchor = where the plant meets the soil: bottom-centre of the plant's own pixels.
    const baseX = (c.x0 + c.x1) / 2, baseY = c.y1 - 7;
    sprites[stage] = {
      file,
      width: sw,
      height: sh,
      anchorX: +((baseX - x0) / sw).toFixed(4),
      anchorY: +((baseY - y0) / sh).toFixed(4),
      homeSpot: { u: +((wx0 + baseX) / IW).toFixed(4), v: +((wy0 + baseY) / IH).toFixed(4) },
    };
    console.log(`${file.padEnd(24)} ${sw}x${sh}  base at u=${sprites[stage].homeSpot.u} v=${sprites[stage].homeSpot.v}`);
  }

  // Paint the plants out. Two of them overlap the patch's top edge, so one smooth fill would smear soil
  // into grass. Each masked pixel instead takes the MATERIAL (soil or grass) of its nearest untouched
  // neighbour (breadth-first from the mask border), is coloured from same-material averages with a
  // widening radius, and the patch's dark outline is redrawn where the two materials meet.
  const SOIL = 1, GRASS = 2;
  const material = new Uint8Array(W * H);
  const chan = [0, 1, 2].map(() => ({ soil: new Float32Array(W * H), grass: new Float32Array(W * H) }));
  const isSoil = new Float32Array(W * H), isGrass = new Float32Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const q = y * W + x;
    if (inpaintMask[q]) continue;
    const [r, g, b] = px(x, y);
    const lum = 0.299 * r + 0.587 * g + 0.114 * b;
    if (r - g > 30 && lum > 85 && lum < 150) { material[q] = SOIL; isSoil[q] = 1; chan[0].soil[q] = r; chan[1].soil[q] = g; chan[2].soil[q] = b; }
    else if (lum > 150 && g > b + 40 && Math.abs(r - g) < 40) { material[q] = GRASS; isGrass[q] = 1; chan[0].grass[q] = r; chan[1].grass[q] = g; chan[2].grass[q] = b; }
  }
  // nearest-material propagation into the mask
  const filled = Uint8Array.from(material);
  let frontier = [];
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
    const q = y * W + x;
    if (!inpaintMask[q] && material[q] && (inpaintMask[q - 1] || inpaintMask[q + 1] || inpaintMask[q - W] || inpaintMask[q + W])) frontier.push(q);
  }
  while (frontier.length) {
    const next = [];
    for (const q of frontier) {
      const x = q % W, y = (q - x) / W;
      for (const n of [q - 1, q + 1, q - W, q + W]) {
        const nx = n % W, ny = (n - nx) / W;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H || Math.abs(nx - x) > 1) continue;
        if (inpaintMask[n] && !filled[n]) { filled[n] = filled[q]; next.push(n); }
      }
    }
    frontier = next;
  }
  const radii = [25, 60, 130];
  const blurs = radii.map((R) => ({
    soilW: boxBlur(isSoil, W, H, R), grassW: boxBlur(isGrass, W, H, R),
    soilC: chan.map((c) => boxBlur(c.soil, W, H, R)), grassC: chan.map((c) => boxBlur(c.grass, W, H, R)),
  }));
  const averageOf = (q, kind) => {
    for (const bl of blurs) {
      const w = kind === SOIL ? bl.soilW[q] : bl.grassW[q];
      if (w > 0.03) return (kind === SOIL ? bl.soilC : bl.grassC).map((c) => c[q] / w);
    }
    return kind === SOIL ? [150, 103, 66] : [200, 185, 100];
  };

  // Round off the angular (Voronoi-like) material boundary with a majority vote before drawing it.
  const soilVote = boxBlur(Float32Array.from(filled, (v) => (v === SOIL ? 1 : 0)), W, H, 16);
  const knownVote = boxBlur(Float32Array.from(filled, (v) => (v ? 1 : 0)), W, H, 16);
  const kindAt = new Uint8Array(W * H);
  for (let q = 0; q < W * H; q++) kindAt[q] = inpaintMask[q] ? (soilVote[q] >= 0.5 * knownVote[q] ? SOIL : GRASS) : material[q];

  // Compose fill colours into a float layer, soften its blockiness, then write it back with grain.
  const layer = [0, 1, 2].map(() => new Float32Array(W * H));
  const isOutline = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const q = y * W + x;
    const c = inpaintMask[q] ? averageOf(q, kindAt[q] || SOIL) : px(x, y);
    for (let k = 0; k < 3; k++) layer[k][q] = c[k];
  }
  for (let y = 3; y < H - 3; y++) for (let x = 3; x < W - 3; x++) {
    const q = y * W + x;
    if (!inpaintMask[q]) continue;
    const kind = kindAt[q];
    for (let dy = -2; dy <= 2 && !isOutline[q]; dy++) for (let dx = -2; dx <= 2; dx++) {
      const f = kindAt[q + dy * W + dx];
      if (f && f !== kind) { isOutline[q] = 1; break; }
    }
  }
  const soft = layer.map((c) => boxBlur(boxBlur(c, W, H, 6), W, H, 6));
  const out = Buffer.from(data);
  let seedRand = 1234567;
  const rand = () => ((seedRand = (seedRand * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff) - 0.5;
  const OUTLINE = [101, 62, 40];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const q = y * W + x;
    if (!inpaintMask[q]) continue;
    const grain = rand() * 5;
    const i = ((wy0 + y) * IW + (wx0 + x)) * 3;
    for (let k = 0; k < 3; k++) {
      const v = isOutline[q] ? OUTLINE[k] : soft[k][q];
      out[i + k] = Math.max(0, Math.min(255, Math.round(v + grain)));
    }
  }
  const bgFile = path.join(outDir, "garden_bg.jpg");
  await sharp(out, { raw: { width: IW, height: IH, channels: 3 } }).jpeg({ quality: 88, mozjpeg: true }).toFile(bgFile);
  console.log(`garden_bg.jpg            ${IW}x${IH}  ${(fs.statSync(bgFile).size / 1024).toFixed(0)} kB (source PNG ${(fs.statSync(source).size / 1048576).toFixed(1)} MB)`);

  const scene = {
    image: { width: IW, height: IH, file: "garden_bg.jpg" },
    patch: { u: +(PATCH.cx / IW).toFixed(4), v: +(PATCH.cy / IH).toFixed(4), ru: +(PATCH.rx / IW).toFixed(4), rv: +(PATCH.ry / IH).toFixed(4) },
    // Planting order: the four painted mounds first (back-to-front reading order), then two free spots.
    // Planting order, all well inside the soil so a sprite's soil rim never reaches the grass.
    // Back row first (drawn smaller: further away), then the front row.
    spots: [
      { u: 0.6150, v: 0.6790, scale: 0.94 },
      { u: 0.7000, v: 0.6900, scale: 0.96 },
      { u: 0.5350, v: 0.6900, scale: 0.96 },
      { u: 0.5800, v: 0.7300, scale: 1.06 },
      { u: 0.6650, v: 0.7350, scale: 1.06 },
      { u: 0.5000, v: 0.7250, scale: 1.04 },
    ],
    // Where the pet sits: on the grass at the front-left of the patch, facing the plants.
    pet: { u: 0.375, v: 0.802, heightRatio: 0.24 },
    sprites,
  };
  fs.writeFileSync(path.join(outDir, "scene.json"), JSON.stringify(scene, null, 2) + "\n");
  console.log("scene.json written");
})().catch((error) => { console.error(error); process.exit(1); });
