"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { Html, OrbitControls } from "@react-three/drei";
import type { LayoutBounds } from "./useSnakeLayout";
import { TURN_RADIUS } from "./constants";
import type { Domino, Team } from "../../lib/gameTypes";
import type { Side, Vec3 } from "./types";
import { useSnakeLayout } from "./useSnakeLayout";
import { Lighting } from "./Lighting";
import { Table } from "./Table";
import { BoardDominoes } from "./BoardDominoes";
import { DominoPiece } from "./DominoPiece";
import { PlayerHand } from "./PlayerHand";
import { HandSlam3D } from "./HandSlam3D";

// Shared geometry + material for opponent tile backs (avoid per-mesh alloc)
const TILE_BOX = new THREE.BoxGeometry(1, 2, 0.18);
const TILE_MAT = new THREE.MeshStandardMaterial({
  color: "#f5f5f0",
  metalness: 0.1,
  roughness: 0.35,
});

export function GameScene({
  board,
  hand,
  isMyTurn,
  getPlayableSidesAction,
  onPlayAction,
  boardLeftEnd = -1,
  boardRightEnd = -1,
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
  bottomPlayerName,
  leftPlayerName,
  topPlayerName,
  rightPlayerName,
  snakeRowSpacing = TURN_RADIUS,
  gameFinished = false,
  blockedEnd = false,
  winSlamEnabled = true,
  screenShakeEnabled = true,
}: {
  board: Domino[];
  hand: Domino[];
  isMyTurn: boolean;
  getPlayableSidesAction: (d: Domino) => Side[];
  onPlayAction: (id: string, s: Side) => void;
  boardLeftEnd?: number;
  boardRightEnd?: number;
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
  bottomPlayerName?: string;
  leftPlayerName?: string;
  topPlayerName?: string;
  rightPlayerName?: string;
  snakeRowSpacing?: number;
  gameFinished?: boolean;
  blockedEnd?: boolean;
  winSlamEnabled?: boolean;
  screenShakeEnabled?: boolean;
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
  const [dragSides, setDragSides] = useState<Side[]>([]);
  const [dragProximity, setDragProximity] = useState({ left: 0, right: 0 });
  const [cameraShake, setCameraShake] = useState(false);
  const [boardImpact, setBoardImpact] = useState(false);

  // ── Track which seat just played the latest tile ──
  // When board grows, the player who placed a tile is the PREVIOUS activeSeat
  type Seat = "bottom" | "left" | "top" | "right";
  const prevActiveSeat = useRef<Seat | null>(null);
  const prevBoardLen = useRef(board.length);
  const [playSeat, setPlaySeat] = useState<Seat | null>(null);

  useEffect(() => {
    if (board.length > prevBoardLen.current && prevActiveSeat.current) {
      // Board just grew — the previous active seat is who placed it
      setPlaySeat(prevActiveSeat.current);
    }
    prevBoardLen.current = board.length;
  }, [board.length]);

  useEffect(() => {
    prevActiveSeat.current = activeSeat;
  }, [activeSeat]);

  // Trigger slam once per finished cycle (including blocked endings)
  const slamTriggeredRef = useRef(false);
  const [showSlam, setShowSlam] = useState(false);
  // Remember the last tile on the board when the game finishes
  const lastTileRef = useRef<Domino | null>(null);
  const lastTilePosRef = useRef<Vec3>([0, 0.1, 0]);
  const { items, leftDrop, rightDrop, bounds } = useSnakeLayout(board, {
    rowSpacing: snakeRowSpacing,
  });

  useEffect(() => {
    if (!gameFinished) {
      slamTriggeredRef.current = false;
      setShowSlam(false);
      return;
    }

    if (blockedEnd) {
      // Blocked game: no slam animation at all
      setShowSlam(false);
      slamTriggeredRef.current = true;
      return;
    }

    if (!slamTriggeredRef.current) {
      lastTileRef.current = board.length > 0 ? board[board.length - 1] : null;
      if (items.length > 0) {
        const lastLayout = items[items.length - 1];
        lastTilePosRef.current = [
          lastLayout.pos[0],
          lastLayout.pos[1],
          lastLayout.pos[2],
        ];
      }
      setShowSlam(winSlamEnabled);
      slamTriggeredRef.current = true;
    }
  }, [gameFinished, blockedEnd, board, winSlamEnabled, items]);

  const onDrag = useCallback(
    (
      active: boolean,
      sides: Side[],
      proximity: { left: number; right: number },
    ) => {
      setAnyDrag(active);
      setDragSides(active ? sides : []);
      setDragProximity(active ? proximity : { left: 0, right: 0 });
    },
    [],
  );

  const lDrop = board.length === 0 ? ([0, 0, 0] as Vec3) : leftDrop;
  const rDrop = board.length === 0 ? ([0, 0, 0] as Vec3) : rightDrop;

  return (
    <>
      <Lighting />
      {/* Scene impact shake: board + nearby environment react to slam */}
      <BoardImpactShake
        active={boardImpact}
        onDone={() => setBoardImpact(false)}
      >
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
        <SeatNameLabels
          bottom={bottomPlayerName}
          left={leftPlayerName}
          top={topPlayerName}
          right={rightPlayerName}
          seatTeams={seatTeams}
          teamColors={teamColors}
          activeSeat={activeSeat}
        />
        <TurnSeatMarker seat={activeSeat} />
        {!revealAllHands && (
          <DropZoneGlow
            leftDrop={lDrop}
            rightDrop={rDrop}
            myTurn={isMyTurn}
            dragSides={dragSides}
            dragging={anyDrag}
            proximity={dragProximity}
            boardCount={board.length}
          />
        )}
        <BoardDominoes board={board} items={items} playSeat={playSeat} />
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
      </BoardImpactShake>
      {/* Hand slam animation on game end */}
      <HandSlam3D
        active={showSlam && winSlamEnabled && !blockedEnd}
        onShakeAction={() => {
          if (screenShakeEnabled) setCameraShake(true);
        }}
        onImpactAction={() => setBoardImpact(true)}
        lastTile={lastTileRef.current}
        targetPos={lastTilePosRef.current}
      />
      <CameraShake active={cameraShake} onDone={() => setCameraShake(false)} />
      <CameraAutoFit bounds={bounds} boardCount={board.length} />
      <OrbitControls
        enabled={!anyDrag}
        maxPolarAngle={Math.PI / 2.2}
        minPolarAngle={Math.PI / 6}
        minDistance={8}
        maxDistance={55}
        enablePan={false}
        enableZoom={true}
        zoomSpeed={0.6}
        enableDamping={false}
        target={[0, 0, 2]}
      />
    </>
  );
}

function SeatNameLabels({
  bottom,
  left,
  top,
  right,
  seatTeams,
  teamColors,
  activeSeat,
}: {
  bottom?: string;
  left?: string;
  top?: string;
  right?: string;
  seatTeams: {
    bottom: Team | null | undefined;
    left: Team | null | undefined;
    top: Team | null | undefined;
    right: Team | null | undefined;
  };
  teamColors: { team1: string; team2: string };
  activeSeat?: "bottom" | "left" | "top" | "right" | null;
}) {
  const { size } = useThree();
  const names = { bottom, left, top, right } as const;

  // Responsive scale factor: 1 at ≥900px, shrinks down to 0.45 at ~360px
  const scale = Math.max(0.45, Math.min(1, size.width / 900));

  const positions: Record<"bottom" | "left" | "top" | "right", Vec3> = {
    bottom: [0, 3.2, 17.5],
    top: [0, 3.2, -17.5],
    left: [-17.5, 3.2, 0],
    right: [17.5, 3.2, 0],
  };

  const fontSize = Math.round(36 * scale);
  const emojiSize = Math.round(28 * scale);
  const dotSize = Math.round(14 * scale);
  const padV = Math.round(8 * scale);
  const padH = Math.round(20 * scale);
  const padDot = Math.round(16 * scale);
  const radius = Math.round(28 * scale);
  const borderW = Math.max(1.5, 2 * scale);

  return (
    <>
      {(Object.keys(names) as Array<keyof typeof names>).map((seat) => {
        const name = names[seat];
        if (!name) return null;
        const team = seatTeams[seat];
        const accent = team ? teamColors[team] : "#94a3b8";
        const isActive = activeSeat === seat;
        return (
          <Html
            key={seat}
            position={positions[seat]}
            center
            distanceFactor={10}
          >
            <div
              className="flex items-center select-none pointer-events-none whitespace-nowrap"
              style={{
                gap: Math.round(8 * scale),
                padding: `${padV}px ${padH}px ${padV}px ${padDot}px`,
                borderRadius: radius,
                background: `linear-gradient(135deg, ${accent}30, rgba(0,0,0,0.7))`,
                backdropFilter: "blur(10px)",
                border: `${borderW}px solid ${accent}`,
                boxShadow: isActive
                  ? `0 0 20px ${accent}aa, 0 0 8px ${accent}60, inset 0 0 12px ${accent}20`
                  : `0 0 12px ${accent}50, 0 0 4px rgba(0,0,0,0.5)`,
                transition: "box-shadow 0.3s ease",
              }}
            >
              {/* Team color dot */}
              <span
                style={{
                  display: "inline-block",
                  width: dotSize,
                  height: dotSize,
                  borderRadius: "50%",
                  background: accent,
                  boxShadow: `0 0 8px ${accent}, 0 0 3px ${accent}`,
                  flexShrink: 0,
                }}
              />
              <span
                style={{
                  color: "#fff",
                  fontSize,
                  fontWeight: 700,
                  letterSpacing: 0.5,
                  textShadow: `0 0 8px ${accent}80, 0 2px 4px rgba(0,0,0,0.6)`,
                }}
              >
                {name}
              </span>
              {isActive && (
                <span
                  style={{
                    fontSize: emojiSize,
                    marginLeft: Math.round(4 * scale),
                    filter: "drop-shadow(0 0 4px rgba(255,200,0,0.8))",
                  }}
                >
                  🎲
                </span>
              )}
            </div>
          </Html>
        );
      })}
    </>
  );
}

function DropZoneGlow({
  leftDrop,
  rightDrop,
  myTurn,
  dragSides,
  dragging,
  proximity,
  boardCount,
}: {
  leftDrop: Vec3;
  rightDrop: Vec3;
  myTurn: boolean;
  dragSides: Side[];
  dragging: boolean;
  proximity: { left: number; right: number };
  boardCount: number;
}) {
  // Pulse clock for idle state (0→1→0 over ~2s)
  const pulseRef = useRef(0);
  useFrame((_, dt) => {
    pulseRef.current = (pulseRef.current + dt * 1.8) % (Math.PI * 2);
  });
  const pulse = (Math.sin(pulseRef.current) + 1) / 2; // 0..1

  if (!myTurn) return null;

  // First tile: show a single centre glow
  if (boardCount === 0) {
    const idleOp = 0.14 + pulse * 0.12;
    const idleEm = 0.5 + pulse * 0.6;
    return (
      <mesh position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.9, 1.45, 48]} />
        <meshStandardMaterial
          color="#a5f3fc"
          emissive="#22d3ee"
          emissiveIntensity={idleEm}
          transparent
          opacity={idleOp}
        />
      </mesh>
    );
  }

  const leftActive = dragSides.length === 0 || dragSides.includes("left");
  const rightActive = dragSides.length === 0 || dragSides.includes("right");
  const leftBoost = dragging ? proximity.left : 0;
  const rightBoost = dragging ? proximity.right : 0;

  // Inner ring: opacity 0 at rest, glows on proximity
  const leftInnerOpacity = leftBoost * 0.88;
  const rightInnerOpacity = rightBoost * 0.88;
  const leftInnerIntensity = leftBoost * 3.5;
  const rightInnerIntensity = rightBoost * 3.5;

  // Outer ring: also 0 at rest
  const leftOuterOpacity = leftBoost * 0.5;
  const rightOuterOpacity = rightBoost * 0.5;
  const leftOuterIntensity = leftBoost * 1.8;
  const rightOuterIntensity = rightBoost * 1.8;

  return (
    <>
      {/* ── Left drop zone ── */}
      {leftActive && (
        <>
          <mesh
            position={[leftDrop[0], 0.055, leftDrop[2]]}
            rotation={[-Math.PI / 2, 0, 0]}
          >
            <ringGeometry args={[0.86, 1.22, 48]} />
            <meshStandardMaterial
              color="#93c5fd"
              emissive="#60a5fa"
              emissiveIntensity={leftInnerIntensity}
              transparent
              opacity={leftInnerOpacity}
            />
          </mesh>
          <mesh
            position={[leftDrop[0], 0.05, leftDrop[2]]}
            rotation={[-Math.PI / 2, 0, 0]}
          >
            <ringGeometry args={[1.25, 1.72, 48]} />
            <meshStandardMaterial
              color="#60a5fa"
              emissive="#3b82f6"
              emissiveIntensity={leftOuterIntensity}
              transparent
              opacity={leftOuterOpacity}
            />
          </mesh>
        </>
      )}

      {/* ── Right drop zone ── */}
      {rightActive && (
        <>
          <mesh
            position={[rightDrop[0], 0.055, rightDrop[2]]}
            rotation={[-Math.PI / 2, 0, 0]}
          >
            <ringGeometry args={[0.86, 1.22, 48]} />
            <meshStandardMaterial
              color="#fdba74"
              emissive="#fb923c"
              emissiveIntensity={rightInnerIntensity}
              transparent
              opacity={rightInnerOpacity}
            />
          </mesh>
          <mesh
            position={[rightDrop[0], 0.05, rightDrop[2]]}
            rotation={[-Math.PI / 2, 0, 0]}
          >
            <ringGeometry args={[1.25, 1.72, 48]} />
            <meshStandardMaterial
              color="#fb923c"
              emissive="#f97316"
              emissiveIntensity={rightOuterIntensity}
              transparent
              opacity={rightOuterOpacity}
            />
          </mesh>
        </>
      )}
    </>
  );
}

