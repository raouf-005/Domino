"use client";

import { useCallback, useState } from "react";
import * as THREE from "three";
import { ContactShadows, OrbitControls } from "@react-three/drei";
import type { Domino } from "../../lib/gameTypes";
import type { Side, Vec3 } from "./types";
import { useSnakeLayout } from "./useSnakeLayout";
import { Lighting } from "./Lighting";
import { Table } from "./Table";
import { BoardDominoes } from "./BoardDominoes";
import { PlayerHand } from "./PlayerHand";

export function GameScene({
  board,
  hand,
  isMyTurn,
  getPlayableSidesAction,
  onPlayAction,
  topHandCount = 0,
  leftHandCount = 0,
  rightHandCount = 0,
}: {
  board: Domino[];
  hand: Domino[];
  isMyTurn: boolean;
  getPlayableSidesAction: (d: Domino) => Side[];
  onPlayAction: (id: string, s: Side) => void;
  topHandCount?: number;
  leftHandCount?: number;
  rightHandCount?: number;
}) {
  const [anyDrag, setAnyDrag] = useState(false);
  const { items, leftDrop, rightDrop } = useSnakeLayout(board);

  const onDrag = useCallback((active: boolean) => setAnyDrag(active), []);

  const lDrop = board.length === 0 ? ([0, 0, 0] as Vec3) : leftDrop;
  const rDrop = board.length === 0 ? ([0, 0, 0] as Vec3) : rightDrop;

  return (
    <>
      <Lighting />
      <fog attach="fog" args={["#0a2e1a", 35, 70]} />
      <Table />
      <HandStacks3D
        top={topHandCount}
        left={leftHandCount}
        right={rightHandCount}
      />
      <BoardDominoes board={board} items={items} />
      <PlayerHand
        hand={hand}
        myTurn={isMyTurn}
        sides={getPlayableSidesAction}
        onPlay={onPlayAction}
        onDrag={onDrag}
        leftDrop={lDrop}
        rightDrop={rDrop}
      />
      <ContactShadows
        position={[0, -0.14, 0]}
        opacity={0.4}
        scale={60}
        blur={2}
      />
      <OrbitControls
        enabled={!anyDrag}
        maxPolarAngle={Math.PI / 2.2}
        minPolarAngle={Math.PI / 6}
        minDistance={8}
        maxDistance={35}
        enablePan={false}
        target={[0, 0, 2]}
      />
    </>
  );
}

function HandArc({
  count,
  center,
  radius = 6,
  baseAngle,
  span = Math.PI / 2,
  tilt = -Math.PI / 12,
}: {
  count: number;
  center: [number, number, number];
  radius?: number;
  baseAngle: number;
  span?: number;
  tilt?: number;
}) {
  const visible = Math.min(count, 12);
  const tiles = Array.from({ length: visible });
  return (
    <>
      {tiles.map((_, i) => {
        const t = visible === 1 ? 0.5 : i / (visible - 1);
        const theta = baseAngle - span / 2 + t * span;
        const x = center[0] + Math.cos(theta) * radius;
        const z = center[2] + Math.sin(theta) * radius;
        const y = center[1] + 0.12 + i * 0.01;
        const yRot = Math.atan2(0 - x, 0 - z);
        const rot = new THREE.Euler(tilt, yRot, 0, "YXZ");
        return (
          <mesh key={i} position={[x, y, z]} rotation={rot}>
            <boxGeometry args={[1, 2, 0.18]} />
            <meshStandardMaterial
              color="#f5f5f0"
              metalness={0.1}
              roughness={0.35}
            />
          </mesh>
        );
      })}
    </>
  );
}

function HandStacks3D({
  top,
  left,
  right,
}: {
  top: number;
  left: number;
  right: number;
}) {
  return (
    <>
      <HandArc
        count={top}
        center={[0, 0, -20.5]}
        radius={6}
        baseAngle={Math.PI / 2}
        span={Math.PI / 2.9}
        tilt={Math.PI / 6}
      />
      <HandArc
        count={left}
        center={[-20.5, 0, 0]}
        radius={6}
        baseAngle={0}
        span={Math.PI / 2.9}
        tilt={Math.PI / 6}
      />
      <HandArc
        count={right}
        center={[20.5, 0, 0]}
        radius={6}
        baseAngle={Math.PI}
        span={Math.PI / 2.9}
        tilt={Math.PI / 6}
      />
    </>
  );
}
