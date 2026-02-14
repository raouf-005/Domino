"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import type { Domino } from "../../lib/gameTypes";
import type { Side, Vec3 } from "./types";
import { DominoPiece } from "./DominoPiece";

/** Distance between two drop-zone centres below which we show a picker */
const AMBIGUOUS_DIST = 8;
/** Each drop-zone's detection radius */
const DROP_THRESHOLD = 4;

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

export function DragTile({
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
  /** When true, we show L/R picker instead of auto-dropping */
  const [showPicker, setShowPicker] = useState(false);
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

  // Are the two drop zones close enough to cause confusion?
  const dropsAreClose = useMemo(() => {
    const dx = leftDrop[0] - rightDrop[0];
    const dz = leftDrop[2] - rightDrop[2];
    return Math.hypot(dx, dz) < AMBIGUOUS_DIST;
  }, [leftDrop, rightDrop]);

  // Does this tile play on both sides AND drops are close?
  const needsPicker =
    sides.includes("left") && sides.includes("right") && dropsAreClose;

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
      if (!playable || !myTurn || showPicker) return;
      e.stopPropagation();
      dragging.current = true;
      setDrag(true);
      onDrag(true, sides);
      gl.domElement.style.cursor = "grabbing";
      const hit = rayHit(e.clientX, e.clientY);
      if (hit && group.current)
        offset.current.copy(group.current.position).sub(hit);
    },
    [playable, myTurn, gl.domElement, rayHit, onDrag, sides, showPicker],
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
      const th = DROP_THRESHOLD;

      if (needsPicker) {
        // When zones overlap, highlight the CLOSER one but don't commit
        if (dL < th || dR < th) {
          setNear(dL <= dR ? "left" : "right");
        } else {
          setNear(null);
        }
      } else {
        if (dL < th && sides.includes("left")) setNear("left");
        else if (dR < th && sides.includes("right")) setNear("right");
        else setNear(null);
      }
    },
    [rayHit, leftDrop, rightDrop, sides, needsPicker],
  );

  const up = useCallback(() => {
    if (!dragging.current) return;
    dragging.current = false;
    setDrag(false);
    onDrag(false, []);
    gl.domElement.style.cursor = "auto";

    if (near) {
      if (needsPicker) {
        // Don't auto-play — show the side picker instead
        setShowPicker(true);
      } else {
        onPlay(domino.id, near);
      }
    }
    setNear(null);
  }, [near, onPlay, domino.id, gl.domElement, onDrag, needsPicker]);

  const pickSide = useCallback(
    (side: Side) => {
      setShowPicker(false);
      onPlay(domino.id, side);
    },
    [domino.id, onPlay],
  );

  const cancelPicker = useCallback(() => {
    setShowPicker(false);
  }, []);

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
        if (can && !showPicker) gl.domElement.style.cursor = "grab";
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
        scale={isDrag ? 1.15 : showPicker ? 1.1 : 1}
        color={
          isDrag
            ? "#fffde0"
            : showPicker
              ? "#fff8cc"
              : !can
                ? "#999"
                : "#f5f5f0"
        }
        emissive={showPicker ? "#ffd700" : glow}
        emissiveIntensity={showPicker ? 0.5 : gi}
      />

      {/* Hover tooltip */}
      {hover && can && !isDrag && !showPicker && (
        <Html center position={[0, 1.8, 0]} distanceFactor={8}>
          <div
            className="bg-black/80 text-white px-2 py-1 rounded-lg text-xs font-bold whitespace-nowrap"
            style={{ pointerEvents: "none" }}
          >
            {domino.left} | {domino.right}
          </div>
        </Html>
      )}

      {/* Near-drop indicator (only when NOT showing picker) */}
      {isDrag && near && !showPicker && (
        <Html center position={[0, 2, 0]} distanceFactor={8}>
          <div
            className={`px-3 py-1 rounded-full text-sm font-bold whitespace-nowrap animate-bounce ${
              near === "left"
                ? "bg-blue-400 text-blue-900"
                : "bg-orange-400 text-orange-900"
            }`}
            style={{ pointerEvents: "none" }}
          >
            Drop on {near} end
          </div>
        </Html>
      )}

      {/* ── Side picker popup when both sides are close ── */}
      {showPicker && (
        <Html center position={[0, 2.6, 0]} distanceFactor={7}>
          <div
            className="flex flex-col items-center gap-2 select-none"
            style={{ pointerEvents: "auto" }}
          >
            <div className="bg-black/90 backdrop-blur-sm text-white px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap mb-1 shadow-xl border border-white/20">
              Which end?
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => pickSide("left")}
                className="px-5 py-2.5 bg-blue-500 hover:bg-blue-400 text-white rounded-xl font-bold text-sm shadow-lg transition-all hover:scale-110 active:scale-95 border-2 border-blue-300/50"
              >
                ← Left
              </button>
              <button
                onClick={() => pickSide("right")}
                className="px-5 py-2.5 bg-orange-500 hover:bg-orange-400 text-white rounded-xl font-bold text-sm shadow-lg transition-all hover:scale-110 active:scale-95 border-2 border-orange-300/50"
              >
                Right →
              </button>
            </div>
            <button
              onClick={cancelPicker}
              className="px-3 py-1 text-white/50 hover:text-white/80 text-xs mt-1 transition-colors"
            >
              Cancel
            </button>
          </div>
        </Html>
      )}
    </group>
  );
}
