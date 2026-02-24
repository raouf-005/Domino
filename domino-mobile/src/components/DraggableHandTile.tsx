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
import React, { useCallback, useMemo } from "react";
import { View, Text, StyleSheet, useWindowDimensions } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  runOnJS,
  SlideInRight,
} from "react-native-reanimated";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { Colors } from "../theme/colors";
import { Domino } from "../types/gameTypes";
import DominoTile3D from "./DominoTile3D";
import type { TileSize } from "./DominoTile3D";

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
  boardLayoutY: number;
  onPlay: (dominoId: string, side: "left" | "right") => void;
  onDragStateChange: (dragging: boolean, side: "left" | "right" | null) => void;
}

export default function DraggableHandTile({
  domino,
  playable,
  isMyTurn,
  index,
  tileSize = "hand",
  compact = false,
  playableSides,
  boardLayoutY,
  onPlay,
  onDragStateChange,
}: Props) {
  const { width: SCREEN_W } = useWindowDimensions();
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const scale = useSharedValue(1);
  const rotZ = useSharedValue(0);
  const zIdx = useSharedValue(1);
  const dragging = useSharedValue(false);

  // ── drop logic ──
  const handleDrop = useCallback(
    (absX: number, absY: number) => {
      if (!playable || playableSides.length === 0) return;
      const inBoard = absY < boardLayoutY + 80;
      if (!inBoard) return;
      if (playableSides.length === 1) {
        onPlay(domino.id, playableSides[0]);
      } else {
        const side = absX < SCREEN_W / 2 ? "left" : "right";
        onPlay(
          domino.id,
          playableSides.includes(side) ? side : playableSides[0],
        );
      }
    },
    [playable, playableSides, boardLayoutY, domino.id, onPlay],
  );

  const reportDrag = useCallback(
    (active: boolean, absX: number, absY: number) => {
      if (!active) {
        onDragStateChange(false, null);
        return;
      }
      const inBoard = absY < boardLayoutY + 80;
      if (inBoard && playableSides.length > 0) {
        if (playableSides.length === 1) {
          onDragStateChange(true, playableSides[0]);
        } else {
          const side = absX < SCREEN_W / 2 ? "left" : "right";
          onDragStateChange(true, playableSides.includes(side) ? side : null);
        }
      } else {
        onDragStateChange(true, null);
      }
    },
    [boardLayoutY, playableSides, onDragStateChange],
  );

  // ── Pan gesture ──
  const pan = useMemo(
    () =>
      Gesture.Pan()
        .enabled(playable)
        .onStart(() => {
          "worklet";
          dragging.value = true;
          scale.value = withSpring(1.18, DRAG_SPRING);
          zIdx.value = 100;
        })
        .onUpdate((e) => {
          "worklet";
          tx.value = e.translationX;
          ty.value = e.translationY;
          // Slight rotation while dragging for 3D feel
          rotZ.value = e.translationX * 0.03;
          runOnJS(reportDrag)(true, e.absoluteX, e.absoluteY);
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
          runOnJS(reportDrag)(false, 0, 0);
        })
        .onFinalize(() => {
          "worklet";
          tx.value = withSpring(0, SPRING);
          ty.value = withSpring(0, SPRING);
          scale.value = withSpring(1, SPRING);
          rotZ.value = withSpring(0, SPRING);
          dragging.value = false;
          zIdx.value = 1;
          runOnJS(reportDrag)(false, 0, 0);
        }),
    [playable, handleDrop, reportDrag],
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
    opacity: dragging.value ? 0.4 : 0,
    transform: [{ scale: dragging.value ? 1.2 : 0.9 }],
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
