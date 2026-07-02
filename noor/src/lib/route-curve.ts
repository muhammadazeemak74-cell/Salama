import * as THREE from "three";

/** Total forward distance of the light route, in world units. */
export const ROUTE_LENGTH_Z = 64;

const CONTROL_POINTS: Array<[number, number, number]> = [
  [0, 0, 0],
  [1.6, 0.9, -8],
  [-1.3, -0.4, -16],
  [2.1, 1.3, -24],
  [-1.9, 0.2, -32],
  [1.1, -0.9, -40],
  [-0.6, 1.1, -48],
  [0.9, 0.3, -56],
  [0, 0, -ROUTE_LENGTH_Z],
];

export function createRouteCurve(): THREE.CatmullRomCurve3 {
  return new THREE.CatmullRomCurve3(
    CONTROL_POINTS.map(([x, y, z]) => new THREE.Vector3(x, y, z)),
    false,
    "catmullrom",
    0.4
  );
}

const GRADIENT_STOPS = [
  new THREE.Color("#ffffff"), // luminous white core
  new THREE.Color("#b9bbbe"), // silver falloff
];

/** White -> silver falloff along the route, t in [0, 1]. */
export function routeGradientColor(
  t: number,
  out: THREE.Color = new THREE.Color()
): THREE.Color {
  const clamped = Math.min(1, Math.max(0, t));
  out.lerpColors(GRADIENT_STOPS[0], GRADIENT_STOPS[1], clamped);
  return out;
}
