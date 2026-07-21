"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef, type MutableRefObject } from "react";
import * as THREE from "three";
import {
  LANDMARKS,
  makeGlowTexture,
  sampleWindows,
  windowNight,
  type TowerSpec,
} from "./skyline";

/**
 * Warm-orange window dots across the towers and the tall landmarks, drawn as a
 * single points cloud. They fade on as dusk arrives (windowNight), so the city
 * "lights up" toward the footer.
 */
export function Windows({
  towers,
  progress,
}: {
  towers: TowerSpec[];
  progress: MutableRefObject<number>;
}) {
  const matRef = useRef<THREE.PointsMaterial>(null);
  const glow = useMemo(() => makeGlowTexture(), []);

  const geometry = useMemo(() => {
    const out: number[] = [];
    for (const t of towers) {
      sampleWindows(out, t.x, 0, t.z, t.w, t.h, t.d / 2 + 0.03);
    }
    // Tall landmarks that read as occupied towers.
    const burj = LANDMARKS.find((l) => l.kind === "burjKhalifa");
    if (burj) sampleWindows(out, burj.x, 0, burj.z, 2.0, 19, 1.35, 0.95);
    const emirates = LANDMARKS.find((l) => l.kind === "emiratesTowers");
    if (emirates) {
      sampleWindows(out, emirates.x - 1.9, 0, emirates.z, 1.7, 10, 0.95, 0.8);
      sampleWindows(out, emirates.x + 1.9, 0, emirates.z, 1.5, 8.5, 0.85, 0.8);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(out, 3));
    return g;
  }, [towers]);

  useFrame(() => {
    if (matRef.current) {
      matRef.current.opacity = windowNight(progress.current);
    }
  });

  return (
    <points geometry={geometry} frustumCulled={false}>
      <pointsMaterial
        ref={matRef}
        map={glow}
        color="#ffb257"
        size={0.42}
        sizeAttenuation
        transparent
        opacity={0}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        toneMapped={false}
      />
    </points>
  );
}
