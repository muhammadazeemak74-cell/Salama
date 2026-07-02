"use client";

import { Canvas } from "@react-three/fiber";
import { Bloom, EffectComposer } from "@react-three/postprocessing";
import { Suspense, useMemo } from "react";
import { createRouteCurve, ROUTE_LENGTH_Z } from "@/lib/route-curve";
import { usePrefersReducedMotion } from "@/lib/use-reduced-motion";
import { useIsMobile } from "@/lib/use-media-query";
import { LightRoute } from "./LightRoute";
import { StreamingParticles } from "./StreamingParticles";
import { SkylineParticles } from "./SkylineParticles";
import { CameraRig } from "./CameraRig";

export function BackgroundScene() {
  const reduced = usePrefersReducedMotion();
  const isMobile = useIsMobile();
  const curve = useMemo(() => createRouteCurve(), []);

  const tubularSegments = isMobile ? 120 : 220;
  const radialSegments = isMobile ? 6 : 8;
  const particleCount = isMobile ? 220 : 650;

  return (
    <div className="fixed inset-0 z-0 pointer-events-none" aria-hidden="true">
      <Canvas
        dpr={[1, isMobile ? 1.5 : 2]}
        gl={{ antialias: true, powerPreference: "high-performance" }}
        camera={{ position: [0, 0.06, 0], fov: 55, near: 0.1, far: 100 }}
      >
        <color attach="background" args={["#0c0c0d"]} />
        <fog attach="fog" args={["#0c0c0d", 8, 42]} />
        <ambientLight intensity={0.25} />
        <Suspense fallback={null}>
          <LightRoute
            curve={curve}
            tubularSegments={tubularSegments}
            radialSegments={radialSegments}
          />
          <StreamingParticles
            curve={curve}
            tubularSegments={tubularSegments}
            count={particleCount}
          />
          <SkylineParticles endZ={-ROUTE_LENGTH_Z} reduced={reduced} />
          <CameraRig curve={curve} reduced={reduced} />
          {!isMobile && !reduced && (
            <EffectComposer multisampling={0}>
              <Bloom
                intensity={0.6}
                luminanceThreshold={0.2}
                luminanceSmoothing={0.4}
              />
            </EffectComposer>
          )}
        </Suspense>
      </Canvas>
    </div>
  );
}
