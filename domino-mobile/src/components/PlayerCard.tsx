import React, { useEffect } from "react";
import { View, Text, StyleSheet } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withRepeat,
  withSequence,
  withTiming,
  interpolate,
  Easing,
} from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { Player } from "../types/gameTypes";
import { Colors } from "../theme/colors";
import { FaceDownTile3D } from "./DominoTile3D";

interface PlayerCardProps {
  player?: Player;
  isCurrentTurn: boolean;
  isMe: boolean;
  compact?: boolean;
}

export default function PlayerCard({
  player,
  isCurrentTurn,
  isMe,
  compact = false,
}: PlayerCardProps) {
  const scale = useSharedValue(0.9);
  const glowAnim = useSharedValue(0);
  const tiltX = useSharedValue(0);
  const tiltY = useSharedValue(0);

  useEffect(() => {
    scale.value = withSpring(1, { damping: 12, stiffness: 100 });
  }, []);

  useEffect(() => {
    if (isCurrentTurn) {
      glowAnim.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 800, easing: Easing.inOut(Easing.ease) }),
          withTiming(0.3, { duration: 800, easing: Easing.inOut(Easing.ease) }),
        ),
        -1,
        true,
      );
      tiltX.value = withRepeat(
        withSequence(
          withTiming(1.5, { duration: 2200, easing: Easing.inOut(Easing.ease) }),
          withTiming(-1.5, {
            duration: 2200,
            easing: Easing.inOut(Easing.ease),
          }),
        ),
        -1,
        true,
      );
      tiltY.value = withRepeat(
        withSequence(
          withTiming(-1.5, {
            duration: 2400,
            easing: Easing.inOut(Easing.ease),
          }),
          withTiming(1.5, { duration: 2400, easing: Easing.inOut(Easing.ease) }),
        ),
        -1,
        true,
      );
    } else {
      glowAnim.value = withTiming(0, { duration: 300 });
      tiltX.value = withTiming(0, { duration: 300 });
      tiltY.value = withTiming(0, { duration: 300 });
    }
  }, [isCurrentTurn]);

  const containerStyle = useAnimatedStyle(() => ({
    transform: [
      { perspective: 700 },
      { rotateX: `${tiltX.value}deg` },
      { rotateY: `${tiltY.value}deg` },
      { scale: scale.value },
    ],
  }));

  const glowStyle = useAnimatedStyle(() => ({
    shadowOpacity: interpolate(glowAnim.value, [0, 1], [0, 0.5]),
  }));

  if (!player) {
    return (
      <Animated.View style={[styles.cardStack, containerStyle]}>
        <View style={[styles.cardDepth, { backgroundColor: Colors.white05 }]} />
        <View style={[styles.card, styles.emptyCard]}>
          <View style={styles.emptyAvatar} />
          <Text style={styles.emptyText}>Empty</Text>
        </View>
      </Animated.View>
    );
  }

  const teamColor = player.team === "team1" ? Colors.team1 : Colors.team2;

  return (
    <Animated.View style={[styles.cardStack, containerStyle]}>
      <View style={[styles.cardDepth, { backgroundColor: teamColor + "18" }]} />
      <Animated.View
        style={[
          styles.card,
          { borderColor: teamColor + "30" },
          isCurrentTurn && { shadowColor: Colors.amber },
          isMe && styles.meCard,
          glowStyle,
        ]}
      >
        {/* Background tint */}
        <View style={[styles.cardBg, { backgroundColor: teamColor + "08" }]} />

        {/* 3D Avatar */}
        <View style={styles.avatarWrap}>
          <LinearGradient
            colors={[teamColor, teamColor + "80"]}
            style={styles.avatar}
          >
            <Text style={styles.avatarText}>
              {player.isAI ? "🤖" : player.name?.charAt(0)?.toUpperCase()}
            </Text>
          </LinearGradient>
          <View
            style={[styles.avatarDepth, { backgroundColor: teamColor + "30" }]}
          />
        </View>

        {/* Info */}
        <View style={styles.info}>
          <View style={styles.nameRow}>
            <Text style={styles.name} numberOfLines={1}>
              {player.name}
            </Text>
            {isMe && (
              <LinearGradient
                colors={[Colors.emerald + "40", Colors.emerald + "20"]}
                style={styles.youBadge}
              >
                <Text style={styles.youText}>YOU</Text>
              </LinearGradient>
            )}
          </View>
          <View style={styles.statusRow}>
            <View
              style={[
                styles.statusDot,
                {
                  backgroundColor: player.isConnected
                    ? Colors.emerald
                    : Colors.team2,
                },
              ]}
            />
            <Text style={styles.statusText}>{player.hand.length} tiles</Text>
          </View>
        </View>

        {/* Turn indicator */}
        {isCurrentTurn && (
          <View style={styles.turnBadge}>
            <Text style={styles.turnText}>🎯</Text>
          </View>
        )}

        {/* Face-down 3D tiles */}
        {!compact && (
          <View style={styles.tilesRow}>
            {Array.from({ length: Math.min(player.hand.length, 4) }).map(
              (_, i) => (
                <FaceDownTile3D key={i} size="small" delay={i * 50} />
              ),
            )}
            {player.hand.length > 4 && (
              <View style={styles.extraWrap}>
                <Text style={styles.extraTiles}>+{player.hand.length - 4}</Text>
              </View>
            )}
          </View>
        )}

        {/* Bottom accent bar */}
        <View style={styles.accentBar}>
          <LinearGradient
            colors={[teamColor, teamColor + "40"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.accentBarFill}
          />
        </View>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  cardStack: {
    position: "relative",
    width: "100%",
  },
  cardDepth: {
    position: "absolute",
    bottom: -4,
    left: 6,
    right: 6,
    height: 8,
    borderRadius: 14,
    zIndex: 1,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    backgroundColor: "rgba(255,255,255,0.04)",
    gap: 10,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
    zIndex: 2,
  },
  cardBg: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 16,
  },
  emptyCard: {
    justifyContent: "center",
    alignItems: "center",
    flexDirection: "column",
    paddingVertical: 16,
    opacity: 0.5,
  },
  emptyAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.white10,
    marginBottom: 4,
  },
  emptyText: {
    color: Colors.white40,
    fontSize: 11,
  },
  meCard: {
    borderColor: Colors.emerald + "40",
    borderWidth: 1.5,
  },
  avatarWrap: {
    position: "relative",
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
  },
  avatarDepth: {
    position: "absolute",
    bottom: -2,
    left: 3,
    right: 3,
    height: 4,
    borderRadius: 6,
    zIndex: 1,
  },
  avatarText: {
    color: Colors.white,
    fontWeight: "700",
    fontSize: 16,
  },
  info: {
    flex: 1,
    minWidth: 0,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  name: {
    color: Colors.white,
    fontWeight: "700",
    fontSize: 14,
    flexShrink: 1,
  },
  youBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  youText: {
    color: Colors.emeraldLight,
    fontSize: 8,
    fontWeight: "700",
    letterSpacing: 1,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 3,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    color: Colors.white40,
    fontSize: 10,
  },
  turnBadge: {
    position: "absolute",
    top: 4,
    right: 6,
  },
  turnText: {
    fontSize: 16,
  },
  tilesRow: {
    flexDirection: "row",
    gap: 2,
    alignItems: "center",
  },
  extraWrap: {
    backgroundColor: Colors.white05,
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 4,
  },
  extraTiles: {
    color: Colors.white60,
    fontSize: 10,
    fontWeight: "600",
  },
  accentBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 2,
  },
  accentBarFill: {
    height: "100%",
  },
});
