import * as THREE from "three";

let cached: THREE.Texture | null = null;

/**
 * A soft radial-gradient sprite so point particles render as glowing dots
 * instead of hard-edged squares. Only ever called from components rendered
 * inside <Canvas>, which react-three-fiber mounts client-side only, so
 * `document` is always available here.
 */
export function getGlowTexture(): THREE.Texture {
  if (cached) return cached;

  const size = 64;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const gradient = ctx.createRadialGradient(
    size / 2,
    size / 2,
    0,
    size / 2,
    size / 2,
    size / 2
  );
  gradient.addColorStop(0, "rgba(255,255,255,1)");
  gradient.addColorStop(0.4, "rgba(255,255,255,0.55)");
  gradient.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);

  cached = new THREE.CanvasTexture(canvas);
  return cached;
}
