/**
 * WinAnimations — A collection of victory animation overlays.
 *
 * 1. BoardSlam      – The last domino tile slams onto the board with impact
 * 2. ConfettiBurst  – Colorful confetti particles flying everywhere
 * 3. Fireworks      – Firework bursts with expanding rings
 * 4. EmojiRain      – Emojis raining from the top of the screen
 * 5. VictoryBanner  – A trophy banner that slides in with a bounce
 *
 * Each component respects the settings from SettingsContext.
 */
import * as Haptics from "expo-haptics";
import React, { useCallback, useEffect, useMemo } from "react";
import { StyleSheet, Text, View, useWindowDimensions } from "react-native";
import Animated, {
  Easing,
  cancelAnimation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { useSettings } from "../context/SettingsContext";
import type { Domino } from "../types/gameTypes";

// ── Domino dot layout for the tile visual ──
const PIP_POSITIONS: Record<number, [number, number][]> = {
  0: [],
  1: [[0, 0]],
  2: [
    [-1, -1],
    [1, 1],
  ],
  3: [
    [-1, -1],
    [0, 0],
    [1, 1],
  ],
  4: [
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1],
  ],
  5: [
    [-1, -1],
    [1, -1],
    [0, 0],
    [-1, 1],
    [1, 1],
  ],
  6: [
    [-1, -1],
    [1, -1],
    [-1, 0],
    [1, 0],
    [-1, 1],
    [1, 1],
  ],
};

function SlamDominoTile({ domino, size }: { domino: Domino; size: number }) {
  const halfH = size / 2;
  const dotSize = size * 0.08;
  const dotSpacing = size * 0.12;

  const renderHalf = (value: number, yOffset: number) => {
    const pips = PIP_POSITIONS[value] || [];
    return pips.map((pos, i) => (
      <View
        key={`${yOffset}-${i}`}
        style={{
          position: "absolute",
          width: dotSize,
          height: dotSize,
          borderRadius: dotSize / 2,
          backgroundColor: "#1a1a2e",
          left: size / 2 + pos[0] * dotSpacing - dotSize / 2,
          top: yOffset + halfH / 2 + pos[1] * dotSpacing - dotSize / 2,
        }}
      />
    ));
  };

  return (
    <View
      style={{
        width: size * 0.45,
        height: size,
        borderRadius: size * 0.08,
        backgroundColor: "#faf6ed",
        borderWidth: 2,
        borderColor: "#b8a88a",
        overflow: "hidden",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.5,
        shadowRadius: 12,
        elevation: 10,
      }}
    >
      {/* Top half */}
      {renderHalf(domino.left, 0)}
      {/* Divider line */}
      <View
        style={{
          position: "absolute",
          top: halfH - 1,
          left: size * 0.06,
          right: size * 0.06,
          height: 2,
          backgroundColor: "#b8a88a",
          borderRadius: 1,
        }}
      />
      {/* Bottom half */}
      {renderHalf(domino.right, halfH)}
    </View>
  );
}

