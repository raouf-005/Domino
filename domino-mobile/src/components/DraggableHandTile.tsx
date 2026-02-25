/**
 * DraggableHandTile — 3D-styled drag-and-drop domino tile.
 *
 * Matches the 3D POV board experience:
 *  • Drag up toward the tilted board to play
 *  • Left/right half of screen picks which side
 *  • Scale-up + elevation + rotation while dragging
 *  • Smooth spring-back on miss
 *  • Glow outline on playable tiles
 */
import React, { useCallback, useEffect, useMemo, useRef } from "react";
import { StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  runOnJS,
  SlideInRight,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { Colors } from "../theme/colors";
import { Domino } from "../types/gameTypes";
import type { TileSize } from "./DominoTile3D";
import DominoTile3D from "./DominoTile3D";

const SPRING = { damping: 16, stiffness: 160, mass: 0.8 };
const DRAG_SPRING = { damping: 14, stiffness: 140, mass: 0.6 };

interface Props {
  domino: Domino;
  playable: boolean;
  isMyTurn: boolean;
  index: number;
  tileSize?: TileSize;
  compact?: boolean;
  playableSides: ("left" | "right")[];
  onPlay: (dominoId: string, side: "left" | "right") => void;
  onDragStateChange: (dragging: boolean, side: "left" | "right" | null) => void;
}

function DraggableHandTileInner({
  domino,
  playable,
  isMyTurn,
  index,
  tileSize = "hand",
  compact = false,
  playableSides,
  onPlay,
  onDragStateChange,
}: Props) {
  const { width: SCREEN_W, height: SCREEN_H } = useWindowDimensions();

  // ── Store dimensions in shared values (for worklets) and refs (for JS callbacks) ──
  const screenW = useSharedValue(SCREEN_W);
  const screenH = useSharedValue(SCREEN_H);
  const screenWRef = useRef(SCREEN_W);
  const screenHRef = useRef(SCREEN_H);

  useEffect(() => {
    screenW.value = SCREEN_W;
    screenH.value = SCREEN_H;
    screenWRef.current = SCREEN_W;
    screenHRef.current = SCREEN_H;
  }, [SCREEN_W, SCREEN_H]);

  // Encode playable sides as a bitmask shared value so worklets can read it
  // without triggering "modified key current" warnings (bit 0 = left, bit 1 = right)
  const playableSidesBits = useSharedValue(0);
  useEffect(() => {
    let bits = 0;
    if (playableSides.includes("left")) bits |= 1;
    if (playableSides.includes("right")) bits |= 2;
    playableSidesBits.value = bits;
  }, [playableSides]);

  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const scale = useSharedValue(1);
  const rotZ = useSharedValue(0);
  const zIdx = useSharedValue(1);
  const dragging = useSharedValue(false);
  const currentSide = useSharedValue<"left" | "right" | null>(null);

  // ── drop logic (uses refs so deps are stable) ──
  const handleDrop = useCallback(
    (absX: number, absY: number) => {
      if (!playable || playableSides.length === 0) return;
      const sw = screenWRef.current;
      const sh = screenHRef.current;
      const inBoard = absY < sh * 0.65;
      if (!inBoard) return;
      if (playableSides.length === 1) {
        onPlay(domino.id, playableSides[0]);
      } else {
        const side = absX < sw / 2 ? "left" : "right";
        onPlay(
          domino.id,
          playableSides.includes(side) ? side : playableSides[0],
        );
      }
    },
    [playable, playableSides, domino.id, onPlay],
  );

  const reportDragWorklet = (active: boolean, absX: number, absY: number) => {
    "worklet";
    if (!active) {
      if (currentSide.value !== null) {
        currentSide.value = null;
        runOnJS(onDragStateChange)(false, null);
      }
      return;
    }
    const sw = screenW.value;
    const sh = screenH.value;
    const bits = playableSidesBits.value;
    const hasLeft = (bits & 1) !== 0;
    const hasRight = (bits & 2) !== 0;
    const sideCount = (hasLeft ? 1 : 0) + (hasRight ? 1 : 0);
    const inBoard = absY < sh * 0.65;
    let newSide: "left" | "right" | null = null;
    if (inBoard && sideCount > 0) {
      if (sideCount === 1) {
        newSide = hasLeft ? "left" : "right";
      } else {
        newSide = absX < sw / 2 ? "left" : "right";
      }
    }
    if (newSide !== currentSide.value) {
      currentSide.value = newSide;
      runOnJS(onDragStateChange)(true, newSide);
    }
  };

  // ── Pan gesture — deps no longer include screen dimensions ──
  const pan = useMemo(
    () =>
      Gesture.Pan()
        .enabled(playable)
        .onStart(() => {
          "worklet";
          dragging.value = true;
          scale.value = withSpring(1.18, DRAG_SPRING);
          zIdx.value = 100;
          runOnJS(onDragStateChange)(true, null);
        })
        .onUpdate((e) => {
          "worklet";
          tx.value = e.translationX;
          ty.value = e.translationY;
          rotZ.value = (e.translationX / screenW.value) * 15;
          reportDragWorklet(true, e.absoluteX, e.absoluteY);
        })
        .onEnd((e) => {
          "worklet";
          runOnJS(handleDrop)(e.absoluteX, e.absoluteY);
          tx.value = withSpring(0, SPRING);
          ty.value = withSpring(0, SPRING);
          scale.value = withSpring(1, SPRING);
          rotZ.value = withSpring(0, SPRING);
          dragging.value = false;
          zIdx.value = 1;
          reportDragWorklet(false, 0, 0);
        })
        .onFinalize(() => {
          "worklet";
          tx.value = withSpring(0, SPRING);
          ty.value = withSpring(0, SPRING);
          scale.value = withSpring(1, SPRING);
          rotZ.value = withSpring(0, SPRING);
          dragging.value = false;
          zIdx.value = 1;
          reportDragWorklet(false, 0, 0);
        }),
    [playable, handleDrop],
  );

  const animStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: tx.value },
      { translateY: ty.value },
      { scale: scale.value },
      { rotateZ: `${rotZ.value}deg` },
    ],
    zIndex: zIdx.value,
  }));

  // Shadow that grows while dragging
  const shadowStyle = useAnimatedStyle(() => ({
    opacity: withTiming(dragging.value ? 0.4 : 0, { duration: 150 }),
    transform: [{ scale: withSpring(dragging.value ? 1.2 : 0.9, SPRING) }],
  }));

  return (
    <GestureDetector gesture={pan}>
      <Animated.View
        entering={SlideInRight.duration(260)
          .delay(index * 50)
          .springify()}
        style={[
          styles.wrap,
          playable && styles.wrapPlayable,
          !playable && isMyTurn && styles.wrapDisabled,
          animStyle,
        ]}
      >
        {/* Drag shadow */}
        <Animated.View style={[styles.dragShadow, shadowStyle]} />

        <DominoTile3D
          domino={domino}
          size={tileSize}
          playable={playable}
          delay={index * 50}
        />
        {playable && !compact && (
          <View style={styles.hint}>
            <Text style={styles.hintText}>⬆ drag</Text>
          </View>
        )}
      </Animated.View>
    </GestureDetector>
  );
}

const DraggableHandTile = React.memo(DraggableHandTileInner);
export default DraggableHandTile;

const styles = StyleSheet.create({
  wrap: {
    borderRadius: 12,
    padding: 3,
    position: "relative",
    overflow: "visible",
  },
  wrapPlayable: {
    backgroundColor: "rgba(16,185,129,0.06)",
    borderWidth: 1,
    borderColor: "rgba(16,185,129,0.18)",
    borderRadius: 14,
  },
  wrapDisabled: {
    opacity: 0.25,
  },
  dragShadow: {
    position: "absolute",
    top: 4,
    left: 4,
    right: -2,
    bottom: -6,
    borderRadius: 12,
    backgroundColor: "rgba(0,0,0,0.3)",
  },
  hint: {
    position: "absolute",
    bottom: -1,
    left: 0,
    right: 0,
    alignItems: "center",
  },
  hintText: {
    color: Colors.emeraldLight,
    fontSize: 8,
    fontWeight: "700",
    opacity: 0.65,
    letterSpacing: 0.5,
  },
});
