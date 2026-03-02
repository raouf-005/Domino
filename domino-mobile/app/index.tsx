import React, { useState } from "react";
import { StatusBar } from "expo-status-bar";
import { View, StyleSheet } from "react-native";
import { GameProvider, useGame } from "../src/context/GameContext";
import LoginScreen from "../src/screens/LoginScreen";
import LobbyScreen from "../src/screens/LobbyScreen";
import GameScreen from "../src/screens/GameScreen";
import SettingsScreen from "../src/screens/SettingsScreen";

function AppContent() {
  const { joined, gameState } = useGame();
  const [showSettings, setShowSettings] = useState(false);

  if (showSettings) {
    return <SettingsScreen onClose={() => setShowSettings(false)} />;
  }

  // Not joined yet → Login
  if (!joined) {
    return <LoginScreen onOpenSettings={() => setShowSettings(true)} />;
  }

  // Joined but game hasn't started → Lobby
  if (!gameState || gameState.gamePhase === "waiting") {
    return <LobbyScreen onOpenSettings={() => setShowSettings(true)} />;
  }

  // Playing or finished → Game
  return <GameScreen onOpenSettings={() => setShowSettings(true)} />;
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
