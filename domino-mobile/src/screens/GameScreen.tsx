/**
 * GameScreen — 3D POV domino table.
 *
 * Layout (portrait):
 *   ┌──────────────────────────┐
 *   │ HUD: score · opponents   │  ~40px
 *   │ Turn indicator           │  ~24px
 *   ├──────────────────────────┤
 *   │                          │
 *   │   ┌──────────────────┐   │
 *   │   │   3D BOARD (tilt)│   │  ~70% of screen
 *   │   │   felt + tiles   │   │
 *   │   └──────────────────┘   │
 *   │                          │
 *   ├──────────────────────────┤
 *   │  🃏 Hand tiles (draggable)│  ~20% of screen
 *   └──────────────────────────┘
 *
 * The board is perspective-tilted so it looks like you're standing
 * at the edge of a domino table and looking down.
 */
import { LinearGradient } from "expo-linear-gradient";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import Animated, {
  FadeInDown,
  FadeInUp,
  ZoomIn,
} from "react-native-reanimated";
import Board3D, { type RenderQuality } from "../components/Board3D";
import DominoTile3D from "../components/DominoTile3D";
import DraggableHandTile from "../components/DraggableHandTile";
import OpponentCard from "../components/OpponentCard";
import { useGame } from "../context/GameContext";
import { Colors } from "../theme/colors";
import { Domino } from "../types/gameTypes";

let ScreenOrientation: typeof import("expo-screen-orientation") | null = null;
try {
  ScreenOrientation = require("expo-screen-orientation");
} catch {
  ScreenOrientation = null;
}

const STATUS_BAR_H =
  Platform.OS === "android" ? (StatusBar.currentHeight ?? 24) : 44;