/* ────────────────────────────────────────────────────────────
 * Auto-fit camera: zoom the camera so the full board always
 * fits inside the viewport, regardless of phone orientation.
 * Smoothly adjusts whenever the board grows or shrinks.
 * ──────────────────────────────────────────────────────────── */
function CameraAutoFit({
  bounds,
  boardCount,
}: {
  bounds: LayoutBounds;
  boardCount: number;
}) {
  const { camera, size } = useThree();

  useEffect(() => {
    const cam = camera as THREE.PerspectiveCamera;
    const aspect = size.width / size.height;

    const extentX = bounds.maxX - bounds.minX;
    const extentZ = bounds.maxZ - bounds.minZ + 12; // extra Z for player hand area

    const fovRad = cam.fov * (Math.PI / 180);

    // Distance needed to fit the vertical extent
    const distZ = extentZ / (2 * Math.tan(fovRad / 2));
    // Distance needed to fit the horizontal extent (account for aspect ratio)
    const distX = extentX / (2 * Math.tan(fovRad / 2) * aspect);

    const idealDist = Math.max(distX, distZ) + 2;
    // Clamp: never closer than 14, never farther than 55
    const clamped = Math.min(Math.max(idealDist, 14), 55);

    // Keep the same look-angle, just move further back / closer
    const dir = cam.position.clone().normalize();
    cam.position.copy(dir.multiplyScalar(clamped));
    cam.updateProjectionMatrix();
  }, [bounds, boardCount, camera, size]);

  return null;
}

