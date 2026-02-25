import { GLView } from "expo-gl";
import { Renderer } from "expo-three";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PanResponder, StyleSheet, Text, View } from "react-native";
import * as THREE from "three";
import { Domino } from "../types/gameTypes";

interface Opponent {
  name: string;
  tileCount: number;
}

interface Props {
  board: Domino[];
  boardLeftEnd: number;
  boardRightEnd: number;
  dragOverSide: "left" | "right" | null;
  opponents?: { top?: Opponent; left?: Opponent; right?: Opponent };
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

  // ── Phase 1: Place tiles in a snake path ──
  // Row goes in direction `dir` along X axis, each turn shifts down Z
  const halfBoard = (TABLE_W * 0.7) / 2; // usable half-width for 60% occupation
  const items: LayoutItem[] = [];
  let dir = 1; // 1 = east, -1 = west
  let x = 0;
  let z = 0;
  let prevHalf = 0;

  for (let i = 0; i < board.length; i += 1) {
    const domino = board[i];
    const isDouble = domino.left === domino.right;
    // When moving horizontally, doubles are perpendicular (use TILE_W as length)
    const myLen = isDouble ? TILE_W : TILE_L;
    const myHalf = myLen / 2;

    if (i === 0) {
      // First tile at origin
      items.push({ x: 0, z: 0, rotY: 0, domino });
      prevHalf = myHalf;
      continue;
    }

    // Try to continue in current direction
    const step = prevHalf + TILE_GAP + myHalf;
    const nextX = x + dir * step;

    if (Math.abs(nextX + dir * myHalf) > halfBoard) {
      // Would exceed row boundary — need to turn
      // 1. Place a connecting tile going downward at current position
      z += ROW_SPACING;
      dir *= -1;
      // After turn, continue in new direction
      x = x + dir * step;
    } else {
      x = nextX;
    }

    items.push({ x, z, rotY: 0, domino });
    prevHalf = myHalf;
  }

  // ── Phase 2: Center the layout ──
  const allX = items.map((it) => it.x);
  const allZ = items.map((it) => it.z);
  const cx = (Math.min(...allX) + Math.max(...allX)) / 2;
  const cz = (Math.min(...allZ) + Math.max(...allZ)) / 2;

  const centered = items.map((it) => ({
    ...it,
    x: it.x - cx,
    z: it.z - cz,
  }));

