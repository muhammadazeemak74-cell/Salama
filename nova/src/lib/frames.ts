import "server-only";
import { readFileSync } from "node:fs";
import path from "node:path";

interface Manifest {
  fps: number;
  scenes: Record<string, { count: number }>;
}

/**
 * Reads the frame manifest written by scripts/extract-frames.mjs (which runs
 * before `next build`). Returns a scene→frameCount map used at render time to
 * decide scrub-vs-fallback per chapter. If footage/frames are absent the map is
 * empty and every chapter falls back to a static Unsplash still.
 */
export function getFrameCounts(): Record<string, number> {
  try {
    const p = path.join(process.cwd(), "public", "frames", "manifest.json");
    const manifest = JSON.parse(readFileSync(p, "utf8")) as Manifest;
    const out: Record<string, number> = {};
    for (const [scene, v] of Object.entries(manifest.scenes ?? {})) {
      out[scene] = v?.count ?? 0;
    }
    return out;
  } catch {
    return {};
  }
}
