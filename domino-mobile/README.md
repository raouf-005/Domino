# Domino Mobile

Cross-platform mobile app (iOS & Android) for the Domino game.

## Prerequisites

- Node.js 18+
- Expo CLI (`npm install -g expo-cli`)
- Expo Go app on your phone (for testing)

## Setup

```bash
cd domino-mobile
npm install
```

## Running

```bash
# Start Expo dev server
npx expo start

# iOS simulator
npx expo start --ios

# Android emulator
npx expo start --android
```

## Connecting to the Backend

1. Start the web server first: `cd ../domino && npx tsx server.ts`
2. Find your local IP (e.g., `192.168.1.100`)
3. Update `src/services/socket.ts` → change `SERVER_URL` to `http://YOUR_IP:3000`
4. Both the mobile app and web app connect to the same server — you can play cross-platform!

## Project Structure

```
domino-mobile/
  app/              # Expo Router screens
    _layout.tsx     # Root layout
    index.tsx       # Entry point (routes to Login/Lobby/Game)
  src/
    components/     # Reusable UI components
      DominoTile.tsx
      PlayerCard.tsx
    context/        # React Context for global state
      GameContext.tsx
    screens/        # Screen components
      LoginScreen.tsx
      LobbyScreen.tsx
      GameScreen.tsx
    services/       # Backend connection
      socket.ts
    theme/          # Design tokens
      colors.ts
    types/          # Shared TypeScript types
      gameTypes.ts
```

## Features

- Same Socket.io backend as the web version
- Same game logic — multiplayer, vs-AI, co-op modes
- Auto-fill with AI in lobby
- SVG domino tiles
- Team selection, scoring, chat
- Portrait-optimized mobile layout
- Works on iOS + Android via Expo