// ─────────────────────────────────────────────
// 1. BOARD SLAM — last domino tile slams onto the center of the board
//    with impact shake that makes all board tiles jitter
// ─────────────────────────────────────────────
export function BoardSlam({
  active,
  onComplete,
  lastDomino,
}: {
  active: boolean;
  onComplete?: () => void;
  lastDomino?: Domino | null;
}) {
  const { settings } = useSettings();
  const { width: W, height: H } = useWindowDimensions();

  // Tile slam from above the screen to center
  const tileY = useSharedValue(-H * 0.5);
  const tileScale = useSharedValue(2.5);
  const tileRotate = useSharedValue(-30);
  const impactOpacity = useSharedValue(0);
  const shakeX = useSharedValue(0);
  const shakeY = useSharedValue(0);
  // Board tiles jitter after impact
  const boardJitterX = useSharedValue(0);
  const boardJitterY = useSharedValue(0);
  // Impact ring
  const ringScale = useSharedValue(0);
  const ringOpacity = useSharedValue(0);
  // Hand comes in after tile lands
  const handY = useSharedValue(-H * 0.4);
  const handOpacity = useSharedValue(0);

  const triggerHaptic = useCallback(() => {
    if (settings.hapticFeedback) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    }
  }, [settings.hapticFeedback]);

  const triggerLightHaptic = useCallback(() => {
    if (settings.hapticFeedback) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
  }, [settings.hapticFeedback]);

  useEffect(() => {
    if (!active || !settings.winSlamAnimation) return;

    // Reset
    tileY.value = -H * 0.5;
    tileScale.value = 2.5;
    tileRotate.value = -30;
    handY.value = -H * 0.4;
    handOpacity.value = 0;

    // Phase 1: Tile rises up slightly then SLAMS down to center
    tileY.value = withDelay(
      100,
      withSequence(
        // Rise a bit
        withTiming(-H * 0.55, {
          duration: 200,
          easing: Easing.out(Easing.ease),
        }),
        // SLAM into center of the board
        withTiming(H * 0.35, {
          duration: 200,
          easing: Easing.in(Easing.cubic),
        }),
        // Bounce on impact
        withSpring(H * 0.32, { damping: 12, stiffness: 300 }),
      ),
    );

    tileScale.value = withDelay(
      100,
      withSequence(
        withTiming(2.8, { duration: 200 }),
        withTiming(1.4, { duration: 200, easing: Easing.in(Easing.cubic) }),
        withSpring(1.6, { damping: 8, stiffness: 200 }),
      ),
    );

    tileRotate.value = withDelay(
      100,
      withSequence(
        withTiming(-35, { duration: 200 }),
        withTiming(3, { duration: 200 }),
        withSpring(0, { damping: 10 }),
      ),
    );

    // Impact flash at t=500ms (100 delay + 200 rise + 200 slam)
    impactOpacity.value = withDelay(
      500,
      withSequence(
        withTiming(0.6, { duration: 40 }),
        withTiming(0, { duration: 350 }),
      ),
    );

    // Impact ring expanding
    ringScale.value = withDelay(
      500,
      withTiming(3, { duration: 600, easing: Easing.out(Easing.cubic) }),
    );
    ringOpacity.value = withDelay(
      500,
      withSequence(
        withTiming(0.6, { duration: 60 }),
        withTiming(0, { duration: 540 }),
      ),
    );

    // Board tiles jitter on impact
    const jitterDur = 40;
    const jitterAmt = 6;
    boardJitterX.value = withDelay(
      500,
      withSequence(
        withTiming(jitterAmt, { duration: jitterDur }),
        withTiming(-jitterAmt, { duration: jitterDur }),
        withTiming(jitterAmt * 0.6, { duration: jitterDur }),
        withTiming(-jitterAmt * 0.6, { duration: jitterDur }),
        withTiming(jitterAmt * 0.3, { duration: jitterDur }),
        withTiming(-jitterAmt * 0.3, { duration: jitterDur }),
        withTiming(0, { duration: jitterDur }),
      ),
    );
    boardJitterY.value = withDelay(
      500,
      withSequence(
        withTiming(-jitterAmt * 0.4, { duration: jitterDur }),
        withTiming(jitterAmt * 0.4, { duration: jitterDur }),
        withTiming(-jitterAmt * 0.2, { duration: jitterDur }),
        withTiming(0, { duration: jitterDur }),
      ),
    );

    // Screen shake
    if (settings.screenShake) {
      const shakeDuration = 50;
      const shakeAmount = 10;
      shakeX.value = withDelay(
        500,
        withSequence(
          withTiming(shakeAmount, { duration: shakeDuration }),
          withTiming(-shakeAmount, { duration: shakeDuration }),
          withTiming(shakeAmount * 0.6, { duration: shakeDuration }),
          withTiming(-shakeAmount * 0.6, { duration: shakeDuration }),
          withTiming(shakeAmount * 0.3, { duration: shakeDuration }),
          withTiming(0, { duration: shakeDuration }),
        ),
      );
      shakeY.value = withDelay(
        500,
        withSequence(
          withTiming(-shakeAmount * 0.4, { duration: shakeDuration }),
          withTiming(shakeAmount * 0.4, { duration: shakeDuration }),
          withTiming(-shakeAmount * 0.2, { duration: shakeDuration }),
          withTiming(0, { duration: shakeDuration }),
        ),
      );
    }

    // Hand slams down after tile lands
    handOpacity.value = withDelay(450, withTiming(1, { duration: 100 }));
    handY.value = withDelay(
      450,
      withSequence(
        withTiming(H * 0.25, {
          duration: 100,
          easing: Easing.in(Easing.cubic),
        }),
        // Lift away
        withDelay(
          600,
          withTiming(-H * 0.5, {
            duration: 400,
            easing: Easing.in(Easing.ease),
          }),
        ),
      ),
    );
    // Fade hand out as it lifts
    handOpacity.value = withDelay(
      450,
      withSequence(
        withTiming(1, { duration: 100 }),
        withDelay(500, withTiming(0, { duration: 400 })),
      ),
    );

    // Haptics at impact
    setTimeout(() => triggerHaptic(), 500);
    setTimeout(() => triggerLightHaptic(), 580);

    if (onComplete) {
      setTimeout(onComplete, 2500);
    }

    return () => {
      cancelAnimation(tileY);
      cancelAnimation(tileScale);
      cancelAnimation(tileRotate);
      cancelAnimation(impactOpacity);
      cancelAnimation(shakeX);
      cancelAnimation(shakeY);
      cancelAnimation(boardJitterX);
      cancelAnimation(boardJitterY);
      cancelAnimation(ringScale);
      cancelAnimation(ringOpacity);
      cancelAnimation(handY);
      cancelAnimation(handOpacity);
    };
  }, [active]);

  const tileStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: tileY.value },
      { scale: tileScale.value },
      { rotate: `${tileRotate.value}deg` },
    ],
  }));

  const impactStyle = useAnimatedStyle(() => ({
    opacity: impactOpacity.value,
  }));

  const shakeStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shakeX.value }, { translateY: shakeY.value }],
  }));

  const boardJitterStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: boardJitterX.value },
      { translateY: boardJitterY.value },
    ],
  }));

  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ scale: ringScale.value }],
    opacity: ringOpacity.value,
  }));

  const handStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: handY.value }],
    opacity: handOpacity.value,
  }));

  if (!active || !settings.winSlamAnimation) return null;

  const tileSize = Math.min(W * 0.28, 120);

  return (
    <Animated.View
      style={[StyleSheet.absoluteFill, shakeStyle, { zIndex: 1000 }]}
    >
      {/* Board jitter overlay — this shakes the whole screen content below */}
      <Animated.View
        style={[StyleSheet.absoluteFill, boardJitterStyle]}
        pointerEvents="none"
      />

      {/* Impact flash */}
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: "#fff" },
          impactStyle,
        ]}
        pointerEvents="none"
      />

      {/* Impact ring */}
      <Animated.View
        style={[
          {
            position: "absolute",
            top: H * 0.35 - 40,
            left: W / 2 - 40,
            width: 80,
            height: 80,
            borderRadius: 40,
            borderWidth: 3,
            borderColor: "rgba(255,200,50,0.6)",
          },
          ringStyle,
        ]}
        pointerEvents="none"
      />

      {/* The slamming domino tile */}
      <Animated.View
        style={[
          {
            position: "absolute",
            top: 0,
            left: W / 2 - tileSize * 0.225,
            alignItems: "center",
          },
          tileStyle,
        ]}
        pointerEvents="none"
      >
        {lastDomino ? (
          <SlamDominoTile domino={lastDomino} size={tileSize} />
        ) : (
          <View
            style={{
              width: tileSize * 0.45,
              height: tileSize,
              borderRadius: tileSize * 0.08,
              backgroundColor: "#faf6ed",
              borderWidth: 2,
              borderColor: "#b8a88a",
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 6 },
              shadowOpacity: 0.5,
              shadowRadius: 12,
              elevation: 10,
            }}
          />
        )}
      </Animated.View>

      {/* Hand following the tile slam */}
      <Animated.View
        style={[
          {
            position: "absolute",
            top: 0,
            left: W * 0.2,
            width: W * 0.6,
            alignItems: "center",
          },
          handStyle,
        ]}
        pointerEvents="none"
      >
        <Text style={{ fontSize: Math.min(W * 0.25, 100) }}>🖐️</Text>
      </Animated.View>

      {/* Impact sparks */}
      <Animated.View
        style={[
          {
            position: "absolute",
            top: H * 0.35 - 25,
            left: W / 2 - 25,
            width: 50,
            height: 50,
            alignItems: "center",
            justifyContent: "center",
          },
          impactStyle,
        ]}
        pointerEvents="none"
      >
        <Text style={{ fontSize: 40 }}>💥</Text>
      </Animated.View>
    </Animated.View>
  );
}

