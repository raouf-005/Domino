"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { RoundedBox } from "@react-three/drei";
import type { Domino } from "../../lib/gameTypes";
import type { Vec3 } from "./types";
import { DominoHalf } from "./DominoHalf";

// Shared materials — created once, reused by every tile (huge GPU win)
const DIVIDER_GEO = new THREE.BoxGeometry(0.8, 0.03, 0.01);
const DIVIDER_MAT = new THREE.MeshStandardMaterial({
  color: "#555",
  metalness: 0.5,
  roughness: 0.5,
});
const BACK_GEO = new THREE.BoxGeometry(1.02, 2.02, 0.01);
const BACK_MAT = new THREE.MeshStandardMaterial({
  color: "#1a1a1a",
  metalness: 0.8,
  roughness: 0.2,
});

interface PieceProps {
  domino: Domino;
  targetPos: Vec3;
  targetRot: Vec3;
  /** Extra visual overrides */
  scale?: number;
  color?: string;
  emissive?: string;
  emissiveIntensity?: number;
  /** If true, piece springs in from above (new board placement) */
  dropIn?: boolean;
  dropDelay?: number;
  children?: ReactNode;
}

export function DominoPiece({
  domino,
  targetPos,
  targetRot,
  scale: s = 1,
  color = "#f5f5f0",
  emissive = "#000000",
  emissiveIntensity = 0,
  dropIn = false,
  dropDelay = 0,
  children,
}: PieceProps) {
  const [visible, setVisible] = useState(!dropIn);

  // Delay visibility for staggered drops
  useEffect(() => {
    if (!dropIn) return;
    const t = setTimeout(() => setVisible(true), dropDelay * 1000);
    return () => clearTimeout(t);
  }, [dropIn, dropDelay]);

  if (!visible) return null;

  return (
    <group position={targetPos} rotation={targetRot} scale={[s, s, s] as Vec3}>
      {/* Body */}
      <RoundedBox args={[1, 2, 0.18]} radius={0.06} smoothness={2}>
        <meshStandardMaterial
          color={color}
          metalness={0.05}
          roughness={0.25}
          emissive={emissive}
          emissiveIntensity={emissiveIntensity}
        />
      </RoundedBox>

      {/* Divider */}
      <mesh
        position={[0, 0, 0.1]}
        geometry={DIVIDER_GEO}
        material={DIVIDER_MAT}
      />

      {/* Pips */}
      <DominoHalf value={domino.left} offset={[0, 0.5, 0]} />
      <DominoHalf value={domino.right} offset={[0, -0.5, 0]} />

      {/* Back */}
      <mesh position={[0, 0, -0.1]} geometry={BACK_GEO} material={BACK_MAT} />

      {children}
    </group>
  );
}

/* ───────────────────────────────────────────────────────────────
 * FlyInPiece – Animates a domino tile from a start position (e.g.
 * an opponent's seat) to its target position on the board.
 * The tile arcs through the air, rotates to match the board layout,
 * and lands with a brief ease-out.
 *
 * Duration: ~0.45s  |  Arc height: ~5 units above midpoint
 * ─────────────────────────────────────────────────────────────── */
const _euler = new THREE.Euler();
const _qCurrent = new THREE.Quaternion();

function useFlyQuats(fromRot: Vec3, targetRot: Vec3) {
  return useRef({
    qs: new THREE.Quaternion().setFromEuler(
      new THREE.Euler(fromRot[0], fromRot[1], fromRot[2]),
    ),
    qe: new THREE.Quaternion().setFromEuler(
      new THREE.Euler(targetRot[0], targetRot[1], targetRot[2]),
    ),
  }).current;
}

export function FlyInPiece({
  domino,
  fromPos,
  fromRot,
  targetPos,
  targetRot,
  onDone,
}: {
  domino: Domino;
  fromPos: Vec3;
  fromRot: Vec3;
  targetPos: Vec3;
  targetRot: Vec3;
  onDone?: () => void;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const progress = useRef(0);
  const done = useRef(false);
  const doneCallback = useRef(onDone);
  doneCallback.current = onDone;

  const quats = useFlyQuats(fromRot, targetRot);

  useFrame((_, delta) => {
    if (!groupRef.current || done.current) return;

    const dt = Math.min(delta, 0.05);
    const speed = 2.5; // ~0.4s total
    progress.current += dt * speed;

    if (progress.current >= 1) {
      progress.current = 1;
      done.current = true;
      groupRef.current.position.set(...targetPos);
      groupRef.current.rotation.set(...targetRot);
      doneCallback.current?.();
      return;
    }

    const t = progress.current;
    // Smooth ease-out: fast start, gentle landing
    const eased = 1 - (1 - t) * (1 - t);

    // Lerp position
    const x = fromPos[0] + (targetPos[0] - fromPos[0]) * eased;
    const z = fromPos[2] + (targetPos[2] - fromPos[2]) * eased;
    // Arc: parabolic height — peaks at ~5 units high
    const arcHeight = 4 * t * (1 - t) * 5;
    const y = fromPos[1] + (targetPos[1] - fromPos[1]) * eased + arcHeight;

    groupRef.current.position.set(x, y, z);

    // Slerp rotation
    _qCurrent.slerpQuaternions(quats.qs, quats.qe, eased);
    groupRef.current.quaternion.copy(_qCurrent);
  });

  return (
    <group ref={groupRef} position={fromPos} rotation={fromRot}>
      <RoundedBox args={[1, 2, 0.18]} radius={0.06} smoothness={2}>
        <meshStandardMaterial
          color="#f5f5f0"
          metalness={0.05}
          roughness={0.25}
        />
      </RoundedBox>
      <mesh
        position={[0, 0, 0.1]}
        geometry={DIVIDER_GEO}
        material={DIVIDER_MAT}
      />
      <DominoHalf value={domino.left} offset={[0, 0.5, 0]} />
      <DominoHalf value={domino.right} offset={[0, -0.5, 0]} />
      <mesh position={[0, 0, -0.1]} geometry={BACK_GEO} material={BACK_MAT} />
    </group>
  );
}
