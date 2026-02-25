import React, { useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Dimensions,
  ScrollView,
} from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withRepeat,
  withSequence,
  withTiming,
  withDelay,
  interpolate,
  Easing,
  FadeInDown,
  FadeInUp,
  ZoomIn,
  SlideInLeft,
} from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { useGame } from "../context/GameContext";
import { Colors } from "../theme/colors";
import AnimatedBackground from "../components/AnimatedBackground";

const { width: SCREEN_W } = Dimensions.get("window");

function FloatingLogo() {
  const rotateY = useSharedValue(0);
  const floatY = useSharedValue(0);

  useEffect(() => {
    rotateY.value = withRepeat(
      withTiming(360, { duration: 8000, easing: Easing.linear }),
      -1,
      false,
    );
    floatY.value = withRepeat(
      withSequence(
        withTiming(-12, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      true,
    );
  }, []);

  const style = useAnimatedStyle(() => ({
    transform: [
      { perspective: 600 },
      { rotateY: `${rotateY.value}deg` },
      { translateY: floatY.value },
    ],
  }));

  return (
    <Animated.View style={[styles.logoWrap, style]}>
      <LinearGradient
        colors={[Colors.emerald, "#065f46"]}
        style={styles.logo3d}
      >
        <View style={styles.logoBevel} />
        <Text style={styles.logoText}>🁣</Text>
      </LinearGradient>
      <View style={styles.logoDepth} />
    </Animated.View>
  );
}

function PlayerSlot({
  index,
  player,
  isMe,
}: {
  index: number;
  player?: any;
  isMe: boolean;
}) {
  const pulseAnim = useSharedValue(0);

  useEffect(() => {
    if (!player) {
      pulseAnim.value = withRepeat(
        withSequence(
          withTiming(1, {
            duration: 1000,
            easing: Easing.inOut(Easing.ease),
          }),
          withTiming(0, {
            duration: 1000,
            easing: Easing.inOut(Easing.ease),
          }),
        ),
        -1,
        true,
      );
    }
  }, [player]);

  const emptyPulse = useAnimatedStyle(() => ({
    opacity: interpolate(pulseAnim.value, [0, 1], [0.3, 0.7]),
    transform: [{ scale: interpolate(pulseAnim.value, [0, 1], [0.95, 1.05]) }],
  }));

  const teamColor =
    player?.team === "team1"
      ? Colors.team1
      : player?.team === "team2"
        ? Colors.team2
        : Colors.white20;

  return (
    <Animated.View
      entering={SlideInLeft.duration(400).delay(200 + index * 120)}
    >
      <View
        style={[
          styles.slot,
          player && {
            borderColor: teamColor + "40",
            backgroundColor: teamColor + "08",
          },
          isMe && { borderColor: Colors.emerald + "60" },
        ]}
      >
        {/* 3D Number badge */}
        <View style={styles.slotNumWrap}>
          <LinearGradient
            colors={
              player ? [teamColor, teamColor + "80"] : ["#374151", "#1f2937"]
            }
            style={styles.slotNum}
          >
            <Text style={styles.slotNumText}>{index + 1}</Text>
          </LinearGradient>
          <View
            style={[
              styles.slotNumDepth,
              player && { backgroundColor: teamColor + "40" },
            ]}
          />
        </View>

        {/* Status dot */}
        <View style={styles.slotStatusWrap}>
          {player ? (
            <View
              style={[styles.statusDot, { backgroundColor: Colors.emerald }]}
            >
              <View style={styles.statusDotInner} />
            </View>
          ) : (
            <Animated.View
              style={[
                styles.statusDot,
                {
                  backgroundColor: Colors.white10,
                  borderWidth: 1,
                  borderColor: Colors.white10,
                },
                emptyPulse,
              ]}
            />
          )}
        </View>

        {/* Player info */}
        <View style={styles.slotInfo}>
          {player ? (
            <>
              <Text
                style={[
                  styles.slotName,
                  isMe && { color: Colors.emeraldLight },
                ]}
                numberOfLines={1}
              >
                {player.name}
                {isMe ? " (you)" : ""}
              </Text>
              <View style={styles.slotMeta}>
                <View
                  style={[
                    styles.teamTag,
                    { backgroundColor: teamColor + "20" },
                  ]}
                >
                  <Text style={[styles.teamTagText, { color: teamColor }]}>
                    {player.team === "team1" ? "TEAM 1" : "TEAM 2"}
                  </Text>
                </View>
                {player.isAI && (
                  <View style={styles.aiTagWrap}>
                    <Text style={styles.aiTag}>🤖 AI</Text>
                  </View>
                )}
              </View>
            </>
          ) : (
            <Text style={styles.slotEmpty}>Waiting for player...</Text>
          )}
        </View>

        {/* Active indicator bar at bottom */}
        {player && (
          <View style={styles.slotBar}>
            <LinearGradient
              colors={[teamColor, teamColor + "60"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.slotBarFill}
            />
          </View>
        )}
      </View>
    </Animated.View>
  );
}

export default function LobbyScreen() {
  const { gameState, startGame, autoFillAI, copyRoomCode, leaveMatch, socket } =
    useGame();

  if (!gameState) {
    return (
      <LinearGradient
        colors={["#060f1d", "#0a192f", "#0f2e2e", "#1a1a2e"]}
        style={styles.container}
      >
        <ActivityIndicator size="large" color={Colors.emerald} />
        <Text style={styles.loadingText}>Connecting...</Text>
      </LinearGradient>
    );
  }

  const playerCount = gameState.players.length;
  const isFull = playerCount === 4;

  return (
    <LinearGradient
      colors={["#060f1d", "#0a192f", "#0f2e2e", "#1a1a2e"]}
      style={styles.container}
    >
      <AnimatedBackground />

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Spinning 3D Logo */}
        <Animated.View entering={ZoomIn.duration(500)}>
          <FloatingLogo />
        </Animated.View>

        {/* Title */}
        <Animated.Text
          entering={FadeInDown.duration(400).delay(100)}
          style={styles.title}
        >
          Game Lobby
        </Animated.Text>
        <Animated.View
          entering={FadeInDown.duration(400).delay(200)}
          style={styles.counterRow}
        >
          {[0, 1, 2, 3].map((i) => (
            <View
              key={i}
              style={[
                styles.counterDot,
                i < playerCount && { backgroundColor: Colors.emerald },
              ]}
            />
          ))}
          <Text style={styles.counterText}>{playerCount}/4 Players</Text>
        </Animated.View>

        {/* Room code card */}
        <Animated.View entering={FadeInDown.duration(400).delay(300)}>
          <TouchableOpacity onPress={copyRoomCode} activeOpacity={0.7}>
            <View style={styles.roomCard}>
              <View style={styles.roomCardGlow} />
              <Text style={styles.roomLabel}>ROOM CODE</Text>
              <Text style={styles.roomCode}>{gameState.id}</Text>
              <View style={styles.copyRow}>
                <Text style={styles.copyIcon}>📋</Text>
                <Text style={styles.copyHint}>Tap to copy & share</Text>
              </View>
            </View>
          </TouchableOpacity>
        </Animated.View>

        {/* Player slots */}
        <View style={styles.slotsContainer}>
          {[0, 1, 2, 3].map((i) => {
            const player = gameState.players[i];
            const isMe = player?.id === socket?.id;
            return <PlayerSlot key={i} index={i} player={player} isMe={isMe} />;
          })}
        </View>

        {/* Actions */}
        <View style={styles.actionsContainer}>
          {isFull ? (
            <Animated.View entering={ZoomIn.duration(300)}>
              <TouchableOpacity onPress={startGame} activeOpacity={0.8}>
                <View style={styles.startBtnWrap}>
                  <LinearGradient
                    colors={[Colors.emerald, Colors.emeraldDark]}
                    style={styles.startBtn}
                  >
                    <Text style={styles.startBtnText}>🚀 Start Game</Text>
                  </LinearGradient>
                  <View style={styles.startGlow} />
                </View>
              </TouchableOpacity>
            </Animated.View>
          ) : (
            <>
              <View style={styles.waitingBox}>
                <ActivityIndicator
                  size="small"
                  color={Colors.white40}
                  style={{ marginRight: 8 }}
                />
                <Text style={styles.waitingText}>
                  Waiting for more players...
                </Text>
              </View>

              <TouchableOpacity onPress={autoFillAI} activeOpacity={0.8}>
                <View style={styles.aiFillWrap}>
                  <LinearGradient
                    colors={["rgba(139,92,246,0.2)", "rgba(124,58,237,0.2)"]}
                    style={styles.aiFillBtn}
                  >
                    <Text style={styles.aiFillIcon}>🤖</Text>
                    <Text style={styles.aiFillText}>Auto Fill with AI</Text>
                  </LinearGradient>
                  <View style={styles.aiFillGlow} />
                </View>
              </TouchableOpacity>
            </>
          )}
        </View>

        {/* Bottom actions */}
        <Animated.View
          entering={FadeInUp.duration(400).delay(500)}
          style={styles.bottomActions}
        >
          <TouchableOpacity onPress={copyRoomCode} style={styles.bottomBtn}>
            <Text style={styles.bottomBtnText}>📋 Copy Code</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={leaveMatch}
            style={[styles.bottomBtn, styles.leaveBtn]}
          >
            <Text style={[styles.bottomBtnText, { color: "#fca5a5" }]}>
              🚪 Leave
            </Text>
          </TouchableOpacity>
        </Animated.View>
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingVertical: 32,
    alignItems: "center",
  },
  loadingText: {
    color: Colors.white60,
    marginTop: 12,
    fontSize: 16,
  },

  // 3D Logo
  logoWrap: {
    marginBottom: 12,
    position: "relative",
  },
  logo3d: {
    width: 64,
    height: 64,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    overflow: "hidden",
    zIndex: 2,
  },
  logoBevel: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: "40%",
    backgroundColor: "rgba(255,255,255,0.15)",
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
  },
  logoText: {
    fontSize: 36,
    zIndex: 1,
  },
  logoDepth: {
    position: "absolute",
    bottom: -4,
    left: 4,
    right: 4,
    height: 8,
    backgroundColor: "rgba(16,185,129,0.3)",
    borderRadius: 12,
    zIndex: 1,
  },

  title: {
    fontSize: 32,
    fontWeight: "800",
    color: Colors.white,
    letterSpacing: 1,
    textShadowColor: "rgba(0,0,0,0.3)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
  counterRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
    marginBottom: 16,
    gap: 6,
  },
  counterDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.white10,
    borderWidth: 1,
    borderColor: Colors.white10,
  },
  counterText: {
    color: Colors.white40,
    fontWeight: "600",
    fontSize: 14,
    marginLeft: 4,
  },

  // Room card
  roomCard: {
    backgroundColor: "rgba(0,0,0,0.3)",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.white10,
    paddingVertical: 14,
    paddingHorizontal: 28,
    alignItems: "center",
    marginBottom: 20,
    overflow: "hidden",
    // 3D shadow
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  roomCardGlow: {
    position: "absolute",
    top: -30,
    width: "80%",
    height: 60,
    backgroundColor: "rgba(16,185,129,0.08)",
    borderRadius: 60,
  },
  roomLabel: {
    fontSize: 9,
    fontWeight: "700",
    color: Colors.white40,
    letterSpacing: 3,
  },
  roomCode: {
    fontSize: 28,
    fontWeight: "900",
    color: Colors.emeraldLight,
    fontFamily: "monospace",
    letterSpacing: 4,
    marginVertical: 4,
    textShadowColor: "rgba(16,185,129,0.3)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
  copyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  copyIcon: { fontSize: 10 },
  copyHint: {
    fontSize: 10,
    color: Colors.white20,
  },

  // Slots
  slotsContainer: {
    width: "100%",
    gap: 8,
    marginBottom: 20,
  },
  slot: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.white10,
    padding: 14,
    gap: 12,
    overflow: "hidden",
    // 3D depth
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 4,
  },
  slotNumWrap: {
    position: "relative",
  },
  slotNum: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2,
  },
  slotNumText: {
    color: Colors.white,
    fontWeight: "800",
    fontSize: 14,
  },
  slotNumDepth: {
    position: "absolute",
    bottom: -2,
    left: 2,
    right: 2,
    height: 4,
    borderRadius: 6,
    backgroundColor: "rgba(0,0,0,0.2)",
    zIndex: 1,
  },
  slotStatusWrap: {},
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    alignItems: "center",
    justifyContent: "center",
  },
  statusDotInner: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.5)",
  },
  slotInfo: {
    flex: 1,
  },
  slotName: {
    color: Colors.white80,
    fontWeight: "700",
    fontSize: 15,
  },
  slotMeta: {
    flexDirection: "row",
    gap: 6,
    marginTop: 3,
  },
  slotEmpty: {
    color: Colors.white20,
    fontSize: 13,
    fontStyle: "italic",
  },
  teamTag: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  teamTagText: {
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 1,
  },
  aiTagWrap: {
    backgroundColor: "rgba(139,92,246,0.15)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  aiTag: {
    fontSize: 9,
    color: Colors.purpleLight,
    fontWeight: "600",
  },
  slotBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 2,
  },
  slotBarFill: {
    height: "100%",
    borderRadius: 1,
  },

  // Actions
  actionsContainer: {
    width: "100%",
    gap: 10,
    marginBottom: 16,
  },
  startBtnWrap: {
    position: "relative",
  },
  startBtn: {
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: "center",
    shadowColor: Colors.emerald,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  startGlow: {
    position: "absolute",
    bottom: -4,
    left: 30,
    right: 30,
    height: 8,
    backgroundColor: Colors.emerald,
    borderRadius: 8,
    opacity: 0.2,
  },
  startBtnText: {
    color: Colors.white,
    fontWeight: "800",
    fontSize: 18,
  },
  waitingBox: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.03)",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.white05,
    padding: 14,
  },
  waitingText: {
    color: Colors.white40,
    fontSize: 14,
  },
  aiFillWrap: {
    position: "relative",
  },
  aiFillBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(139,92,246,0.2)",
    paddingVertical: 14,
    gap: 10,
  },
  aiFillGlow: {
    position: "absolute",
    bottom: -3,
    left: 30,
    right: 30,
    height: 6,
    backgroundColor: Colors.purple,
    borderRadius: 6,
    opacity: 0.15,
  },
  aiFillIcon: { fontSize: 20 },
  aiFillText: {
    color: Colors.purpleLight,
    fontWeight: "700",
    fontSize: 15,
  },

  bottomActions: {
    flexDirection: "row",
    gap: 12,
  },
  bottomBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.white10,
    paddingVertical: 12,
    gap: 6,
    // 3D depth
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  bottomBtnText: {
    color: Colors.white60,
    fontWeight: "600",
    fontSize: 14,
  },
  leaveBtn: {
    borderColor: "rgba(239,68,68,0.2)",
    backgroundColor: "rgba(239,68,68,0.06)",
  },
});
