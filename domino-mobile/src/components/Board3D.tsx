import { GLView } from "expo-gl";
import { Renderer } from "expo-three";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  PanResponder,
  PixelRatio,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import * as THREE from "three";
import { Domino } from "../types/gameTypes";

export type RenderQuality = "low" | "medium" | "high";

interface Opponent {
  name: string;
  tileCount: number;
}

/** Which seat around the table currently has the turn */
type ActiveSlot = "top" | "left" | "right" | "self" | null;

interface Props {
  board: Domino[];
  boardLeftEnd: number;
  boardRightEnd: number;
  dragOverSide: "left" | "right" | null;
  opponents?: { top?: Opponent; left?: Opponent; right?: Opponent };
  activeSlot?: ActiveSlot;
  quality?: RenderQuality;
}

const TABLE_W = 40;
const TABLE_H = 26;
const EDGE_H = 0.9;
const EDGE_T = 0.8;
const TILE_W = 1.15;
const TILE_L = 1.9;
const TILE_H = 0.32;
const TILE_GAP = 0.12;
const ROW_SPACING = 2.2;
const QUALITY_CONFIG: Record<
  RenderQuality,
  { maxDpr: number; shadows: boolean; shadowMapSize: number }
> = {
  low: { maxDpr: 1, shadows: false, shadowMapSize: 512 },
  medium: { maxDpr: 1.5, shadows: false, shadowMapSize: 1024 },
  high: { maxDpr: 2, shadows: true, shadowMapSize: 2048 },
};

const PIP_LAYOUT: Record<number, [number, number][]> = {
  0: [],
  1: [[0, 0]],
  2: [
    [-0.25, -0.28],
    [0.25, 0.28],
  ],
  3: [
    [-0.25, -0.28],
    [0, 0],
    [0.25, 0.28],
  ],
  4: [
    [-0.25, -0.28],
    [0.25, -0.28],
    [-0.25, 0.28],
    [0.25, 0.28],
  ],
  5: [
    [-0.25, -0.28],
    [0.25, -0.28],
    [0, 0],
    [-0.25, 0.28],
    [0.25, 0.28],
  ],
  6: [
    [-0.25, -0.28],
    [0.25, -0.28],
    [-0.25, 0],
    [0.25, 0],
    [-0.25, 0.28],
    [0.25, 0.28],
  ],
};

type LayoutItem = { x: number; z: number; rotY: number; domino: Domino };

function sharedValue(a: Domino, b: Domino): number | null {
  const valuesA = [a.left, a.right];
  const valuesB = [b.left, b.right];
  for (const va of valuesA) {
    if (valuesB.includes(va)) return va;
  }
  return null;
}

