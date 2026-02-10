"use client";

import { useEffect, useState, type ReactNode } from "react";
import { RoundedBox } from "@react-three/drei";
import { useSpring, animated } from "@react-spring/three";
import type { Domino } from "../../lib/gameTypes";
import type { Vec3 } from "./types";
import { DominoHalf } from "./DominoHalf";

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

const AnimGroup = animated.group;

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

  const spring = useSpring({
    pos: visible
      ? targetPos
      : ([targetPos[0], targetPos[1] + 8, targetPos[2]] as Vec3),
    rot: visible ? targetRot : ([0, targetRot[1], targetRot[2]] as Vec3),
    scale: visible ? s : 0.6,
    config: {
      mass: 2.5,
      tension: 180,
      friction: 22,
      clamp: false,
    },
    immediate: !dropIn && !visible,
  });

  return (
    <AnimGroup
      position={spring.pos as unknown as Vec3}
      rotation={spring.rot as unknown as Vec3}
      scale={spring.scale.to((v: number) => [v, v, v]) as unknown as Vec3}
    >
      {/* Body */}
      <RoundedBox args={[1, 2, 0.18]} radius={0.06} smoothness={4}>
        <meshStandardMaterial
          color={color}
          metalness={0.05}
          roughness={0.25}
          emissive={emissive}
          emissiveIntensity={emissiveIntensity}
        />
      </RoundedBox>

      {/* Divider */}
      <mesh position={[0, 0, 0.1]}>
        <boxGeometry args={[0.8, 0.03, 0.01]} />
        <meshStandardMaterial color="#555" metalness={0.5} roughness={0.5} />
      </mesh>

      {/* Pips */}
      <DominoHalf value={domino.left} offset={[0, 0.5, 0]} />
      <DominoHalf value={domino.right} offset={[0, -0.5, 0]} />

      {/* Back */}
      <mesh position={[0, 0, -0.1]}>
        <boxGeometry args={[1.02, 2.02, 0.01]} />
        <meshStandardMaterial color="#1a1a1a" metalness={0.8} roughness={0.2} />
      </mesh>

      {children}
    </AnimGroup>
  );
}
