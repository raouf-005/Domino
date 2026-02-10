"use client";

import {
  useRef,
  useMemo,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from "react";
import {
  Canvas,
  useFrame,
  useThree,
  type ThreeEvent,
} from "@react-three/fiber";
import {
  RoundedBox,
  ContactShadows,
  OrbitControls,
  Html,
} from "@react-three/drei";
import {
  useSpring,
  animated,
  config as springPresets,
} from "@react-spring/three";
import * as THREE from "three";
import type { Domino } from "../lib/gameTypes";

/* ================================================================
   TYPES
   ================================================================ */

type Vec3 = [number, number, number];
type Side = "left" | "right";

/* ================================================================
   CONSTANTS
   ================================================================ */

/** Table size constraints for the snake layout */
const TABLE_HALF_W = 18; // max X extent before turning
const PIECE_GAP = 0.3;
const DOUBLE_W = 1.2;
const NORMAL_W = 2.2;
const TURN_RADIUS = 2.5; // spacing when the chain turns a corner

/** Domino dot positions by pip count */
const DOT_MAP: Record<number, [number, number][]> = {
  0: [],
  1: [[0, 0]],
  2: [
    [0.25, 0.25],
    [-0.25, -0.25],
  ],
  3: [
    [0.25, 0.25],
    [0, 0],
    [-0.25, -0.25],
  ],
  4: [
    [-0.25, 0.25],
    [0.25, 0.25],
    [-0.25, -0.25],
    [0.25, -0.25],
  ],
  5: [
    [-0.25, 0.25],
    [0.25, 0.25],
    [0, 0],
    [-0.25, -0.25],
    [0.25, -0.25],
  ],
  6: [
    [-0.25, 0.25],
    [0.25, 0.25],
    [-0.25, 0],
    [0.25, 0],
    [-0.25, -0.25],
    [0.25, -0.25],
  ],
};

/* ================================================================
   HOOKS
   ================================================================ */

/**
 * Snake-style board layout.
 *
 * Pieces are placed left-to-right. When the chain would exceed TABLE_HALF_W
 * it turns DOWN then continues in the opposite direction, like a real domino
 * table. Doubles are always vertical (narrow), others horizontal (wide).
 *
 * Returns per-piece position + rotation, plus drop-zone anchor positions.
 */
interface LayoutItem {
  pos: Vec3;
  rot: Vec3;
  isDouble: boolean;
}

function useSnakeLayout(board: Domino[]) {
  return useMemo(() => {
    if (board.length === 0) {
      return {
        items: [] as LayoutItem[],
        leftDrop: [0, 0, 0] as Vec3,
        rightDrop: [0, 0, 0] as Vec3,
      };
    }

    const items: LayoutItem[] = [];

    // Direction: 1 = right, -1 = left
    let dir = 1;
    let x = 0;
    let z = 0;
    let prevHalfW = 0;

    for (let i = 0; i < board.length; i++) {
      const d = board[i];
      const isDouble = d.left === d.right;
      const halfW = (isDouble ? DOUBLE_W : NORMAL_W) / 2;

      if (i === 0) {
        // First piece at origin
        x = 0;
        z = 0;
      } else {
        const nextX = x + dir * (prevHalfW + PIECE_GAP + halfW);

        // Check if we'd go out of bounds
        if (Math.abs(nextX) > TABLE_HALF_W) {
          // Turn: move down, flip direction
          z += TURN_RADIUS;
          dir *= -1;
          x = x + dir * (prevHalfW + PIECE_GAP + halfW);
        } else {
          x = nextX;
        }
      }

      // Flat on table, face up.  Doubles: vertical (no Z-rotation), others: horizontal (90-deg Z)
      const rotY = 0;
      const rotZ = isDouble ? 0 : Math.PI / 2;
      items.push({
        pos: [x, 0.1, z],
        rot: [-Math.PI / 2, rotY, rotZ],
        isDouble,
      });

      prevHalfW = halfW;
    }

    // Center the whole chain
    const allX = items.map((it) => it.pos[0]);
    const allZ = items.map((it) => it.pos[2]);
    const cx = (Math.min(...allX) + Math.max(...allX)) / 2;
    const cz = (Math.min(...allZ) + Math.max(...allZ)) / 2;
    for (const it of items) {
      it.pos[0] -= cx;
      it.pos[2] -= cz;
    }

    // Drop positions: just beyond the first / last piece
    const first = items[0];
    const last = items[items.length - 1];
    const fHW = board[0].left === board[0].right ? DOUBLE_W / 2 : NORMAL_W / 2;
    const lHW =
      board[board.length - 1].left === board[board.length - 1].right
        ? DOUBLE_W / 2
        : NORMAL_W / 2;

    // Left drop: opposite to the direction the chain started
    const leftDrop: Vec3 = [first.pos[0] - 1.8 * (fHW + 0.5), 0, first.pos[2]];
    const rightDrop: Vec3 = [
      last.pos[0] + (items.length > 1 ? dir : 1) * 1.8 * (lHW + 0.5),
      0,
      last.pos[2],
    ];

    return { items, leftDrop, rightDrop };
  }, [board]);
}

/* ================================================================
   ATOMIC — Dot3D / DominoHalf3D
   ================================================================ */

function Dot3D({
  pos,
  offset,
  s = 1,
}: {
  pos: [number, number];
  offset: Vec3;
  s?: number;
}) {
  return (
    <mesh
      position={[
        offset[0] + pos[0] * 0.55 * s,
        offset[1] + pos[1] * 0.55 * s,
        offset[2] + 0.07,
      ]}
    >
      <sphereGeometry args={[0.07 * s, 12, 12]} />
      <meshStandardMaterial color="#1a1a1a" metalness={0.3} roughness={0.4} />
    </mesh>
  );
}

function DominoHalf({
  value,
  offset,
  s = 1,
}: {
  value: number;
  offset: Vec3;
  s?: number;
}) {
  const dots = DOT_MAP[value] ?? [];
  return (
    <>
      {dots.map((p, i) => (
        <Dot3D key={i} pos={p} offset={offset} s={s} />
      ))}
    </>
  );
}

/* ================================================================
   DOMINO PIECE — Spring-animated, reusable tile mesh
   ================================================================ */

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

function DominoPiece({
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

/* ================================================================
   TABLE — Felt surface + wooden rim
   ================================================================ */

function Table() {
  const rim = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#5a3a1a",
        metalness: 0.3,
        roughness: 0.7,
      }),
    [],
  );
  return (
    <group>
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -0.15, 0]}
        receiveShadow
      >
        <planeGeometry args={[55, 35]} />
        <meshStandardMaterial color="#1a5c2a" metalness={0.1} roughness={0.9} />
      </mesh>
      {/* Rim */}
      <mesh position={[0, -0.1, -17.5]} material={rim}>
        <boxGeometry args={[55, 0.4, 0.5]} />
      </mesh>
      <mesh position={[0, -0.1, 17.5]} material={rim}>
        <boxGeometry args={[55, 0.4, 0.5]} />
      </mesh>
      <mesh position={[-27.5, -0.1, 0]} material={rim}>
        <boxGeometry args={[0.5, 0.4, 35.5]} />
      </mesh>
      <mesh position={[27.5, -0.1, 0]} material={rim}>
        <boxGeometry args={[0.5, 0.4, 35.5]} />
      </mesh>
    </group>
  );
}

