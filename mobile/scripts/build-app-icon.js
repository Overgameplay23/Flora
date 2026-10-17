#!/usr/bin/env node
// Renders Luna's app icon, Android adaptive icon layers, splash image and favicon from one piece of artwork:
// the app's own golden dog (assets/brand/luna-dog.svg, captured from PetRig) sitting in front of a full moon on
// the dusk sky of the design tokens (src/theme/tokens.ts, sky.dusk). Edit the SVG or the scene below, then run:
//   node scripts/build-app-icon.js
// iOS rejects app icons with transparency, so icon.png is flattened onto the sky.
const fs = require("node:fs");
const path = require("node:path");
const sharp = require("sharp");

const ROOT = path.join(__dirname, "..");
const ASSETS = path.join(ROOT, "assets");
const SIZE = 1024;

// sky.dusk and ink.night from src/theme/tokens.ts
const SKY = { top: "#3E4878", mid: "#8B6C9C", horizon: "#E7A29F" };
const MOON = "#F6F1E9";
const HILL = "#4B3A6E"; // brand.plum

const dogSvg = fs.readFileSync(path.join(ASSETS, "brand", "luna-dog.svg"), "utf8");
const DOG = dogSvg
  .replace(/<!--[\s\S]*?-->/g, "")
  .replace(/^[\s\S]*?<svg[^>]*>/, "")
  .replace(/<\/svg>\s*$/, "")
  .trim();

const dog = (x, y, scale) => `<g transform="translate(${x} ${y}) scale(${scale})">${DOG}</g>`;

const defs = `
<defs>
  <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="${SKY.top}"/>
    <stop offset="0.62" stop-color="${SKY.mid}"/>
    <stop offset="1" stop-color="${SKY.horizon}"/>
  </linearGradient>
  <radialGradient id="glow" cx="0.5" cy="0.5" r="0.5">
    <stop offset="0.55" stop-color="${MOON}" stop-opacity="0.38"/>
    <stop offset="1" stop-color="${MOON}" stop-opacity="0"/>
  </radialGradient>
  <radialGradient id="moonShade" cx="0.38" cy="0.34" r="0.75">
    <stop offset="0" stop-color="#FFFDF8"/>
    <stop offset="1" stop-color="#EFE3D2"/>
  </radialGradient>
</defs>`;

function moon(cx, cy, r) {
  return `
  <circle cx="${cx}" cy="${cy}" r="${r * 1.32}" fill="url(#glow)"/>
  <circle cx="${cx}" cy="${cy}" r="${r}" fill="url(#moonShade)"/>
  <circle cx="${cx - r * 0.42}" cy="${cy - r * 0.36}" r="${r * 0.13}" fill="#E6D8C4" opacity="0.6"/>
  <circle cx="${cx + r * 0.46}" cy="${cy - r * 0.12}" r="${r * 0.09}" fill="#E6D8C4" opacity="0.55"/>
  <circle cx="${cx + r * 0.2}" cy="${cy - r * 0.55}" r="${r * 0.06}" fill="#E6D8C4" opacity="0.5"/>`;
}

const stars = (list) => list.map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${MOON}" opacity="0.85"/>`).join("");

const STARS = [
  [150, 170, 6], [236, 96, 4], [862, 132, 5], [930, 300, 3.5], [108, 380, 3.5], [905, 560, 4], [196, 600, 3],
];

const hill = (cy) => `<ellipse cx="512" cy="${cy}" rx="760" ry="200" fill="${HILL}" opacity="0.9"/>`;

// The dog's art box is 200 units; it sits on y = 188. Scale and place it so it sits on the hill, its head on the moon.
const FULL = { moon: [512, 420, 300], dog: [512 - 100 * 4.2, 948 - 188 * 4.2, 4.2] };
// Adaptive icons and the splash keep everything inside the central safe circle (about 61% of the canvas).
const INNER = { moon: [512, 436, 196], dog: [512 - 100 * 2.75, 790 - 188 * 2.75, 2.75] };

const svg = (body, { background = true } = {}) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}">${defs}${
    background ? `<rect width="${SIZE}" height="${SIZE}" fill="url(#sky)"/>` : ""
  }${body}</svg>`;

const scene = {
  icon: svg(stars(STARS) + moon(...FULL.moon) + hill(1060) + dog(...FULL.dog)),
  // the launcher shows only the middle of the canvas, so the hill comes up to meet the dog
  adaptiveBackground: svg(stars(STARS) + hill(985)),
  foreground: svg(moon(...INNER.moon) + dog(...INNER.dog), { background: false }),
};

async function render(markup, file, { opaque = false, size = SIZE } = {}) {
  let image = sharp(Buffer.from(markup), { density: 72 }).resize(size, size);
  if (opaque) image = image.flatten({ background: SKY.top }).removeAlpha();
  await image.png().toFile(path.join(ASSETS, file));
  console.log(`wrote assets/${file} (${size}x${size}${opaque ? ", opaque" : ""})`);
}

(async () => {
  fs.writeFileSync(path.join(ASSETS, "brand", "icon-source.svg"), scene.icon);
  await render(scene.icon, "icon.png", { opaque: true });
  await render(scene.adaptiveBackground, "adaptive-icon-background.png", { opaque: true });
  await render(scene.foreground, "adaptive-icon.png");
  await render(scene.foreground, "splash-icon.png");
  await render(scene.icon, "favicon.png", { opaque: true, size: 48 });
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