// ─────────────────────────────────────────────
// 2. CONFETTI BURST
// ─────────────────────────────────────────────
const CONFETTI_COLORS = [
  "#FF6B6B",
  "#4ECDC4",
  "#45B7D1",
  "#FED766",
  "#F08080",
  "#98D8C8",
  "#7EC8E3",
  "#FFB347",
  "#87CEEB",
  "#DDA0DD",
  "#98FB98",
  "#FF69B4",
];

function ConfettiPiece({
  index,
  screenW,
  screenH,
}: {
  index: number;
  screenW: number;
  screenH: number;
}) {
  const progress = useSharedValue(0);
  const startX = useMemo(() => Math.random() * screenW, [screenW]);
  const drift = useMemo(() => (Math.random() - 0.5) * screenW * 0.6, [screenW]);
  const rotSpeed = useMemo(() => 360 + Math.random() * 720, []);
  const size = useMemo(() => 8 + Math.random() * 10, []);
  const color = useMemo(
    () => CONFETTI_COLORS[index % CONFETTI_COLORS.length],
    [index],
  );
  const shape = useMemo(() => (Math.random() > 0.5 ? "square" : "circle"), []);
  const delay = useMemo(() => Math.random() * 400, []);

  useEffect(() => {
    progress.value = withDelay(
      delay,
      withTiming(1, {
        duration: 2500 + Math.random() * 1000,
        easing: Easing.out(Easing.quad),
      }),
    );
  }, []);

  const style = useAnimatedStyle(() => {
    const p = progress.value;
    return {
      position: "absolute",
      left: startX + drift * p,
      top: interpolate(p, [0, 1], [-20, screenH + 20]),
      width: size,
      height: shape === "square" ? size : size * 0.5,
      borderRadius: shape === "circle" ? size / 2 : 2,
      backgroundColor: color,
      opacity: interpolate(p, [0, 0.1, 0.8, 1], [0, 1, 1, 0]),
      transform: [
        { rotate: `${p * rotSpeed}deg` },
        { scale: interpolate(p, [0, 0.1, 1], [0, 1, 0.6]) },
      ],
    };
  });

  return <Animated.View style={style} pointerEvents="none" />;
}

