"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useScrollProgressRef } from "@/lib/scroll-provider";

export function OnyxCrystal({ reduced }: { reduced: boolean }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const edgesRef = useRef<THREE.LineSegments>(null);
  const progressRef = useScrollProgressRef();

  const geometry = useMemo(() => new THREE.IcosahedronGeometry(1.6, 1), []);
  const edgesGeometry = useMemo(
    () => new THREE.EdgesGeometry(geometry, 1),
    [geometry]
  );

  useFrame((state, delta) => {
    const progress = progressRef.current;
    const mesh = meshRef.current;
    if (!mesh) return;

    if (!reduced) {
      mesh.rotation.y += delta * 0.15;
    }
    mesh.rotation.x = 0.35 + progress * Math.PI * 0.55;
    mesh.rotation.z = progress * 0.35;

    if (edgesRef.current) {
      edgesRef.current.rotation.copy(mesh.rotation);
    }

    const camera = state.camera;
    camera.position.z = 6 - progress * 8.5;
    camera.position.x = reduced ? 0 : Math.sin(progress * Math.PI) * 0.5;
    camera.position.y = reduced ? 0 : Math.cos(progress * Math.PI * 0.6) * 0.25;
    camera.lookAt(0, 0, 0);
  });

  return (
    <group>
      <mesh ref={meshRef} geometry={geometry}>
        <meshPhysicalMaterial
          color="#08080a"
          metalness={1}
          roughness={0.24}
          clearcoat={1}
          clearcoatRoughness={0.12}
          reflectivity={1}
          envMapIntensity={1.6}
        />
      </mesh>
      <lineSegments ref={edgesRef} geometry={edgesGeometry}>
        <lineBasicMaterial color="#c6a15b" transparent opacity={0.65} />
      </lineSegments>
    </group>
  );
}
