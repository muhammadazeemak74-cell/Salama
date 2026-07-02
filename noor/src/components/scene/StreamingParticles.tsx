"use client";

import { useMemo } from "react";
import * as THREE from "three";
import { routeGradientColor } from "@/lib/route-curve";
import { getGlowTexture } from "@/lib/particle-texture";
import { createSeededRandom } from "@/lib/seeded-random";

interface StreamingParticlesProps {
  curve: THREE.CatmullRomCurve3;
  tubularSegments: number;
  count: number;
}

/**
 * Particles are placed at fixed positions along the route corridor; the
 * "streaming" effect comes entirely from the camera flying past them, not
 * from per-frame position updates — cheap and reads correctly at speed.
 */
export function StreamingParticles({
  curve,
  tubularSegments,
  count,
}: StreamingParticlesProps) {
  const geometry = useMemo(() => {
    const frames = curve.computeFrenetFrames(tubularSegments, false);
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const color = new THREE.Color();
    const point = new THREE.Vector3();
    const random = createSeededRandom(count * 7919 + tubularSegments);

    for (let i = 0; i < count; i++) {
      const t = random();
      const idx = Math.min(tubularSegments, Math.floor(t * tubularSegments));
      curve.getPointAt(t, point);
      const normal = frames.normals[idx];
      const binormal = frames.binormals[idx];
      const angle = random() * Math.PI * 2;
      const radius = 0.35 + random() * 1.6;

      const x = point.x + normal.x * Math.cos(angle) * radius + binormal.x * Math.sin(angle) * radius;
      const y = point.y + normal.y * Math.cos(angle) * radius + binormal.y * Math.sin(angle) * radius;
      const z = point.z + normal.z * Math.cos(angle) * radius + binormal.z * Math.sin(angle) * radius;

      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;

      routeGradientColor(t, color);
      colors[i * 3] = color.r;
      colors[i * 3 + 1] = color.g;
      colors[i * 3 + 2] = color.b;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    return geo;
  }, [curve, tubularSegments, count]);

  const glowTexture = useMemo(() => getGlowTexture(), []);

  return (
    <points geometry={geometry}>
      <pointsMaterial
        map={glowTexture}
        size={0.12}
        vertexColors
        transparent
        opacity={0.9}
        sizeAttenuation
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        toneMapped={false}
      />
    </points>
  );
}
