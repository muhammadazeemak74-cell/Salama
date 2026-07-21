"use client";

import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { paintHeightGradient, type TowerSpec } from "./skyline";

const dummy = new THREE.Object3D();

/**
 * The generic Marina tower field, drawn as a single instanced mesh for cheap
 * density. One unit box (base at y=0) is scaled per instance; the shared
 * geometry carries the navy→teal height gradient.
 */
export function CityTowers({ towers }: { towers: TowerSpec[] }) {
  const meshRef = useRef<THREE.InstancedMesh>(null);

  const geo = useMemo(() => {
    const g = new THREE.BoxGeometry(1, 1, 1);
    g.translate(0, 0.5, 0); // base at y = 0
    paintHeightGradient(g, 0, 1.8);
    return g;
  }, []);

  useLayoutEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    towers.forEach((t, i) => {
      dummy.position.set(t.x, 0, t.z);
      dummy.scale.set(t.w, t.h, t.d);
      dummy.rotation.set(0, 0, 0);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
  }, [towers]);

  return (
    <instancedMesh
      ref={meshRef}
      args={[geo, undefined, towers.length]}
      frustumCulled={false}
    >
      <meshStandardMaterial vertexColors flatShading roughness={0.9} metalness={0.03} />
    </instancedMesh>
  );
}