  // ── Phase 3: Assign orientations based on movement direction ──
  for (let i = 0; i < centered.length; i += 1) {
    const cur = centered[i];
    const isDouble = cur.domino.left === cur.domino.right;

    const prev = i > 0 ? centered[i - 1] : null;
    const next = i < centered.length - 1 ? centered[i + 1] : null;

    // Determine movement direction for this tile
    const dx = next ? next.x - cur.x : prev ? cur.x - prev.x : 1;
    const dz = next ? next.z - cur.z : prev ? cur.z - prev.z : 0;

    const horizontal = Math.abs(dx) >= Math.abs(dz);

    if (horizontal) {
      // Moving east/west — tile lies sideways
      cur.rotY = isDouble ? 0 : dx >= 0 ? Math.PI / 2 : -Math.PI / 2;
    } else {
      // Moving north/south (turn segment) — tile points along Z
      cur.rotY = isDouble ? Math.PI / 2 : dz >= 0 ? 0 : Math.PI;
    }

    // ── Phase 4: Fix pip orientation so shared value faces previous tile ──
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

function makePips(value: number, top: boolean) {
  const group = new THREE.Group();
  const pipGeo = new THREE.SphereGeometry(0.075, 16, 12);
  const pipMat = new THREE.MeshStandardMaterial({
    color: "#111827",
    roughness: 0.6,
    metalness: 0.1,
  });

  const yBase = TILE_H / 2 + 0.035;
  const zShift = top ? -TILE_L * 0.25 : TILE_L * 0.25;

  for (const [px, pz] of PIP_LAYOUT[value] ?? []) {
    const pip = new THREE.Mesh(pipGeo, pipMat);
    pip.position.set(px * TILE_W * 0.86, yBase, zShift + pz * TILE_L * 0.58);
    group.add(pip);
  }

  return group;
}

function makeDominoMesh(domino: Domino) {
  const group = new THREE.Group();

  const base = new THREE.Mesh(
    new THREE.BoxGeometry(TILE_W * 1.03, TILE_H * 0.95, TILE_L * 1.03),
    new THREE.MeshStandardMaterial({
      color: "#c8b899",
      roughness: 0.85,
      metalness: 0.02,
    }),
  );
  base.position.y = -TILE_H * 0.03;
  base.castShadow = true;
  base.receiveShadow = true;
  group.add(base);

  const body = new THREE.Mesh(
    new THREE.BoxGeometry(TILE_W, TILE_H, TILE_L),
    new THREE.MeshStandardMaterial({
      color: "#f8f4ea",
      roughness: 0.35,
      metalness: 0.08,
    }),
  );
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);

  const topPlate = new THREE.Mesh(
    new THREE.BoxGeometry(TILE_W * 0.94, TILE_H * 0.12, TILE_L * 0.94),
    new THREE.MeshStandardMaterial({
      color: "#fffdf6",
      roughness: 0.2,
      metalness: 0.12,
    }),
  );
  topPlate.position.y = TILE_H * 0.46;
  group.add(topPlate);

  const edge = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(TILE_W, TILE_H, TILE_L)),
    new THREE.LineBasicMaterial({ color: "#d8cfbc" }),
  );
  group.add(edge);

  const divider = new THREE.Mesh(
    new THREE.BoxGeometry(TILE_W * 0.88, 0.025, 0.055),
    new THREE.MeshStandardMaterial({ color: "#8b7355", roughness: 0.65 }),
  );
  divider.position.y = TILE_H / 2 + 0.002;
  group.add(divider);

  const gloss = new THREE.Mesh(
    new THREE.PlaneGeometry(TILE_W * 0.35, TILE_L * 0.26),
    new THREE.MeshStandardMaterial({
      color: "#ffffff",
      transparent: true,
      opacity: 0.12,
      roughness: 0.05,
      metalness: 0.15,
      side: THREE.DoubleSide,
    }),
  );
  gloss.rotation.x = -Math.PI / 2;
  gloss.position.set(-TILE_W * 0.2, TILE_H / 2 + 0.012, -TILE_L * 0.22);
  group.add(gloss);

  group.add(makePips(domino.left, true));
  group.add(makePips(domino.right, false));

  return group;
}

function makeBlankDominoMesh() {
  const group = new THREE.Group();

  const base = new THREE.Mesh(
    new THREE.BoxGeometry(TILE_W * 1.03, TILE_H * 0.95, TILE_L * 1.03),
    new THREE.MeshStandardMaterial({
      color: "#e8e8e8",
      roughness: 0.4,
      metalness: 0.05,
    }),
  );
  base.position.y = -TILE_H * 0.03;
  base.castShadow = true;
  base.receiveShadow = true;
  group.add(base);

  const body = new THREE.Mesh(
    new THREE.BoxGeometry(TILE_W, TILE_H, TILE_L),
    new THREE.MeshStandardMaterial({
      color: "#ffffff",
      roughness: 0.25,
      metalness: 0.08,
    }),
  );
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);

  const edge = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(TILE_W, TILE_H, TILE_L)),
    new THREE.LineBasicMaterial({ color: "#d0d0d0" }),
  );
  group.add(edge);

  return group;
}

/** Place N blank tiles side by side, centered around (cx, cz) */
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
    // Rotate tile to face down (back side up)
    tile.rotation.x = Math.PI; // flip upside down
    tile.rotation.y = rotY;
    // Position relative to center
    const localX = startX + i * spacing;
    // Apply rotation to get world position
    const cos = Math.cos(rotY);
    const sin = Math.sin(rotY);
    tile.position.set(cx + localX * cos, TILE_H / 2 + 0.04, cz + localX * sin);
    parent.add(tile);
  }
}

