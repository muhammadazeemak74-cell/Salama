#!/usr/bin/env node
/**
 * Runs before `next build` and before `next dev`. Makes sure every image slot
 * has a file on disk, whatever the environment.
 *
 *   PEXELS_API_KEY set   → fetch real photography, then fill any gaps
 *   PEXELS_API_KEY unset → gradient placeholders only
 *
 * The fetch is allowed to fail. A deploy that ships with a gradient in one slot
 * is a far better outcome than a deploy that does not happen because Pexels was
 * rate-limiting, so a failed fetch is logged loudly and the build continues.
 *
 * Both child scripts skip slots that already have a file, so this is cheap on
 * repeat runs and never overwrites real photography.
 */

import { spawn } from "node:child_process";
import { dirname, extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { access, mkdir, readdir, readFile } from "node:fs/promises";
import sharp from "sharp";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const PHOTOS_DIR = join(ROOT, "photos");
const OUT_DIR = join(ROOT, "public", "images");

function run(script, args = []) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [join(__dirname, script), ...args], {
      cwd: ROOT,
      stdio: "inherit",
    });
    child.on("close", (code) => resolve(code ?? 1));
    child.on("error", () => resolve(1));
  });
}

async function hasKey() {
  if (process.env.PEXELS_API_KEY) return true;
  try {
    await access(join(ROOT, ".env.local"));
    const text = await readFile(join(ROOT, ".env.local"), "utf8");
    return /^\s*PEXELS_API_KEY\s*=\s*\S/m.test(text);
  } catch {
    return false;
  }
}

/**
 * Your own photographs win over anything fetched.
 *
 * public/images/ is build output, so it is not somewhere a real photograph can
 * live. photos/ is committed instead: drop <slot>.jpg (or .png/.webp) in there
 * and it is converted to the slot's exact dimensions before the fetch runs,
 * which then skips that slot because a file already exists.
 *
 * Deliberately no colour grade here. The grade exists to make unrelated stock
 * photographs look like one shoot; real client work does not need rescuing,
 * and quietly restyling someone's before/after would misrepresent the result.
 */
async function ingestOwnPhotos() {
  let files;
  try {
    files = await readdir(PHOTOS_DIR);
  } catch {
    return 0;
  }

  const source = await readFile(join(ROOT, "src", "content", "images.ts"), "utf8");
  const body = source.slice(source.indexOf("IMAGE_MANIFEST: Record<ImageSlot, ImageSpec> = {"));
  const dims = new Map();
  const re = /"?([a-z0-9-]+)"?:\s*\{\s*width:\s*(\d+),\s*height:\s*(\d+),/g;
  let match;
  while ((match = re.exec(body)) !== null) {
    dims.set(match[1], { width: Number(match[2]), height: Number(match[3]) });
  }

  await mkdir(OUT_DIR, { recursive: true });
  let count = 0;

  for (const file of files) {
    const ext = extname(file).toLowerCase();
    if (![".jpg", ".jpeg", ".png", ".webp", ".avif", ".tif", ".tiff"].includes(ext)) continue;
    const slot = file.slice(0, -ext.length);
    const size = dims.get(slot);
    if (!size) {
      console.warn(`images: photos/${file} does not match any slot — ignored`);
      continue;
    }
    const processed = await sharp(join(PHOTOS_DIR, file))
      .rotate()
      .resize(size.width, size.height, { fit: "cover", position: "attention" })
      .toBuffer();
    await sharp(processed).webp({ quality: 82 }).toFile(join(OUT_DIR, `${slot}.webp`));
    await sharp(processed).jpeg({ quality: 82, mozjpeg: true }).toFile(join(OUT_DIR, `${slot}.jpg`));
    count += 1;
  }

  if (count) console.log(`images: ${count} of your own photograph(s) used from photos/`);
  return count;
}

await ingestOwnPhotos();

const key = await hasKey();

if (key) {
  console.log("images: PEXELS_API_KEY found — fetching photography");
  const code = await run("fetch-images.mjs");
  if (code !== 0) {
    console.warn(
      "images: fetch did not complete cleanly. Falling back to placeholders for any slot it did not fill — the build continues.",
    );
  }
} else {
  console.log(
    "images: no PEXELS_API_KEY — using gradient placeholders. Set the key in Vercel (or .env.local) to ship photography.",
  );
}

// Always run last: fills whatever is still missing, and never touches a slot
// that already has a file.
const placeholders = await run("generate-placeholders.mjs");
if (placeholders !== 0) {
  console.error("images: placeholder generation failed — the build cannot continue without image files");
  process.exit(1);
}