export function ConfettiBurst({ active }: { active: boolean }) {
  const { settings } = useSettings();
  const { width: W, height: H } = useWindowDimensions();

  if (!active || !settings.confettiAnimation) return null;

  const count =
    settings.animationIntensity === "full"
      ? 60
      : settings.animationIntensity === "minimal"
        ? 25
        : 0;

  return (
    <View
      style={[StyleSheet.absoluteFill, { zIndex: 1001 }]}
      pointerEvents="none"
    >
      {Array.from({ length: count }).map((_, i) => (
        <ConfettiPiece key={i} index={i} screenW={W} screenH={H} />
      ))}
    </View>
  );
}

// ─────────────────────────────────────────────
// 3. FIREWORKS
// ─────────────────────────────────────────────
function FireworkBurst({
  cx,
  cy,
  color,
  delay: d,
  size,
}: {
  cx: number;
  cy: number;
  color: string;
  delay: number;
  size: number;
}) {
  const progress = useSharedValue(0);
  const particles = useMemo(
    () =>
      Array.from({ length: 12 }).map((_, i) => ({
        angle: (i / 12) * Math.PI * 2,
        dist: size * 0.3 + Math.random() * size * 0.7,
      })),
    [size],
  );

  useEffect(() => {
    progress.value = withDelay(
      d,
      withSequence(
        withTiming(1, { duration: 800, easing: Easing.out(Easing.cubic) }),
        withTiming(1.5, { duration: 600, easing: Easing.linear }),
      ),
    );
  }, []);

  return (
    <>
      {particles.map((p, i) => {
        const ParticleView = () => {
          const style = useAnimatedStyle(() => {
            const prog = Math.min(progress.value, 1);
            const fade =
              progress.value > 1
                ? interpolate(progress.value, [1, 1.5], [1, 0])
                : 1;
            return {
              position: "absolute",
              left: cx + Math.cos(p.angle) * p.dist * prog - 4,
              top: cy + Math.sin(p.angle) * p.dist * prog - 4,
              width: 8,
              height: 8,
              borderRadius: 4,
              backgroundColor: color,
              opacity: fade,
              transform: [
                { scale: interpolate(prog, [0, 0.5, 1], [0, 1.2, 0.8]) },
              ],
              shadowColor: color,
              shadowOffset: { width: 0, height: 0 },
              shadowOpacity: 0.8,
              shadowRadius: 6,
            };
          });
          return <Animated.View style={style} pointerEvents="none" />;
        };
        return <ParticleView key={i} />;
      })}
    </>
  );
}