/* ────────────────────────────────────────────────────────────
 * CameraShake: brief camera shake when the hand slams the table
 * ──────────────────────────────────────────────────────────── */
function CameraShake({
  active,
  onDone,
}: {
  active: boolean;
  onDone: () => void;
}) {
  const elapsed = useRef(0);
  const origPos = useRef<THREE.Vector3 | null>(null);
  const { camera } = useThree();

  useEffect(() => {
    if (active) {
      elapsed.current = 0;
      origPos.current = camera.position.clone();
    }
  }, [active, camera]);

  useFrame((_, delta) => {
    if (!active || !origPos.current) return;
    elapsed.current += delta;
    const duration = 0.5; // shake lasts 0.5s
    if (elapsed.current > duration) {
      camera.position.copy(origPos.current);
      origPos.current = null;
      onDone();
      return;
    }
    const intensity = 0.25 * (1 - elapsed.current / duration); // decays
    camera.position.x = origPos.current.x + (Math.random() - 0.5) * intensity;
    camera.position.y = origPos.current.y + (Math.random() - 0.5) * intensity;
  });

  return null;
}

/* ──────────────────────────────────────────────────────────────
 * BoardImpactShake: wraps board tiles in a group that jolts on slam impact.
 * Tiles jump up, rattle sideways, and settle back down over ~0.7s.
 * ────────────────────────────────────────────────────────────── */
