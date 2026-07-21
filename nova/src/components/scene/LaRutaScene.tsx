"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Sparkles } from "@react-three/drei";
import { Suspense, useMemo, useRef } from "react";
import * as THREE from "three";
import { useScrollProgressRef } from "@/lib/scroll-provider";
import { usePrefersReducedMotion } from "@/lib/use-reduced-motion";
import { useIsMobile } from "@/lib/use-media-query";
import { makeTowers, skyPalette } from "./skyline";
import { SkyDome } from "./SkyDome";
import { Sun } from "./Sun";
import { Water } from "./Water";
import { Landmarks } from "./Landmarks";
import { CityTowers } from "./CityTowers";
import { Windows } from "./Windows";

const REDUCED_P = 0.5;

/** Soft warm haze bands between building rows for atmospheric depth. */
function Haze() {
  return (
    <group>
      {[
        { z: -6, o: 0.1 },
        { z: -15, o: 0.13 },
        { z: -24, o: 0.16 },
      ].map((h, i) => (
        <mesh key={i} position={[0, 9, h.z]}>
          <planeGeometry args={[140, 44]} />
          <meshBasicMaterial
            color="#f7e6cf"
            transparent
            opacity={h.o}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
      ))}
    </group>
  );
}

function SceneContents({
  reduced,
  isMobile,
}: {
  reduced: boolean;
  isMobile: boolean;
}) {
  const { camera, scene } = useThree();
  const progressRef = useScrollProgressRef();
  const smoothRef = useRef(reduced ? REDUCED_P : 0);
  const camX = useRef(0);
  const tmpZ = useRef(new THREE.Color()).current;
  const tmpH = useRef(new THREE.Color()).current;

  const towers = useMemo(() => makeTowers(isMobile ? 7 : 16), [isMobile]);

  useFrame((_, delta) => {
    // Smooth scroll progress for buttery, cinematic motion.
    if (reduced) {
      smoothRef.current = REDUCED_P;
    } else {
      const target = progressRef.current;
      smoothRef.current += (target - smoothRef.current) * Math.min(1, delta * 2.2);
    }
    const p = smoothRef.current;

    if (reduced) {
      camera.position.set(-9, 7, 16);
      camera.lookAt(-9, 5, -13);
      camX.current = -9;
    } else {
      const cx = THREE.MathUtils.lerp(-16, 21, p);
      // Lift + tilt up over the hero so the big headline clears the rooftops,
      // then settle to an eye-level glide through the city.
      const rise = 1 - THREE.MathUtils.smoothstep(p, 0.0, 0.16);
      camera.position.x = cx;
      camera.position.y = 6.4 + rise * 2.6;
      camera.position.z = THREE.MathUtils.lerp(15.5, 11, p) + rise * 1.2;
      camera.lookAt(cx, 4.4 - rise * 1.4, -14);
      camX.current = cx;
    }

    // Fog melts distant towers into the current horizon colour.
    skyPalette(p, tmpZ, tmpH);
    if (scene.fog) (scene.fog as THREE.Fog).color.copy(tmpH);
  });

  return (
    <>
      <SkyDome progress={smoothRef} />
      <Sun progress={smoothRef} camX={camX} />

      <ambientLight intensity={0.75} />
      <hemisphereLight args={["#ffe9cf", "#12233a", 0.55]} />
      <directionalLight position={[-8, 12, 8]} intensity={0.7} color="#fff1d8" />

      {/* Warm desert ground the city stands on — a light haze band behind the
          towers that keeps mid-height text readable and reads as sand. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.06, -18]}>
        <planeGeometry args={[160, 70]} />
        <meshStandardMaterial color="#cdb694" roughness={1} metalness={0} />
      </mesh>

      <Haze />
      <CityTowers towers={towers} />
      <Landmarks />
      <Windows towers={towers} progress={smoothRef} />
      <Water progress={smoothRef} camX={camX} reflections={!isMobile} />

      <Sparkles
        count={isMobile ? 24 : 70}
        scale={[70, 26, 34]}
        position={[0, 11, -6]}
        size={isMobile ? 2 : 2.6}
        speed={reduced ? 0 : 0.16}
        opacity={0.5}
        color="#ffe4bd"
      />
    </>
  );
}

export function LaRutaScene() {
  const reduced = usePrefersReducedMotion();
  const isMobile = useIsMobile();

  return (
    <div className="pointer-events-none fixed inset-0 z-0" aria-hidden="true">
      <Canvas
        dpr={[1, isMobile ? 1.5 : 2]}
        gl={{ antialias: true, powerPreference: "high-performance" }}
        camera={{ position: [-15, 6.2, 15.5], fov: 50 }}
      >
        <fog attach="fog" args={["#fdf0dc", 26, 66]} />
        <Suspense fallback={null}>
          <SceneContents reduced={reduced} isMobile={isMobile} />
        </Suspense>
      </Canvas>
      {/* Readability wash: a soft warm-white veil over the left, where every
          section's text sits. Keeps navy copy legible over the skyline at any
          scroll position while leaving the city clearly visible centre/right. */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(100deg, rgba(250,247,242,0.52) 0%, rgba(250,247,242,0.30) 30%, rgba(250,247,242,0) 54%)",
        }}
      />
    </div>
  );
}