export function Fireworks({ active }: { active: boolean }) {
  const { settings } = useSettings();
  const { width: W, height: H } = useWindowDimensions();

  if (!active || !settings.victoryFireworks) return null;

  const bursts = useMemo(
    () =>
      Array.from({
        length: settings.animationIntensity === "full" ? 5 : 2,
      }).map((_, i) => ({
        cx: W * 0.15 + Math.random() * W * 0.7,
        cy: H * 0.1 + Math.random() * H * 0.4,
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        delay: i * 400,
        size: 60 + Math.random() * 40,
      })),
    [W, H, settings.animationIntensity],
  );

  return (
    <View
      style={[StyleSheet.absoluteFill, { zIndex: 1002 }]}
      pointerEvents="none"
    >
      {bursts.map((b, i) => (
        <FireworkBurst key={i} {...b} />
      ))}
    </View>
  );
}

// ─────────────────────────────────────────────
// 4. EMOJI RAIN
// ─────────────────────────────────────────────
const WIN_EMOJIS = [
  "🎉",
  "🏆",
  "🥇",
  "💪",
  "🔥",
  "⭐",
  "👑",
  "🎊",
  "💯",
  "🙌",
  "😎",
  "🤩",
];
const LOSS_EMOJIS = ["😢", "💀", "😭", "🫠", "😩", "😤"];

function FallingEmoji({
  emoji,
  screenW,
  screenH,
  delay: d,
}: {
  emoji: string;
  screenW: number;
  screenH: number;
  delay: number;
}) {
  const progress = useSharedValue(0);
  const startX = useMemo(() => Math.random() * screenW, [screenW]);
  const wobble = useMemo(() => (Math.random() - 0.5) * 60, []);
  const emojiSize = useMemo(() => 20 + Math.random() * 24, []);

  useEffect(() => {
    progress.value = withDelay(
      d,
      withTiming(1, {
        duration: 2000 + Math.random() * 1500,
        easing: Easing.in(Easing.quad),
      }),
    );
  }, []);

  const style = useAnimatedStyle(() => ({
    position: "absolute",
    left: startX + Math.sin(progress.value * 6) * wobble,
    top: interpolate(progress.value, [0, 1], [-40, screenH + 40]),
    opacity: interpolate(progress.value, [0, 0.05, 0.85, 1], [0, 1, 1, 0]),
    transform: [
      { rotate: `${progress.value * 360}deg` },
      { scale: interpolate(progress.value, [0, 0.1, 1], [0.3, 1, 0.7]) },
    ],
  }));

  return (
    <Animated.View style={style} pointerEvents="none">
      <Text style={{ fontSize: emojiSize }}>{emoji}</Text>
    </Animated.View>
  );
}

export function EmojiRain({ active, won }: { active: boolean; won: boolean }) {
  const { settings } = useSettings();
  const { width: W, height: H } = useWindowDimensions();

  if (!active || !settings.funnyEmojis) return null;

  const emojis = won ? WIN_EMOJIS : LOSS_EMOJIS;
  const count =
    settings.animationIntensity === "full"
      ? 20
      : settings.animationIntensity === "minimal"
        ? 8
        : 0;

  return (
    <View
      style={[StyleSheet.absoluteFill, { zIndex: 1003 }]}
      pointerEvents="none"
    >
      {Array.from({ length: count }).map((_, i) => (
        <FallingEmoji
          key={i}
          emoji={emojis[i % emojis.length]}
          screenW={W}
          screenH={H}
          delay={i * 150}
        />
      ))}
    </View>
  );
}

