"use client";

import { useCallback, useState } from "react";
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
}: {
  board: Domino[];
  hand: Domino[];
  isMyTurn: boolean;
  getPlayableSidesAction: (d: Domino) => Side[];
  onPlayAction: (id: string, s: Side) => void;
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