export default function Board3D({
  board,
  boardLeftEnd,
  boardRightEnd,
  dragOverSide,
  opponents,
}: Props) {
  const rendererRef = useRef<any>(null);
  const sceneRef = useRef<any>(null);
  const cameraRef = useRef<any>(null);
  const boardGroupRef = useRef<any>(null);
  const frameRef = useRef<number | null>(null);
  const mountedRef = useRef(true);

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
  const [cameraHelp, setCameraHelp] = useState(
    "1 finger: rotate · 2 fingers: pan & zoom",
  );

  const layout = useMemo(() => buildSnakeLayout(board), [board]);

  const updateCamera = useCallback(() => {
    const camera = cameraRef.current;
    if (!camera) return;
    const { azimuth, polar, distance, targetX, targetY, targetZ } =
      cameraOrbitRef.current;
    const x = targetX + Math.sin(polar) * Math.cos(azimuth) * distance;
    const z = targetZ + Math.sin(polar) * Math.sin(azimuth) * distance;
    const y = targetY + Math.cos(polar) * distance;
    camera.position.set(x, y, z);
    camera.far = Math.max(260, distance * 14);
    camera.updateProjectionMatrix();
    camera.lookAt(targetX, targetY, targetZ);
  }, []);

  const zoomIn = useCallback(() => {
    cameraOrbitRef.current.distance = Math.max(
      0.5,
      cameraOrbitRef.current.distance * 0.84,
    );
    updateCamera();
  }, [updateCamera]);

  const zoomOut = useCallback(() => {
    cameraOrbitRef.current.distance = Math.min(
      200,
      cameraOrbitRef.current.distance * 1.19,
    );
    updateCamera();
  }, [updateCamera]);

  const applyBoardLayout = useCallback(() => {
    const group = boardGroupRef.current;
    if (!group) return;

    while (group.children.length > 0) {
      group.remove(group.children[0]);
    }

    for (const item of layout) {
      const mesh = makeDominoMesh(item.domino);
      mesh.position.set(item.x, TILE_H / 2 + 0.04, item.z);
      mesh.rotation.y = item.rotY;
      group.add(mesh);
    }

    // ── Place opponent blank tiles in 3 corners ──
    const cornerInset = 3.5;
    const edgeX = TABLE_W / 2 - cornerInset;
    const edgeZ = TABLE_H / 2 - cornerInset;

    // Top center (partner)
    if (opponents?.top && opponents.top.tileCount > 0) {
      placeOpponentTiles(group, opponents.top.tileCount, 0, -edgeZ, 0);
    }
    // Left side
    if (opponents?.left && opponents.left.tileCount > 0) {
      placeOpponentTiles(
        group,
        opponents.left.tileCount,
        -edgeX,
        0,
        Math.PI / 2,
      );
    }
    // Right side
    if (opponents?.right && opponents.right.tileCount > 0) {
      placeOpponentTiles(
        group,
        opponents.right.tileCount,
        edgeX,
        0,
        -Math.PI / 2,
      );
    }
  }, [layout, opponents]);

  useEffect(() => {
    applyBoardLayout();
  }, [applyBoardLayout]);

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
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onStartShouldSetPanResponderCapture: () => false,
        onMoveShouldSetPanResponderCapture: () => true,
        onPanResponderGrant: (evt) => {
          lastPanRef.current = { dx: 0, dy: 0 };
          const touches = evt.nativeEvent.touches;
          if (touches && touches.length >= 2) {
            const dx = touches[1].pageX - touches[0].pageX;
            const dy = touches[1].pageY - touches[0].pageY;
            touchesRef.current = {
              count: 2,
              pinchDist: Math.sqrt(dx * dx + dy * dy),
              midX: (touches[0].pageX + touches[1].pageX) / 2,
              midY: (touches[0].pageY + touches[1].pageY) / 2,
            };
          } else {
            touchesRef.current = { count: 1, pinchDist: 0, midX: 0, midY: 0 };
          }
          setCameraHelp("");
        },
        onPanResponderMove: (evt, gestureState) => {
          const touches = evt.nativeEvent.touches;
          if (touches && touches.length >= 2) {
            // ── Pinch to zoom ──
            const dx = touches[1].pageX - touches[0].pageX;
            const dy = touches[1].pageY - touches[0].pageY;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const midX = (touches[0].pageX + touches[1].pageX) / 2;
            const midY = (touches[0].pageY + touches[1].pageY) / 2;

            if (
              touchesRef.current.count === 2 &&
              touchesRef.current.pinchDist > 0
            ) {
              const scale = touchesRef.current.pinchDist / dist;
              cameraOrbitRef.current.distance = Math.max(
                0.5,
                Math.min(200, cameraOrbitRef.current.distance * scale),
              );

              // ── Two-finger pan ──
              const panDx = midX - touchesRef.current.midX;
              const panDy = midY - touchesRef.current.midY;
              const panSpeed = cameraOrbitRef.current.distance * 0.002;
              const { azimuth } = cameraOrbitRef.current;
              cameraOrbitRef.current.targetX +=
                (-panDx * Math.cos(azimuth) - panDy * Math.sin(azimuth)) *
                panSpeed *
                0.3;
              cameraOrbitRef.current.targetZ +=
                (panDx * Math.sin(azimuth) - panDy * Math.cos(azimuth)) *
                panSpeed *
                0.3;
            }

            touchesRef.current = { count: 2, pinchDist: dist, midX, midY };
            updateCamera();
            return;
          }

          // ── Single finger: orbit ──
          touchesRef.current.count = 1;
          const deltaX = gestureState.dx - lastPanRef.current.dx;
          const deltaY = gestureState.dy - lastPanRef.current.dy;
          lastPanRef.current = { dx: gestureState.dx, dy: gestureState.dy };

          cameraOrbitRef.current.azimuth -= deltaX * 0.01;
          cameraOrbitRef.current.polar += deltaY * 0.008;
          cameraOrbitRef.current.polar = Math.min(
            Math.PI - 0.05,
            Math.max(0.05, cameraOrbitRef.current.polar),
          );
          updateCamera();
        },
        onPanResponderRelease: () => {
          touchesRef.current = { count: 0, pinchDist: 0, midX: 0, midY: 0 };
          setTimeout(
            () => setCameraHelp("1 finger: rotate · 2 fingers: pan & zoom"),
            350,
          );
        },
        onPanResponderTerminate: () => {
          touchesRef.current = { count: 0, pinchDist: 0, midX: 0, midY: 0 };
          setCameraHelp("1 finger: rotate · 2 fingers: pan & zoom");
        },
      }),
    [updateCamera],
  );

  const onContextCreate = useCallback(
    async (gl: any) => {
      const { drawingBufferWidth: width, drawingBufferHeight: height } = gl;

      const renderer = new Renderer({ gl }) as any;
      renderer.setSize(width, height);
      renderer.setClearColor("#071a12");
      renderer.shadowMap.enabled = true;

      const scene = new THREE.Scene();
      scene.fog = new THREE.Fog("#071a12", 50, 120);

      const camera = new THREE.PerspectiveCamera(52, width / height, 0.1, 1200);
      cameraRef.current = camera;
      updateCamera();

      const ambient = new THREE.AmbientLight("#d4f5dc", 0.75);
      scene.add(ambient);

      const dir = new THREE.DirectionalLight("#ffffff", 0.95);
      dir.position.set(12, 16, 10);
      dir.castShadow = true;
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

      applyBoardLayout();

      const renderLoop = () => {
        if (!mountedRef.current) return;
        frameRef.current = requestAnimationFrame(renderLoop);
        renderer.render(scene, camera);
        (gl as any).endFrameEXP?.();
      };
      renderLoop();
    },
    [applyBoardLayout, updateCamera],
  );

  const handleLayout = useCallback((e: any) => {
    const { width, height } = e.nativeEvent.layout;
    if (rendererRef.current && cameraRef.current) {
      rendererRef.current.setSize(width, height);
      cameraRef.current.aspect = width / height;
      cameraRef.current.updateProjectionMatrix();
    }
  }, []);

  const leftActive = dragOverSide === "left";
  const rightActive = dragOverSide === "right";

  return (
    <View
      style={styles.root}
      {...panResponder.panHandlers}
      onLayout={handleLayout}
    >
      <GLView style={styles.gl} onContextCreate={onContextCreate} />

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
        <Text style={styles.helpText}>{cameraHelp}</Text>
      </View>
    </View>
  );
}

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
