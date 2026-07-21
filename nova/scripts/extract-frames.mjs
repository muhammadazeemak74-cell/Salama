// Extracts scroll-scrub JPEG frame sequences from public/footage/scene-N.mp4
// into public/frames/scene-N/{1440,720}/frame-%04d.jpg, plus a manifest.json
// the client reads to know how many frames each scene has.
//
// Uses the bundled @ffmpeg-installer/ffmpeg binary (no system ffmpeg needed),
// so it runs identically locally and on Vercel. Runs as part of `npm run build`
// (before `next build`) and standalone via `npm run extract:frames`.
//
// Missing footage is NOT an error: the scene is simply recorded with count 0
// and the app falls back to a static Unsplash still for that chapter.

import { existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ffmpeg from "fluent-ffmpeg";
import ffmpegInstaller from "@ffmpeg-installer/ffmpeg";

ffmpeg.setFfmpegPath(ffmpegInstaller.path);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const FOOTAGE_DIR = path.join(ROOT, "public", "footage");
const FRAMES_DIR = path.join(ROOT, "public", "frames");

const SCENES = ["scene-1", "scene-2", "scene-3", "scene-4"];
const WIDTHS = [1920, 720]; // hi / lo tiers (never upscaled past the source)
const FPS = 13; // ~12–15 fps sampling
const MAX_FRAMES = 160; // cap per scene
const QSCALE = { 1920: 3, 720: 4 }; // mjpeg quality (lower = sharper, ~q82)
const FORCE = !!process.env.NOVA_FORCE_FRAMES;

function jpgCount(dir) {
  if (!existsSync(dir)) return 0;
  return readdirSync(dir).filter((f) => f.endsWith(".jpg")).length;
}

function extract(input, outDir, width) {
  return new Promise((resolve, reject) => {
    rmSync(outDir, { recursive: true, force: true });
    mkdirSync(outDir, { recursive: true });
    ffmpeg(input)
      .outputOptions([
        "-vf",
        // Never upscale past the source width — extracting a 720p clip at 1920
        // adds bytes and softness but no detail. min(width, iw) keeps native.
        `fps=${FPS},scale=w='min(${width}\\,iw)':h=-2:flags=lanczos`,
        "-qscale:v",
        String(QSCALE[width]),
        "-frames:v",
        String(MAX_FRAMES),
      ])
      .output(path.join(outDir, "frame-%04d.jpg"))
      .on("end", () => resolve())
      .on("error", reject)
      .run();
  });
}

async function run() {
  mkdirSync(FRAMES_DIR, { recursive: true });
  const scenes = {};

  for (const scene of SCENES) {
    const input = path.join(FOOTAGE_DIR, `${scene}.mp4`);
    if (!existsSync(input)) {
      console.log(`[frames] ${scene}: no footage — will fall back to a still.`);
      scenes[scene] = { count: 0 };
      continue;
    }

    const dirHi = path.join(FRAMES_DIR, scene, String(WIDTHS[0]));
    // Local speed: skip re-extraction if frames already exist (unless forced).
    if (!FORCE && jpgCount(dirHi) > 0) {
      const count = jpgCount(dirHi);
      console.log(`[frames] ${scene}: ${count} frames already present — skipping.`);
      scenes[scene] = { count };
      continue;
    }

    let count = 0;
    try {
      for (const width of WIDTHS) {
        const outDir = path.join(FRAMES_DIR, scene, String(width));
        await extract(input, outDir, width);
        const n = jpgCount(outDir);
        if (width === WIDTHS[0]) count = n; // hi tier drives the frame count
        console.log(`[frames] ${scene} @${width}px: ${n} frames`);
      }
      scenes[scene] = { count };
    } catch (err) {
      console.warn(`[frames] ${scene}: extraction failed — falling back. ${err?.message ?? err}`);
      scenes[scene] = { count: 0 };
    }
  }

  const manifest = { fps: FPS, generatedAt: new Date().toISOString(), scenes };
  writeFileSync(path.join(FRAMES_DIR, "manifest.json"), JSON.stringify(manifest, null, 2));

  const withFootage = Object.values(scenes).filter((s) => s.count > 0).length;
  console.log(
    `[frames] manifest written — ${withFootage}/${SCENES.length} scenes have footage.`
  );
}

run().catch((err) => {
  // Never break the build over frames — the app has a graceful still fallback.
  console.warn(`[frames] extraction skipped due to error: ${err?.message ?? err}`);
  try {
    mkdirSync(FRAMES_DIR, { recursive: true });
    const scenes = Object.fromEntries(SCENES.map((s) => [s, { count: 0 }]));
    writeFileSync(
      path.join(FRAMES_DIR, "manifest.json"),
      JSON.stringify({ fps: FPS, generatedAt: new Date().toISOString(), scenes }, null, 2)
    );
  } catch {}
  process.exit(0);
});
