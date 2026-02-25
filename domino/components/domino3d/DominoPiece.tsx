"use client";

import { useEffect, useState, type ReactNode } from "react";
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
      <mesh position={[0, 0, 0.1]} geometry={DIVIDER_GEO} material={DIVIDER_MAT} />

      {/* Pips */}
      <DominoHalf value={domino.left} offset={[0, 0.5, 0]} />
      <DominoHalf value={domino.right} offset={[0, -0.5, 0]} />

      {/* Back */}
      <mesh position={[0, 0, -0.1]} geometry={BACK_GEO} material={BACK_MAT} />

      {children}
    </group>
  );
}
