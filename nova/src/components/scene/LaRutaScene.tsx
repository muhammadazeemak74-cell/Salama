"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Sparkles } from "@react-three/drei";
import { Suspense, useRef } from "react";
import * as THREE from "three";
import { useScrollProgressRef } from "@/lib/scroll-provider";
import { usePrefersReducedMotion } from "@/lib/use-reduced-motion";
import { useIsMobile } from "@/lib/use-media-query";
import { routeCurve } from "./route";
import { RouteDots } from "./RouteDots";
import { Waypoints } from "./Waypoints";
import { Sky } from "./Sky";
import { usePaperPlaneGeometry } from "./PaperPlane";

const FORWARD = new THREE.Vector3(0, 0, 1);
const REDUCED_PARK_T = 0.12;

function SceneContents({
  reduced,
  isMobile,
}: {
  reduced: boolean;
  isMobile: boolean;
}) {
  const { camera } = useThree();
  const progressRef = useScrollProgressRef();
  const smoothRef = useRef(0);
  const planeRef = useRef<THREE.Group>(null);
  const dustRef = useRef<THREE.Group>(null);
  const geometry = usePaperPlaneGeometry();

  // Scratch objects reused each frame — no per-frame allocation.
  const scratchQ = useRef(new THREE.Quaternion()).current;
  const rollQ = useRef(new THREE.Quaternion()).current;
  const tan = useRef(new THREE.Vector3()).current;
  const tanAhead = useRef(new THREE.Vector3()).current;
  const camTarget = useRef(new THREE.Vector3()).current;

  useFrame((state, delta) => {
    const target = progressRef.current;
    if (reduced) {
      smoothRef.current = target;
    } else {
      smoothRef.current +=
        (target - smoothRef.current) * Math.min(1, delta * 3.5);
    }
    const p = smoothRef.current;
    const plane = planeRef.current;

    const pt = reduced ? REDUCED_PARK_T : THREE.MathUtils.clamp(p, 0.0008, 0.999);
    const pos = routeCurve.getPointAt(pt);
    routeCurve.getTangentAt(pt, tan).normalize();

    if (plane) {
      plane.position.copy(pos);
      if (!reduced) {
        plane.position.y += Math.sin(state.clock.elapsedTime * 1.6) * 0.05;
      }
      // Orient nose (+Z) along the route.
      scratchQ.setFromUnitVectors(FORWARD, tan);
      // Bank into the turn.
      const ptAhead = THREE.MathUtils.clamp(pt + 0.012, 0, 1);
      routeCurve.getTangentAt(ptAhead, tanAhead).normalize();
      let bank = THREE.MathUtils.clamp((tanAhead.x - tan.x) * 7, -0.7, 0.7);
      if (!reduced) bank += Math.sin(state.clock.elapsedTime * 0.9) * 0.06;
      rollQ.setFromAxisAngle(tan, bank);
      plane.quaternion.copy(rollQ).multiply(scratchQ);
    }

    if (dustRef.current) {
      dustRef.current.position.copy(pos);
    }

    // Camera framing.
    if (reduced) {
      camera.position.set(0, 0, 15);
      camera.lookAt(0, 0, 0);
    } else {
      camTarget.set(pos.x * 0.5, pos.y + 1.1, pos.z + 8);
      camera.position.lerp(camTarget, Math.min(1, delta * 2.5));
      camera.lookAt(pos.x * 0.45, pos.y - 0.5, pos.z);
    }
  });

  return (
    <>
      <Sky progress={smoothRef} />
      <ambientLight intensity={0.95} />
      <hemisphereLight args={["#fff6e8", "#cfe4e8", 0.6]} />
      <directionalLight
        position={[4, 8, 6]}
        intensity={1.5}
        color="#fff2dc"
      />
      <directionalLight position={[-6, -2, -4]} intensity={0.4} color="#2f8ca3" />

      <RouteDots
        count={isMobile ? 70 : 120}
        progress={smoothRef}
        reduced={reduced}
      />
      <Waypoints progress={smoothRef} reduced={reduced} />

      <group ref={planeRef} scale={isMobile ? 1.0 : 1.15}>
        <mesh geometry={geometry}>
          <meshStandardMaterial
            vertexColors
            flatShading
            side={THREE.DoubleSide}
            roughness={0.55}
            metalness={0.05}
          />
        </mesh>
      </group>

      <group ref={dustRef}>
        <Sparkles
          count={isMobile ? 28 : 70}
          scale={[10, 8, 8]}
          size={isMobile ? 2.2 : 2.8}
          speed={reduced ? 0 : 0.25}
          opacity={0.55}
          color="#f2a33c"
        />
        <Sparkles
          count={isMobile ? 18 : 44}
          scale={[9, 7, 7]}
          size={isMobile ? 1.6 : 2.0}
          speed={reduced ? 0 : 0.15}
          opacity={0.4}
          color="#ffffff"
        />
      </group>
    </>
  );
}

export function LaRutaScene() {
  const reduced = usePrefersReducedMotion();
  const isMobile = useIsMobile();

  return (
    <div
      className="pointer-events-none fixed inset-0 z-0"
      aria-hidden="true"
    >
      <Canvas
        dpr={[1, isMobile ? 1.5 : 2]}
        gl={{ antialias: true, powerPreference: "high-performance" }}
        camera={{ position: [0, 4, 9], fov: 48 }}
      >
        <fog attach="fog" args={["#f3ead9", 14, 34]} />
        <Suspense fallback={null}>
          <SceneContents reduced={reduced} isMobile={isMobile} />
        </Suspense>
      </Canvas>
    </div>
  );
}
