import React, { useEffect } from "react";
import { View, StyleSheet, Dimensions } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withDelay,
  withSequence,
  Easing,
  interpolate,
} from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");

interface FloatingDom {
  id: number;
  x: number;
  y: number;
  size: number;
  duration: number;
  delay: number;
  rotation: number;
}

const FLOATING_ITEMS: FloatingDom[] = Array.from({ length: 12 }, (_, i) => ({
  id: i,
  x: Math.random() * SCREEN_W,
  y: Math.random() * SCREEN_H,
  size: 20 + Math.random() * 30,
  duration: 4000 + Math.random() * 6000,
  delay: Math.random() * 3000,
  rotation: Math.random() * 360,
}));

function FloatingDomino({ item }: { item: FloatingDom }) {
  const anim = useSharedValue(0);

  useEffect(() => {
    anim.value = withDelay(
      item.delay,
      withRepeat(
        withSequence(
          withTiming(1, {
            duration: item.duration,
            easing: Easing.inOut(Easing.ease),
          }),
          withTiming(0, {
            duration: item.duration,
            easing: Easing.inOut(Easing.ease),
          }),
        ),
        -1,
        true,
      ),
    );
  }, []);

  const style = useAnimatedStyle(() => ({
    transform: [
      { translateY: interpolate(anim.value, [0, 1], [0, -40]) },
      {
        rotate: `${interpolate(
          anim.value,
          [0, 0.5, 1],
          [item.rotation, item.rotation + 15, item.rotation],
        )}deg`,
      },
      { perspective: 600 },
      {
        rotateX: `${interpolate(anim.value, [0, 1], [0, 20])}deg`,
      },
    ],
    opacity: interpolate(
      anim.value,
      [0, 0.3, 0.7, 1],
      [0.04, 0.08, 0.08, 0.04],
    ),
  }));

  return (
    <Animated.View
      style={[
        {
          position: "absolute",
          left: item.x,
          top: item.y,
          width: item.size,
          height: item.size * 1.8,
        },
        style,
      ]}
    >
      <LinearGradient
        colors={["rgba(16,185,129,0.3)", "rgba(16,185,129,0.1)"]}
        style={{
          flex: 1,
          borderRadius: 4,
          borderWidth: 0.5,
          borderColor: "rgba(16,185,129,0.2)",
        }}
      />
    </Animated.View>
  );
}

interface ParticleProps {
  x: number;
  y: number;
  size: number;
  duration: number;
  delay: number;
  color: string;
}

const PARTICLES: ParticleProps[] = Array.from({ length: 20 }, (_, i) => ({
  x: Math.random() * SCREEN_W,
  y: Math.random() * SCREEN_H,
  size: 2 + Math.random() * 4,
  duration: 3000 + Math.random() * 4000,
  delay: Math.random() * 2000,
  color: [
    "rgba(16,185,129,0.4)",
    "rgba(59,130,246,0.3)",
    "rgba(139,92,246,0.3)",
    "rgba(245,158,11,0.3)",
  ][Math.floor(Math.random() * 4)],
}));

function Particle({ particle }: { particle: ParticleProps }) {
  const anim = useSharedValue(0);

  useEffect(() => {
    anim.value = withDelay(
      particle.delay,
      withRepeat(
        withTiming(1, {
          duration: particle.duration,
          easing: Easing.inOut(Easing.ease),
        }),
        -1,
        true,
      ),
    );
  }, []);

  const style = useAnimatedStyle(() => ({
    opacity: interpolate(anim.value, [0, 0.5, 1], [0, 0.8, 0]),
    transform: [
      { translateY: interpolate(anim.value, [0, 1], [0, -60]) },
      { scale: interpolate(anim.value, [0, 0.5, 1], [0.5, 1, 0.5]) },
    ],
  }));

  return (
    <Animated.View
      style={[
        {
          position: "absolute",
          left: particle.x,
          top: particle.y,
          width: particle.size,
          height: particle.size,
          borderRadius: particle.size / 2,
          backgroundColor: particle.color,
        },
        style,
      ]}
    />
  );
}

export default function AnimatedBackground() {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {FLOATING_ITEMS.map((item) => (
        <FloatingDomino key={item.id} item={item} />
      ))}
      {PARTICLES.map((p, i) => (
        <Particle key={`p-${i}`} particle={p} />
      ))}
    </View>
  );
}