/* ================================================================
   LIGHTING
   ================================================================ */

function Lighting() {
  return (
    <>
      <ambientLight intensity={0.6} />
      <directionalLight
        position={[8, 12, 8]}
        intensity={1.5}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
      />
      <directionalLight position={[-8, 10, -4]} intensity={0.5} />
      <pointLight position={[0, 8, 10]} intensity={0.6} color="#ffeedd" />
      <pointLight position={[0, 6, -6]} intensity={0.3} color="#ccddff" />
      <hemisphereLight args={["#b1e1ff", "#1a5c2a", 0.4]} />
    </>
  );
}

/* ================================================================
   BOARD DOMINOES — Placed pieces with spring drop-in
   ================================================================ */

function BoardDominoes({
  board,
  items,
}: {
  board: Domino[];
  items: LayoutItem[];
}) {
  // Track which pieces we've "seen" so only new ones animate in
  const seenRef = useRef(new Set<string>());
  const prevLen = useRef(0);

  // Mark new pieces
  const isNew = useMemo(() => {
    const result: boolean[] = [];
    const incoming = new Set(board.map((d) => d.id));
    for (const d of board) {
      result.push(!seenRef.current.has(d.id));
    }
    // Update seen set
    seenRef.current = incoming;
    prevLen.current = board.length;
    return result;
  }, [board]);

  return (
    <>
      {board.map((domino, idx) => {
        const layout = items[idx];
        if (!layout) return null;
        return (
          <DominoPiece
            key={`b-${domino.id}`}
            domino={domino}
            targetPos={layout.pos}
            targetRot={layout.rot}
            dropIn={isNew[idx]}
            dropDelay={isNew[idx] ? 0 : idx * 0.04}
          />
        );
      })}
    </>
  );
}

