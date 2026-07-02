"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useScrollProgressRef } from "@/lib/scroll-provider";
import { getGlowTexture } from "@/lib/particle-texture";
import { createSeededRandom } from "@/lib/seeded-random";

interface SkylineParticlesProps {
  endZ: number;
  reduced: boolean;
}

/** A faint particle skyline that resolves into view as the route nears its end. */
export function SkylineParticles({ endZ, reduced }: SkylineParticlesProps) {
  const materialRef = useRef<THREE.PointsMaterial>(null);
  const progressRef = useScrollProgressRef();

  const geometry = useMemo(() => {
    const buildings = 22;
    const pointsPerBuilding = 8;
    const count = buildings * pointsPerBuilding;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const warm = new THREE.Color("#ffcb94");
    const cool = new THREE.Color("#9ff0f7");
    let i = 0;
    const random = createSeededRandom(buildings * 104729 + pointsPerBuilding);

    for (let b = 0; b < buildings; b++) {
      const x = (b / (buildings - 1) - 0.5) * 18;
      const height = 0.6 + random() * 3.4;
      const z = endZ - random() * 6;
      for (let p = 0; p < pointsPerBuilding; p++) {
        const y = (p / (pointsPerBuilding - 1)) * height - 1.4;
        positions[i * 3] = x + (random() - 0.5) * 0.3;
        positions[i * 3 + 1] = y;
        positions[i * 3 + 2] = z + (random() - 0.5) * 1.5;
        const c = random() > 0.6 ? warm : cool;
        colors[i * 3] = c.r;
        colors[i * 3 + 1] = c.g;
        colors[i * 3 + 2] = c.b;
        i++;
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    return geo;
  }, [endZ]);

  useFrame(() => {
    const material = materialRef.current;
    if (!material) return;
    if (reduced) {
      material.opacity = 0.5;
      return;
    }
    const progress = progressRef.current;
    material.opacity = Math.max(0, Math.min(1, (progress - 0.55) / 0.4));
  });

  const glowTexture = useMemo(() => getGlowTexture(), []);

  return (
    <points geometry={geometry}>
      <pointsMaterial
        ref={materialRef}
        map={glowTexture}
        size={0.2}
        vertexColors
        transparent
        opacity={0}
        sizeAttenuation
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        toneMapped={false}
      />
    </points>
  );
}