function sideFacingDirection(
  domino: Domino,
  rotY: number,
  toward: "west" | "east" | "north" | "south",
): number {
  const rot = ((rotY % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);

  // local -Z -> domino.left, local +Z -> domino.right
  if (toward === "west") {
    if (Math.abs(rot - Math.PI / 2) < 0.01) return domino.left;
    if (Math.abs(rot - (3 * Math.PI) / 2) < 0.01) return domino.right;
  }
  if (toward === "east") {
    if (Math.abs(rot - Math.PI / 2) < 0.01) return domino.right;
    if (Math.abs(rot - (3 * Math.PI) / 2) < 0.01) return domino.left;
  }
  if (toward === "north") {
    if (Math.abs(rot - 0) < 0.01) return domino.left;
    if (Math.abs(rot - Math.PI) < 0.01) return domino.right;
  }
  // south
  if (Math.abs(rot - 0) < 0.01) return domino.right;
  if (Math.abs(rot - Math.PI) < 0.01) return domino.left;

  return domino.left;
}

function buildSnakeLayout(board: Domino[]): LayoutItem[] {
  if (board.length === 0) return [];

  const halfBoard = (TABLE_W * 0.7) / 2;
  const items: LayoutItem[] = [];
  let dir = 1;
  let x = 0;
  let z = 0;
  let prevHalf = 0;

  for (let i = 0; i < board.length; i += 1) {
    const domino = board[i];
    const isDouble = domino.left === domino.right;
    const myLen = isDouble ? TILE_W : TILE_L;
    const myHalf = myLen / 2;

    if (i === 0) {
      items.push({ x: 0, z: 0, rotY: 0, domino });
      prevHalf = myHalf;
      continue;
    }

    const step = prevHalf + TILE_GAP + myHalf;
    const nextX = x + dir * step;

    if (Math.abs(nextX + dir * myHalf) > halfBoard) {
      z += ROW_SPACING;
      dir *= -1;
      x = x + dir * step;
    } else {
      x = nextX;
    }

    items.push({ x, z, rotY: 0, domino });
    prevHalf = myHalf;
  }

  const allX = items.map((it) => it.x);
  const allZ = items.map((it) => it.z);
  const cx = (Math.min(...allX) + Math.max(...allX)) / 2;
  const cz = (Math.min(...allZ) + Math.max(...allZ)) / 2;

  const centered = items.map((it) => ({
    ...it,
    x: it.x - cx,
    z: it.z - cz,
  }));

  for (let i = 0; i < centered.length; i += 1) {
    const cur = centered[i];
    const isDouble = cur.domino.left === cur.domino.right;

    const prev = i > 0 ? centered[i - 1] : null;
    const next = i < centered.length - 1 ? centered[i + 1] : null;

    const dx = next ? next.x - cur.x : prev ? cur.x - prev.x : 1;
    const dz = next ? next.z - cur.z : prev ? cur.z - prev.z : 0;

    const horizontal = Math.abs(dx) >= Math.abs(dz);

    if (horizontal) {
      cur.rotY = isDouble ? 0 : dx >= 0 ? Math.PI / 2 : -Math.PI / 2;
    } else {
      cur.rotY = isDouble ? Math.PI / 2 : dz >= 0 ? 0 : Math.PI;
    }

    if (prev && !isDouble) {
      const mustMatch = sharedValue(prev.domino, cur.domino);
      if (mustMatch !== null) {
        const toPrevX = prev.x - cur.x;
        const toPrevZ = prev.z - cur.z;
        const toward: "west" | "east" | "north" | "south" =
          Math.abs(toPrevX) >= Math.abs(toPrevZ)
            ? toPrevX < 0
              ? "west"
              : "east"
            : toPrevZ < 0
              ? "north"
              : "south";

        const facing = sideFacingDirection(cur.domino, cur.rotY, toward);
        if (facing !== mustMatch) {
          cur.rotY += Math.PI;
        }
      }
    }
  }

  return centered;
}

// ── Cached geometries & materials (singletons) ──
const CACHED_PIP_GEO = new THREE.SphereGeometry(0.075, 16, 12);
const CACHED_PIP_MAT = new THREE.MeshStandardMaterial({
  color: "#111827",
  roughness: 0.6,
  metalness: 0.1,
});
const CACHED_BASE_GEO = new THREE.BoxGeometry(
  TILE_W * 1.03,
  TILE_H * 0.95,
  TILE_L * 1.03,
);
const CACHED_BASE_MAT = new THREE.MeshStandardMaterial({
  color: "#c8b899",
  roughness: 0.85,
  metalness: 0.02,
});
const CACHED_BODY_GEO = new THREE.BoxGeometry(TILE_W, TILE_H, TILE_L);
const CACHED_BODY_MAT = new THREE.MeshStandardMaterial({
  color: "#f8f4ea",
  roughness: 0.35,
  metalness: 0.08,
});
const CACHED_TOP_GEO = new THREE.BoxGeometry(
  TILE_W * 0.94,
  TILE_H * 0.12,
  TILE_L * 0.94,
);
const CACHED_TOP_MAT = new THREE.MeshStandardMaterial({
  color: "#fffdf6",
  roughness: 0.2,
  metalness: 0.12,
});
const CACHED_EDGES_GEO = new THREE.EdgesGeometry(
  new THREE.BoxGeometry(TILE_W, TILE_H, TILE_L),
);
const CACHED_EDGES_MAT = new THREE.LineBasicMaterial({ color: "#d8cfbc" });
const CACHED_DIVIDER_GEO = new THREE.BoxGeometry(TILE_W * 0.88, 0.025, 0.055);
const CACHED_DIVIDER_MAT = new THREE.MeshStandardMaterial({
  color: "#8b7355",
  roughness: 0.65,
});
const CACHED_GLOSS_GEO = new THREE.PlaneGeometry(TILE_W * 0.35, TILE_L * 0.26);
const CACHED_GLOSS_MAT = new THREE.MeshStandardMaterial({
  color: "#ffffff",
  transparent: true,
  opacity: 0.12,
  roughness: 0.05,
  metalness: 0.15,
  side: THREE.DoubleSide,
});
const CACHED_BLANK_BASE_MAT = new THREE.MeshStandardMaterial({
  color: "#e8e8e8",
  roughness: 0.6,
  metalness: 0.02,
});
const CACHED_BLANK_BODY_MAT = new THREE.MeshStandardMaterial({
  color: "#ffffff",
  roughness: 0.3,
  metalness: 0.05,
});
const CACHED_BLANK_TOP_MAT = new THREE.MeshStandardMaterial({
  color: "#ffffff",
  roughness: 0.2,
  metalness: 0.08,
});
const CACHED_BLANK_EDGES_MAT = new THREE.LineBasicMaterial({
  color: "#e0e0e0",
});
const CACHED_BLANK_SLASH_GEO = new THREE.BufferGeometry().setFromPoints([
  new THREE.Vector3(-TILE_W * 0.28, TILE_H * 0.48, -TILE_L * 0.28),
  new THREE.Vector3(TILE_W * 0.28, TILE_H * 0.48, TILE_L * 0.28),
]);
const CACHED_BLANK_SLASH_MAT = new THREE.LineBasicMaterial({
  color: "#cfcfcf",
});

// Ring indicator geometry & material (turn indicator)
const RING_GEO = new THREE.TorusGeometry(1.6, 0.12, 16, 48);
const RING_MAT = new THREE.MeshStandardMaterial({
  color: "#f59e0b",
  emissive: "#f59e0b",
  emissiveIntensity: 0.6,
  roughness: 0.3,
  metalness: 0.5,
  transparent: true,
  opacity: 0.85,
});
const RING_SELF_MAT = new THREE.MeshStandardMaterial({
  color: "#34d399",
  emissive: "#10b981",
  emissiveIntensity: 0.7,
  roughness: 0.3,
  metalness: 0.5,
  transparent: true,
  opacity: 0.85,
});

function makePips(value: number, top: boolean) {
  const group = new THREE.Group();

  const yBase = TILE_H / 2 + 0.035;
  const zShift = top ? -TILE_L * 0.25 : TILE_L * 0.25;

  for (const [px, pz] of PIP_LAYOUT[value] ?? []) {
    const pip = new THREE.Mesh(CACHED_PIP_GEO, CACHED_PIP_MAT);
    pip.position.set(px * TILE_W * 0.86, yBase, zShift + pz * TILE_L * 0.58);
    group.add(pip);
  }

  return group;
}

function makeDominoMesh(domino: Domino) {
  const group = new THREE.Group();

  const base = new THREE.Mesh(CACHED_BASE_GEO, CACHED_BASE_MAT);
  base.position.y = -TILE_H * 0.03;
  base.castShadow = true;
  base.receiveShadow = true;
  group.add(base);

  const body = new THREE.Mesh(CACHED_BODY_GEO, CACHED_BODY_MAT);
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);

  const topPlate = new THREE.Mesh(CACHED_TOP_GEO, CACHED_TOP_MAT);
  topPlate.position.y = TILE_H * 0.46;
  group.add(topPlate);

  const edge = new THREE.LineSegments(CACHED_EDGES_GEO, CACHED_EDGES_MAT);
  group.add(edge);

  const divider = new THREE.Mesh(CACHED_DIVIDER_GEO, CACHED_DIVIDER_MAT);
  divider.position.y = TILE_H / 2 + 0.002;
  group.add(divider);

  const gloss = new THREE.Mesh(CACHED_GLOSS_GEO, CACHED_GLOSS_MAT);
  gloss.rotation.x = -Math.PI / 2;
  gloss.position.set(-TILE_W * 0.2, TILE_H / 2 + 0.012, -TILE_L * 0.22);
  group.add(gloss);

  group.add(makePips(domino.left, true));
  group.add(makePips(domino.right, false));

  return group;
}

