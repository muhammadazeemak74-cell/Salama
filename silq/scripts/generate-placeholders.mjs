#!/usr/bin/env node
/**
 * Generates a gradient placeholder for every slot in the image manifest, at the
 * exact dimensions the manifest declares, so the site builds and reads as
 * intentional before any real photography exists.
 *
 * It also writes src/content/image-blur.ts — the base64 blur-up data URLs that
 * next/image uses. Re-run this after dropping in real photos so the blur data
 * matches the new files:
 *
 *   npm run placeholders
 *
 * Existing files are left alone unless --force is passed, so real photography is
 * never overwritten by a placeholder.
 */

import { mkdir, writeFile, readFile, access } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const OUT_DIR = join(ROOT, "public", "images");
const APP_DIR = join(ROOT, "src", "app");
const BLUR_FILE = join(ROOT, "src", "content", "image-blur.ts");

const FORCE = process.argv.includes("--force");

const PALETTE = {
  bone: "#F4F1EC",
  ink: "#14110F",
  clay: "#9A7B62",
  champagne: "#D8C3A5",
  ash: "#6E6862",
  sable: "#221D1A",
};

/** Curated pairs only — the placeholders should still look like one brand. */
const GRADIENTS = [
  { from: PALETTE.champagne, to: PALETTE.clay, ink: PALETTE.bone },
  { from: PALETTE.clay, to: PALETTE.sable, ink: PALETTE.bone },
  { from: PALETTE.bone, to: PALETTE.champagne, ink: PALETTE.sable },
  { from: PALETTE.sable, to: PALETTE.clay, ink: PALETTE.champagne },
  { from: PALETTE.champagne, to: PALETTE.bone, ink: PALETTE.clay },
  { from: PALETTE.ink, to: PALETTE.clay, ink: PALETTE.champagne },
];

/** Stable per-slot choice so regenerating never reshuffles the set. */
function hash(value) {
  let h = 0;
  for (let i = 0; i < value.length; i += 1) {
    h = (h * 31 + value.charCodeAt(i)) >>> 0;
  }
  return h;
}

function escapeXml(value) {
  return value.replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" })[c]);
}

function placeholderSvg(slot, width, height) {
  const g = GRADIENTS[hash(slot) % GRADIENTS.length];
  const min = Math.min(width, height);
  const label = Math.max(11, Math.round(min * 0.026));
  const meta = Math.max(9, Math.round(min * 0.016));
  const mark = Math.max(10, Math.round(min * 0.019));
  const inset = Math.round(min * 0.045);
  // Bloom sits off-centre so the flat colour never reads as a broken image.
  const bloomX = width * 0.68;
  const bloomY = height * 0.28;
  const bloomR = min * 0.75;

  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <linearGradient id="base" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${g.from}"/>
      <stop offset="100%" stop-color="${g.to}"/>
    </linearGradient>
    <radialGradient id="bloom" cx="${bloomX}" cy="${bloomY}" r="${bloomR}" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="${PALETTE.bone}" stop-opacity="0.30"/>
      <stop offset="100%" stop-color="${PALETTE.bone}" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="${width}" height="${height}" fill="url(#base)"/>
  <rect width="${width}" height="${height}" fill="url(#bloom)"/>
  <rect x="${inset}" y="${inset}" width="${width - inset * 2}" height="${height - inset * 2}"
        fill="none" stroke="${g.ink}" stroke-opacity="0.28" stroke-width="1"/>
  <text x="${inset * 1.6}" y="${inset * 2.1}" fill="${g.ink}" fill-opacity="0.72"
        font-family="Georgia, 'DejaVu Serif', serif" font-size="${mark}" letter-spacing="${mark * 0.42}">SILQ</text>
  <text x="50%" y="50%" text-anchor="middle" fill="${g.ink}" fill-opacity="0.85"
        font-family="'DejaVu Sans', Helvetica, sans-serif" font-size="${label}"
        letter-spacing="${label * 0.28}">${escapeXml(slot.toUpperCase())}</text>
  <text x="50%" y="${height / 2 + label * 2.4}" text-anchor="middle" fill="${g.ink}" fill-opacity="0.5"
        font-family="'DejaVu Sans', Helvetica, sans-serif" font-size="${meta}"
        letter-spacing="${meta * 0.24}">${width} &#215; ${height}</text>
</svg>`);
}

function iconSvg(size) {
  const r = size / 2;
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${PALETTE.sable}"/>
      <stop offset="100%" stop-color="${PALETTE.ink}"/>
    </linearGradient>
  </defs>
  <rect width="${size}" height="${size}" fill="url(#g)"/>
  <text x="${r}" y="${r}" text-anchor="middle" dominant-baseline="central"
        fill="${PALETTE.champagne}" font-family="Georgia, 'DejaVu Serif', serif"
        font-size="${size * 0.58}" font-weight="300">S</text>
</svg>`);
}

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

/** Reads the manifest out of the TypeScript source without needing a compiler. */
async function readManifest() {
  const source = await readFile(join(ROOT, "src", "content", "images.ts"), "utf8");
  const body = source.slice(
    source.indexOf("IMAGE_MANIFEST: Record<ImageSlot, ImageSpec> = {"),
  );
  const entries = [];
  // Keys are quoted only when they contain a hyphen, so both forms must match.
  const re = /"?([a-z0-9-]+)"?:\s*\{\s*width:\s*(\d+),\s*height:\s*(\d+),/g;
  let match;
  while ((match = re.exec(body)) !== null) {
    entries.push({ slot: match[1], width: Number(match[2]), height: Number(match[3]) });
  }
  if (entries.length === 0) {
    throw new Error("No slots parsed from src/content/images.ts");
  }
  return entries;
}

async function blurDataUrl(buffer) {
  const tiny = await sharp(buffer)
    .resize(16, 16, { fit: "inside" })
    .jpeg({ quality: 45 })
    .toBuffer();
  return `data:image/jpeg;base64,${tiny.toString("base64")}`;
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  const slots = await readManifest();
  const blur = {};
  let written = 0;
  let kept = 0;

  for (const { slot, width, height } of slots) {
    const file = join(OUT_DIR, `${slot}.jpg`);
    const already = await exists(file);

    if (!already || FORCE) {
      const buffer = await sharp(placeholderSvg(slot, width, height))
        .jpeg({ quality: 82, mozjpeg: true })
        .toBuffer();
      await writeFile(file, buffer);
      written += 1;
    } else {
      kept += 1;
    }

    const current = await readFile(file);
    const meta = await sharp(current).metadata();
    if (meta.width !== width || meta.height !== height) {
      console.warn(
        `  ! ${slot}.jpg is ${meta.width}x${meta.height}, manifest expects ${width}x${height}`,
      );
    }
    blur[slot] = await blurDataUrl(current);
  }

  const header = `// GENERATED FILE — do not edit by hand.
// Run \`npm run placeholders\` to regenerate after changing any image.
import type { ImageSlot } from "./images";

export const IMAGE_BLUR: Record<ImageSlot, string> = {
`;
  const rows = Object.entries(blur)
    .map(([slot, data]) => `  "${slot}": "${data}",`)
    .join("\n");
  await writeFile(BLUR_FILE, `${header}${rows}\n};\n`);

  for (const [name, size] of [
    ["icon.png", 512],
    ["apple-icon.png", 180],
  ]) {
    const target = join(APP_DIR, name);
    if (!(await exists(target)) || FORCE) {
      await sharp(iconSvg(size)).png().toFile(target);
    }
  }

  console.log(
    `placeholders: ${written} generated, ${kept} existing kept, ${slots.length} blur entries written`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