// ================================================================
// ---- MAIN GAME SCREEN ----
// ================================================================
export default function GameScreen() {
  const {
    gameState,
    socket,
    currentPlayer,
    isMyTurn,
    canPass,
    getPlayableSides,
    playDomino,
    pass,
    startGame,
    leaveMatch,
    copyRoomCode,
    error,
    toast,
  } = useGame();

  const { width: W, height: H } = useWindowDimensions();
  const isLandscape = W > H;
  const hudTop = isLandscape ? 4 : STATUS_BAR_H;
  const handPad = isLandscape ? 8 : H < 700 ? 14 : 22;

  // ── Fullscreen & quality state (like web version) ──
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [renderQuality, setRenderQuality] = useState<RenderQuality>("medium");

  // Force-remount GLView on orientation change to fix canvas sizing
  const [glKey, setGlKey] = useState(0);
  useEffect(() => {
    setGlKey((k) => k + 1);
  }, [isLandscape]);

  // Hide status bar in fullscreen
  useEffect(() => {
    if (isFullscreen) {
      StatusBar.setHidden(true, "slide");
    } else {
      StatusBar.setHidden(false, "slide");
    }
  }, [isFullscreen]);

  const toggleFullscreen = useCallback(async () => {
    const next = !isFullscreen;
    setIsFullscreen(next);
    if (ScreenOrientation) {
      if (next) {
        await ScreenOrientation.lockAsync(
          ScreenOrientation.OrientationLock.LANDSCAPE_RIGHT,
        );
      } else {
        await ScreenOrientation.unlockAsync();
      }
    }
  }, [isFullscreen]);

  const cycleQuality = useCallback(() => {
    setRenderQuality((prev) => {
      if (prev === "low") return "medium";
      if (prev === "medium") return "high";
      return "low";
    });
  }, []);

  const [dragOverSide, setDragOverSide] = useState<"left" | "right" | null>(
    null,
  );

  const handleDragStateChange = useCallback(
    (dragging: boolean, side: "left" | "right" | null) => {
      setDragOverSide(dragging ? side : null);
    },
    [],
  );

  const handlePlay = useCallback(
    (dominoId: string, side: "left" | "right") => {
      playDomino(dominoId, side);
    },
    [playDomino],
  );

  if (!gameState) return null;

  const myIndex = gameState.players.findIndex((p) => p.id === socket?.id) ?? -1;
  const partner =
    myIndex >= 0
      ? gameState.players[(myIndex + 2) % gameState.players.length]
      : undefined;
  const leftOpp =
    myIndex >= 0
      ? gameState.players[(myIndex + 1) % gameState.players.length]
      : undefined;
  const rightOpp =
    myIndex >= 0
      ? gameState.players[(myIndex + 3) % gameState.players.length]
      : undefined;

  const isBlockedEnd =
    gameState.gamePhase === "finished" && gameState.passCount >= 4;
  const handSum = (hand: Domino[]) =>
    hand.reduce((sum, d) => sum + d.left + d.right, 0);

  // ================================================================
  // ---- FINISHED STATE ----
  // ================================================================
  if (gameState.gamePhase === "finished") {
    return (
      <LinearGradient
        colors={["#060f1d", "#0a192f", "#0f2e2e", "#1a1a2e"]}
        style={styles.container}
      >
        <ScrollView
          contentContainerStyle={[
            styles.finishedScroll,
            { paddingTop: hudTop + 20 },
          ]}
        >
          <Animated.Text
            entering={ZoomIn.duration(500)}
            style={styles.finishedEmoji}
          >
            🎉
          </Animated.Text>
          <Animated.Text
            entering={FadeInDown.duration(400).delay(200)}
            style={styles.finishedTitle}
          >
            {isBlockedEnd ? "Game Blocked" : "Game Over!"}
          </Animated.Text>
          <Animated.Text
            entering={FadeInDown.duration(400).delay(300)}
            style={styles.finishedAction}
          >
            {gameState.lastAction}
          </Animated.Text>

          {/* Score cards */}
          <Animated.View
            entering={FadeInDown.duration(500).delay(400)}
            style={styles.scoreRow}
          >
            <LinearGradient
              colors={[Colors.team1 + "20", Colors.team1 + "08"]}
              style={[styles.scoreCard, { borderColor: Colors.team1 + "40" }]}
            >
              <Text style={styles.scoreEmoji}>🔵</Text>
              <Text style={[styles.scoreVal, { color: Colors.team1Light }]}>
                {gameState.scores.team1}
              </Text>
            </LinearGradient>
            <LinearGradient
              colors={[Colors.team2 + "20", Colors.team2 + "08"]}
              style={[styles.scoreCard, { borderColor: Colors.team2 + "40" }]}
            >
              <Text style={styles.scoreEmoji}>🔴</Text>
              <Text style={[styles.scoreVal, { color: Colors.team2Light }]}>
                {gameState.scores.team2}
              </Text>
            </LinearGradient>
          </Animated.View>

          {/* Remaining tiles */}
          <View style={styles.handsReveal}>
            {gameState.players.map((p, idx) => (
              <Animated.View
                key={idx}
                entering={FadeInDown.duration(300).delay(600 + idx * 100)}
              >
                <View style={styles.handRevealCard}>
                  <View style={styles.handRevealHeader}>
                    <View
                      style={[
                        styles.revealDot,
                        {
                          backgroundColor:
                            p.team === "team1" ? Colors.team1 : Colors.team2,
                        },
                      ]}
                    />
                    <Text style={styles.handRevealName}>{p.name}</Text>
                    <Text style={styles.handRevealScore}>
                      {handSum(p.hand)} pts
                    </Text>
                  </View>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <View style={styles.handRevealTiles}>
                      {p.hand.length === 0 ? (
                        <Text style={styles.noTilesText}>No tiles ✨</Text>
                      ) : (
                        p.hand.map((d, i) => (
                          <DominoTile3D
                            key={d.id}
                            domino={d}
                            size="small"
                            delay={i * 40}
                          />
                        ))
                      )}
                    </View>
                  </ScrollView>
                </View>
              </Animated.View>
            ))}
          </View>

          {/* Actions */}
          <Animated.View
            entering={FadeInUp.duration(400).delay(1000)}
            style={styles.finishedActions}
          >
            <TouchableOpacity
              onPress={startGame}
              activeOpacity={0.8}
              style={{ flex: 1 }}
            >
              <LinearGradient
                colors={[Colors.emerald, Colors.emeraldDark]}
                style={styles.playAgainBtn}
              >
                <Text style={styles.playAgainText}>🔄 Play Again</Text>
              </LinearGradient>
            </TouchableOpacity>
            <TouchableOpacity onPress={leaveMatch} style={styles.leaveBtn}>
              <Text style={styles.leaveBtnText}>Leave</Text>
            </TouchableOpacity>
          </Animated.View>
        </ScrollView>
      </LinearGradient>
    );
  }

  // ================================================================
  // ---- PLAYING PHASE — 3D POV TABLE ----
  // ================================================================
  const currentTurn = gameState.players[gameState.currentPlayerIndex];

  // Memoize opponents object so Board3D doesn't re-render on rotation
  const boardOpponents = useMemo(
    () => ({
      top: partner
        ? { name: partner.name, tileCount: partner.hand.length }
        : undefined,
      left: leftOpp
        ? { name: leftOpp.name, tileCount: leftOpp.hand.length }
        : undefined,
      right: rightOpp
        ? { name: rightOpp.name, tileCount: rightOpp.hand.length }
        : undefined,
    }),
    [
      partner?.name,
      partner?.hand.length,
      leftOpp?.name,
      leftOpp?.hand.length,
      rightOpp?.name,
      rightOpp?.hand.length,
    ],
  );

  // Determine which board slot is currently active (turn indicator)
  const activeSlot = useMemo(() => {
    if (myIndex < 0 || !gameState) return null;
    const ci = gameState.currentPlayerIndex;
    if (ci === myIndex) return "self" as const;
    const total = gameState.players.length;
    if (ci === (myIndex + 2) % total) return "top" as const;
    if (ci === (myIndex + 1) % total) return "left" as const;
    if (ci === (myIndex + 3) % total) return "right" as const;
    return null;
  }, [myIndex, gameState?.currentPlayerIndex, gameState?.players.length]);

  // ── Hand tiles ──
  const handContent = (
    <View style={[styles.handSection, isLandscape && styles.handSectionLand]}>
      {/* Glass-frosted background */}
      <LinearGradient
        colors={["rgba(6,15,29,0.85)", "rgba(10,25,47,0.95)"]}
        style={styles.handGradientBg}
        pointerEvents="none"
      />
      <View style={[styles.handContent, { paddingBottom: handPad }]}>
        {/* Hand header with tile count + pass button */}
        <View style={styles.handHeader}>
          <View style={styles.handLabelRow}>
            <Text style={styles.handLabel}>
              🃏 {currentPlayer?.hand.length || 0}
            </Text>
            <Text style={styles.handSubLabel}> tiles</Text>
          </View>
          {canPass && isMyTurn && (
            <TouchableOpacity onPress={pass} activeOpacity={0.7}>
              <LinearGradient
                colors={["rgba(245,158,11,0.15)", "rgba(245,158,11,0.05)"]}
                style={styles.passBtn}
              >
                <Text style={styles.passBtnText}>Pass ⏭</Text>
              </LinearGradient>
            </TouchableOpacity>
          )}
        </View>

        {/* Draggable tiles */}
        <View
          style={[styles.handTiles, isLandscape && styles.handTilesLandscape]}
        >
          {currentPlayer?.hand.map((domino, index) => {
            const sides = getPlayableSides(domino);
            const playable = isMyTurn && sides.length > 0;

            return (
              <DraggableHandTile
                key={domino.id}
                domino={domino}
                playable={playable}
                isMyTurn={isMyTurn}
                index={index}
                tileSize={isLandscape ? "tiny" : "hand"}
                compact={isLandscape}
                playableSides={sides}
                onPlay={handlePlay}
                onDragStateChange={handleDragStateChange}
              />
            );
          })}
        </View>
      </View>
    </View>
  );

  // ================================================================
  // ---- FULLSCREEN MODE ----
  // ================================================================
  if (isFullscreen) {
    return (
      <View style={styles.fullscreenContainer}>
        <View style={styles.fullscreenBoard} key={`fs-board-${glKey}`}>
          <Board3D
            board={gameState.board}
            boardLeftEnd={gameState.boardLeftEnd}
            boardRightEnd={gameState.boardRightEnd}
            dragOverSide={dragOverSide}
            opponents={boardOpponents}
            activeSlot={activeSlot}
            quality={renderQuality}
          />
        </View>

        {/* Fullscreen HUD overlay */}
        <View style={styles.fsHudTop}>
          {/* Score pill */}
          <View style={styles.scorePill}>
            <View style={styles.scoreTeamDot1} />
            <Text style={styles.scorePillVal}>{gameState.scores.team1}</Text>
            <View style={styles.scoreDivider} />
            <View style={styles.scoreTeamDot2} />
            <Text style={styles.scorePillVal}>{gameState.scores.team2}</Text>
          </View>
          {/* Turn text */}
          <View style={styles.fsTurnPill}>
            <View
              style={[
                styles.turnDot,
                {
                  backgroundColor:
                    currentTurn?.team === "team1" ? Colors.team1 : Colors.team2,
                },
              ]}
            />
            <Text
              style={[
                styles.turnText,
                isMyTurn && { color: Colors.amber, fontWeight: "800" },
              ]}
              numberOfLines={1}
            >
              {isMyTurn ? "⚡ Your Turn" : `${currentTurn?.name}'s turn`}
            </Text>
          </View>
          {/* Exit fullscreen */}
          <TouchableOpacity onPress={toggleFullscreen} style={styles.fsExitBtn}>
            <Text style={styles.fsExitBtnText}>✕</Text>
          </TouchableOpacity>
        </View>

        {/* Hand in fullscreen — compact bottom strip */}
        <View style={styles.fsHandStrip}>
          <LinearGradient
            colors={["rgba(6,15,29,0.9)", "rgba(10,25,47,0.95)"]}
            style={styles.fsHandBg}
            pointerEvents="none"
          />
          <View style={styles.fsHandContent}>
            <View style={styles.handLabelRow}>
              <Text style={styles.handLabel}>
                🃏 {currentPlayer?.hand.length || 0}
              </Text>
              {canPass && isMyTurn && (
                <TouchableOpacity onPress={pass} activeOpacity={0.7}>
                  <LinearGradient
                    colors={["rgba(245,158,11,0.15)", "rgba(245,158,11,0.05)"]}
                    style={styles.passBtn}
                  >
                    <Text style={styles.passBtnText}>Pass ⏭</Text>
                  </LinearGradient>
                </TouchableOpacity>
              )}
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.fsHandTiles}
            >
              {currentPlayer?.hand.map((domino, index) => {
                const sides = getPlayableSides(domino);
                const playable = isMyTurn && sides.length > 0;
                return (
                  <DraggableHandTile
                    key={domino.id}
                    domino={domino}
                    playable={playable}
                    isMyTurn={isMyTurn}
                    index={index}
                    tileSize="tiny"
                    compact
                    playableSides={sides}
                    onPlay={handlePlay}
                    onDragStateChange={handleDragStateChange}
                  />
                );
              })}
            </ScrollView>
          </View>
        </View>

        {/* Floating toolbar in fullscreen */}
        <View style={[styles.floatingToolbar, { bottom: 80 }]}>
          <TouchableOpacity
            style={styles.toolbarBtn}
            activeOpacity={0.7}
            onPress={cycleQuality}
          >
            <Text style={styles.toolbarBtnText}>
              {renderQuality === "low"
                ? "🔋"
                : renderQuality === "medium"
                  ? "⚡"
                  : "✨"}
            </Text>
            <Text style={styles.toolbarBtnLabel}>
              {renderQuality.charAt(0).toUpperCase() + renderQuality.slice(1)}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.toolbarBtn}
            activeOpacity={0.7}
            onPress={toggleFullscreen}
          >
            <Text style={styles.toolbarBtnText}>⛶</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <LinearGradient
      colors={["#060f1d", "#0a192f", "#0d1f2d"]}
      style={styles.container}
    >
      {/* ── Compact HUD: score + opponents + exit ── */}
      <View style={[styles.topBar, { paddingTop: hudTop }]}>
        {/* Score pill */}
        <View style={styles.scorePill}>
          <View style={styles.scoreTeamDot1} />
          <Text style={styles.scorePillVal}>{gameState.scores.team1}</Text>
          <View style={styles.scoreDivider} />
          <View style={styles.scoreTeamDot2} />
          <Text style={styles.scorePillVal}>{gameState.scores.team2}</Text>
        </View>

        {/* Opponents */}
        <View style={styles.oppRow}>
          <OpponentCard
            player={leftOpp}
            isActive={gameState.currentPlayerIndex === (myIndex + 1) % 4}
          />
          <OpponentCard
            player={partner}
            isActive={gameState.currentPlayerIndex === (myIndex + 2) % 4}
          />
          <OpponentCard
            player={rightOpp}
            isActive={gameState.currentPlayerIndex === (myIndex + 3) % 4}
          />
        </View>

        {/* Exit */}
        <TouchableOpacity onPress={leaveMatch} style={styles.exitBtn}>
          <Text style={styles.exitBtnText}>✕</Text>
        </TouchableOpacity>
      </View>

      {/* Turn indicator */}
      <View style={styles.turnStrip}>
        <View
          style={[
            styles.turnDot,
            {
              backgroundColor:
                currentTurn?.team === "team1" ? Colors.team1 : Colors.team2,
            },
          ]}
        />
        <Text
          style={[
            styles.turnText,
            isMyTurn && { color: Colors.amber, fontWeight: "800" },
          ]}
          numberOfLines={1}
        >
          {isMyTurn ? "⚡ Your Turn" : `${currentTurn?.name}'s turn`}
        </Text>
      </View>

      {/* Error / Toast */}
      {error && (
        <View style={styles.errorBanner}>
          <Text style={styles.bannerText}>⚠️ {error}</Text>
        </View>
      )}
      {toast && (
        <View style={styles.toastBanner}>
          <Text style={styles.bannerText}>{toast}</Text>
        </View>
      )}

      {/* ── Main content: 3D board + hand tray ── */}
      <>
        <View style={styles.boardFlex} key={`board-${glKey}`}>
          <Board3D
            board={gameState.board}
            boardLeftEnd={gameState.boardLeftEnd}
            boardRightEnd={gameState.boardRightEnd}
            dragOverSide={dragOverSide}
            opponents={boardOpponents}
            activeSlot={activeSlot}
            quality={renderQuality}
          />
        </View>
        {handContent}
      </>

      {/* ── Floating toolbar: fullscreen + quality + rotate ── */}
      <View style={styles.floatingToolbar}>
        {/* Quality button */}
        <TouchableOpacity
          style={styles.toolbarBtn}
          activeOpacity={0.7}
          onPress={cycleQuality}
        >
          <Text style={styles.toolbarBtnText}>
            {renderQuality === "low"
              ? "🔋"
              : renderQuality === "medium"
                ? "⚡"
                : "✨"}
          </Text>
          <Text style={styles.toolbarBtnLabel}>
            {renderQuality.charAt(0).toUpperCase() + renderQuality.slice(1)}
          </Text>
        </TouchableOpacity>

        {/* Fullscreen button */}
        <TouchableOpacity
          style={styles.toolbarBtn}
          activeOpacity={0.7}
          onPress={toggleFullscreen}
        >
          <Text style={styles.toolbarBtnText}>⛶</Text>
        </TouchableOpacity>

        {/* Rotate screen button */}
        <TouchableOpacity
          style={styles.toolbarBtn}
          activeOpacity={0.7}
          onPress={async () => {
            if (!ScreenOrientation) return;
            if (isLandscape) {
              await ScreenOrientation.lockAsync(
                ScreenOrientation.OrientationLock.PORTRAIT_UP,
              );
            } else {
              await ScreenOrientation.lockAsync(
                ScreenOrientation.OrientationLock.LANDSCAPE_RIGHT,
              );
            }
          }}
        >
          <Text style={styles.toolbarBtnText}>{isLandscape ? "📱" : "📲"}</Text>
        </TouchableOpacity>
      </View>
    </LinearGradient>
  );
}

