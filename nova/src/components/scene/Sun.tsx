"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef, type MutableRefObject } from "react";
import * as THREE from "three";
import { makeGlowTexture, sunColor } from "./skyline";

/**
 * A large soft orange sun disc far behind the city. It descends toward the
 * horizon as the page scrolls and deepens from pale gold to burnt orange.
 */
export function Sun({
  progress,
  camX,
}: {
  progress: MutableRefObject<number>;
  camX: MutableRefObject<number>;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const coreMat = useRef<THREE.MeshBasicMaterial>(null);
  const haloMat = useRef<THREE.MeshBasicMaterial>(null);
  const glow = useMemo(() => makeGlowTexture(), []);

  useFrame(() => {
    const p = progress.current;
    const g = groupRef.current;
    if (g) {
      g.position.x = camX.current * 0.85;
      g.position.y = THREE.MathUtils.lerp(19, 2.2, p);
    }
    const c = sunColor(p);
    if (coreMat.current) coreMat.current.color.copy(c);
    if (haloMat.current) {
      haloMat.current.color.copy(c);
      haloMat.current.opacity = 0.35 + p * 0.3;
    }
  });

  return (
    <group ref={groupRef} position={[0, 16, -46]}>
      <mesh>
        <circleGeometry args={[6.2, 48]} />
        <meshBasicMaterial ref={coreMat} color="#ffdca2" toneMapped={false} />
      </mesh>
      <mesh position={[0, 0, -0.5]}>
        <planeGeometry args={[34, 34]} />
        <meshBasicMaterial
          ref={haloMat}
          map={glow}
          color="#ffdca2"
          transparent
          opacity={0.4}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}
