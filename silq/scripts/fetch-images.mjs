#!/usr/bin/env node
/**
 * Fetches, grades and writes every photograph the site uses.
 *
 *   npm run images              # fill any missing slots
 *   npm run images -- --force   # re-fetch and overwrite everything
 *   npm run images:blur         # no network: just refresh blur data from disk
 *
 * Requires PEXELS_API_KEY in .env.local (free, instant, from pexels.com/api).
 * The key is build-time only. It is never imported by client code, never
 * prefixed NEXT_PUBLIC_, and never reaches the browser.
 *
 * Outputs
 *   public/images/<slot>.webp     the image the site actually serves
 *   public/images/<slot>.jpg      fallback encode of the same processed pixels
 *   image-candidates.json         all 15 candidates per slot, with the pick
 *   src/content/blur-data.ts      base64 blur-up previews
 *   src/content/credits.ts        photographer attribution
 *
 * Swapping a pick without re-running the search: open image-candidates.json,
 * change that slot's "selectedIndex" to the candidate you want, then run
 * `npm run images -- --force`. The cached candidate list is reused, so no
 * search request is made and the choice is reproducible.
 */

import { mkdir, writeFile, readFile, access } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const OUT_DIR = join(ROOT, "public", "images");
const BLUR_FILE = join(ROOT, "src", "content", "blur-data.ts");
const CREDITS_FILE = join(ROOT, "src", "content", "credits.ts");
const CANDIDATES_FILE = join(ROOT, "image-candidates.json");

const FORCE = process.argv.includes("--force");
const BLUR_ONLY = process.argv.includes("--blur-only");

const API_BASE = process.env.PEXELS_API_BASE ?? "https://api.pexels.com/v1";
const PER_PAGE = 15;
const RATE_LIMIT_MS = 250;

/** The unifying grade. Every slot gets it, so 21 sources read as one shoot. */
const GRADE = { saturation: 0.82, brightness: 1.02 };
/** Bone wash, composited at low alpha. Warms the shadows, kills stock glare. */
const TINT = { r: 244, g: 241, b: 236, alpha: 0.06 };

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

/** Minimal .env.local reader — avoids a dependency for one variable. */
async function loadEnvLocal() {
  const file = join(ROOT, ".env.local");
  if (!(await exists(file))) return;
  const text = await readFile(file, "utf8");
  for (const line of text.split("\n")) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!match) continue;
    const value = match[2].replace(/^["']|["']$/g, "");
    if (!process.env[match[1]]) process.env[match[1]] = value;
  }
}

/**
 * Parses the manifest straight out of the TypeScript source. Keeps one
 * definition of the slots rather than a second copy that can drift.
 */
async function readManifest() {
  const source = await readFile(join(ROOT, "src", "content", "images.ts"), "utf8");
  const body = source.slice(source.indexOf("IMAGE_MANIFEST: Record<ImageSlot, ImageSpec> = {"));
  const re =
    /"?([a-z0-9-]+)"?:\s*\{\s*width:\s*(\d+),\s*height:\s*(\d+),\s*orientation:\s*"(landscape|portrait)",\s*query:\s*"([^"]*)",(?:\s*derivedFrom:\s*"([a-z0-9-]+)",)?/g;
  const slots = [];
  let match;
  while ((match = re.exec(body)) !== null) {
    slots.push({
      slot: match[1],
      width: Number(match[2]),
      height: Number(match[3]),
      orientation: match[4],
      query: match[5],
      derivedFrom: match[6] ?? null,
    });
  }
  if (slots.length === 0) throw new Error("No slots parsed from src/content/images.ts");
  return slots;
}

// ---------------------------------------------------------------------------
// Candidate scoring
// ---------------------------------------------------------------------------

function hexToHsl(hex) {
  const clean = hex.replace("#", "");
  const r = parseInt(clean.slice(0, 2), 16) / 255;
  const g = parseInt(clean.slice(2, 4), 16) / 255;
  const b = parseInt(clean.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return { h: 0, s: 0, l };
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) * 60;
  else if (max === g) h = ((b - r) / d + 2) * 60;
  else h = ((r - g) / d + 4) * 60;
  return { h, s, l };
}

