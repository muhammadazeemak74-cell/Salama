"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useScrollProgressRef } from "@/lib/scroll-provider";

interface CameraRigProps {
  curve: THREE.CatmullRomCurve3;
  reduced: boolean;
}

export function CameraRig({ curve, reduced }: CameraRigProps) {
  const progressRef = useScrollProgressRef();
  const smoothed = useRef(0.02);
  const point = useMemo(() => new THREE.Vector3(), []);
  const lookPoint = useMemo(() => new THREE.Vector3(), []);
  const tangent = useMemo(() => new THREE.Vector3(), []);

  useFrame((state, delta) => {
    const camera = state.camera;
    const target = Math.min(0.985, Math.max(0.015, progressRef.current));

    if (reduced) {
      smoothed.current = 0.08;
    } else {
      smoothed.current += (target - smoothed.current) * Math.min(1, delta * 2.2);
    }

    curve.getPointAt(smoothed.current, point);
    curve.getTangentAt(smoothed.current, tangent);

    let swayX = 0;
    let swayY = 0;
    if (!reduced) {
      const t = state.clock.elapsedTime;
      swayX = Math.sin(t * 0.25) * 0.05;
      swayY = Math.cos(t * 0.2) * 0.03;
    }

    // Hover above and slightly behind the ribbon's centerline, looking
    // forward and down along it, rather than riding inside the tube.
    camera.position.set(point.x + swayX, point.y + 1.3 + swayY, point.z + 0.8);
    lookPoint.copy(point).addScaledVector(tangent, 6);
    camera.lookAt(lookPoint);
  });

  return null;
}
