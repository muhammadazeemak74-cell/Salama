"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef, type MutableRefObject } from "react";
import * as THREE from "three";
import { skyPalette } from "./skyline";

/**
 * Gradient sky dome enclosing the city. Bright warm day at the top of the page,
 * shifting through golden hour to early dusk at the footer. Colours are the
 * same ones the fog and page tint follow, so everything stays coordinated and
 * text stays readable at every scroll position.
 */
export function SkyDome({ progress }: { progress: MutableRefObject<number> }) {
  const matRef = useRef<THREE.ShaderMaterial>(null);

  const uniforms = useMemo(
    () => ({
      uZenith: { value: new THREE.Color("#e8f0f0") },
      uHorizon: { value: new THREE.Color("#fdf0dc") },
    }),
    []
  );

  useFrame(() => {
    const m = matRef.current;
    if (!m) return;
    skyPalette(progress.current, m.uniforms.uZenith.value, m.uniforms.uHorizon.value);
  });

  return (
    <mesh scale={[80, 80, 80]}>
      <sphereGeometry args={[1, 32, 16]} />
      <shaderMaterial
        ref={matRef}
        side={THREE.BackSide}
        depthWrite={false}
        uniforms={uniforms}
        vertexShader={`
          varying float vLat;
          void main() {
            vLat = normalize(position).y;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `}
        fragmentShader={`
          uniform vec3 uZenith;
          uniform vec3 uHorizon;
          varying float vLat;
          void main() {
            float t = clamp(vLat * 0.6 + 0.35, 0.0, 1.0);
            vec3 col = mix(uHorizon, uZenith, smoothstep(0.0, 1.0, t));
            gl_FragColor = vec4(col, 1.0);
          }
        `}
      />
    </mesh>
  );
}
