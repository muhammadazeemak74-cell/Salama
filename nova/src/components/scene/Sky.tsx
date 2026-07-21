"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef, type MutableRefObject } from "react";
import * as THREE from "three";

/**
 * A large gradient sky dome enclosing the whole scene. Bright daytime at the
 * top, warming toward golden hour along the route as scroll progress rises.
 * Kept intentionally light so navy text stays readable through the
 * translucent content panels that float over it.
 */
export function Sky({ progress }: { progress: MutableRefObject<number> }) {
  const matRef = useRef<THREE.ShaderMaterial>(null);

  const uniforms = useMemo(
    () => ({
      uProgress: { value: 0 },
      uDayZenith: { value: new THREE.Color("#e2eef0") },
      uDayHorizon: { value: new THREE.Color("#fdf4e6") },
      uGoldZenith: { value: new THREE.Color("#f4e6d2") },
      uGoldHorizon: { value: new THREE.Color("#f6c986") },
    }),
    []
  );

  useFrame(() => {
    if (matRef.current) {
      matRef.current.uniforms.uProgress.value = progress.current;
    }
  });

  return (
    <mesh scale={[60, 60, 60]}>
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
          uniform float uProgress;
          uniform vec3 uDayZenith;
          uniform vec3 uDayHorizon;
          uniform vec3 uGoldZenith;
          uniform vec3 uGoldHorizon;
          varying float vLat;
          void main() {
            float t = clamp(vLat * 0.55 + 0.5, 0.0, 1.0);
            vec3 horizon = mix(uDayHorizon, uGoldHorizon, uProgress);
            vec3 zenith = mix(uDayZenith, uGoldZenith, uProgress * 0.7);
            vec3 col = mix(horizon, zenith, smoothstep(0.12, 1.0, t));
            gl_FragColor = vec4(col, 1.0);
          }
        `}
      />
    </mesh>
  );
}