function makeBlankDominoMesh() {
  const group = new THREE.Group();

  const base = new THREE.Mesh(CACHED_BASE_GEO, CACHED_BLANK_BASE_MAT);
  base.position.y = -TILE_H * 0.03;
  base.castShadow = true;
  base.receiveShadow = true;
  group.add(base);

  const body = new THREE.Mesh(CACHED_BODY_GEO, CACHED_BLANK_BODY_MAT);
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);

  const topPlate = new THREE.Mesh(CACHED_TOP_GEO, CACHED_BLANK_TOP_MAT);
  topPlate.position.y = TILE_H * 0.46;
  group.add(topPlate);

  const edge = new THREE.LineSegments(CACHED_EDGES_GEO, CACHED_BLANK_EDGES_MAT);
  group.add(edge);

  const slash = new THREE.Line(CACHED_BLANK_SLASH_GEO, CACHED_BLANK_SLASH_MAT);
  group.add(slash);

  return group;
}

function placeOpponentTiles(
  parent: any,
  count: number,
  cx: number,
  cz: number,
  rotY: number,
) {
  const spacing = TILE_W + 0.15;
  const totalW = count * spacing - 0.15;
  const startX = -totalW / 2 + TILE_W / 2;

  for (let i = 0; i < count; i++) {
    const tile = makeBlankDominoMesh();
    tile.userData.oppMarker = true;
    tile.rotation.x = Math.PI;
    tile.rotation.y = rotY;
    const localX = startX + i * spacing;
    const cos = Math.cos(rotY);
    const sin = Math.sin(rotY);
    tile.position.set(cx + localX * cos, TILE_H / 2 + 0.04, cz + localX * sin);
    parent.add(tile);
  }
}

