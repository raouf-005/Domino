import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useRef,
  useCallback,
} from "react";
import {
  GameState,
  Team,
  GameMode,
  AIDifficulty,
  Domino,
  canPlayDomino,
} from "../types/gameTypes";
import {
  getSocket,
  disconnectSocket,
  getDeviceId,
  getDeviceMetadata,
  GameSocket,
} from "../services/socket";
import type { DeviceMetadata } from "../types/gameTypes";

interface GameContextType {
  socket: GameSocket | null;
  gameState: GameState | null;
  playerName: string;
  setPlayerName: (n: string) => void;
  gameId: string;
  setGameId: (id: string) => void;
  selectedTeam: Team;
  setSelectedTeam: (t: Team) => void;
  gameMode: GameMode;
  setGameMode: (m: GameMode) => void;
  aiDifficulty: AIDifficulty;
  setAIDifficulty: (d: AIDifficulty) => void;
  joined: boolean;
  error: string | null;
  toast: string | null;

  // Actions
  joinGame: () => void;
  startGame: () => void;
  playDomino: (dominoId: string, side: "left" | "right") => void;
  pass: () => void;
  autoFillAI: () => void;
  leaveMatch: () => void;
  copyRoomCode: () => Promise<void>;
  sendChat: (message: string) => void;

  // Computed
  currentPlayer: GameState["players"][0] | undefined;
  isMyTurn: boolean;
  canPass: boolean;
  getPlayableSides: (domino: Domino) => ("left" | "right")[];
  chatMessages: { playerName: string; message: string }[];
}

const GameContext = createContext<GameContextType | null>(null);

export function useGame() {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error("useGame must be inside GameProvider");
  return ctx;
}

export function GameProvider({ children }: { children: React.ReactNode }) {
  const [socket, setSocket] = useState<GameSocket | null>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [playerName, setPlayerName] = useState("");
  const [gameId, setGameId] = useState("");
  const [selectedTeam, setSelectedTeam] = useState<Team>("team1");
  const [gameMode, setGameMode] = useState<GameMode>("multiplayer");
  const [aiDifficulty, setAIDifficulty] = useState<AIDifficulty>("medium");
  const [joined, setJoined] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<
    { playerName: string; message: string }[]
  >([]);
  const deviceIdRef = useRef<string>("");
  const deviceMetaRef = useRef<DeviceMetadata>({});
  const [connectionKey, setConnectionKey] = useState(0);

  // Init device ID
  useEffect(() => {
    getDeviceId().then((id) => {
      deviceIdRef.current = id;
    });
    getDeviceMetadata().then((meta) => {
      deviceMetaRef.current = meta;
    });
  }, []);

  // Socket connection
  useEffect(() => {
    const sock = getSocket();
    setSocket(sock);

    sock.on("gameState", (state) => {
      setGameState(state);
      setError(null);
    });

    sock.on("error", (message) => {
      setError(message);
      setTimeout(() => setError(null), 3000);
    });

    sock.on("chatMessage", (data) => {
      setChatMessages((prev) => [...prev, data].slice(-50));
    });

    sock.on("reconnected", (data) => {
      setJoined(true);
      setGameId(data.gameId);
      setPlayerName(data.playerName);
    });

    sock.on("connect", () => {
      if (deviceIdRef.current) {
        sock.emit("reconnectGame", {
          deviceId: deviceIdRef.current,
          deviceMeta: deviceMetaRef.current,
        });
      }
    });

    return () => {
      sock.removeAllListeners();
    };
  }, [connectionKey]);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2000);
  }, []);

  const joinGame = useCallback(() => {
    if (!socket || !playerName.trim() || !gameId.trim()) return;

    if (gameMode === "multiplayer") {
      socket.emit("joinGame", {
        gameId: gameId.trim().toUpperCase(),
        playerName: playerName.trim(),
        team: selectedTeam,
        deviceId: deviceIdRef.current,
        deviceMeta: deviceMetaRef.current,
      });
    } else {
      socket.emit("createAIGame", {
        gameId: gameId.trim().toUpperCase(),
        playerName: playerName.trim(),
        team: selectedTeam,
        gameMode,
        aiDifficulty,
        deviceId: deviceIdRef.current,
        deviceMeta: deviceMetaRef.current,
      });
    }
    setJoined(true);
  }, [socket, playerName, gameId, selectedTeam, gameMode, aiDifficulty]);

  const startGame = useCallback(() => {
    if (!socket || !gameState) return;
    socket.emit("startGame", gameState.id);
  }, [socket, gameState]);

  const playDomino = useCallback(
    (dominoId: string, side: "left" | "right") => {
      if (!socket || !gameState) return;
      socket.emit("playDomino", { gameId: gameState.id, dominoId, side });
    },
    [socket, gameState],
  );

  const pass = useCallback(() => {
    if (!socket || !gameState) return;
    socket.emit("pass", gameState.id);
  }, [socket, gameState]);

  const autoFillAI = useCallback(() => {
    if (!socket || !gameState) return;
    socket.emit("autoFillAI", {
      gameId: gameState.id,
      difficulty: aiDifficulty,
    });
  }, [socket, gameState, aiDifficulty]);

  const leaveMatch = useCallback(() => {
    disconnectSocket();
    setSocket(null);
    setJoined(false);
    setGameState(null);
    setChatMessages([]);
    setError(null);
    setConnectionKey((k) => k + 1);
  }, []);

  const copyRoomCode = useCallback(async () => {
    if (!gameState?.id) return;
    try {
      const Clipboard = (await import("expo-clipboard")).default;
      await Clipboard.setStringAsync(gameState.id);
      showToast("Room code copied!");
    } catch {
      showToast("Copy failed");
    }
  }, [gameState?.id, showToast]);

  const sendChat = useCallback(
    (message: string) => {
      if (!socket || !gameState || !message.trim()) return;
      socket.emit("sendChat", {
        gameId: gameState.id,
        message: message.trim(),
      });
    },
    [socket, gameState],
  );

  // Computed
  const currentPlayer = gameState?.players.find((p) => p.id === socket?.id);
  const isMyTurn =
    gameState?.players[gameState.currentPlayerIndex]?.id === socket?.id;

  const getPlayableSides = useCallback(
    (domino: Domino): ("left" | "right")[] => {
      if (!gameState) return [];
      const boardEmpty = gameState.board.length === 0;
      const { canPlay: cp, sides } = canPlayDomino(
        domino,
        gameState.boardLeftEnd,
        gameState.boardRightEnd,
        boardEmpty,
      );
      return cp ? sides : [];
    },
    [gameState],
  );

  const canPass =
    currentPlayer?.hand.every((d) => getPlayableSides(d).length === 0) ?? false;

  return (
    <GameContext.Provider
      value={{
        socket,
        gameState,
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
        joined,
        error,
        toast,
        joinGame,
        startGame,
        playDomino,
        pass,
        autoFillAI,
        leaveMatch,
        copyRoomCode,
        sendChat,
        currentPlayer,
        isMyTurn,
        canPass,
        getPlayableSides,
        chatMessages,
      }}
    >
      {children}
    </GameContext.Provider>
  );
}
