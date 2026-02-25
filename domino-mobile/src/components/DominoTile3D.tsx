import { LinearGradient } from "expo-linear-gradient";
import React, { useEffect, useMemo } from "react";
import { StyleSheet, useWindowDimensions, View } from "react-native";
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { Colors } from "../theme/colors";
import { Domino } from "../types/gameTypes";

function getScale(screenW: number) {
  return screenW <= 360 ? 0.85 : screenW >= 420 ? 1.08 : 1;
}

// ── Pip layouts for domino faces 0-6 ──
const PIP_POS: Record<number, [number, number][]> = {
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

// ── Size presets ──
const SIZES = {
  tiny: { w: 22, h: 40, pip: 3, radius: 3, side: 4, bevel: 1 },
  small: { w: 30, h: 54, pip: 4, radius: 5, side: 5, bevel: 1.5 },
  normal: { w: 42, h: 76, pip: 5.5, radius: 7, side: 6, bevel: 2 },
  large: { w: 56, h: 100, pip: 7, radius: 9, side: 7, bevel: 2.5 },
  hand: { w: 52, h: 92, pip: 6.5, radius: 8, side: 7, bevel: 2 },
  board: { w: 32, h: 58, pip: 4.2, radius: 5, side: 5, bevel: 1.5 },
};

export type TileSize = keyof typeof SIZES;

interface Props {
  domino: Domino;
  size?: TileSize;
  playable?: boolean;
  highlighted?: boolean;
  boardTile?: boolean;
  delay?: number;
  dragging?: boolean;
  horizontal?: boolean;
  onPress?: () => void;
}

// ── 3D Pip with emboss ──
function Pip3D({ x, y, r }: { x: number; y: number; r: number }) {
  return (
    <View
      style={{
        position: "absolute",
        left: x - r,
        top: y - r,
        width: r * 2,
        height: r * 2,
        borderRadius: r,
        backgroundColor: "#151526",
        borderWidth: 0.4,
        borderColor: "rgba(255,255,255,0.06)",
      }}
    />
  );
}

// ── Single face ──
function Face({
  value,
  w,
  h,
  pipR,
}: {
  value: number;
  w: number;
  h: number;
  pipR: number;
}) {
  const pips = PIP_POS[value] || [];
  const pad = pipR * 1.8;
  const innerW = w - pad * 2;
  const innerH = h - pad * 2;

  return (
    <View style={{ width: w, height: h }}>
      {pips.map(([px, py], i) => (
        <Pip3D key={i} x={pad + px * innerW} y={pad + py * innerH} r={pipR} />
      ))}
    </View>
  );
}

// ══════════ MAIN 3D DOMINO TILE ══════════
function DominoTile3DInner({
  domino,
  size = "normal",
  playable = false,
  highlighted = false,
  boardTile = false,
  delay = 0,
  dragging = false,
  horizontal = false,
  onPress,
}: Props) {
  const { width: screenW } = useWindowDimensions();
  const SCALE = useMemo(() => getScale(screenW), [screenW]);
  const sc = SCALE * (boardTile ? 1.05 : 1);
  const raw = SIZES[size];
  const W = Math.round(raw.w * sc);
  const H = Math.round(raw.h * sc);
  const SIDE = Math.round(raw.side * sc);
  const R = Math.round(raw.radius * sc);
  const pipR = raw.pip * sc * 0.5;
  const bevel = raw.bevel * sc;
  const halfH = H / 2;

  // tile outer dimensions (always vertical internally, rotate for horizontal)
  // Give horizontal doubles the same row height as vertical tiles so they
  // don't crowd neighbours in a flexWrap layout.
  const verticalH = H + SIDE;
  const outerW = horizontal ? H + SIDE : W;
  const outerH = horizontal ? verticalH : verticalH;

  // ── Animations ──
  const entrance = useSharedValue(boardTile ? 0.4 : 0.7);
  const flipY = useSharedValue(boardTile ? 90 : 0);
  const glow = useSharedValue(0);

  useEffect(() => {
    entrance.value = withDelay(
      delay,
      withSpring(1, { damping: 18, stiffness: 160, mass: 0.7 }),
    );
    if (boardTile) {
      flipY.value = withDelay(
        delay,
        withSpring(0, { damping: 20, stiffness: 100, mass: 0.8 }),
      );
    }
  }, []);

  useEffect(() => {
    if (playable) {
      glow.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 700, easing: Easing.inOut(Easing.ease) }),
          withTiming(0.2, {
            duration: 700,
            easing: Easing.inOut(Easing.ease),
          }),
        ),
        -1,
        true,
      );
    } else {
      glow.value = withTiming(0, { duration: 200 });
    }
  }, [playable]);

  const tileAnim = useAnimatedStyle(() => ({
    transform: [
      { perspective: 500 },
      { scale: entrance.value * (dragging ? 1.12 : 1) },
      { rotateY: `${flipY.value}deg` },
      ...(horizontal ? [{ rotateZ: "-90deg" as any }] : []),
    ],
    opacity: entrance.value,
  }));

  const glowAnim = useAnimatedStyle(() => ({
    opacity: interpolate(glow.value, [0, 1], [0, 0.7]),
    transform: [{ scale: interpolate(glow.value, [0, 1], [0.96, 1.06]) }],
  }));

  return (
    <Animated.View
      style={[
        {
          width: outerW,
          height: outerH,
          alignItems: "center",
          justifyContent: "center",
        },
        tileAnim,
      ]}
    >
      {/* ── Playable glow ── */}
      {playable && (
        <Animated.View
          style={[
            {
              position: "absolute",
              top: -5,
              left: -5,
              right: -5,
              bottom: -5,
              borderRadius: R + 5,
              backgroundColor: Colors.emerald,
            },
            glowAnim,
          ]}
        />
      )}
      {highlighted && (
        <View
          style={{
            position: "absolute",
            top: -3,
            left: -3,
            right: -3,
            bottom: -3,
            borderRadius: R + 4,
            borderWidth: 2,
            borderColor: Colors.amber,
          }}
        />
      )}

      {/* ── 3D side / depth ── */}
      <View
        style={{
          position: "absolute",
          top: SIDE,
          left: (outerW - W) / 2,
          width: W,
          height: H,
          borderRadius: R,
          backgroundColor: "#8a7a62",
        }}
      />
      {/* ── Side edge gradient ── */}
      <View
        style={{
          position: "absolute",
          top: SIDE - 1,
          left: (outerW - W) / 2 + 1,
          width: W - 2,
          height: SIDE + 1,
          borderBottomLeftRadius: R,
          borderBottomRightRadius: R,
          overflow: "hidden",
        }}
      >
        <LinearGradient
          colors={["#b09878", "#8a7a62", "#6a5a42"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={{ flex: 1 }}
        />
      </View>

      {/* ── Main tile face ── */}
      <View
        style={{
          position: "absolute",
          top: 0,
          left: (outerW - W) / 2,
          width: W,
          height: H,
          borderRadius: R,
          overflow: "hidden",
          shadowColor: "#000",
          shadowOffset: { width: 0, height: SIDE },
          shadowOpacity: dragging ? 0.55 : 0.4,
          shadowRadius: dragging ? 14 : 8,
          elevation: dragging ? 16 : 10,
        }}
      >
        {/* Ivory body gradient — matches PC #f5f5f0 */}
        <LinearGradient
          colors={["#faf8f2", "#f5f5f0", "#ece8dd", "#e2ded3"]}
          start={{ x: 0.15, y: 0 }}
          end={{ x: 0.85, y: 1 }}
          style={StyleSheet.absoluteFill}
        />

        {/* Top highlight bevel */}
        <View
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: bevel * 2,
            backgroundColor: "rgba(255,255,255,0.3)",
            borderTopLeftRadius: R,
            borderTopRightRadius: R,
          }}
        />
        {/* Left highlight bevel */}
        <View
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: bevel,
            bottom: 0,
            backgroundColor: "rgba(255,255,255,0.15)",
            borderTopLeftRadius: R,
            borderBottomLeftRadius: R,
          }}
        />
        {/* Right shadow bevel */}
        <View
          style={{
            position: "absolute",
            top: 0,
            right: 0,
            width: bevel,
            bottom: 0,
            backgroundColor: "rgba(0,0,0,0.06)",
            borderTopRightRadius: R,
            borderBottomRightRadius: R,
          }}
        />
        {/* Bottom shadow bevel */}
        <View
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            height: bevel * 1.5,
            backgroundColor: "rgba(0,0,0,0.08)",
            borderBottomLeftRadius: R,
            borderBottomRightRadius: R,
          }}
        />

        {/* ── Top face (domino.left) ── */}
        <Face value={domino.left} w={W} h={halfH} pipR={pipR} />

        {/* ── Divider groove ── */}
        <View
          style={{
            height: 3,
            marginHorizontal: 4,
            backgroundColor: "rgba(80,60,40,0.18)",
            borderRadius: 1,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <View
            style={{
              height: 0.8,
              width: "55%",
              backgroundColor: "rgba(255,255,255,0.35)",
              borderRadius: 1,
            }}
          />
        </View>

        {/* ── Bottom face (domino.right) ── */}
        <Face value={domino.right} w={W} h={halfH} pipR={pipR} />

        {/* Specular highlight top-left */}
        <View
          style={{
            position: "absolute",
            top: 3,
            left: 4,
            width: W * 0.35,
            height: H * 0.18,
            borderRadius: R,
            backgroundColor: "rgba(255,255,255,0.12)",
          }}
        />
      </View>

      {/* Drag shadow boost */}
      {dragging && (
        <View
          style={{
            position: "absolute",
            bottom: -8,
            left: 6,
            right: 6,
            height: 12,
            borderRadius: 8,
            backgroundColor: "rgba(0,0,0,0.25)",
          }}
        />
      )}
    </Animated.View>
  );
}