function Board3DInner({
  board,
  boardLeftEnd,
  boardRightEnd,
  dragOverSide,
  opponents,
  activeSlot,
  quality = "medium",
}: Props) {
  const qCfg = QUALITY_CONFIG[quality];
  const rendererRef = useRef<any>(null);
  const sceneRef = useRef<any>(null);
  const cameraRef = useRef<any>(null);
  const boardGroupRef = useRef<any>(null);
  const frameRef = useRef<number | null>(null);
  const mountedRef = useRef(true);
  const glRef = useRef<any>(null);
  /** Map of domino id → Three.js mesh group (for incremental updates) */
  const tileMeshMap = useRef<Map<string, any>>(new Map());
  const prevOppsRef = useRef<string>("");
  const ringRef = useRef<any>(null);
  const prevActiveSlotRef = useRef<ActiveSlot | undefined>(null);
  // Ref-based fast apply: store latest layout data in refs so the render loop
  // can apply changes immediately instead of waiting for React's useEffect batch.
  const pendingApplyRef = useRef(false);
  const latestLayoutRef = useRef<LayoutItem[]>([]);
  const latestOpponentsRef = useRef(opponents);
  const latestActiveSlotRef = useRef(activeSlot);
  const applyBoardLayoutRef = useRef<() => void>(() => {});

  const cameraOrbitRef = useRef({
    azimuth: 0.8,
    polar: 1.0,
    distance: 32,
    targetX: 0,
    targetY: 0,
    targetZ: 0,
  });
  const lastPanRef = useRef({ dx: 0, dy: 0 });
  const touchesRef = useRef<{
    count: number;
    pinchDist: number;
    midX: number;
    midY: number;
  }>({
    count: 0,
    pinchDist: 0,
    midX: 0,
    midY: 0,
  });
  const cameraDirtyRef = useRef(true);

  const layout = useMemo(() => buildSnakeLayout(board), [board]);

  // Keep refs in sync — mark a pending apply whenever data changes
  useEffect(() => {
    latestLayoutRef.current = layout;
    latestOpponentsRef.current = opponents;
    latestActiveSlotRef.current = activeSlot;
    pendingApplyRef.current = true;
  }, [layout, opponents, activeSlot]);

  const updateCamera = useCallback(() => {
    const camera = cameraRef.current;
    if (!camera) return;
    const { azimuth, polar, distance, targetX, targetY, targetZ } =
      cameraOrbitRef.current;
    const x = targetX + Math.sin(polar) * Math.cos(azimuth) * distance;
    const z = targetZ + Math.sin(polar) * Math.sin(azimuth) * distance;
    const y = targetY + Math.cos(polar) * distance;
    camera.position.set(x, y, z);
    camera.lookAt(targetX, targetY, targetZ);
  }, []);

  const zoomIn = useCallback(() => {
    cameraOrbitRef.current.distance = Math.max(
      0.5,
      cameraOrbitRef.current.distance * 0.84,
    );
    cameraDirtyRef.current = true;
  }, []);

  const zoomOut = useCallback(() => {
    cameraOrbitRef.current.distance = Math.min(
      200,
      cameraOrbitRef.current.distance * 1.19,
    );
    cameraDirtyRef.current = true;
  }, []);

  const applyBoardLayout = useCallback(() => {
    const group = boardGroupRef.current;
    if (!group) return;

    const curLayout = latestLayoutRef.current;
    const curOpponents = latestOpponentsRef.current;

    // ── 1. Incremental board tile update ──
    const newIds = new Set(curLayout.map((it) => it.domino.id));
    const map = tileMeshMap.current;

    // Remove tiles no longer on the board
    for (const [id, mesh] of map) {
      if (!newIds.has(id)) {
        group.remove(mesh);
        map.delete(id);
      }
    }

    // Add new tiles & reposition all (positions shift in the snake layout)
    for (const item of curLayout) {
      let mesh = map.get(item.domino.id);
      if (!mesh) {
        mesh = makeDominoMesh(item.domino);
        mesh.userData.tileId = item.domino.id;
        map.set(item.domino.id, mesh);
        group.add(mesh);
      }
      mesh.position.set(item.x, TILE_H / 2 + 0.04, item.z);
      mesh.rotation.y = item.rotY;
    }

    // ── 2. Rebuild opponent markers only when changed ──
    const oppsKey = JSON.stringify(curOpponents ?? {});
    if (oppsKey !== prevOppsRef.current) {
      const toRemove: any[] = [];
      for (const child of group.children) {
        if (child.userData.oppMarker) toRemove.push(child);
      }
      for (const obj of toRemove) group.remove(obj);

      const cornerInset = 3.5;
      const edgeX = TABLE_W / 2 - cornerInset;
      const edgeZ = TABLE_H / 2 - cornerInset;

      if (curOpponents?.top && curOpponents.top.tileCount > 0) {
        placeOpponentTiles(group, curOpponents.top.tileCount, 0, -edgeZ, 0);
      }
      if (curOpponents?.left && curOpponents.left.tileCount > 0) {
        placeOpponentTiles(
          group,
          curOpponents.left.tileCount,
          -edgeX,
          0,
          Math.PI / 2,
        );
      }
      if (curOpponents?.right && curOpponents.right.tileCount > 0) {
        placeOpponentTiles(
          group,
          curOpponents.right.tileCount,
          edgeX,
          0,
          -Math.PI / 2,
        );
      }
      prevOppsRef.current = oppsKey;
    }

    // ── 3. Turn indicator ring ──
    const slot = latestActiveSlotRef.current;
    if (slot !== prevActiveSlotRef.current) {
      if (ringRef.current && group) {
        group.remove(ringRef.current);
        ringRef.current = null;
      }

      if (slot) {
        const cornerInset = 3.5;
        const edgeX = TABLE_W / 2 - cornerInset;
        const edgeZ = TABLE_H / 2 - cornerInset;

        const ring = new THREE.Mesh(
          RING_GEO,
          slot === "self" ? RING_SELF_MAT : RING_MAT,
        );
        ring.rotation.x = -Math.PI / 2;
        ring.userData.turnRing = true;

        if (slot === "top") ring.position.set(0, 2.0, -edgeZ);
        else if (slot === "left") ring.position.set(-edgeX, 2.0, 0);
        else if (slot === "right") ring.position.set(edgeX, 2.0, 0);
        else ring.position.set(0, 2.0, edgeZ);

        group.add(ring);
        ringRef.current = ring;
      }
      prevActiveSlotRef.current = slot;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Reads everything from refs — no closure deps needed

  // Keep the ref pointing at the latest callback
  applyBoardLayoutRef.current = applyBoardLayout;

  // Trigger apply whenever data changes
  useEffect(() => {
    applyBoardLayoutRef.current();
  }, [layout, opponents, activeSlot]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
      }
      rendererRef.current = null;
      sceneRef.current = null;
      cameraRef.current = null;
      boardGroupRef.current = null;
    };
  }, []);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_, g) =>
          Math.abs(g.dx) > 4 || Math.abs(g.dy) > 4,
        onStartShouldSetPanResponderCapture: () => false,
        onMoveShouldSetPanResponderCapture: (_, g) =>
          Math.abs(g.dx) > 4 || Math.abs(g.dy) > 4,
        onPanResponderGrant: (evt) => {
          lastPanRef.current = { dx: 0, dy: 0 };
          const touches = evt.nativeEvent.touches ?? [];
          touchesRef.current.count = touches.length;
          if (touches.length === 2) {
            const dx = touches[1].pageX - touches[0].pageX;
            const dy = touches[1].pageY - touches[0].pageY;
            touchesRef.current.pinchDist = Math.sqrt(dx * dx + dy * dy);
            touchesRef.current.midX = (touches[0].pageX + touches[1].pageX) / 2;
            touchesRef.current.midY = (touches[0].pageY + touches[1].pageY) / 2;
          }
        },
        onPanResponderMove: (evt, gestureState) => {
          const touches = evt.nativeEvent.touches ?? [];
          if (touches.length === 2) {
            // Pinch zoom
            const dx = touches[1].pageX - touches[0].pageX;
            const dy = touches[1].pageY - touches[0].pageY;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const prev = touchesRef.current.pinchDist;
            if (prev > 0) {
              const scale = prev / dist;
              cameraOrbitRef.current.distance = Math.max(
                0.5,
                Math.min(200, cameraOrbitRef.current.distance * scale),
              );
              cameraDirtyRef.current = true;
            }
            touchesRef.current.pinchDist = dist;
            // Two-finger pan
            const midX = (touches[0].pageX + touches[1].pageX) / 2;
            const midY = (touches[0].pageY + touches[1].pageY) / 2;
            const panDx = midX - touchesRef.current.midX;
            const panDy = midY - touchesRef.current.midY;
            const panSpeed = 0.04 * (cameraOrbitRef.current.distance / 32);
            cameraOrbitRef.current.targetX -= panDx * panSpeed;
            cameraOrbitRef.current.targetZ -= panDy * panSpeed;
            touchesRef.current.midX = midX;
            touchesRef.current.midY = midY;
            touchesRef.current.count = 2;
            cameraDirtyRef.current = true;
            return;
          }
          touchesRef.current.count = 1;
          const deltaX = gestureState.dx - lastPanRef.current.dx;
          const deltaY = gestureState.dy - lastPanRef.current.dy;
          lastPanRef.current = { dx: gestureState.dx, dy: gestureState.dy };

          cameraOrbitRef.current.azimuth -= deltaX * 0.01;
          cameraOrbitRef.current.polar += deltaY * 0.008;
          cameraOrbitRef.current.polar = Math.min(
            1.45,
            Math.max(0.58, cameraOrbitRef.current.polar),
          );
          cameraDirtyRef.current = true;
        },
        onPanResponderRelease: () => {},
        onPanResponderTerminate: () => {},
      }),
    [],
  );

  const onContextCreate = useCallback(
    async (gl: any) => {
      glRef.current = gl;
      const { drawingBufferWidth: width, drawingBufferHeight: height } = gl;

      const renderer = new Renderer({ gl }) as any;
      const pr = Math.min(PixelRatio.get(), qCfg.maxDpr);
      renderer.setPixelRatio(pr);
      renderer.setSize(width, height);
      renderer.setClearColor("#071a12");
      renderer.shadowMap.enabled = qCfg.shadows;
      renderer.shadowMap.type = qCfg.shadows
        ? THREE.PCFSoftShadowMap
        : THREE.BasicShadowMap;

      const scene = new THREE.Scene();
      scene.fog = new THREE.Fog("#071a12", 50, 120);

      const camera = new THREE.PerspectiveCamera(52, width / height, 0.1, 1200);
      cameraRef.current = camera;
      camera.far = 600;
      camera.updateProjectionMatrix();
      updateCamera();
      cameraDirtyRef.current = false;

      const ambient = new THREE.AmbientLight("#d4f5dc", 0.75);
      scene.add(ambient);

      const dir = new THREE.DirectionalLight("#ffffff", 0.95);
      dir.position.set(12, 16, 10);
      dir.castShadow = qCfg.shadows;
      if (qCfg.shadows) {
        dir.shadow.mapSize.width = qCfg.shadowMapSize;
        dir.shadow.mapSize.height = qCfg.shadowMapSize;
      }
      scene.add(dir);

      const tableBase = new THREE.Mesh(
        new THREE.BoxGeometry(TABLE_W + 2, EDGE_H, TABLE_H + 2),
        new THREE.MeshStandardMaterial({ color: "#4a2e12", roughness: 0.85 }),
      );
      tableBase.position.y = -EDGE_H / 2;
      tableBase.receiveShadow = true;
      scene.add(tableBase);

      const felt = new THREE.Mesh(
        new THREE.BoxGeometry(TABLE_W, 0.22, TABLE_H),
        new THREE.MeshStandardMaterial({ color: "#1a5c2a", roughness: 0.95 }),
      );
      felt.position.y = 0.02;
      felt.receiveShadow = true;
      scene.add(felt);

      const railMaterial = new THREE.MeshStandardMaterial({
        color: "#5a3a1a",
        roughness: 0.9,
      });

      const railTop = new THREE.Mesh(
        new THREE.BoxGeometry(TABLE_W + EDGE_T * 2, EDGE_H, EDGE_T),
        railMaterial,
      );
      railTop.position.set(0, EDGE_H * 0.1, TABLE_H / 2 + EDGE_T / 2);
      const railBottom = railTop.clone();
      railBottom.position.z = -TABLE_H / 2 - EDGE_T / 2;
      const railLeft = new THREE.Mesh(
        new THREE.BoxGeometry(EDGE_T, EDGE_H, TABLE_H),
        railMaterial,
      );
      railLeft.position.set(-TABLE_W / 2 - EDGE_T / 2, EDGE_H * 0.1, 0);
      const railRight = railLeft.clone();
      railRight.position.x = TABLE_W / 2 + EDGE_T / 2;
      scene.add(railTop, railBottom, railLeft, railRight);

      const boardGroup = new THREE.Group();
      boardGroupRef.current = boardGroup;
      scene.add(boardGroup);

      rendererRef.current = renderer;
      sceneRef.current = scene;

      applyBoardLayoutRef.current();

      const renderLoop = () => {
        if (!mountedRef.current) return;
        frameRef.current = requestAnimationFrame(renderLoop);

        // Fast-path: apply pending board changes inside the render loop
        if (pendingApplyRef.current) {
          pendingApplyRef.current = false;
          applyBoardLayoutRef.current();
        }

        if (cameraDirtyRef.current) {
          updateCamera();
          cameraDirtyRef.current = false;
        }

        // Animate the turn ring (slow rotation + gentle bob)
        const ring = ringRef.current;
        if (ring) {
          const t = performance.now() * 0.001;
          ring.rotation.z = t * 0.8;
          ring.position.y = 2.0 + Math.sin(t * 2) * 0.25;
        }

        renderer.render(scene, camera);
        (gl as any).endFrameEXP?.();
      };
      renderLoop();
    },
    [updateCamera],
  );

  const handleLayout = useCallback(
    (e: any) => {
      const { width, height } = e.nativeEvent.layout;
      if (
        !rendererRef.current ||
        !cameraRef.current ||
        width === 0 ||
        height === 0
      )
        return;

      const pr = Math.min(PixelRatio.get(), qCfg.maxDpr);
      const pw = Math.round(width * pr);
      const ph = Math.round(height * pr);

      rendererRef.current.setPixelRatio(pr);
      rendererRef.current.setSize(pw, ph);

      const gl = glRef.current;
      if (gl) {
        gl.viewport(0, 0, pw, ph);
      }

      cameraRef.current.aspect = width / height;
      cameraRef.current.updateProjectionMatrix();
      cameraDirtyRef.current = true;
      // eslint-disable-next-line react-hooks/exhaustive-deps
    },
    [qCfg.maxDpr],
  );

  const leftActive = dragOverSide === "left";
  const rightActive = dragOverSide === "right";

  return (
    <View style={styles.root} {...panResponder.panHandlers}>
      <GLView
        style={styles.gl}
        onContextCreate={onContextCreate}
        onLayout={handleLayout}
      />

      <View style={styles.overlayTop} pointerEvents="none">
        <View style={[styles.endChip, leftActive && styles.endChipActive]}>
          <Text style={styles.endArrow}>◀</Text>
          <Text style={styles.endValue}>
            {boardLeftEnd >= 0 ? boardLeftEnd : "—"}
          </Text>
          {leftActive && <Text style={styles.dropHint}>DROP</Text>}
        </View>

        <View style={[styles.endChip, rightActive && styles.endChipActive]}>
          {rightActive && <Text style={styles.dropHint}>DROP</Text>}
          <Text style={styles.endValue}>
            {boardRightEnd >= 0 ? boardRightEnd : "—"}
          </Text>
          <Text style={styles.endArrow}>▶</Text>
        </View>
      </View>

      <View style={styles.overlayBottom} pointerEvents="none">
        <Text style={styles.helpText}>Pinch to zoom · drag to orbit</Text>
      </View>
    </View>
  );
}

const Board3D = React.memo(Board3DInner);
export default Board3D;

const styles = StyleSheet.create({
  root: {
    flex: 1,
    borderRadius: 14,
    overflow: "hidden",
    backgroundColor: "#071a12",
    marginHorizontal: 4,
    marginVertical: 2,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  gl: {
    flex: 1,
  },
  overlayTop: {
    position: "absolute",
    top: 8,
    left: 8,
    right: 8,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  overlayBottom: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingVertical: 6,
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.18)",
  },
  helpText: {
    color: "rgba(255,255,255,0.65)",
    fontSize: 11,
    fontWeight: "600",
  },
  endChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: "rgba(0,0,0,0.38)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
  },
  endChipActive: {
    borderColor: "#34d399",
    backgroundColor: "rgba(16,185,129,0.24)",
  },
  endArrow: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 12,
  },
  endValue: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "800",
  },
  dropHint: {
    color: "#34d399",
    fontSize: 8,
    fontWeight: "900",
    letterSpacing: 1,
  },
});
