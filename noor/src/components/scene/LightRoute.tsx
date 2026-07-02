"use client";

import { useMemo } from "react";
import * as THREE from "three";
import { routeGradientColor } from "@/lib/route-curve";

interface LightRouteProps {
  curve: THREE.CatmullRomCurve3;
  tubularSegments: number;
  radialSegments: number;
}

export function LightRoute({
  curve,
  tubularSegments,
  radialSegments,
}: LightRouteProps) {
  const geometry = useMemo(() => {
    const geo = new THREE.TubeGeometry(
      curve,
      tubularSegments,
      0.34,
      radialSegments,
      false
    );

    const position = geo.attributes.position;
    const ringSize = radialSegments + 1;
    const segCount = tubularSegments + 1;
    const colors = new Float32Array(position.count * 3);
    const color = new THREE.Color();

    for (let i = 0; i < segCount; i++) {
      routeGradientColor(i / tubularSegments, color);
      for (let j = 0; j < ringSize; j++) {
        const idx = i * ringSize + j;
        if (idx >= position.count) continue;
        colors[idx * 3] = color.r;
        colors[idx * 3 + 1] = color.g;
        colors[idx * 3 + 2] = color.b;
      }
    }

    geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    return geo;
  }, [curve, tubularSegments, radialSegments]);

  return (
    <mesh geometry={geometry}>
      <meshBasicMaterial
        vertexColors
        transparent
        opacity={0.85}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
        toneMapped={false}
      />
    </mesh>
  );
}