/* ================================================================
   DRAGGABLE HAND DOMINO
   ================================================================ */

interface DragTileProps {
  domino: Domino;
  index: number;
  total: number;
  playable: boolean;
  myTurn: boolean;
  sides: Side[];
  onPlay: (id: string, side: Side) => void;
  onDrag: (active: boolean, sides: Side[]) => void;
  leftDrop: Vec3;
  rightDrop: Vec3;
}

function DragTile({
  domino,
  index,
  total,
  playable,
  myTurn,
  sides,
  onPlay,
  onDrag,
  leftDrop,
  rightDrop,
}: DragTileProps) {
  const group = useRef<THREE.Group>(null);
  const dragging = useRef(false);
  const [isDrag, setDrag] = useState(false);
  const [hover, setHover] = useState(false);
  const [near, setNear] = useState<Side | null>(null);
  const offset = useRef(new THREE.Vector3());
  const rest = useRef(new THREE.Vector3());
  const { camera, gl } = useThree();

  const spacing = Math.min(1.8, 12 / Math.max(total, 1));
  const ox = (index - (total - 1) / 2) * spacing;
  const handY = 2;
  const handZ = 8;

  useEffect(() => {
    rest.current.set(ox, handY, handZ);
  }, [ox]);

  // Smooth return when not dragging
  useFrame(() => {
    if (!group.current || dragging.current) return;
    group.current.position.lerp(rest.current, 0.12);
    if (hover && playable && myTurn) group.current.position.y = handY + 0.5;
  });

  const plane = useMemo(
    () => new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.5),
    [],
  );

  const rayHit = useCallback(
    (cx: number, cy: number) => {
      const rect = gl.domElement.getBoundingClientRect();
      const m = new THREE.Vector2(
        ((cx - rect.left) / rect.width) * 2 - 1,
        -((cy - rect.top) / rect.height) * 2 + 1,
      );
      const rc = new THREE.Raycaster();
      rc.setFromCamera(m, camera);
      const t = new THREE.Vector3();
      return rc.ray.intersectPlane(plane, t) ? t : null;
    },
    [gl.domElement, camera, plane],
  );

  const down = useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      if (!playable || !myTurn) return;
      e.stopPropagation();
      dragging.current = true;
      setDrag(true);
      onDrag(true, sides);
      gl.domElement.style.cursor = "grabbing";
      const hit = rayHit(e.clientX, e.clientY);
      if (hit && group.current)
        offset.current.copy(group.current.position).sub(hit);
    },
    [playable, myTurn, gl.domElement, rayHit, onDrag, sides],
  );

  const move = useCallback(
    (e: PointerEvent) => {
      if (!dragging.current || !group.current) return;
      const hit = rayHit(e.clientX, e.clientY);
      if (!hit) return;
      const p = hit.add(offset.current);
      group.current.position.set(p.x, 0.5, p.z);
      const px = p.x,
        pz = p.z;
      const dL = Math.hypot(px - leftDrop[0], pz - leftDrop[2]);
      const dR = Math.hypot(px - rightDrop[0], pz - rightDrop[2]);
      const th = 4;
      if (dL < th && sides.includes("left")) setNear("left");
      else if (dR < th && sides.includes("right")) setNear("right");
      else setNear(null);
    },
    [rayHit, leftDrop, rightDrop, sides],
  );

  const up = useCallback(() => {
    if (!dragging.current) return;
    dragging.current = false;
    setDrag(false);
    onDrag(false, []);
    gl.domElement.style.cursor = "auto";
    if (near) onPlay(domino.id, near);
    setNear(null);
  }, [near, onPlay, domino.id, gl.domElement, onDrag]);

  useEffect(() => {
    if (!isDrag) return;
    const c = gl.domElement;
    c.addEventListener("pointermove", move);
    c.addEventListener("pointerup", up);
    window.addEventListener("pointerup", up);
    return () => {
      c.removeEventListener("pointermove", move);
      c.removeEventListener("pointerup", up);
      window.removeEventListener("pointerup", up);
    };
  }, [isDrag, move, up, gl.domElement]);

  const can = playable && myTurn;
  const glow = can
    ? isDrag
      ? "#ffd700"
      : hover
        ? "#66ff66"
        : "#44cc44"
    : "#000000";
  const gi = can ? (isDrag ? 0.6 : hover ? 0.4 : 0.15) : 0;

  return (
    <group
      ref={group}
      position={[ox, handY, handZ]}
      onPointerDown={down}
      onPointerOver={() => {
        setHover(true);
        if (can) gl.domElement.style.cursor = "grab";
      }}
      onPointerOut={() => {
        setHover(false);
        if (!dragging.current) gl.domElement.style.cursor = "auto";
      }}
    >
      <DominoPiece
        domino={domino}
        targetPos={[0, 0, 0]}
        targetRot={[-Math.PI * 0.4, 0, 0]}
        scale={isDrag ? 1.15 : 1}
        color={isDrag ? "#fffde0" : !can ? "#999" : "#f5f5f0"}
        emissive={glow}
        emissiveIntensity={gi}
      />

      {/* Hover tooltip */}
      {hover && can && !isDrag && (
        <Html center position={[0, 1.8, 0]} distanceFactor={8}>
          <div
            className="bg-black/80 text-white px-2 py-1 rounded-lg text-xs font-bold whitespace-nowrap"
            style={{ pointerEvents: "none" }}
          >
            {domino.left} | {domino.right}
          </div>
        </Html>
      )}

      {/* Near-drop indicator */}
      {isDrag && near && (
        <Html center position={[0, 2, 0]} distanceFactor={8}>
          <div
            className="bg-yellow-400 text-black px-3 py-1 rounded-full text-sm font-bold whitespace-nowrap animate-bounce"
            style={{ pointerEvents: "none" }}
          >
            Drop on {near}!
          </div>
        </Html>
      )}
    </group>
  );
}