/**
 * Rejects anything whose dominant colour will fight the bone/clay palette.
 *
 * Near-neutral images pass whatever their hue — a grey-beige interior reads as
 * warm once graded. It is only *saturated* green, cyan, blue and violet that
 * are unrecoverable, so saturation gates the hue test.
 */
const COOL_HUE_START = 75;
const COOL_HUE_END = 330;
const NEUTRAL_SATURATION = 0.12;

function scoreCandidate(photo, minWidth = 0, minHeight = 0) {
  // avg_color is nullable in the Pexels schema; a mid grey scores as neutral.
  const { h, s, l } = hexToHsl(photo.avg_color ?? "#808080");

  const isCool = s > NEUTRAL_SATURATION && h >= COOL_HUE_START && h < COOL_HUE_END;
  if (isCool) return { score: -1, rejected: true, reason: `cool cast (h=${Math.round(h)})` };

  // Very dark or blown-out frames lose the grade and print badly behind text.
  if (l < 0.12) return { score: -1, rejected: true, reason: "too dark" };
  if (l > 0.94) return { score: -1, rejected: true, reason: "blown out" };

  // Distance from the palette's own hue band (bronze/beige, ~20–45°).
  const target = 32;
  const hueDistance = s <= NEUTRAL_SATURATION ? 0 : Math.min(Math.abs(h - target), 360 - Math.abs(h - target));
  const warmth = Math.max(0, 1 - hueDistance / 90);

  // Resolution headroom, so the crop to target size never upscales.
  const resolution = Math.min((photo.width ?? 0) / 4000, 1);

  // Anything smaller than the slot has to be enlarged, which reads as cheap
  // stock however good the framing. Heavily penalised rather than rejected, so
  // a slot where every candidate is small still gets its best option.
  const undersized = (photo.width ?? 0) < minWidth || (photo.height ?? 0) < minHeight;

  return {
    score: warmth * 100 + resolution * 25 - (undersized ? 60 : 0),
    rejected: false,
    reason: null,
    undersized,
  };
}

// ---------------------------------------------------------------------------
// Pexels
// ---------------------------------------------------------------------------

async function search(query, orientation, apiKey) {
  const url = new URL(`${API_BASE}/search`);
  url.searchParams.set("query", query);
  url.searchParams.set("orientation", orientation);
  url.searchParams.set("size", "large");
  url.searchParams.set("per_page", String(PER_PAGE));

  const response = await fetch(url, { headers: { Authorization: apiKey } });
  if (!response.ok) {
    throw new Error(`Pexels search failed (${response.status} ${response.statusText}) for "${query}"`);
  }
  const data = await response.json();
  // Pexels reports quota and key problems in an `error` field, sometimes with
  // a 200. Surface it rather than letting it degrade into "no candidates".
  if (data.error) throw new Error(`Pexels: ${data.error}`);
  return data.photos ?? [];
}

