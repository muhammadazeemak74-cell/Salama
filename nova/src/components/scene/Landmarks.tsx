"use client";

import { useMemo } from "react";
import * as THREE from "three";
import {
  LANDMARKS,
  paintHeightGradient,
  TEAL,
  type LandmarkKind,
} from "./skyline";

interface Piece {
  geo: THREE.BufferGeometry;
  position: [number, number, number];
  rotation?: [number, number, number];
  /** Override the height-gradient with a flat colour (used for spires). */
  color?: THREE.Color;
}

function grad(geo: THREE.BufferGeometry, baseY: number): THREE.BufferGeometry {
  return paintHeightGradient(geo, baseY);
}

function flat(geo: THREE.BufferGeometry, color: THREE.Color): THREE.BufferGeometry {
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    colors[i * 3] = color.r;
    colors[i * 3 + 1] = color.g;
    colors[i * 3 + 2] = color.b;
  }
  geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  return geo;
}

/* ---- landmark builders (each authored with its base at y = 0) ---- */

function burjKhalifa(): Piece[] {
  const tiers: [number, number, number][] = [
    [2.0, 2.4, 6],
    [1.5, 2.0, 5],
    [1.05, 1.5, 4.5],
    [0.6, 1.05, 4],
    [0.3, 0.6, 3],
  ];
  const pieces: Piece[] = [];
  let cursor = 0;
  for (const [rT, rB, h] of tiers) {
    const y = cursor + h / 2;
    pieces.push({
      geo: grad(new THREE.CylinderGeometry(rT, rB, h, 6), y),
      position: [0, y, 0],
      rotation: [0, Math.PI / 6, 0],
    });
    cursor += h;
  }
  // Spire.
  const spireH = 4;
  const spireY = cursor + spireH / 2;
  pieces.push({
    geo: flat(new THREE.CylinderGeometry(0.03, 0.28, spireH, 6), TEAL),
    position: [0, spireY, 0],
  });
  return pieces;
}

function emiratesTowers(): Piece[] {
  const one = (dx: number, bodyH: number, w: number, roofH: number): Piece[] => {
    const bodyY = bodyH / 2;
    const roofY = bodyH + roofH / 2;
    return [
      {
        geo: grad(new THREE.BoxGeometry(w, bodyH, w), bodyY),
        position: [dx, bodyY, 0],
      },
      {
        geo: grad(new THREE.ConeGeometry(w * 0.72, roofH, 4), roofY),
        position: [dx, roofY, 0],
        rotation: [0, Math.PI / 4, 0],
      },
    ];
  };
  return [...one(-1.9, 11, 1.8, 3), ...one(1.9, 9, 1.6, 2.6)];
}

function museumFuture(): Piece[] {
  const plinthH = 2;
  const R = 3;
  const torusY = plinthH + R * 0.72;
  return [
    {
      geo: grad(new THREE.CylinderGeometry(2.1, 2.5, plinthH, 16), plinthH / 2),
      position: [0, plinthH / 2, 0],
    },
    {
      geo: grad(new THREE.TorusGeometry(R, 0.95, 10, 22), torusY),
      position: [0, torusY, 0],
      rotation: [0.12, 0.35, 0.15],
    },
  ];
}

function dubaiFrame(): Piece[] {
  const w = 6;
  const h = 15;
  const t = 0.7;
  const postH = h;
  return [
    {
      geo: grad(new THREE.BoxGeometry(t, postH, t), postH / 2),
      position: [-(w / 2 - t / 2), postH / 2, 0],
    },
    {
      geo: grad(new THREE.BoxGeometry(t, postH, t), postH / 2),
      position: [w / 2 - t / 2, postH / 2, 0],
    },
    {
      geo: grad(new THREE.BoxGeometry(w, t, t), h - t / 2),
      position: [0, h - t / 2, 0],
    },
    {
      geo: grad(new THREE.BoxGeometry(w, t, t), t / 2),
      position: [0, t / 2, 0],
    },
  ];
}

function burjAlArab(): Piece[] {
  // Right-triangle "sail" silhouette, extruded thin.
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.lineTo(0, 17);
  shape.quadraticCurveTo(2.4, 9, 6.4, 0); // gentle curved hypotenuse
  shape.lineTo(0, 0);
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: 1.3,
    bevelEnabled: false,
  });
  geo.translate(-1.6, 0, -0.65);
  grad(geo, 0);
  return [{ geo, position: [0, 0, 0] }];
}

function ainDubai(): Piece[] {
  const R = 4.2;
  const cy = R + 1.4;
  const pieces: Piece[] = [];
  // Rim.
  pieces.push({
    geo: grad(new THREE.TorusGeometry(R, 0.28, 8, 30), cy),
    position: [0, cy, 0],
  });
  // Hub.
  pieces.push({
    geo: flat(new THREE.CylinderGeometry(0.4, 0.4, 0.6, 10), TEAL),
    position: [0, cy, 0],
    rotation: [Math.PI / 2, 0, 0],
  });
  // Spokes.
  const spokes = 10;
  for (let i = 0; i < spokes; i++) {
    const a = (i / spokes) * Math.PI * 2;
    pieces.push({
      geo: flat(new THREE.CylinderGeometry(0.045, 0.045, R, 5), TEAL),
      position: [(Math.cos(a) * R) / 2, cy + (Math.sin(a) * R) / 2, 0],
      rotation: [0, 0, a - Math.PI / 2],
    });
  }
  // A-frame support legs to the ground.
  pieces.push({
    geo: grad(new THREE.BoxGeometry(0.35, cy + 1, 0.35), (cy + 1) / 2),
    position: [-1.7, (cy + 1) / 2, 0],
    rotation: [0, 0, 0.28],
  });
  pieces.push({
    geo: grad(new THREE.BoxGeometry(0.35, cy + 1, 0.35), (cy + 1) / 2),
    position: [1.7, (cy + 1) / 2, 0],
    rotation: [0, 0, -0.28],
  });
  return pieces;
}

const BUILDERS: Record<LandmarkKind, () => Piece[]> = {
  burjKhalifa,
  emiratesTowers,
  museumFuture,
  dubaiFrame,
  burjAlArab,
  ainDubai,
};

function Landmark({ kind }: { kind: LandmarkKind }) {
  const pieces = useMemo(() => BUILDERS[kind](), [kind]);
  return (
    <group>
      {pieces.map((p, i) => (
        <mesh
          key={i}
          geometry={p.geo}
          position={p.position}
          rotation={p.rotation}
        >
          <meshStandardMaterial
            vertexColors
            flatShading
            roughness={0.88}
            metalness={0.04}
          />
        </mesh>
      ))}
    </group>
  );
}

export function Landmarks() {
  return (
    <group>
      {LANDMARKS.map((l) => (
        <group key={l.kind} position={[l.x, 0, l.z]}>
          <Landmark kind={l.kind} />
        </group>
      ))}
    </group>
  );
}
