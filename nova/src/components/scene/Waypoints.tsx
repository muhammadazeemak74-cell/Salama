"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef, type MutableRefObject } from "react";
import * as THREE from "three";
import type { WaypointKind } from "@/data/content";
import { routeCurve, waypoints } from "./route";

const INK = "#14304a";
const TEAL = "#2f8ca3";
const ORANGE = "#f2a33c";

/** The abstract low-poly landmark hint that sits above each pin. */
function Landmark({ kind }: { kind: WaypointKind }) {
  const ink = (
    <meshStandardMaterial color={INK} roughness={0.6} metalness={0.05} />
  );
  const teal = (
    <meshStandardMaterial color={TEAL} roughness={0.55} metalness={0.05} />
  );

  switch (kind) {
    case "arch":
      return (
        <mesh position={[0, 0.34, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.16, 0.045, 6, 12, Math.PI]} />
          {teal}
        </mesh>
      );
    case "tower":
      return (
        <mesh position={[0, 0.42, 0]}>
          <cylinderGeometry args={[0.025, 0.08, 0.6, 6]} />
          {ink}
        </mesh>
      );
    case "dome":
      return (
        <group position={[0, 0.3, 0]}>
          <mesh position={[0, 0.02, 0]}>
            <sphereGeometry args={[0.17, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
            {teal}
          </mesh>
          <mesh position={[0, 0.24, 0]}>
            <cylinderGeometry args={[0.012, 0.012, 0.16, 5]} />
            {ink}
          </mesh>
        </group>
      );
    case "dune":
      return (
        <mesh position={[0, 0.26, 0]} rotation={[0, Math.PI / 4, 0]}>
          <coneGeometry args={[0.32, 0.2, 4]} />
          <meshStandardMaterial color={ORANGE} roughness={0.75} />
        </mesh>
      );
    case "sail":
      return (
        <group position={[0, 0.32, 0]}>
          <mesh position={[0, 0.02, 0]}>
            <coneGeometry args={[0.14, 0.42, 3]} />
            {teal}
          </mesh>
          <mesh position={[0, -0.2, 0]} rotation={[0, 0, 0]}>
            <boxGeometry args={[0.32, 0.06, 0.12]} />
            {ink}
          </mesh>
        </group>
      );
    case "camera":
      return (
        <group position={[0, 0.34, 0]}>
          <mesh>
            <boxGeometry args={[0.28, 0.2, 0.16]} />
            {ink}
          </mesh>
          <mesh position={[0, 0, 0.13]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.07, 0.07, 0.1, 12]} />
            {teal}
          </mesh>
        </group>
      );
    case "pin":
    default:
      return null;
  }
}

function Waypoint({
  t,
  kind,
  progress,
  reduced,
}: {
  t: number;
  kind: WaypointKind;
  progress: MutableRefObject<number>;
  reduced: boolean;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const position = useMemo(() => routeCurve.getPointAt(t), [t]);

  useFrame((state) => {
    const g = groupRef.current;
    if (!g) return;
    // Appear as the plane reaches this point on the route.
    const p = progress.current;
    const appear = reduced
      ? 1
      : THREE.MathUtils.smoothstep(p, t - 0.06, t + 0.01);
    const s = appear;
    g.scale.setScalar(s);
    g.visible = s > 0.001;
    if (!reduced) {
      g.position.y = position.y + Math.sin(state.clock.elapsedTime * 1.4 + t * 12) * 0.04;
    }
  });

  return (
    <group ref={groupRef} position={position} scale={reduced ? 1 : 0}>
      {/* Orange map-pin: rounded head narrowing to a point on the route. */}
      <mesh position={[0, 0.13, 0]}>
        <sphereGeometry args={[0.1, 14, 12]} />
        <meshStandardMaterial
          color={ORANGE}
          roughness={0.4}
          metalness={0.1}
          emissive={ORANGE}
          emissiveIntensity={0.18}
        />
      </mesh>
      <mesh position={[0, 0.02, 0]} rotation={[Math.PI, 0, 0]}>
        <coneGeometry args={[0.1, 0.18, 14]} />
        <meshStandardMaterial color={ORANGE} roughness={0.45} metalness={0.1} />
      </mesh>
      <mesh position={[0, 0.13, 0]}>
        <sphereGeometry args={[0.04, 10, 8]} />
        <meshStandardMaterial color="#ffffff" roughness={0.3} />
      </mesh>
      <Landmark kind={kind} />
    </group>
  );
}

export function Waypoints({
  progress,
  reduced,
}: {
  progress: MutableRefObject<number>;
  reduced: boolean;
}) {
  return (
    <group>
      {waypoints.map((w) => (
        <Waypoint
          key={w.label}
          t={w.t}
          kind={w.kind}
          progress={progress}
          reduced={reduced}
        />
      ))}
    </group>
  );
}
