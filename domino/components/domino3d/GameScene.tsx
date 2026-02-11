"use client";

import { useCallback, useState } from "react";
import * as THREE from "three";
import {
  Billboard,
  ContactShadows,
  OrbitControls,
  Text,
} from "@react-three/drei";
import type { Domino, Team } from "../../lib/gameTypes";
import type { Side, Vec3 } from "./types";
import { useSnakeLayout } from "./useSnakeLayout";
import { Lighting } from "./Lighting";
import { Table } from "./Table";
import { BoardDominoes } from "./BoardDominoes";
import { DominoPiece } from "./DominoPiece";
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
  revealAllHands = false,
  revealTopHand = [],
  revealLeftHand = [],
  revealRightHand = [],
  activeSeat = null,
  bottomTeam = null,
  leftTeam = null,
  topTeam = null,
  rightTeam = null,
}: {
  board: Domino[];
  hand: Domino[];
  isMyTurn: boolean;
  getPlayableSidesAction: (d: Domino) => Side[];
  onPlayAction: (id: string, s: Side) => void;
  topHandCount?: number;
  leftHandCount?: number;
  rightHandCount?: number;
  revealAllHands?: boolean;
  revealTopHand?: Domino[];
  revealLeftHand?: Domino[];
  revealRightHand?: Domino[];
  activeSeat?: "bottom" | "left" | "top" | "right" | null;
  bottomTeam?: Team | null;
  leftTeam?: Team | null;
  topTeam?: Team | null;
  rightTeam?: Team | null;
}) {
  const teamColors = {
    team1: "#4aa3ff",
    team2: "#ff5a5f",
  } as const;

  const seatTeams = {
    bottom: bottomTeam,
    left: leftTeam,
    top: topTeam,
    right: rightTeam,
  } as const;
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
      {revealAllHands ? (
        <HandTiles3D
          top={revealTopHand}
          left={revealLeftHand}
          right={revealRightHand}
          bottom={hand}
          seatTeams={seatTeams}
          teamColors={teamColors}
        />
      ) : (
        <HandStacks3D
          top={topHandCount}
          left={leftHandCount}
          right={rightHandCount}
        />
      )}
      <TeamSeatGlows seatTeams={seatTeams} teamColors={teamColors} />
      <TurnSeatMarker seat={activeSeat} />
      {!revealAllHands && <BoardDominoes board={board} items={items} />}
      {!revealAllHands && (
        <PlayerHand
          hand={hand}
          myTurn={isMyTurn}
          sides={getPlayableSidesAction}
          onPlay={onPlayAction}
          onDrag={onDrag}
          leftDrop={lDrop}
          rightDrop={rDrop}
        />
      )}
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

function TurnSeatMarker({
  seat,
}: {
  seat: "bottom" | "left" | "top" | "right" | null;
}) {
  if (!seat) return null;

  const seatPos: Record<
    "bottom" | "left" | "top" | "right",
    [number, number, number]
  > = {
    bottom: [0, 0.12, 19.5],
    top: [0, 0.12, -19.5],
    left: [-19.5, 0.12, 0],
    right: [19.5, 0.12, 0],
  };

  const emojiPos: Record<
    "bottom" | "left" | "top" | "right",
    [number, number, number]
  > = {
    bottom: [0, 2.1, 18.2],
    top: [0, 2.1, -18.2],
    left: [-18.2, 2.1, 0],
    right: [18.2, 2.1, 0],
  };

  return (
    <>
      <mesh position={seatPos[seat]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[2.2, 2.75, 48]} />
        <meshStandardMaterial
          color="#ffe066"
          emissive="#ffd24a"
          emissiveIntensity={1.6}
          transparent
          opacity={0.65}
        />
      </mesh>
      <Billboard position={emojiPos[seat]} follow>
        <Text
          fontSize={0.8}
          color="#fff6cc"
          outlineWidth={0.05}
          outlineColor="#6b4b00"
          anchorX="center"
          anchorY="middle"
        >
          ⭐
        </Text>
      </Billboard>
    </>
  );
}

function TeamSeatGlows({
  seatTeams,
  teamColors,
}: {
  seatTeams: {
    bottom: Team | null | undefined;
    left: Team | null | undefined;
    top: Team | null | undefined;
    right: Team | null | undefined;
  };
  teamColors: { team1: string; team2: string };
}) {
  const seats: Array<"bottom" | "left" | "top" | "right"> = [
    "bottom",
    "left",
    "top",
    "right",
  ];
  const seatPos: Record<
    "bottom" | "left" | "top" | "right",
    [number, number, number]
  > = {
    bottom: [0, 0.06, 14.5],
    top: [0, 0.06, -14.5],
    left: [-14.5, 0.06, 0],
    right: [14.5, 0.06, 0],
  };

  return (
    <>
      {seats.map((seat) => {
        const team = seatTeams[seat];
        if (!team) return null;
        const color = teamColors[team];
        return (
          <mesh
            key={seat}
            position={seatPos[seat]}
            rotation={[-Math.PI / 2, 0, 0]}
          >
            <circleGeometry args={[2.8, 48]} />
            <meshStandardMaterial
              color={color}
              emissive={color}
              emissiveIntensity={0.55}
              transparent
              opacity={0.18}
            />
          </mesh>
        );
      })}
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

function HandArcTiles({
  dominoes,
  center,
  radius = 6,
  baseAngle,
  span,
  face,
}: {
  dominoes: Domino[];
  center: [number, number, number];
  radius?: number;
  baseAngle: number;
  span?: number;
  face: "bottom" | "left" | "right" | "top";
}) {
  const visible = dominoes.length;
  const tiles = dominoes;
  const arcSpan =
    span ?? Math.min(Math.PI / 2.2, 0.4 + Math.max(0, visible - 1) * 0.1);
  const zRot =
    face === "left" ? Math.PI / 2 : face === "right" ? -Math.PI / 2 : 0;
  return (
    <>
      {tiles.map((d, i) => {
        const t = visible === 1 ? 0.5 : i / (visible - 1);
        const theta = baseAngle - arcSpan / 2 + t * arcSpan;
        const x = center[0] + Math.cos(theta) * radius;
        const z = center[2] + Math.sin(theta) * radius;
        const y = center[1] + 0.11 + i * 0.003;
        const rot = new THREE.Euler(-Math.PI / 2, 0, zRot, "YXZ");
        return (
          <DominoPiece
            key={d.id}
            domino={d}
            targetPos={[x, y, z]}
            targetRot={[rot.x, rot.y, rot.z]}
            scale={0.95}
          />
        );
      })}
    </>
  );
}

function HandCountLabel({
  position,
  label,
  color = "#ffffff",
}: {
  position: [number, number, number];
  label: string;
  color?: string;
}) {
  return (
    <Billboard
      position={position}
      follow
      lockX={false}
      lockY={false}
      lockZ={false}
    >
      <Text
        fontSize={0.55}
        color={color}
        outlineWidth={0.04}
        outlineColor="#0a2e1a"
        anchorX="center"
        anchorY="middle"
      >
        {label}
      </Text>
    </Billboard>
  );
}

function HandTiles3D({
  top,
  left,
  right,
  bottom,
  seatTeams,
  teamColors,
}: {
  top: Domino[];
  left: Domino[];
  right: Domino[];
  bottom: Domino[];
  seatTeams: {
    bottom: Team | null | undefined;
    left: Team | null | undefined;
    top: Team | null | undefined;
    right: Team | null | undefined;
  };
  teamColors: { team1: string; team2: string };
}) {
  const sum = (hand: Domino[]) =>
    hand.reduce((total, d) => total + d.left + d.right, 0);

  const labelColor = (team: Team | null | undefined) =>
    team ? teamColors[team] : "#ffffff";
  return (
    <>
      <HandArcTiles
        dominoes={top}
        center={[0, 0, -17.0]}
        radius={4.8}
        baseAngle={Math.PI / 2}
        face="bottom"
      />
      <HandCountLabel
        position={[0, 1.25, -15.0]}
        label={`${sum(top)} pts`}
        color={labelColor(seatTeams.top)}
      />
      <HandArcTiles
        dominoes={left}
        center={[-17.0, 0, 0]}
        radius={4.8}
        baseAngle={0}
        face="right"
      />
      <HandCountLabel
        position={[-15.0, 1.25, 0]}
        label={`${sum(left)} pts`}
        color={labelColor(seatTeams.left)}
      />
      <HandArcTiles
        dominoes={right}
        center={[17.0, 0, 0]}
        radius={4.8}
        baseAngle={Math.PI}
        face="left"
      />
      <HandCountLabel
        position={[15.0, 1.25, 0]}
        label={`${sum(right)} pts`}
        color={labelColor(seatTeams.right)}
      />
      <HandArcTiles
        dominoes={bottom}
        center={[0, 0, 13.5]}
        radius={4.8}
        baseAngle={-Math.PI / 2}
        face="bottom"
      />
      <HandCountLabel
        position={[0, 1.25, 12.0]}
        label={`${sum(bottom)} pts`}
        color={labelColor(seatTeams.bottom)}
      />
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
