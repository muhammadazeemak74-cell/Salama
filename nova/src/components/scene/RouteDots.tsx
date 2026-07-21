"use client";

import { useFrame } from "@react-three/fiber";
import { useLayoutEffect, useMemo, useRef, type MutableRefObject } from "react";
import * as THREE from "three";
import { routeCurve } from "./route";

const dummy = new THREE.Object3D();
const TEAL = new THREE.Color("#2f8ca3");
const TEAL_DEEP = new THREE.Color("#246f83");

/**
 * The dotted travel route that draws itself. A row of low-poly dots sampled
 * along the curve; each dot pops in as scroll progress passes it (plus a small
 * lead so a little route always sits ahead of the plane).
 */
export function RouteDots({
  count,
  progress,
  reduced,
}: {
  count: number;
  progress: MutableRefObject<number>;
  reduced: boolean;
}) {
  const meshRef = useRef<THREE.InstancedMesh>(null);

  const { positions, ts } = useMemo(() => {
    const positions: THREE.Vector3[] = [];
    const ts: number[] = [];
    for (let i = 0; i < count; i++) {
      const t = i / (count - 1);
      positions.push(routeCurve.getPointAt(t));
      ts.push(t);
    }
    return { positions, ts };
  }, [count]);

  useLayoutEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    for (let i = 0; i < count; i++) {
      mesh.setColorAt(i, i % 2 === 0 ? TEAL : TEAL_DEEP);
      dummy.position.copy(positions[i]);
      dummy.scale.setScalar(reduced ? 1 : 0);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [count, positions, reduced]);

  useFrame(() => {
    const mesh = meshRef.current;
    if (!mesh || reduced) return;
    const p = progress.current;
    const lead = 0.05;
    for (let i = 0; i < count; i++) {
      const reveal = THREE.MathUtils.clamp(
        (p + lead - ts[i]) / 0.02,
        0,
        1
      );
      const s = reveal * (0.85 + 0.15 * Math.sin(ts[i] * 40));
      dummy.position.copy(positions[i]);
      dummy.scale.setScalar(s);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh
      ref={meshRef}
      args={[undefined, undefined, count]}
      frustumCulled={false}
    >
      <sphereGeometry args={[0.05, 8, 8]} />
      <meshStandardMaterial
        roughness={0.4}
        metalness={0.1}
        emissive={TEAL}
        emissiveIntensity={0.25}
        toneMapped={false}
      />
    </instancedMesh>
  );
}
