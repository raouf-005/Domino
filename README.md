# Domino

A multiplayer domino game with a 3D board — web client, mobile client and game server in one repository.

**[Live demo](https://domino-snowy-rho.vercel.app)**

---

## Repository layout

| | |
|---|---|
| `domino/` | Web client — Next.js, TypeScript, React Three Fiber |
| `domino-server/` | Game server — TypeScript, authoritative game state |
| `domino-mobile/` | Mobile client — React Native / Expo, with a native Android project |

The game rules and state live in a shared `gameTypes.ts`, mirrored between the server and the client, so both sides agree on what a legal move is rather than each re-implementing it.

## The 3D board

The table is rendered in React Three Fiber rather than as flat sprites:

```
components/domino3d/
  GameScene · GameBoard3D · Table · Lighting     scene and staging
  DominoPiece · DominoHalf · Dot3D               a tile, built from parts
  PlayerHand · DragTile · HandSlam3D             holding and playing a tile
  useSnakeLayout                                 lays the chain out as it grows
  Overlays                                       turn state and game UI
```

`useSnakeLayout` is the interesting part — a domino chain has to fold back on itself as it runs out of table, so tile placement is computed rather than fixed, and doubles sit perpendicular to the line.

## Stack

Next.js · TypeScript · React Three Fiber / Three.js · React Native (Expo) · Node

## Running locally

```bash
# server
cd domino-server && npm install
cp .env.example .env
npm run dev

# web client
cd domino && npm install && npm run dev

# mobile client
cd domino-mobile && npm install && npx expo start
```