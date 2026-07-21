import * as THREE from "three";

/**
 * Shared building blocks for the low-poly Dubai skyline background.
 * Strictly brand palette: navy silhouettes shading up into teal, warm-orange
 * emissive windows, a soft orange sun. No textures, flat-shaded geometry only.
 */

export const NAVY = new THREE.Color("#14304a");
export const TEAL = new THREE.Color("#2f8ca3");
export const ORANGE = new THREE.Color("#f2a33c");

/** Tallest structure in the city (Burj Khalifa), used to normalise gradients. */
export const CITY_MAX_H = 24;

/**
 * Paint per-vertex colours on a geometry so it fades navy (base) → teal (top),
 * keyed to absolute world height. `baseY` is the mesh's world y so stacked
 * pieces share one continuous city-wide gradient.
 */
export function paintHeightGradient(
  geo: THREE.BufferGeometry,
  baseY = 0,
  maxH = CITY_MAX_H
) {
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const worldY = baseY + pos.getY(i);
    const t = THREE.MathUtils.clamp(worldY / maxH, 0, 1);
    // Ease so the teal only creeps in near the top — keeps silhouettes deep.
    c.copy(NAVY).lerp(TEAL, Math.pow(t, 0.85));
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }
  geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  return geo;
}

interface Stop {
  at: number;
  z: string;
  h: string;
}

const SKY_STOPS: Stop[] = [
  { at: 0.0, z: "#e8f0f0", h: "#fdf0dc" }, // bright warm day
  { at: 0.55, z: "#f4ddc2", h: "#f8bd76" }, // golden hour
  { at: 1.0, z: "#cfd4dc", h: "#f2b481" }, // early dusk (kept light + readable)
];

const _z = new THREE.Color();
const _h = new THREE.Color();
const _za = new THREE.Color();
const _zb = new THREE.Color();
const _ha = new THREE.Color();
const _hb = new THREE.Color();

/** Zenith + horizon sky colours for a scroll progress p (0→1). Mutates+returns. */
export function skyPalette(p: number, zenith = _z, horizon = _h) {
  const t = THREE.MathUtils.clamp(p, 0, 1);
  let a = SKY_STOPS[0];
  let b = SKY_STOPS[SKY_STOPS.length - 1];
  for (let i = 0; i < SKY_STOPS.length - 1; i++) {
    if (t >= SKY_STOPS[i].at && t <= SKY_STOPS[i + 1].at) {
      a = SKY_STOPS[i];
      b = SKY_STOPS[i + 1];
      break;
    }
  }
  const local = (t - a.at) / Math.max(1e-6, b.at - a.at);
  zenith.copy(_za.set(a.z)).lerp(_zb.set(b.z), local);
  horizon.copy(_ha.set(a.h)).lerp(_hb.set(b.h), local);
  return { zenith, horizon };
}

const _sun = new THREE.Color();
/** Sun disc colour: bright pale gold by day → deep burnt orange at dusk. */
export function sunColor(p: number, out = _sun) {
  return out.copy(_za.set("#ffdca2")).lerp(_zb.set("#f0722a"), THREE.MathUtils.clamp(p, 0, 1));
}

/** How lit the windows are (0 by day → 1 at dusk). */
export function windowNight(p: number) {
  return THREE.MathUtils.smoothstep(p, 0.42, 0.92);
}

/** Soft round glow sprite (white) — tinted per material for windows / sun. */
export function makeGlowTexture(): THREE.Texture {
  const size = 64;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const g = ctx.createRadialGradient(
    size / 2,
    size / 2,
    0,
    size / 2,
    size / 2,
    size / 2
  );
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.35, "rgba(255,255,255,0.85)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

/** Tiny seeded PRNG so the generic tower field is identical every render. */
function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface TowerSpec {
  x: number;
  z: number;
  w: number;
  d: number;
  h: number;
}

/**
 * Deterministic field of generic Marina towers filling the skyline for depth.
 * Spread across X with a mix of near (fast parallax) and far (slow) rows.
 */
export function makeTowers(count: number): TowerSpec[] {
  const rand = mulberry32(20240721);
  const towers: TowerSpec[] = [];
  for (let i = 0; i < count; i++) {
    // Near foreground towers are kept to the centre/right so the left of the
    // frame — where every section's text sits — stays open sky. The far
    // backdrop row spans the whole width for an unbroken silhouette.
    const near = rand() > 0.5;
    const x = near ? -6 + rand() * 36 : -30 + rand() * 60;
    const z = near ? -8 - rand() * 4 : -15 - rand() * 11;
    const h = near ? 3 + rand() * 4 : 5 + rand() * 8;
    const w = 1.3 + rand() * 1.3;
    const d = 1.3 + rand() * 1.3;
    towers.push({ x, z, w, d, h });
  }
  return towers;
}

export type LandmarkKind =
  | "burjKhalifa"
  | "emiratesTowers"
  | "museumFuture"
  | "dubaiFrame"
  | "burjAlArab"
  | "ainDubai";

export interface LandmarkSpec {
  kind: LandmarkKind;
  x: number;
  z: number;
}

/**
 * Named landmarks placed left→right along the route so that, as the camera
 * dollies across, roughly one drifts through view per content section.
 */
export const LANDMARKS: LandmarkSpec[] = [
  { kind: "burjKhalifa", x: -8, z: -15 },
  { kind: "emiratesTowers", x: -1, z: -12 },
  { kind: "museumFuture", x: 5, z: -9.5 },
  { kind: "dubaiFrame", x: 10, z: -13 },
  { kind: "burjAlArab", x: 15, z: -7.5 },
  { kind: "ainDubai", x: 21, z: -11 },
];

/**
 * Sample window-dot positions on the +Z (camera-facing) face of a box tower.
 * Returned in the tower's local/world space given its base transform.
 */
export function sampleWindows(
  out: number[],
  cx: number,
  baseY: number,
  cz: number,
  w: number,
  h: number,
  frontZ: number,
  step = 0.7
) {
  const cols = Math.max(2, Math.floor(w / step));
  const rows = Math.max(3, Math.floor(h / step));
  const x0 = cx - w / 2 + w / (cols * 2);
  for (let r = 0; r < rows; r++) {
    const y = baseY + 0.6 + (r / rows) * (h - 0.8);
    for (let cIdx = 0; cIdx < cols; cIdx++) {
      const x = x0 + (cIdx / Math.max(1, cols - 1)) * (w - w / cols);
      // Sparse: skip ~35% of windows for a less regular, more real look.
      if (((r * 31 + cIdx * 17) % 100) / 100 < 0.35) continue;
      out.push(x, y, cz + frontZ);
    }
  }
}
