import React from "react";
import { StatusBar } from "expo-status-bar";
import { View, StyleSheet } from "react-native";
import { GameProvider, useGame } from "../src/context/GameContext";
import LoginScreen from "../src/screens/LoginScreen";
import LobbyScreen from "../src/screens/LobbyScreen";
import GameScreen from "../src/screens/GameScreen";

function AppContent() {
  const { joined, gameState } = useGame();

  // Not joined yet → Login
  if (!joined) {
    return <LoginScreen />;
  }

  // Joined but game hasn't started → Lobby
  if (!gameState || gameState.gamePhase === "waiting") {
    return <LobbyScreen />;
  }

  // Playing or finished → Game
  return <GameScreen />;
}

export default function Index() {
  return (
    <View style={styles.root}>
      <StatusBar style="light" translucent />
      <GameProvider>
        <AppContent />
      </GameProvider>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#0a192f",
  },
});
