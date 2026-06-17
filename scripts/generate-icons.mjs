// Generates the KitchenGuard PWA app icons into /public.
// Run: node scripts/generate-icons.mjs
//
// Produces a brand-green (#16a34a) rounded-square background with a centered
// white shield-check (matching the Wordmark). Maskable variant is full-bleed
// with the mark inside the safe zone.

import sharp from "sharp";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const GREEN = "#16a34a";
const publicDir = join(dirname(fileURLToPath(import.meta.url)), "..", "public");

function iconSvg({ size, radiusFrac, iconFrac }) {
  const radius = Math.round(size * radiusFrac);
  const iconSize = size * iconFrac;
  const offset = (size - iconSize) / 2;
  const scale = iconSize / 24; // shield path uses a 0..24 viewBox
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${radius}" ry="${radius}" fill="${GREEN}"/>
  <g transform="translate(${offset} ${offset}) scale(${scale})" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/>
    <path d="m9 12 2 2 4-4"/>
  </g>
</svg>`;
}

async function png(svg, name) {
  await sharp(Buffer.from(svg)).png().toFile(join(publicDir, name));
  console.log("wrote", name);
}

await png(iconSvg({ size: 192, radiusFrac: 0.18, iconFrac: 0.62 }), "icon-192.png");
await png(iconSvg({ size: 512, radiusFrac: 0.18, iconFrac: 0.62 }), "icon-512.png");
// Maskable: no rounding (platforms apply their own mask), mark in safe zone.
await png(iconSvg({ size: 512, radiusFrac: 0, iconFrac: 0.52 }), "icon-maskable-512.png");
await png(iconSvg({ size: 180, radiusFrac: 0.18, iconFrac: 0.62 }), "apple-touch-icon.png");