function BoardImpactShake({
  active,
  onDone,
  children,
}: {
  active: boolean;
  onDone: () => void;
  children: ReactNode;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const elapsed = useRef(0);

  useEffect(() => {
    if (active) elapsed.current = 0;
  }, [active]);

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    if (!active) {
      // Ensure resting state
      groupRef.current.position.set(0, 0, 0);
      groupRef.current.rotation.set(0, 0, 0);
      return;
    }

    elapsed.current += Math.min(delta, 0.05);
    const duration = 0.9;

    if (elapsed.current > duration) {
      groupRef.current.position.set(0, 0, 0);
      groupRef.current.rotation.set(0, 0, 0);
      onDone();
      return;
    }

    const t = elapsed.current / duration; // 0→1
    const decay = 1 - t; // 1→0

    // Jump: tiles pop up on impact, then land
    const jumpY = Math.sin(t * Math.PI * 2) * 0.24 * decay;
    // Rattle sideways
    const rattleX = Math.sin(elapsed.current * 72) * 0.12 * decay;
    const rattleZ = Math.cos(elapsed.current * 64) * 0.1 * decay;
    // Slight rotational jitter
    const jitterRot = Math.sin(elapsed.current * 70) * 0.02 * decay;

    groupRef.current.position.set(rattleX, jumpY, rattleZ);
    groupRef.current.rotation.set(jitterRot * 0.5, jitterRot, 0);
  });

  return <group ref={groupRef}>{children}</group>;
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
        <ringGeometry args={[2.2, 2.75, 16]} />
        <meshStandardMaterial
          color="#ffe066"
          emissive="#ffd24a"
          emissiveIntensity={1.6}
          transparent
          opacity={0.65}
        />
      </mesh>
      <Html position={emojiPos[seat]} center distanceFactor={10}>
        <div className="text-xl select-none pointer-events-none">⭐</div>
      </Html>
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
            <circleGeometry args={[2.8, 16]} />
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
  const visible = Math.min(count, 8);
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
          <mesh
            key={i}
            position={[x, y, z]}
            rotation={rot}
            geometry={TILE_BOX}
            material={TILE_MAT}
          />
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
    <Html position={position} center distanceFactor={12}>
      <div
        className="px-2 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap select-none pointer-events-none"
        style={{ color, background: "rgba(0,0,0,0.35)" }}
      >
        {label}
      </div>
    </Html>
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