// ================================================================
// ---- STYLES ----
// ================================================================
const styles = StyleSheet.create({
  container: { flex: 1 },

  // ── Floating toolbar ──
  floatingToolbar: {
    position: "absolute",
    right: 8,
    bottom: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(0,0,0,0.55)",
    borderRadius: 16,
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
    zIndex: 999,
  },
  toolbarBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 12,
    gap: 3,
  },
  toolbarBtnText: {
    fontSize: 16,
  },
  toolbarBtnLabel: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 9,
    fontWeight: "700",
  },

  // ── Top bar ──
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingBottom: 4,
    gap: 6,
    backgroundColor: "rgba(0,0,0,0.4)",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.white10,
  },
  scorePill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.3)",
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 5,
    gap: 4,
  },
  scoreTeamDot1: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.team1,
  },
  scoreTeamDot2: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.team2,
  },
  scorePillVal: {
    color: Colors.white,
    fontWeight: "900",
    fontSize: 13,
  },
  scoreDivider: {
    width: 1,
    height: 14,
    backgroundColor: Colors.white10,
    marginHorizontal: 2,
  },
  oppRow: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "center",
    gap: 4,
  },
  exitBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: "rgba(239,68,68,0.12)",
    borderWidth: 1,
    borderColor: "rgba(239,68,68,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  exitBtnText: { color: "#fca5a5", fontWeight: "700", fontSize: 13 },

  // ── Turn strip ──
  turnStrip: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 3,
    gap: 5,
  },
  turnDot: { width: 7, height: 7, borderRadius: 4 },
  turnText: { color: Colors.white60, fontWeight: "700", fontSize: 12 },

  // ── Banners ──
  errorBanner: {
    backgroundColor: "rgba(239,68,68,0.85)",
    paddingVertical: 4,
    paddingHorizontal: 12,
    alignItems: "center",
  },
  toastBanner: {
    backgroundColor: "rgba(16,185,129,0.85)",
    paddingVertical: 4,
    paddingHorizontal: 12,
    alignItems: "center",
  },
  bannerText: { color: Colors.white, fontWeight: "600", fontSize: 12 },

  // ── Board ──
  boardFlex: {
    flex: 1,
  },

  // ── Landscape ──
  // ── Hand section ──
  handSection: {
    overflow: "visible",
    position: "relative",
  },
  handSectionLand: {
    maxHeight: 88,
  },
  handGradientBg: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.08)",
    borderBottomWidth: 0,
  },
  handContent: {
    paddingTop: 8,
    paddingHorizontal: 8,
    minHeight: 78,
    overflow: "visible",
  },
  handHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 4,
    marginBottom: 6,
  },
  handLabelRow: {
    flexDirection: "row",
    alignItems: "baseline",
  },
  handLabel: {
    color: Colors.white60,
    fontWeight: "800",
    fontSize: 13,
  },
  handSubLabel: {
    color: Colors.white20,
    fontWeight: "600",
    fontSize: 10,
  },
  passBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(245,158,11,0.25)",
  },
  passBtnText: { color: Colors.amber, fontWeight: "700", fontSize: 11 },
  handTiles: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: 2,
    paddingVertical: 2,
    paddingBottom: 4,
    overflow: "visible",
  },
  handTilesLandscape: {
    alignItems: "center",
    gap: 4,
    paddingVertical: 0,
    paddingBottom: 0,
  },

  // ── Finished ──
  finishedScroll: {
    flexGrow: 1,
    padding: 20,
    alignItems: "center",
  },
  finishedEmoji: { fontSize: 56, marginBottom: 6 },
  finishedTitle: {
    fontSize: 26,
    fontWeight: "900",
    color: Colors.white,
    marginBottom: 4,
  },
  finishedAction: {
    color: Colors.white60,
    fontSize: 13,
    textAlign: "center",
    marginBottom: 20,
  },
  scoreRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 20,
    width: "100%",
  },
  scoreCard: {
    flex: 1,
    alignItems: "center",
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 14,
  },
  scoreEmoji: { fontSize: 28 },
  scoreVal: { fontWeight: "900", fontSize: 28, marginTop: 4 },

  handsReveal: { width: "100%", gap: 6, marginBottom: 20 },
  handRevealCard: {
    backgroundColor: "rgba(0,0,0,0.3)",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.white10,
    padding: 10,
  },
  handRevealHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 6,
  },
  revealDot: { width: 7, height: 7, borderRadius: 4 },
  handRevealName: {
    color: Colors.white,
    fontWeight: "700",
    fontSize: 13,
    flex: 1,
  },
  handRevealScore: { color: Colors.white40, fontSize: 10 },
  handRevealTiles: { flexDirection: "row", gap: 3 },
  noTilesText: { color: Colors.white40, fontSize: 11, fontStyle: "italic" },

  finishedActions: { flexDirection: "row", gap: 10, width: "100%" },
  playAgainBtn: {
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
  },
  playAgainText: { color: Colors.white, fontWeight: "800", fontSize: 15 },
  leaveBtn: {
    flex: 1,
    backgroundColor: "rgba(55,65,81,0.6)",
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: Colors.white10,
  },
  leaveBtnText: { color: Colors.white, fontWeight: "700", fontSize: 15 },
  // ── Fullscreen styles ──
  fullscreenContainer: {
    flex: 1,
    backgroundColor: "#060f1d",
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: "100%",
    height: "100%",
    zIndex: 9999,
  },
  fullscreenBoard: {
    flex: 1,
    borderRadius: 0,
    overflow: "hidden",
    backgroundColor: "#071a12",
  },
  fsHudTop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 18,
    paddingHorizontal: 12,
    zIndex: 10,
  },
  fsTurnPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.32)",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 5,
    gap: 5,
  },
  fsExitBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(239,68,68,0.12)",
    borderWidth: 1,
    borderColor: "rgba(239,68,68,0.2)",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 8,
  },
  fsExitBtnText: { color: "#fca5a5", fontWeight: "700", fontSize: 18 },
  fsHandStrip: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingBottom: 0,
    zIndex: 10,
  },
  fsHandBg: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.08)",
    borderBottomWidth: 0,
  },
  fsHandContent: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 8,
    minHeight: 60,
    gap: 8,
  },
  fsHandTiles: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 2,
    paddingVertical: 2,
    paddingBottom: 4,
  },
});