// ─────────────────────────────────────────────
// 5. VICTORY BANNER — trophy with bounce-in
// ─────────────────────────────────────────────
export function VictoryBanner({
  active,
  won,
  teamColor,
}: {
  active: boolean;
  won: boolean;
  teamColor: string;
}) {
  const { settings } = useSettings();
  const { width: W } = useWindowDimensions();

  const scale = useSharedValue(0);
  const rotate = useSharedValue(-10);
  const opacity = useSharedValue(0);
  const glow = useSharedValue(0);

  useEffect(() => {
    if (!active) return;

    opacity.value = withDelay(300, withTiming(1, { duration: 300 }));
    scale.value = withDelay(
      300,
      withSpring(1, { damping: 6, stiffness: 120, mass: 0.8 }),
    );
    rotate.value = withDelay(
      300,
      withSequence(
        withSpring(5, { damping: 4, stiffness: 200 }),
        withSpring(0, { damping: 8, stiffness: 150 }),
      ),
    );
    glow.value = withDelay(
      800,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
          withTiming(0.3, {
            duration: 1000,
            easing: Easing.inOut(Easing.ease),
          }),
        ),
        -1,
        true,
      ),
    );

    return () => {
      cancelAnimation(scale);
      cancelAnimation(rotate);
      cancelAnimation(opacity);
      cancelAnimation(glow);
    };
  }, [active]);

  const bannerStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }, { rotate: `${rotate.value}deg` }],
    opacity: opacity.value,
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: glow.value,
  }));

  if (!active || settings.reducedMotion) return null;

  const label = won ? "🏆 VICTORY! 🏆" : "💀 DEFEAT 💀";
  const subLabel = won
    ? "You dominated the table!"
    : "Better luck next time...";

  return (
    <View style={victoryStyles.container} pointerEvents="none">
      {/* Glow ring */}
      <Animated.View
        style={[
          victoryStyles.glowRing,
          {
            width: W * 0.7,
            height: W * 0.7,
            borderRadius: W * 0.35,
            backgroundColor: teamColor + "15",
            borderColor: teamColor + "30",
          },
          glowStyle,
        ]}
      />

      <Animated.View style={[victoryStyles.bannerCard, bannerStyle]}>
        <Text style={victoryStyles.bannerEmoji}>{won ? "🏆" : "💀"}</Text>
        <Text style={[victoryStyles.bannerTitle, { color: teamColor }]}>
          {won ? "VICTORY!" : "DEFEAT"}
        </Text>
        <Text style={victoryStyles.bannerSub}>{subLabel}</Text>
      </Animated.View>
    </View>
  );
}

const victoryStyles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  glowRing: {
    position: "absolute",
    borderWidth: 2,
  },
  bannerCard: {
    alignItems: "center",
    paddingHorizontal: 40,
    paddingVertical: 24,
    borderRadius: 20,
    backgroundColor: "rgba(6,15,29,0.9)",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.15)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 12,
  },
  bannerEmoji: {
    fontSize: 56,
    marginBottom: 8,
  },
  bannerTitle: {
    fontSize: 28,
    fontWeight: "900",
    letterSpacing: 2,
  },
  bannerSub: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 13,
    marginTop: 6,
    fontWeight: "600",
  },
});

// ─────────────────────────────────────────────
// 6. COMBINED OVERLAY — orchestrates all animations
// ─────────────────────────────────────────────
export function WinCelebration({
  active,
  won,
  isBlocked,
  teamColor,
  lastDomino,
  onSlamComplete,
}: {
  active: boolean;
  won: boolean;
  isBlocked?: boolean;
  teamColor: string;
  lastDomino?: Domino | null;
  onSlamComplete?: () => void;
}) {
  const { settings } = useSettings();

  if (
    !active ||
    settings.reducedMotion ||
    settings.animationIntensity === "off"
  )
    return null;

  // Don't play slam when game is blocked (passCount >= 4)
  const showSlam = won && !isBlocked;

  return (
    <>
      <BoardSlam
        active={active && showSlam}
        onComplete={onSlamComplete}
        lastDomino={lastDomino}
      />
      <ConfettiBurst active={active && won} />
      <Fireworks active={active && won} />
      <EmojiRain active={active} won={won} />
      <VictoryBanner active={active} won={won} teamColor={teamColor} />
    </>
  );
}
