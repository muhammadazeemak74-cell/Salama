import * as THREE from "three";
import type { WaypointKind } from "@/data/content";

/**
 * "La Ruta" — the single travel route that the whole page is built around.
 * A CatmullRom curve weaving down through 3D space; scroll progress (0→1)
 * draws it and flies the paper plane along it. Authored once here so the
 * dots, the plane, and the waypoints all share the exact same path.
 */
const CONTROL_POINTS: [number, number, number][] = [
  [-3.4, 5.6, -1.0],
  [2.6, 4.2, 0.8],
  [3.6, 2.6, 2.2],
  [-1.2, 1.4, 1.0],
  [-3.8, -0.2, -0.6],
  [0.4, -1.6, -1.4],
  [3.4, -2.8, 0.4],
  [1.0, -4.0, 1.8],
  [-2.6, -5.4, 0.2],
];

export const routeCurve = new THREE.CatmullRomCurve3(
  CONTROL_POINTS.map(([x, y, z]) => new THREE.Vector3(x, y, z)),
  false,
  "centripetal",
  0.5
);

export interface WaypointDef {
  t: number;
  kind: WaypointKind;
  /** Section this waypoint narrates — kept for reference / future anchoring. */
  label: string;
}

/** One waypoint per content section, ordered along the route. */
export const waypoints: WaypointDef[] = [
  { t: 0.06, kind: "arch", label: "Traslados de Aeropuerto" },
  { t: 0.22, kind: "tower", label: "Dubai City Tour" },
  { t: 0.38, kind: "dome", label: "Abu Dhabi Experience" },
  { t: 0.54, kind: "dune", label: "Desert Safari" },
  { t: 0.7, kind: "sail", label: "Yacht Experience" },
  { t: 0.84, kind: "camera", label: "Photography Experience" },
  { t: 0.95, kind: "pin", label: "Travel Concierge" },
];
