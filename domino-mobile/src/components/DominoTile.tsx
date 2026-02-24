import React from "react";
import { View, StyleSheet } from "react-native";
import Svg, { Rect, Circle, Line } from "react-native-svg";
import { Domino } from "../types/gameTypes";
import { Colors } from "../theme/colors";

// Pip positions for domino faces (0-6)
const PIP_POSITIONS: Record<number, [number, number][]> = {
  0: [],
  1: [[0.5, 0.5]],
  2: [
    [0.25, 0.25],
    [0.75, 0.75],
  ],
  3: [
    [0.25, 0.25],
    [0.5, 0.5],
    [0.75, 0.75],
  ],
  4: [
    [0.25, 0.25],
    [0.75, 0.25],
    [0.25, 0.75],
    [0.75, 0.75],
  ],
  5: [
    [0.25, 0.25],
    [0.75, 0.25],
    [0.5, 0.5],
    [0.25, 0.75],
    [0.75, 0.75],
  ],
  6: [
    [0.25, 0.25],
    [0.75, 0.25],
    [0.25, 0.5],
    [0.75, 0.5],
    [0.25, 0.75],
    [0.75, 0.75],
  ],
};

interface DominoTileProps {
  domino: Domino;
  size?: "small" | "normal" | "large";
  horizontal?: boolean;
  highlighted?: boolean;
  playable?: boolean;
  onPress?: () => void;
}

export default function DominoTile({
  domino,
  size = "normal",
  horizontal = false,
  highlighted = false,
  playable = false,
}: DominoTileProps) {
  const dims = {
    small: { w: 24, h: 44 },
    normal: { w: 36, h: 66 },
    large: { w: 48, h: 88 },
  };

  const d = dims[size];
  const svgW = horizontal ? d.h : d.w;
  const svgH = horizontal ? d.w : d.h;
  const halfH = d.h / 2;
  const pipR = size === "small" ? 2 : size === "normal" ? 2.8 : 3.5;

  const renderPips = (value: number, offsetY: number) => {
    const pips = PIP_POSITIONS[value] || [];
    return pips.map(([px, py], i) => (
      <Circle
        key={`${value}-${i}`}
        cx={px * d.w}
        cy={offsetY + py * halfH}
        r={pipR}
        fill="#1a1a2e"
      />
    ));
  };

  return (
    <View
      style={[
        styles.container,
        highlighted && styles.highlighted,
        playable && styles.playable,
      ]}
    >
      <Svg
        width={svgW}
        height={svgH}
        viewBox={horizontal ? `0 0 ${d.h} ${d.w}` : `0 0 ${d.w} ${d.h}`}
      >
        {/* Background */}
        <Rect
          x={horizontal ? 0 : 0}
          y={0}
          width={horizontal ? d.h : d.w}
          height={horizontal ? d.w : d.h}
          rx={4}
          ry={4}
          fill="#f5f0e8"
          stroke={highlighted ? Colors.amber : "rgba(0,0,0,0.3)"}
          strokeWidth={highlighted ? 2 : 1}
        />

        {horizontal ? (
          <>
            {/* Left half pips (rotated) */}
            {PIP_POSITIONS[domino.left]?.map(([px, py], i) => (
              <Circle
                key={`l-${i}`}
                cx={py * halfH}
                cy={px * d.w}
                r={pipR}
                fill="#1a1a2e"
              />
            ))}
            {/* Divider */}
            <Line
              x1={halfH}
              y1={2}
              x2={halfH}
              y2={d.w - 2}
              stroke="rgba(0,0,0,0.2)"
              strokeWidth={1}
            />
            {/* Right half pips */}
            {PIP_POSITIONS[domino.right]?.map(([px, py], i) => (
              <Circle
                key={`r-${i}`}
                cx={halfH + py * halfH}
                cy={px * d.w}
                r={pipR}
                fill="#1a1a2e"
              />
            ))}
          </>
        ) : (
          <>
            {/* Top half pips */}
            {renderPips(domino.left, 0)}
            {/* Divider line */}
            <Line
              x1={3}
              y1={halfH}
              x2={d.w - 3}
              y2={halfH}
              stroke="rgba(0,0,0,0.2)"
              strokeWidth={1}
            />
            {/* Bottom half pips */}
            {renderPips(domino.right, halfH)}
          </>
        )}
      </Svg>
    </View>
  );
}

// Face-down tile for opponents
export function FaceDownTile({
  size = "small",
  horizontal = false,
}: {
  size?: "small" | "normal";
  horizontal?: boolean;
}) {
  const dims = {
    small: { w: 16, h: 28 },
    normal: { w: 24, h: 44 },
  };
  const d = dims[size];
  const svgW = horizontal ? d.h : d.w;
  const svgH = horizontal ? d.w : d.h;

  return (
    <View style={styles.faceDown}>
      <Svg width={svgW} height={svgH}>
        <Rect
          x={0}
          y={0}
          width={svgW}
          height={svgH}
          rx={3}
          ry={3}
          fill="#1e293b"
          stroke="rgba(255,255,255,0.2)"
          strokeWidth={1}
        />
        <Rect
          x={2}
          y={2}
          width={svgW - 4}
          height={svgH - 4}
          rx={2}
          ry={2}
          fill="none"
          stroke="rgba(255,255,255,0.1)"
          strokeWidth={0.5}
        />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 4,
    overflow: "hidden",
  },
  highlighted: {
    shadowColor: Colors.amber,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 8,
    elevation: 6,
  },
  playable: {
    shadowColor: Colors.emerald,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 4,
  },
  faceDown: {
    borderRadius: 3,
    overflow: "hidden",
  },
});
