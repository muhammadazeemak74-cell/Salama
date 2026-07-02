"use client";

import { Canvas } from "@react-three/fiber";
import { Environment, Lightformer, Sparkles } from "@react-three/drei";
import { Suspense } from "react";
import { OnyxCrystal } from "./OnyxCrystal";
import { usePrefersReducedMotion } from "@/lib/use-reduced-motion";
import { useIsMobile } from "@/lib/use-media-query";

/**
 * The crystal's reflections come from a procedurally-rendered environment
 * (Lightformers), not a fetched HDR — no external CDN dependency, no risk
 * of the scene failing to render on a blocked or offline network.
 */
function CrystalEnvironment({ resolution }: { resolution: number }) {
  return (
    <Environment resolution={resolution}>
      <Lightformer
        intensity={4}
        color="#c6a15b"
        position={[0, 4, -4]}
        scale={[10, 2, 1]}
      />
      <Lightformer
        intensity={2.2}
        color="#e4c98a"
        position={[-5, 1.5, 3]}
        scale={[6, 2, 1]}
        rotation={[0, Math.PI / 3, 0]}
      />
      <Lightformer
        intensity={1.6}
        color="#ff9a4d"
        position={[5, -2, 3]}
        scale={[6, 2, 1]}
        rotation={[0, -Math.PI / 3, 0]}
      />
      <Lightformer
        intensity={0.6}
        color="#f4f1ea"
        position={[0, -5, 2]}
        scale={[10, 4, 1]}
      />
    </Environment>
  );
}

export function BackgroundScene() {
  const reduced = usePrefersReducedMotion();
  const isMobile = useIsMobile();

  return (
    <div className="fixed inset-0 z-0 pointer-events-none" aria-hidden="true">
      <Canvas
        dpr={[1, isMobile ? 1.5 : 2]}
        gl={{ antialias: true, powerPreference: "high-performance" }}
        camera={{ position: [0, 0, 6], fov: 45 }}
      >
        <color attach="background" args={["#0a0a0b"]} />
        <fog attach="fog" args={["#0a0a0b", 6, 22]} />
        <ambientLight intensity={0.35} />
        <pointLight position={[4, 3, 5]} intensity={45} color="#c6a15b" />
        <pointLight position={[-5, -2, -4]} intensity={18} color="#ff9a4d" />
        <Suspense fallback={null}>
          <CrystalEnvironment resolution={isMobile ? 64 : 256} />
          <OnyxCrystal reduced={reduced} />
          <Sparkles
            count={isMobile ? 50 : 220}
            scale={isMobile ? [12, 12, 16] : [16, 16, 22]}
            size={isMobile ? 2.5 : 3.2}
            speed={reduced ? 0 : isMobile ? 0.12 : 0.2}
            color="#c6a15b"
            opacity={0.55}
          />
        </Suspense>
      </Canvas>
    </div>
  );
}