/* ================================================================
   PLAYER HAND — maps hand array to DragTiles
   ================================================================ */

interface HandProps {
  hand: Domino[];
  myTurn: boolean;
  sides: (d: Domino) => Side[];
  onPlay: (id: string, s: Side) => void;
  onDrag: (a: boolean, s: Side[]) => void;
  leftDrop: Vec3;
  rightDrop: Vec3;
}

function PlayerHand({
  hand,
  myTurn,
  sides,
  onPlay,
  onDrag,
  leftDrop,
  rightDrop,
}: HandProps) {
  return (
    <>
      {hand.map((d, i) => {
        const s = myTurn ? sides(d) : [];
        return (
          <DragTile
            key={d.id}
            domino={d}
            index={i}
            total={hand.length}
            playable={s.length > 0}
            myTurn={myTurn}
            sides={s}
            onPlay={onPlay}
            onDrag={onDrag}
            leftDrop={leftDrop}
            rightDrop={rightDrop}
          />
        );
      })}
    </>
  );
}

/* ================================================================
   GAME SCENE — Composes all 3D elements inside the Canvas
   ================================================================ */

function GameScene({
  board,
  hand,
  isMyTurn,
  getPlayableSides,
  onPlay,
}: {
  board: Domino[];
  hand: Domino[];
  isMyTurn: boolean;
  getPlayableSides: (d: Domino) => Side[];
  onPlay: (id: string, s: Side) => void;
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
        sides={getPlayableSides}
        onPlay={onPlay}
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

/* ================================================================
   GAME BOARD 3D — Canvas wrapper + HTML overlays (EXPORTED)
   ================================================================ */

export interface GameBoard3DProps {
  board: Domino[];
  boardLeftEnd: number;
  boardRightEnd: number;
  hand: Domino[];
  isMyTurn: boolean;
  getPlayableSides: (d: Domino) => Side[];
  onPlay: (id: string, s: Side) => void;
  onPass: () => void;
  canPass: boolean;
}

export function GameBoard3D({
  board,
  boardLeftEnd,
  boardRightEnd,
  hand,
  isMyTurn,
  getPlayableSides,
  onPlay,
  onPass,
  canPass,
}: GameBoard3DProps) {
  return (
    <div className="relative w-full" style={{ height: "65vh", minHeight: 500 }}>
      <Canvas
        shadows
        camera={{ position: [0, 14, 16], fov: 50 }}
        style={{
          borderRadius: 24,
          background: "linear-gradient(180deg,#0a2e1a 0%,#153d25 100%)",
        }}
        gl={{ antialias: true, alpha: false }}
        onCreated={({ gl: r }) => {
          r.setClearColor(new THREE.Color("#0a2e1a"));
          r.toneMapping = THREE.ACESFilmicToneMapping;
          r.toneMappingExposure = 1.2;
        }}
      >
        <GameScene
          board={board}
          hand={hand}
          isMyTurn={isMyTurn}
          getPlayableSides={getPlayableSides}
          onPlay={onPlay}
        />
      </Canvas>

      {/* Turn + Pass overlay */}
      <TurnOverlay myTurn={isMyTurn} canPass={canPass} onPass={onPass} />
      {/* End-value labels */}
      <EndLabels left={boardLeftEnd} right={boardRightEnd} />
      {/* Tile count */}
      {hand.length > 0 && (
        <div className="absolute bottom-14 left-0 right-0 flex justify-center pointer-events-none">
          <span className="text-white/50 text-sm font-medium backdrop-blur-sm bg-black/20 px-3 py-1 rounded-full">
            Your tiles ({hand.length})
          </span>
        </div>
      )}
    </div>
  );
}

/* ================================================================
   OVERLAY COMPONENTS
   ================================================================ */

function TurnOverlay({
  myTurn,
  canPass,
  onPass,
}: {
  myTurn: boolean;
  canPass: boolean;
  onPass: () => void;
}) {
  if (!myTurn) return null;
  return (
    <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-4 pointer-events-none">
      <div className="pointer-events-auto flex items-center gap-4">
        <span className="bg-gradient-to-r from-yellow-400 to-amber-500 text-yellow-900 px-5 py-2 rounded-full font-bold shadow-lg text-lg">
          Your Turn — Drag a tile!
        </span>
        {canPass && (
          <button
            onClick={onPass}
            className="px-6 py-3 bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-xl font-bold hover:from-orange-600 hover:to-red-600 transition-all shadow-lg"
          >
            Pass
          </button>
        )}
      </div>
    </div>
  );
}

function EndLabels({ left, right }: { left: number; right: number }) {
  return (
    <div className="absolute top-4 left-0 right-0 flex justify-between px-6 pointer-events-none">
      <span className="bg-black/40 text-white px-3 py-1 rounded-full font-mono backdrop-blur-sm text-lg">
        {"<"} {left >= 0 ? left : "-"}
      </span>
      <span className="text-white/80 font-semibold text-lg backdrop-blur-sm bg-black/20 px-4 py-1 rounded-full">
        Game Board
      </span>
      <span className="bg-black/40 text-white px-3 py-1 rounded-full font-mono backdrop-blur-sm text-lg">
        {right >= 0 ? right : "-"} {">"}
      </span>
    </div>
  );
}

/* ================================================================
   2D TILE — Fallback for non-3D contexts (EXPORTED)
   ================================================================ */

export function DominoTile2D({
  domino,
  horizontal = false,
  isPlayable = false,
  isSelected = false,
  onClick,
  size = "normal",
}: {
  domino: Domino;
  horizontal?: boolean;
  isPlayable?: boolean;
  isSelected?: boolean;
  onClick?: () => void;
  size?: "small" | "normal" | "large";
}) {
  const dims = {
    small: horizontal ? "w-12 h-6" : "w-6 h-12",
    normal: horizontal ? "w-16 h-8" : "w-10 h-20",
    large: horizontal ? "w-20 h-10" : "w-12 h-24",
  };
  const dot = { small: "w-1 h-1", normal: "w-1.5 h-1.5", large: "w-2 h-2" };

  const dotPos = (n: number) => {
    const m: Record<number, string[]> = {
      0: [],
      1: ["center"],
      2: ["top-right", "bottom-left"],
      3: ["top-right", "center", "bottom-left"],
      4: ["top-left", "top-right", "bottom-left", "bottom-right"],
      5: ["top-left", "top-right", "center", "bottom-left", "bottom-right"],
      6: [
        "top-left",
        "top-right",
        "middle-left",
        "middle-right",
        "bottom-left",
        "bottom-right",
      ],
    };
    return m[n] ?? [];
  };

  const dotStyle = (p: string) => {
    const s: Record<string, string> = {
      "top-left": "top-0.5 left-0.5",
      "top-right": "top-0.5 right-0.5",
      "middle-left": "top-1/2 -translate-y-1/2 left-0.5",
      "middle-right": "top-1/2 -translate-y-1/2 right-0.5",
      center: "top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2",
      "bottom-left": "bottom-0.5 left-0.5",
      "bottom-right": "bottom-0.5 right-0.5",
    };
    return s[p] ?? "";
  };

  const Half = ({ value }: { value: number }) => (
    <div
      className={`relative flex-1 ${horizontal ? "h-full" : "w-full"}`}
      style={{ background: "linear-gradient(135deg,#fefefe,#f0f0e8)" }}
    >
      {dotPos(value).map((p, i) => (
        <div
          key={i}
          className={`absolute ${dot[size]} bg-gray-900 rounded-full ${dotStyle(p)}`}
          style={{ boxShadow: "inset 0 1px 2px rgba(0,0,0,.3)" }}
        />
      ))}
    </div>
  );

  return (
    <button
      onClick={onClick}
      disabled={!isPlayable && onClick !== undefined}
      className={`
        flex ${horizontal ? "flex-row" : "flex-col"} ${dims[size]}
        rounded-lg overflow-hidden transition-all duration-300 ease-out
        ${isSelected ? "scale-110 -translate-y-4 z-10" : ""}
        ${isPlayable ? "hover:scale-105 hover:-translate-y-2 cursor-pointer" : onClick ? "opacity-60 cursor-not-allowed" : ""}
        ${isSelected ? "ring-4 ring-yellow-400 shadow-2xl shadow-yellow-400/50" : "shadow-lg hover:shadow-xl"}
      `}
      style={{
        background: "linear-gradient(180deg,#2d2d2d,#1a1a1a)",
        border: "2px solid #333",
      }}
    >
      <Half value={domino.left} />
      <div
        className={`${horizontal ? "w-0.5 h-full" : "h-0.5 w-full"} bg-gray-700`}
        style={{ background: "linear-gradient(90deg,#444,#222,#444)" }}
      />
      <Half value={domino.right} />
    </button>
  );
}
