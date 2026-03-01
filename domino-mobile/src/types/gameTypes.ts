// Domino Game Types — shared with web version

export interface Domino {
  id: string;
  left: number;
  right: number;
}

export type Team = "team1" | "team2";
export type GameMode = "multiplayer" | "vs-ai" | "with-ai-partner";
export type AIDifficulty = "easy" | "medium" | "hard";

export interface DeviceMetadata {
  machineFingerprint?: string;
  macAddress?: string;
  localIp?: string;
  platform?: string;
  os?: string;
  model?: string;
  userAgent?: string;
  language?: string;
  timezone?: string;
  screen?: string;
  networkStatus?: "online" | "offline";
}

export interface Player {
  id: string;
  name: string;
  team: Team;
  hand: Domino[];
  isReady: boolean;
  isConnected: boolean;
  isAI: boolean;
  aiDifficulty?: AIDifficulty;
}

export interface GameState {
  id: string;
  players: Player[];
  board: Domino[];
  boardLeftEnd: number;
  boardRightEnd: number;
  currentPlayerIndex: number;
  gamePhase: "waiting" | "playing" | "finished";
  winner: Team | "draw" | null;
  lastAction: string;
  passCount: number;
  scores: {
    team1: number;
    team2: number;
  };
  gameMode: GameMode;
  aiDifficulty: AIDifficulty;
}

export interface ServerToClientEvents {
  gameState: (state: GameState) => void;
  playerJoined: (player: Player) => void;
  playerLeft: (playerId: string) => void;
  gameStarted: (state: GameState) => void;
  dominoPlayed: (data: {
    playerId: string;
    domino: Domino;
    side: "left" | "right";
  }) => void;
  playerPassed: (playerId: string) => void;
  gameOver: (
    winner: Team | "draw",
    scores: { team1: number; team2: number },
  ) => void;
  error: (message: string) => void;
  chatMessage: (data: { playerName: string; message: string }) => void;
  reconnected: (data: { gameId: string; playerName: string }) => void;
}

export interface ClientToServerEvents {
  joinGame: (data: {
    gameId: string;
    playerName: string;
    team: Team;
    deviceId: string;
    deviceMeta?: DeviceMetadata;
  }) => void;
  createAIGame: (data: {
    gameId: string;
    playerName: string;
    team: Team;
    gameMode: GameMode;
    aiDifficulty: AIDifficulty;
    deviceId: string;
    deviceMeta?: DeviceMetadata;
  }) => void;
  reconnectGame: (data: {
    deviceId: string;
    deviceMeta?: DeviceMetadata;
  }) => void;
  startGame: (gameId: string) => void;
  playDomino: (data: {
    gameId: string;
    dominoId: string;
    side: "left" | "right";
  }) => void;
  pass: (gameId: string) => void;
  sendChat: (data: { gameId: string; message: string }) => void;
  addAIPlayer: (data: {
    gameId: string;
    team?: Team;
    difficulty: AIDifficulty;
  }) => void;
  autoFillAI: (data: { gameId: string; difficulty?: AIDifficulty }) => void;
}

// Check if a domino can be played
export function canPlayDomino(
  domino: Domino,
  leftEnd: number,
  rightEnd: number,
  boardEmpty: boolean,
): { canPlay: boolean; sides: ("left" | "right")[] } {
  if (boardEmpty) {
    return { canPlay: true, sides: ["left", "right"] };
  }
  const sides: ("left" | "right")[] = [];
  if (domino.left === leftEnd || domino.right === leftEnd) {
    sides.push("left");
  }
  if (domino.left === rightEnd || domino.right === rightEnd) {
    sides.push("right");
  }
  return { canPlay: sides.length > 0, sides };
}

export function calculateHandScore(hand: Domino[]): number {
  return hand.reduce((sum, d) => sum + d.left + d.right, 0);
}
