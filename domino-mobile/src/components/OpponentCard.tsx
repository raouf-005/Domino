/**
 * OpponentCard — Ultra-compact opponent pill.
 * Shows only: team dot · initial/emoji · tile count.
 * Amber border pulse when it's that player's turn.
 */
import React, { useEffect } from "react";
import { View, Text, StyleSheet } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  interpolate,
  Easing,
} from "react-native-reanimated";
import { Player } from "../types/gameTypes";
import { Colors } from "../theme/colors";

interface Props {
  player?: Player;
  isActive: boolean;
}

export default function OpponentCard({ player, isActive }: Props) {
  const glow = useSharedValue(0);

  useEffect(() => {
    if (isActive) {
      glow.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 500, easing: Easing.inOut(Easing.ease) }),
          withTiming(0.2, { duration: 500, easing: Easing.inOut(Easing.ease) }),
        ),
        -1,
        true,
      );
    } else {
      glow.value = withTiming(0, { duration: 200 });
    }
  }, [isActive]);

  const pillStyle = useAnimatedStyle(() => ({
    borderColor: isActive
      ? `rgba(245,158,11,${interpolate(glow.value, [0, 1], [0.25, 0.8])})`
      : "rgba(255,255,255,0.08)",
    backgroundColor: isActive
      ? `rgba(245,158,11,${interpolate(glow.value, [0, 1], [0.04, 0.1])})`
      : "rgba(255,255,255,0.04)",
  }));

  if (!player) return null;

  const tc = player.team === "team1" ? Colors.team1 : Colors.team2;

  return (
    <Animated.View style={[s.pill, pillStyle]}>
      <View style={[s.dot, { backgroundColor: tc }]} />
      <Text style={s.initial} numberOfLines={1}>
        {player.isAI ? "🤖" : player.name?.charAt(0)?.toUpperCase()}
      </Text>
      <Text style={s.count}>{player.hand.length}</Text>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  initial: {
    color: Colors.white80,
    fontWeight: "700",
    fontSize: 11,
  },
  count: {
    color: Colors.white40,
    fontWeight: "600",
    fontSize: 10,
    fontFamily: "monospace",
  },
});
