"use client";

import { useMemo } from "react";
import * as THREE from "three";

/**
 * A stylized low-poly paper plane — NOT photoreal. Nose points +Z.
 * Two-tone folded top (white / teal) with an orange underside, built as a
 * non-indexed, flat-shaded geometry so every fold reads crisply.
 */
export function usePaperPlaneGeometry() {
  return useMemo(() => {
    const N = [0, 0, 0.62]; // nose
    const T = [0, 0.03, -0.42]; // tail centre (slight upward fold)
    const L = [-0.5, 0, -0.3]; // left wing tip
    const R = [0.5, 0, -0.3]; // right wing tip
    const K = [0, -0.16, -0.34]; // underside keel ridge

    const white = [0.94, 0.97, 0.96];
    const teal = [0.184, 0.549, 0.639]; // #2F8CA3
    const orange = [0.949, 0.639, 0.235]; // #F2A33C

    // Each face: three vertices + a shared face colour.
    const faces: [number[], number[], number[], number[]][] = [
      [N, L, T, white], // top-left fold
      [N, T, R, teal], // top-right fold
      [N, K, L, orange], // underside-left
      [N, R, K, orange], // underside-right
    ];

    const positions: number[] = [];
    const colors: number[] = [];
    for (const [a, b, c, col] of faces) {
      positions.push(...a, ...b, ...c);
      colors.push(...col, ...col, ...col);
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(positions, 3)
    );
    geo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    return geo;
  }, []);
}
