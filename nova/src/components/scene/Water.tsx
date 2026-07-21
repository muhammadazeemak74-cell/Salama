"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef, type MutableRefObject } from "react";
import * as THREE from "three";
import { skyPalette, sunColor } from "./skyline";

const WIDTH = 100;

/**
 * A thin water strip in the foreground. On desktop a shader fakes a reflection:
 * the horizon/sky colour bleeds across it with a rippling vertical sun-glimmer
 * under the descending sun. On mobile it's a plain flat plane (no reflection).
 */
export function Water({
  progress,
  camX,
  reflections,
}: {
  progress: MutableRefObject<number>;
  camX: MutableRefObject<number>;
  reflections: boolean;
}) {
  const matRef = useRef<THREE.ShaderMaterial>(null);

  const uniforms = useMemo(
    () => ({
      uNear: { value: new THREE.Color("#254f6b") },
      uHorizon: { value: new THREE.Color("#fdf0dc") },
      uSun: { value: new THREE.Color("#ffdca2") },
      uSunX: { value: 0 },
      uTime: { value: 0 },
      uWidth: { value: WIDTH },
    }),
    []
  );

  useFrame((state) => {
    const m = matRef.current;
    if (!m) return;
    const p = progress.current;
    skyPalette(p, m.uniforms.uHorizon.value, m.uniforms.uHorizon.value);
    // Only the horizon colour is needed; reuse it for both slots is fine.
    sunColor(p, m.uniforms.uSun.value);
    m.uniforms.uSunX.value = camX.current * 0.85;
    m.uniforms.uTime.value = state.clock.elapsedTime;
  });

  if (!reflections) {
    return (
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 4]}>
        <planeGeometry args={[WIDTH, 22]} />
        <meshStandardMaterial color="#12314a" roughness={0.5} metalness={0.4} />
      </mesh>
    );
  }

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 4]}>
      <planeGeometry args={[WIDTH, 22, 1, 1]} />
      <shaderMaterial
        ref={matRef}
        uniforms={uniforms}
        vertexShader={`
          varying vec2 vUv;
          void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `}
        fragmentShader={`
          uniform vec3 uNear;
          uniform vec3 uHorizon;
          uniform vec3 uSun;
          uniform float uSunX;
          uniform float uTime;
          uniform float uWidth;
          varying vec2 vUv;
          void main() {
            // vUv.y = 0 near camera, 1 at far edge (toward the horizon).
            float far = pow(vUv.y, 1.4);
            vec3 col = mix(uNear, uHorizon, far);
            float worldX = (vUv.x - 0.5) * uWidth;
            float wob = sin(vUv.y * 26.0 + uTime * 1.3) * 0.5;
            float d = abs(worldX - uSunX + wob);
            float streak = smoothstep(3.2, 0.0, d) * far;
            streak *= 0.6 + 0.4 * sin(vUv.y * 60.0 + uTime * 2.0);
            col += uSun * streak * 0.45;
            gl_FragColor = vec4(col, 1.0);
          }
        `}
      />
    </mesh>
  );
}
