import React, { useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
} from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withDelay,
  withRepeat,
  withSequence,
  interpolate,
  Easing,
  FadeInDown,
  FadeInUp,
  SlideInDown,
} from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { useGame } from "../context/GameContext";
import { Colors } from "../theme/colors";
import { GameMode, AIDifficulty } from "../types/gameTypes";
import AnimatedBackground from "../components/AnimatedBackground";

const { width: SCREEN_W } = Dimensions.get("window");

const MODES: {
  mode: GameMode;
  icon: string;
  title: string;
  desc: string;
  colors: [string, string];
}[] = [
  {
    mode: "multiplayer",
    icon: "👥",
    title: "Multiplayer",
    desc: "Play with friends online",
    colors: ["#3b82f6", "#6366f1"],
  },
  {
    mode: "vs-ai",
    icon: "🤖",
    title: "Play vs AI",
    desc: "Train your skills solo",
    colors: ["#8b5cf6", "#7c3aed"],
  },
  {
    mode: "with-ai-partner",
    icon: "🤝",
    title: "AI Partner",
    desc: "Co-op vs Humans",
    colors: ["#ec4899", "#e11d48"],
  },
];

const DIFFICULTIES: AIDifficulty[] = ["easy", "medium", "hard"];

export default function LoginScreen() {
  const {
    playerName,
    setPlayerName,
    gameId,
    setGameId,
    selectedTeam,
    setSelectedTeam,
    gameMode,
    setGameMode,
    aiDifficulty,
    setAIDifficulty,
    joinGame,
  } = useGame();

  // Logo animation
  const logoRotate = useSharedValue(0);
  const logoScale = useSharedValue(0);
  const logoFloat = useSharedValue(0);

  useEffect(() => {
    logoScale.value = withSpring(1, { damping: 10, stiffness: 80 });
    logoRotate.value = withDelay(
      200,
      withRepeat(
        withSequence(
          withTiming(10, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
          withTiming(-10, {
            duration: 2000,
            easing: Easing.inOut(Easing.ease),
          }),
        ),
        -1,
        true,
      ),
    );
    logoFloat.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      true,
    );
  }, []);

  const logoStyle = useAnimatedStyle(() => ({
    transform: [
      { perspective: 800 },
      { scale: logoScale.value },
      { rotateY: `${logoRotate.value}deg` },
      { rotateX: `${interpolate(logoFloat.value, [0, 1], [-5, 5])}deg` },
      { translateY: interpolate(logoFloat.value, [0, 1], [0, -8]) },
    ],
  }));

  const isDisabled = !playerName.trim() || !gameId.trim();

  return (
    <LinearGradient
      colors={["#060f1d", "#0a192f", "#0f2e2e", "#1a1a2e"]}
      style={styles.container}
    >
      <AnimatedBackground />

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* 3D Logo Header */}
          <Animated.View
            entering={FadeInDown.duration(600).delay(100)}
            style={styles.header}
          >
            <Animated.View style={logoStyle}>
              <View style={styles.logoContainer}>
                <View style={styles.logoShadow} />
                <LinearGradient
                  colors={[Colors.emerald, "#065f46"]}
                  style={styles.logoBox}
                >
                  <View style={styles.logoBevel} />
                  <Text style={styles.logoEmoji}>🁣</Text>
                </LinearGradient>
              </View>
            </Animated.View>

            <Animated.Text
              entering={FadeInDown.duration(500).delay(300)}
              style={styles.title}
            >
              Domino
            </Animated.Text>
            <Animated.View
              entering={FadeInDown.duration(500).delay(400)}
              style={styles.subtitleContainer}
            >
              <View style={styles.subtitleLine} />
              <Text style={styles.subtitle}>NEXT-GEN MULTIPLAYER</Text>
              <View style={styles.subtitleLine} />
            </Animated.View>
          </Animated.View>

          {/* Glass Card */}
          <Animated.View
            entering={FadeInUp.duration(600).delay(400)}
            style={styles.card}
          >
            <View style={styles.cardGlow} />

            <Text style={styles.label}>GAME MODE</Text>
            <View style={styles.modesContainer}>
              {MODES.map((item, idx) => {
                const active = gameMode === item.mode;
                return (
                  <Animated.View
                    key={item.mode}
                    entering={FadeInDown.duration(400).delay(500 + idx * 100)}
                  >
                    <TouchableOpacity
                      onPress={() => setGameMode(item.mode)}
                      activeOpacity={0.7}
                    >
                      {active ? (
                        <View style={styles.modeBtnActiveWrap}>
                          <LinearGradient
                            colors={item.colors}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={[styles.modeBtn, styles.modeBtnActive]}
                          >
                            <View style={styles.modeIconWrap}>
                              <Text style={styles.modeIcon}>{item.icon}</Text>
                            </View>
                            <View style={styles.modeInfo}>
                              <Text style={styles.modeTitleActive}>
                                {item.title}
                              </Text>
                              <Text style={styles.modeDescActive}>
                                {item.desc}
                              </Text>
                            </View>
                            <View style={styles.checkCircle}>
                              <Text style={styles.checkmark}>✓</Text>
                            </View>
                          </LinearGradient>
                          <View
                            style={[
                              styles.modeGlow,
                              { backgroundColor: item.colors[0] },
                            ]}
                          />
                        </View>
                      ) : (
                        <View style={styles.modeBtn}>
                          <View style={styles.modeIconWrap}>
                            <Text style={styles.modeIcon}>{item.icon}</Text>
                          </View>
                          <View style={styles.modeInfo}>
                            <Text style={styles.modeTitle}>{item.title}</Text>
                            <Text style={styles.modeDesc}>{item.desc}</Text>
                          </View>
                        </View>
                      )}
                    </TouchableOpacity>
                  </Animated.View>
                );
              })}
            </View>

            {/* AI Difficulty */}
            {gameMode !== "multiplayer" && (
              <Animated.View entering={FadeInDown.duration(400)}>
                <View style={styles.diffSection}>
                  <Text style={styles.label}>DIFFICULTY</Text>
                  <View style={styles.diffRow}>
                    {DIFFICULTIES.map((d) => {
                      const active = aiDifficulty === d;
                      return (
                        <TouchableOpacity
                          key={d}
                          onPress={() => setAIDifficulty(d)}
                          style={[
                            styles.diffBtn,
                            active && styles.diffBtnActive,
                          ]}
                        >
                          <Text
                            style={[
                              styles.diffText,
                              active && styles.diffTextActive,
                            ]}
                          >
                            {d === "easy" ? "🟢" : d === "medium" ? "🟡" : "🔴"}{" "}
                            {d.charAt(0).toUpperCase() + d.slice(1)}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              </Animated.View>
            )}

            {/* Inputs */}
            <View style={styles.inputRow}>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>YOUR NAME</Text>
                <View style={styles.inputWrapper}>
                  <Text style={styles.inputIcon}>👤</Text>
                  <TextInput
                    value={playerName}
                    onChangeText={setPlayerName}
                    placeholder="Enter name"
                    placeholderTextColor={Colors.white20}
                    style={styles.input}
                    maxLength={20}
                    autoCapitalize="words"
                  />
                </View>
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>ROOM CODE</Text>
                <View style={styles.inputWrapper}>
                  <Text style={styles.inputIcon}>🏠</Text>
                  <TextInput
                    value={gameId}
                    onChangeText={(t) => setGameId(t.toUpperCase())}
                    placeholder="GAME1"
                    placeholderTextColor={Colors.white20}
                    style={[styles.input, styles.monoInput]}
                    maxLength={10}
                    autoCapitalize="characters"
                  />
                </View>
              </View>
            </View>

            {/* Team */}
            <Text style={styles.label}>SELECT TEAM</Text>
            <View style={styles.teamRow}>
              {(["team1", "team2"] as const).map((team) => {
                const active = selectedTeam === team;
                const colors =
                  team === "team1"
                    ? ([Colors.team1, "#4f46e5"] as [string, string])
                    : ([Colors.team2, "#e11d48"] as [string, string]);
                return (
                  <TouchableOpacity
                    key={team}
                    onPress={() => setSelectedTeam(team)}
                    style={styles.teamBtnWrap}
                    activeOpacity={0.7}
                  >
                    {active ? (
                      <View>
                        <LinearGradient
                          colors={colors}
                          style={[styles.teamBtn, styles.teamBtnActive]}
                        >
                          <Text style={styles.teamDotText}>
                            {team === "team1" ? "🔵" : "🔴"}
                          </Text>
                          <Text style={styles.teamBtnText}>
                            Team {team === "team1" ? "1" : "2"}
                          </Text>
                        </LinearGradient>
                        <View
                          style={[
                            styles.teamGlow,
                            { backgroundColor: colors[0] },
                          ]}
                        />
                      </View>
                    ) : (
                      <View style={styles.teamBtn}>
                        <Text style={styles.teamDotText}>
                          {team === "team1" ? "🔵" : "🔴"}
                        </Text>
                        <Text style={styles.teamBtnTextInactive}>
                          Team {team === "team1" ? "1" : "2"}
                        </Text>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Join Button */}
            <Animated.View entering={SlideInDown.duration(400).delay(600)}>
              <TouchableOpacity
                onPress={joinGame}
                disabled={isDisabled}
                activeOpacity={0.8}
              >
                <View style={styles.joinBtnWrap}>
                  <LinearGradient
                    colors={
                      isDisabled
                        ? ["#374151", "#1f2937"]
                        : [Colors.emerald, Colors.emeraldDark]
                    }
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={[
                      styles.joinBtn,
                      isDisabled && styles.joinBtnDisabled,
                    ]}
                  >
                    <Text
                      style={[
                        styles.joinBtnText,
                        isDisabled && { color: Colors.white40 },
                      ]}
                    >
                      {gameMode === "multiplayer"
                        ? "⚡ Join Lobby"
                        : "🚀 Start Game"}
                    </Text>
                  </LinearGradient>
                  {!isDisabled && <View style={styles.joinGlow} />}
                </View>
              </TouchableOpacity>
            </Animated.View>

            <Text style={styles.footer}>
              Ready to play? 2v2 Dominoes action awaits! 🎲
            </Text>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  scroll: {
    flexGrow: 1,
    justifyContent: "center",
    padding: 20,
  },
  header: {
    alignItems: "center",
    marginBottom: 24,
  },
  logoContainer: {
    position: "relative",
    marginBottom: 16,
  },
  logoShadow: {
    position: "absolute",
    bottom: -8,
    left: 8,
    right: 8,
    height: 16,
    backgroundColor: "rgba(16,185,129,0.2)",
    borderRadius: 20,
    transform: [{ scaleX: 0.9 }],
  },
  logoBox: {
    width: 80,
    height: 80,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    shadowColor: Colors.emerald,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 15,
    overflow: "hidden",
  },
  logoBevel: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: "40%",
    backgroundColor: "rgba(255,255,255,0.15)",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  logoEmoji: {
    fontSize: 44,
    zIndex: 1,
  },
  title: {
    fontSize: 46,
    fontWeight: "900",
    color: Colors.white,
    letterSpacing: 2,
    textShadowColor: "rgba(16,185,129,0.3)",
    textShadowOffset: { width: 0, height: 4 },
    textShadowRadius: 12,
  },
  subtitleContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
    gap: 10,
  },
  subtitleLine: {
    width: 30,
    height: 1,
    backgroundColor: Colors.white20,
  },
  subtitle: {
    fontSize: 11,
    fontWeight: "700",
    color: Colors.white40,
    letterSpacing: 4,
  },

  card: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 28,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    padding: 22,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 12,
  },
  cardGlow: {
    position: "absolute",
    top: -50,
    left: "20%",
    width: "60%",
    height: 100,
    backgroundColor: "rgba(16,185,129,0.06)",
    borderRadius: 100,
  },
  label: {
    fontSize: 10,
    fontWeight: "700",
    color: Colors.white40,
    letterSpacing: 2,
    marginBottom: 8,
    marginTop: 18,
  },

  modesContainer: { gap: 10 },
  modeBtnActiveWrap: { position: "relative" },
  modeBtn: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: Colors.white10,
    gap: 14,
  },
  modeBtnActive: {
    borderColor: "transparent",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  modeGlow: {
    position: "absolute",
    bottom: -4,
    left: 20,
    right: 20,
    height: 8,
    borderRadius: 8,
    opacity: 0.2,
  },
  modeIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "rgba(0,0,0,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  modeIcon: { fontSize: 24 },
  modeInfo: { flex: 1 },
  modeTitle: { color: Colors.white80, fontWeight: "700", fontSize: 15 },
  modeTitleActive: { color: Colors.white, fontWeight: "700", fontSize: 15 },
  modeDesc: { color: Colors.white40, fontSize: 12, marginTop: 2 },
  modeDescActive: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 12,
    marginTop: 2,
  },
  checkCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  checkmark: { color: Colors.white, fontSize: 16, fontWeight: "bold" },

  diffSection: { marginTop: 4 },
  diffRow: {
    flexDirection: "row",
    backgroundColor: "rgba(0,0,0,0.3)",
    borderRadius: 14,
    padding: 4,
    borderWidth: 1,
    borderColor: Colors.white05,
  },
  diffBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    borderRadius: 12,
  },
  diffBtnActive: {
    backgroundColor: Colors.white,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  diffText: {
    color: Colors.white40,
    fontWeight: "700",
    fontSize: 13,
  },
  diffTextActive: {
    color: "#0a192f",
    fontWeight: "700",
    fontSize: 13,
  },

  inputRow: {
    flexDirection: "row",
    gap: 12,
  },
  inputGroup: { flex: 1 },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.3)",
    borderWidth: 1,
    borderColor: Colors.white10,
    borderRadius: 14,
    paddingLeft: 12,
  },
  inputIcon: {
    fontSize: 16,
    marginRight: 4,
  },
  input: {
    flex: 1,
    paddingHorizontal: 8,
    paddingVertical: 14,
    color: Colors.white,
    fontSize: 15,
  },
  monoInput: {
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    letterSpacing: 2,
  },

  teamRow: {
    flexDirection: "row",
    gap: 12,
  },
  teamBtnWrap: { flex: 1 },
  teamBtn: {
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: Colors.white10,
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
  },
  teamBtnActive: {
    borderColor: "transparent",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 5,
  },
  teamDotText: { fontSize: 16 },
  teamGlow: {
    position: "absolute",
    bottom: -3,
    left: 20,
    right: 20,
    height: 6,
    borderRadius: 6,
    opacity: 0.2,
  },
  teamBtnText: {
    color: Colors.white,
    fontWeight: "700",
    fontSize: 15,
  },
  teamBtnTextInactive: {
    color: Colors.white40,
    fontWeight: "700",
    fontSize: 15,
  },

  joinBtnWrap: {
    position: "relative",
    marginTop: 22,
  },
  joinBtn: {
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: "center",
    shadowColor: Colors.emerald,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  joinBtnDisabled: {
    opacity: 0.6,
    shadowOpacity: 0,
    elevation: 0,
  },
  joinGlow: {
    position: "absolute",
    bottom: -4,
    left: 30,
    right: 30,
    height: 8,
    backgroundColor: Colors.emerald,
    borderRadius: 8,
    opacity: 0.2,
  },
  joinBtnText: {
    color: Colors.white,
    fontWeight: "800",
    fontSize: 18,
    letterSpacing: 0.5,
  },
  footer: {
    color: Colors.white20,
    fontSize: 12,
    textAlign: "center",
    marginTop: 16,
  },
});