async function download(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Download failed (${response.status}) for ${url}`);
  return Buffer.from(await response.arrayBuffer());
}

// ---------------------------------------------------------------------------
// Processing
// ---------------------------------------------------------------------------

/**
 * Crops to the slot's exact dimensions and applies the house grade.
 * Returns raw processed pixels so both encodes come from identical input.
 */
async function processImage(buffer, width, height) {
  const tint = await sharp({
    create: { width, height, channels: 4, background: TINT },
  })
    .png()
    .toBuffer();

  return sharp(buffer)
    .rotate()
    .resize(width, height, { fit: "cover", position: "attention" })
    .modulate(GRADE)
    .composite([{ input: tint, blend: "over" }])
    .toBuffer();
}

async function writeEncodes(processed, slot) {
  await sharp(processed).webp({ quality: 82 }).toFile(join(OUT_DIR, `${slot}.webp`));
  await sharp(processed).jpeg({ quality: 82, mozjpeg: true }).toFile(join(OUT_DIR, `${slot}.jpg`));
}

async function blurDataUrl(file) {
  const tiny = await sharp(await readFile(file))
    .resize(20, 20, { fit: "inside" })
    .blur(1)
    .jpeg({ quality: 45 })
    .toBuffer();
  return `data:image/jpeg;base64,${tiny.toString("base64")}`;
}

// ---------------------------------------------------------------------------
// Emit
// ---------------------------------------------------------------------------

async function writeBlurData(slots) {
  const entries = [];
  const missing = [];
  for (const { slot } of slots) {
    const file = join(OUT_DIR, `${slot}.webp`);
    if (!(await exists(file))) {
      missing.push(slot);
      continue;
    }
    entries.push(`  "${slot}": "${await blurDataUrl(file)}",`);
  }
  await writeFile(
    BLUR_FILE,
    `// GENERATED FILE — do not edit by hand.
// Run \`npm run images:blur\` to regenerate after replacing any image.
import type { ImageSlot } from "./images";

export const IMAGE_BLUR: Record<ImageSlot, string> = {
${entries.join("\n")}
};
`,
  );
  return missing;
}

async function writeCredits(credits) {
  const rows = Object.entries(credits)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(
      ([slot, c]) =>
        `  "${slot}": {\n    photographer: ${JSON.stringify(c.photographer)},\n    photographerUrl: ${JSON.stringify(c.photographerUrl)},\n    photoUrl: ${JSON.stringify(c.photoUrl)},\n  },`,
    )
    .join("\n");

  await writeFile(
    CREDITS_FILE,
    `// GENERATED FILE — do not edit by hand.
// Written by scripts/fetch-images.mjs. Powers the /credits page.
import type { ImageSlot } from "./images";

export type PhotoCredit = {
  photographer: string;
  photographerUrl: string;
  photoUrl: string;
};

/**
 * Pexels does not require attribution but asks for it, so every photograph
 * still in use is credited on /credits.
 */
export const PHOTO_CREDITS: Partial<Record<ImageSlot, PhotoCredit>> = {
${rows}
};
`,
  );
}

// ---------------------------------------------------------------------------

async function main() {
  await loadEnvLocal();
  await mkdir(OUT_DIR, { recursive: true });
  const slots = await readManifest();

  if (BLUR_ONLY) {
    const missing = await writeBlurData(slots);
    console.log(
      `blur data written for ${slots.length - missing.length}/${slots.length} slots` +
        (missing.length ? ` (missing: ${missing.join(", ")})` : ""),
    );
    return;
  }

  const apiKey = process.env.PEXELS_API_KEY;
  if (!apiKey) {
    console.error(
      [
        "PEXELS_API_KEY is not set.",
        "",
        "  1. Get a free key (instant) at https://www.pexels.com/api/",
        "  2. Create silq/.env.local containing:",
        "       PEXELS_API_KEY=your_key_here",
        "  3. Re-run: npm run images",
        "",
        ".env.local is gitignored. The key is build-time only and never ships to the browser.",
      ].join("\n"),
    );
    process.exit(1);
  }

  const cached = (await exists(CANDIDATES_FILE))
    ? JSON.parse(await readFile(CANDIDATES_FILE, "utf8"))
    : {};
  const candidatesOut = {};
  const credits = {};
  const originals = new Map();
  const failures = [];

  // ---- Slots that are searched -------------------------------------------
  for (const spec of slots.filter((s) => s.query)) {
    const { slot, width, height, orientation, query } = spec;
    const target = join(OUT_DIR, `${slot}.webp`);

    if ((await exists(target)) && !FORCE) {
      console.log(`  · ${slot} — exists, skipped`);
      if (cached[slot]) {
        candidatesOut[slot] = cached[slot];
        const pick = cached[slot].candidates?.[cached[slot].selectedIndex ?? 0];
        if (pick) credits[slot] = pick;
      }
      continue;
    }

    try {
      let entry = cached[slot];
      // Reuse the cached candidate list so a hand-edited selectedIndex is
      // honoured without spending a search request on it.
      if (!entry?.candidates?.length) {
        const photos = await search(query, orientation, apiKey);
        await sleep(RATE_LIMIT_MS);
        entry = {
          query,
          selectedIndex: 0,
          candidates: photos.map((photo) => {
            const { score, rejected, reason, undersized } = scoreCandidate(photo, width, height);
            return {
              id: photo.id,
              width: photo.width,
              height: photo.height,
              avgColor: photo.avg_color,
              score: Math.round(score * 10) / 10,
              rejected,
              rejectedReason: reason,
              undersized: Boolean(undersized),
              photographer: photo.photographer,
              photographerUrl: photo.photographer_url,
              photoUrl: photo.url,
              original: photo.src?.original,
            };
          }),
        };
        // Rank accepted candidates first, best score at index 0, so the
        // default pick is index 0 and a human swap is a small number.
        entry.candidates.sort((a, b) => Number(a.rejected) - Number(b.rejected) || b.score - a.score);
      }

      const index = entry.selectedIndex ?? 0;
      const pick = entry.candidates[index];
      if (!pick) throw new Error("no candidates returned");
      if (pick.rejected) {
        console.warn(`  ! ${slot} — selected candidate is flagged: ${pick.rejectedReason}`);
      }
      if (pick.undersized) {
        console.warn(
          `  ! ${slot} — source is ${pick.width}×${pick.height}, smaller than the ${width}×${height} slot; it will be enlarged`,
        );
      }

      const buffer = await download(pick.original);
      await sleep(RATE_LIMIT_MS);
      originals.set(slot, buffer);

      await writeEncodes(await processImage(buffer, width, height), slot);

      entry.selectedIndex = index;
      candidatesOut[slot] = entry;
      credits[slot] = pick;

      const accepted = entry.candidates.filter((c) => !c.rejected).length;
      console.log(`  ✓ ${slot} — ${width}×${height} (${accepted}/${entry.candidates.length} passed the colour gate)`);
    } catch (error) {
      failures.push(`${slot}: ${error.message}`);
      console.error(`  ✗ ${slot} — ${error.message}`);
      if (cached[slot]) candidatesOut[slot] = cached[slot];
    }
  }

  // ---- Slots derived from another slot (the OG card) ----------------------
  for (const spec of slots.filter((s) => s.derivedFrom)) {
    const { slot, width, height, derivedFrom } = spec;
    const target = join(OUT_DIR, `${slot}.webp`);
    if ((await exists(target)) && !FORCE) {
      console.log(`  · ${slot} — exists, skipped`);
      if (credits[derivedFrom]) credits[slot] = credits[derivedFrom];
      continue;
    }

    // Prefer the untouched original; fall back to the already-graded file so
    // this still works when the source slot was skipped by the cache.
    const source = originals.get(derivedFrom) ?? (await exists(join(OUT_DIR, `${derivedFrom}.webp`)) ? await readFile(join(OUT_DIR, `${derivedFrom}.webp`)) : null);
    if (!source) {
      failures.push(`${slot}: source slot ${derivedFrom} is not available`);
      console.error(`  ✗ ${slot} — source slot ${derivedFrom} is not available`);
      continue;
    }

    await writeEncodes(await processImage(source, width, height), slot);
    if (credits[derivedFrom]) credits[slot] = credits[derivedFrom];
    console.log(`  ✓ ${slot} — ${width}×${height} (cropped from ${derivedFrom})`);
  }

  // ---- Emit ---------------------------------------------------------------
  await writeFile(CANDIDATES_FILE, `${JSON.stringify(candidatesOut, null, 2)}\n`);
  await writeCredits(credits);
  const missing = await writeBlurData(slots);

  console.log(
    `\nimages: ${Object.keys(credits).length} credited, ${slots.length - missing.length}/${slots.length} slots on disk`,
  );
  if (missing.length) console.warn(`missing: ${missing.join(", ")}`);
  if (failures.length) {
    console.error(`\n${failures.length} slot(s) failed:\n  ${failures.join("\n  ")}`);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