const DominoTile3D = React.memo(DominoTile3DInner);
export default DominoTile3D;

// ══════════ FACE-DOWN 3D TILE ══════════
function FaceDownTile3DInner({
  size = "small",
  delay = 0,
}: {
  size?: "tiny" | "small" | "normal";
  delay?: number;
}) {
  const { width: screenW } = useWindowDimensions();
  const sc = useMemo(() => getScale(screenW), [screenW]);
  const raw = SIZES[size];
  const W = Math.round(raw.w * sc);
  const H = Math.round(raw.h * sc);
  const SIDE = Math.round(raw.side * sc * 0.7);
  const R = Math.round(raw.radius * sc);

  const entrance = useSharedValue(0.3);
  useEffect(() => {
    entrance.value = withDelay(
      delay,
      withSpring(1, { damping: 16, stiffness: 140, mass: 0.7 }),
    );
  }, []);

  const anim = useAnimatedStyle(() => ({
    transform: [{ perspective: 400 }, { scale: entrance.value }],
    opacity: entrance.value,
  }));

  return (
    <Animated.View style={[{ width: W, height: H + SIDE }, anim]}>
      {/* Side */}
      <View
        style={{
          position: "absolute",
          top: SIDE,
          left: 0,
          width: W,
          height: H,
          borderRadius: R,
          backgroundColor: "#0a1a30",
        }}
      />
      {/* Body */}
      <View
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: W,
          height: H,
          borderRadius: R,
          overflow: "hidden",
          borderWidth: 0.5,
          borderColor: "rgba(100,160,255,0.2)",
          shadowColor: "#000",
          shadowOffset: { width: 0, height: SIDE },
          shadowOpacity: 0.4,
          shadowRadius: 6,
          elevation: 6,
        }}
      >
        <LinearGradient
          colors={["#1e3a5f", "#162d4d", "#0f2240"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        {/* Decorative lines */}
        <View
          style={{
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            gap: 3,
          }}
        >
          <View
            style={{
              height: 1,
              width: W * 0.5,
              backgroundColor: "rgba(100,160,255,0.15)",
              borderRadius: 1,
            }}
          />
          <View
            style={{
              height: 1,
              width: W * 0.3,
              backgroundColor: "rgba(100,160,255,0.1)",
              borderRadius: 1,
            }}
          />
        </View>
        {/* Top bevel */}
        <View
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: 2,
            backgroundColor: "rgba(100,160,255,0.1)",
            borderTopLeftRadius: R,
            borderTopRightRadius: R,
          }}
        />
      </View>
    </Animated.View>
  );
}

export const FaceDownTile3D = React.memo(FaceDownTile3DInner);
