#!/usr/bin/env node
/**
 * Fallback artwork for any slot that has no photograph yet.
 *
 *   npm run images:placeholders
 *
 * This exists so the site always builds and always looks deliberate, even
 * before `npm run images` has run against Pexels. It writes a quiet warm
 * gradient at the slot's exact dimensions — no captions, no slot names, no
 * dimension labels. A placeholder that announces itself is worse than one that
 * simply reads as a colour field.
 *
 * Existing files are never overwritten unless --force is passed, so it can be
 * run at any time without touching real photography.
 *
 * DELETE THIS SCRIPT once every slot has a real photograph. It is scaffolding,
 * not part of the finished site.
 */

import { mkdir, writeFile, readFile, access } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const OUT_DIR = join(ROOT, "public", "images");
const APP_DIR = join(ROOT, "src", "app");
const BLUR_FILE = join(ROOT, "src", "content", "blur-data.ts");

const FORCE = process.argv.includes("--force");

const PALETTE = {
  bone: "#F4F1EC",
  ink: "#14110F",
  clay: "#9A7B62",
  champagne: "#D8C3A5",
  sable: "#221D1A",
};

/** Curated pairs only — the placeholders should still look like one brand. */
const GRADIENTS = [
  { from: PALETTE.champagne, to: PALETTE.clay, line: PALETTE.bone },
  { from: PALETTE.clay, to: PALETTE.sable, line: PALETTE.bone },
  { from: PALETTE.bone, to: PALETTE.champagne, line: PALETTE.sable },
  { from: PALETTE.sable, to: PALETTE.clay, line: PALETTE.champagne },
  { from: PALETTE.champagne, to: PALETTE.bone, line: PALETTE.clay },
  { from: PALETTE.ink, to: PALETTE.clay, line: PALETTE.champagne },
];

/** Stable per-slot choice so regenerating never reshuffles the set. */
function hash(value) {
  let h = 0;
  for (let i = 0; i < value.length; i += 1) h = (h * 31 + value.charCodeAt(i)) >>> 0;
  return h;
}

function placeholderSvg(slot, width, height) {
  const g = GRADIENTS[hash(slot) % GRADIENTS.length];
  const min = Math.min(width, height);
  const inset = Math.round(min * 0.045);
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
        fill="none" stroke="${g.line}" stroke-opacity="0.22" stroke-width="1"/>
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
  const body = source.slice(source.indexOf("IMAGE_MANIFEST: Record<ImageSlot, ImageSpec> = {"));
  const re = /"?([a-z0-9-]+)"?:\s*\{\s*width:\s*(\d+),\s*height:\s*(\d+),/g;
  const entries = [];
  let match;
  while ((match = re.exec(body)) !== null) {
    entries.push({ slot: match[1], width: Number(match[2]), height: Number(match[3]) });
  }
  if (entries.length === 0) throw new Error("No slots parsed from src/content/images.ts");
  return entries;
}

async function blurDataUrl(file) {
  const tiny = await sharp(await readFile(file))
    .resize(20, 20, { fit: "inside" })
    .blur(1)
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
    const file = join(OUT_DIR, `${slot}.webp`);

    if (!(await exists(file)) || FORCE) {
      await sharp(placeholderSvg(slot, width, height))
        .webp({ quality: 82 })
        .toFile(file);
      written += 1;
    } else {
      kept += 1;
    }

    const meta = await sharp(await readFile(file)).metadata();
    if (meta.width !== width || meta.height !== height) {
      console.warn(`  ! ${slot}.webp is ${meta.width}x${meta.height}, manifest expects ${width}x${height}`);
    }
    blur[slot] = await blurDataUrl(file);
  }

  const rows = Object.entries(blur)
    .map(([slot, data]) => `  "${slot}": "${data}",`)
    .join("\n");
  await writeFile(
    BLUR_FILE,
    `// GENERATED FILE — do not edit by hand.
// Run \`npm run images:blur\` to regenerate after replacing any image.
import type { ImageSlot } from "./images";

export const IMAGE_BLUR: Record<ImageSlot, string> = {
${rows}
};
`,
  );

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
    `placeholders: ${written} generated, ${kept} real images left alone, ${slots.length} blur entries written`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
