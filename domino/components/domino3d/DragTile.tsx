"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import type { Domino } from "../../lib/gameTypes";
import type { Side, Vec3 } from "./types";
import { DominoPiece } from "./DominoPiece";

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
  onDrag: (
    active: boolean,
    sides: Side[],
    proximity: { left: number; right: number },
  ) => void;
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
  const nearRef = useRef<Side | null>(null);
  const lastProximityRef = useRef<{ left: number; right: number }>({
    left: -1,
    right: -1,
  });
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

  // Is the board empty? (both drops at origin)
  const boardEmpty = useMemo(
    () =>
      leftDrop[0] === 0 &&
      leftDrop[2] === 0 &&
      rightDrop[0] === 0 &&
      rightDrop[2] === 0,
    [leftDrop, rightDrop],
  );

  // Smooth return when not dragging (delta-based for frame-rate independence)
  useFrame((_, delta) => {
    if (!group.current || dragging.current) return;
    const t = 1 - Math.pow(0.001, delta); // ~0.12 at 60fps, adapts to any fps
    group.current.position.lerp(rest.current, t);
    if (hover && playable && myTurn) group.current.position.y = handY + 0.5;
  });

  const plane = useMemo(
    () => new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.5),
    [],
  );

  // ── Reusable THREE objects (avoid GC pressure in hot path) ──
  const _mouse = useRef(new THREE.Vector2());
  const _ray = useRef(new THREE.Raycaster());
  const _hit = useRef(new THREE.Vector3());

  const rayHit = useCallback(
    (cx: number, cy: number) => {
      const rect = gl.domElement.getBoundingClientRect();
      _mouse.current.set(
        ((cx - rect.left) / rect.width) * 2 - 1,
        -((cy - rect.top) / rect.height) * 2 + 1,
      );
      _ray.current.setFromCamera(_mouse.current, camera);
      return _ray.current.ray.intersectPlane(plane, _hit.current)
        ? _hit.current.clone()
        : null;
    },
    [gl.domElement, camera, plane],
  );

  const setNearIfChanged = useCallback((next: Side | null) => {
    if (nearRef.current === next) return;
    nearRef.current = next;
    setNear(next);
  }, []);

  const down = useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      if (!playable || !myTurn) return;
      e.stopPropagation();
      dragging.current = true;
      setDrag(true);
      onDrag(true, sides, { left: 0, right: 0 });
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
      const th = DROP_THRESHOLD;
      const proxLeft = sides.includes("left") ? Math.max(0, 1 - dL / th) : 0;
      const proxRight = sides.includes("right") ? Math.max(0, 1 - dR / th) : 0;

      const prev = lastProximityRef.current;
      if (
        Math.abs(prev.left - proxLeft) > 0.05 ||
        Math.abs(prev.right - proxRight) > 0.05
      ) {
        lastProximityRef.current = { left: proxLeft, right: proxRight };
        onDrag(true, sides, { left: proxLeft, right: proxRight });
      }

      if (
        dL < th &&
        dR < th &&
        sides.includes("left") &&
        sides.includes("right")
      ) {
        setNearIfChanged(dL <= dR ? "left" : "right");
      } else if (dL < th && sides.includes("left")) {
        setNearIfChanged("left");
      } else if (dR < th && sides.includes("right")) {
        setNearIfChanged("right");
      } else {
        setNearIfChanged(null);
      }
    },
    [rayHit, leftDrop, rightDrop, sides, setNearIfChanged, onDrag],
  );

  const up = useCallback(() => {
    if (!dragging.current) return;
    dragging.current = false;
    setDrag(false);
    onDrag(false, [], { left: 0, right: 0 });
    gl.domElement.style.cursor = "auto";

    if (boardEmpty) {
      // First tile — side doesn't matter, just play it
      onPlay(domino.id, "left");
    } else if (near) {
      onPlay(domino.id, near);
    }
    setNearIfChanged(null);
    lastProximityRef.current = { left: -1, right: -1 };
  }, [
    near,
    onPlay,
    domino.id,
    gl.domElement,
    onDrag,
    boardEmpty,
    setNearIfChanged,
  ]);

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
  const gi = can ? (isDrag ? 0.7 : hover ? 0.45 : 0.15) : 0;

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
            className={`sm:px-4 sm:py-3 py-1 px-2 rounded-full text-sm sm:text-md font-bold whitespace-nowrap animate-bounce ${
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
    </group>
  );
}
