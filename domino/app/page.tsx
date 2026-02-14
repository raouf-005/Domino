"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { io, Socket } from "socket.io-client";
import { motion, AnimatePresence } from "framer-motion";
import {
  GameState,
  Domino,
  Team,
  GameMode,
  AIDifficulty,
  canPlayDomino,
  ServerToClientEvents,
  ClientToServerEvents,
} from "../lib/gameTypes";
import { DominoTile2D, GameBoard3D } from "../components/Domino3D";
import dynamic from "next/dynamic";

const GameBoard3DNoSSR = dynamic(
  () =>
    import("../components/Domino3D").then((mod) => ({
      default: mod.GameBoard3D,
    })),
  {
    ssr: false,
    loading: () => (
      <div className="board-wrapper w-full h-[45vh] sm:h-[50vh] md:h-[65vh] min-h-60 sm:min-h-75 md:min-h-130 bg-green-900/50 rounded-xl sm:rounded-2xl md:rounded-3xl animate-pulse flex items-center justify-center text-white/50 text-sm sm:text-lg md:text-xl">
        Loading 3D Board...
      </div>
    ),
  },
);

type GameSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

// --------------- Device Fingerprint (persistent device ID) ---------------
function getDeviceId(): string {
  if (typeof window === "undefined") return "";
  const STORAGE_KEY = "domino_device_id";
  let id = localStorage.getItem(STORAGE_KEY);
  if (id) return id;

  // Build a fingerprint from stable browser / hardware properties
  const raw = [
    navigator.userAgent,
    navigator.language,
    navigator.hardwareConcurrency ?? 0,
    screen.width,
    screen.height,
    screen.colorDepth,
    Intl.DateTimeFormat().resolvedOptions().timeZone,
    navigator.platform,
  ].join("|");

  // Simple hash
  let hash = 0;
  for (let i = 0; i < raw.length; i++) {
    hash = (hash << 5) - hash + raw.charCodeAt(i);
    hash |= 0;
  }
  id = "dev-" + Math.abs(hash).toString(36) + "-" + Date.now().toString(36);
  localStorage.setItem(STORAGE_KEY, id);
  return id;
}
// -------------------------------------------------------------------------

// Particle effect component
function Particles() {
  const [particles, setParticles] = useState<{ x: number; delay: number }[]>(
    [],
  );

  useEffect(() => {
    setParticles(
      [...Array(20)].map(() => ({
        x: Math.random() * 100,
        delay: Math.random() * 10,
      })),
    );
  }, []);

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {particles.map((p, i) => (
        <motion.div
          key={i}
          className="absolute w-2 h-2 bg-white/20 rounded-full"
          style={{ left: `${p.x}%` }}
          initial={{ y: "100vh" }}
          animate={{ y: "-10vh" }}
          transition={{
            duration: 10 + Math.random() * 10,
            repeat: Infinity,
            ease: "linear",
            delay: p.delay,
          }}
        />
      ))}
    </div>
  );
}

// Animated background
function AnimatedBackground() {
  return (
    <div className="fixed inset-0 -z-10 bg-[#0a192f]">
      <div className="absolute inset-0 bg-gradient-to-br from-emerald-900/40 via-[#0f2e2e] to-slate-900" />
      <div className="absolute inset-0 opacity-20">
        <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern
              id="grid-pattern"
              x="0"
              y="0"
              width="40"
              height="40"
              patternUnits="userSpaceOnUse"
            >
              <path
                d="M 40 0 L 0 0 0 40"
                fill="none"
                stroke="rgba(255,255,255,0.05)"
                strokeWidth="1"
              />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid-pattern)" />
        </svg>
      </div>
      <Particles />
      <div className="absolute inset-0 bg-radial-gradient from-transparent to-black/60 pointer-events-none" />
    </div>
  );
}

function FaceDownTile({ size = "sm" }: { size?: "sm" | "md" }) {
  const dims = size === "md" ? "w-5 h-8" : "w-4 h-7";
  return (
    <div
      className={`${dims} rounded-md border border-white/30 bg-linear-to-br from-slate-900 to-slate-700 shadow-md`}
      style={{ boxShadow: "inset 0 1px 2px rgba(255,255,255,.15)" }}
    />
  );
}

function HandPreview({ count, max = 7 }: { count: number; max?: number }) {
  const shown = Math.min(count, max);
  const extra = Math.max(0, count - max);
  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: shown }).map((_, i) => (
        <FaceDownTile key={i} />
      ))}
      {extra > 0 && (
        <span className="text-xs text-white/80 bg-black/30 px-2 py-0.5 rounded-full">
          +{extra}
        </span>
      )}
    </div>
  );
}

// Player card component
function PlayerCard({
  player,
  isCurrentTurn,
  isMe,
  index,
}: {
  player?: {
    name: string;
    team: Team;
    hand: Domino[];
    isConnected: boolean;
    isAI?: boolean;
  };
  isCurrentTurn: boolean;
  isMe: boolean;
  index: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
      layout
      className={`
        relative p-2 sm:p-4 rounded-2xl sm:rounded-3xl backdrop-blur-xl border overflow-hidden group
        transition-all duration-500 ease-out
        ${
          player
            ? isCurrentTurn
              ? "bg-gradient-to-br from-amber-500/20 to-orange-600/20 border-amber-500/30 shadow-[0_0_20px_rgba(245,158,11,0.2)]"
              : player.team === "team1"
                ? "bg-gradient-to-br from-blue-500/10 to-indigo-600/10 border-blue-500/10"
                : "bg-gradient-to-br from-red-500/10 to-rose-600/10 border-red-500/10"
            : "bg-black/20 border-white/5"
        }
        ${isMe ? "ring-1 ring-white/30" : ""}
      `}
    >
      {isCurrentTurn && (
        <motion.div
          layoutId="turn-glow"
          className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent skew-x-12"
          animate={{ x: ["-100%", "200%"] }}
          transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
        />
      )}

      {player ? (
        <div className="relative z-10 flex flex-col h-full justify-between gap-1 sm:gap-3">
          {/* Desktop: full card */}
          <div className="hidden sm:flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div
                className={`
                  h-10 w-10 rounded-2xl flex items-center justify-center text-white font-bold shadow-lg
                  ${player.team === "team1" ? "bg-gradient-to-br from-blue-500 to-indigo-600" : "bg-gradient-to-br from-red-500 to-rose-600"}
                  ${player.isAI ? "ring-2 ring-purple-400/50" : ""}
                `}
              >
                {player.isAI ? "🤖" : player.name?.charAt(0)?.toUpperCase()}
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <p className="font-bold text-white text-sm tracking-wide leading-none">
                    {player.name}
                  </p>
                  {isMe && (
                    <span className="text-[10px] bg-white/20 px-1.5 py-0.5 rounded text-white/80 font-medium">
                      YOU
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1 mt-1 text-xs font-medium text-white/60">
                  <div
                    className={`w-1.5 h-1.5 rounded-full ${player.isConnected ? "bg-emerald-400" : "bg-red-400 animate-pulse"}`}
                  ></div>
                  {player.isConnected ? "Online" : "Disconnected"}
                </div>
              </div>
            </div>
          </div>

          {/* Mobile: compact inline card */}
          <div className="flex sm:hidden items-center gap-2">
            <div
              className={`
                h-7 w-7 rounded-lg flex items-center justify-center text-white text-xs font-bold shrink-0
                ${player.team === "team1" ? "bg-gradient-to-br from-blue-500 to-indigo-600" : "bg-gradient-to-br from-red-500 to-rose-600"}
              `}
            >
              {player.isAI ? "🤖" : player.name?.charAt(0)?.toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-bold text-white text-[11px] leading-tight truncate">
                {player.name}
                {isMe && (
                  <span className="text-[8px] ml-1 text-white/60">(you)</span>
                )}
              </p>
              <div className="flex items-center gap-1 text-[9px] text-white/50">
                <div
                  className={`w-1 h-1 rounded-full ${player.isConnected ? "bg-emerald-400" : "bg-red-400"}`}
                />
                <span>{player.hand.length} tiles</span>
              </div>
            </div>
          </div>

          {/* Desktop tile count bar */}
          <div className="hidden sm:flex bg-black/20 rounded-xl p-2.5 items-center justify-between border border-white/5">
            <div className="flex items-center gap-2">
              <span className="text-white/40 text-[10px] uppercase font-bold tracking-wider">
                Remaining
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-bold text-white">
                {player.hand.length}
              </span>
              <div className="flex gap-0.5">
                {Array.from({ length: Math.min(player.hand.length, 5) }).map(
                  (_, i) => (
                    <div
                      key={i}
                      className="w-1.5 h-3 bg-white/30 rounded-full"
                    />
                  ),
                )}
                {player.hand.length > 5 && (
                  <div className="w-1.5 h-3 bg-white/10 rounded-full text-[6px] flex items-center justify-center text-white">
                    +
                  </div>
                )}
              </div>
            </div>
          </div>

          {!player.isConnected && !player.isAI && (
            <div className="absolute top-1 right-1 sm:top-2 sm:right-2 text-yellow-500 animate-pulse text-[10px] sm:text-xs font-bold">
              ⚠
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-2 sm:py-6 gap-1 sm:gap-2 opacity-50">
          <div className="w-7 h-7 sm:w-10 sm:h-10 rounded-full bg-white/10 animate-pulse" />
          <p className="text-[9px] sm:text-xs text-white/50 font-medium">
            Empty
          </p>
        </div>
      )}
    </motion.div>
  );
}

// Enhanced board component
function GameBoard({
  board,
  leftEnd,
  rightEnd,
}: {
  board: Domino[];
  leftEnd: number;
  rightEnd: number;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollLeft =
        (scrollRef.current.scrollWidth - scrollRef.current.clientWidth) / 2;
    }
  }, [board]);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="relative bg-linear-to-b from-green-700/50 to-green-800/50 backdrop-blur-md rounded-3xl p-6 shadow-2xl border border-white/10"
    >
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2 text-white/80">
            <span className="text-lg">◀</span>
            <span className="bg-black/30 px-3 py-1 rounded-full font-mono">
              {leftEnd >= 0 ? leftEnd : "-"}
            </span>
          </div>
          <h3 className="text-white/90 font-semibold text-lg">Game Board</h3>
          <div className="flex items-center gap-2 text-white/80">
            <span className="bg-black/30 px-3 py-1 rounded-full font-mono">
              {rightEnd >= 0 ? rightEnd : "-"}
            </span>
            <span className="text-lg">▶</span>
          </div>
        </div>

        <div
          ref={scrollRef}
          className="overflow-x-auto pb-4"
          style={{ scrollbarWidth: "thin" }}
        >
          <div className="flex items-center justify-center gap-1 min-w-max py-4 px-2">
            <AnimatePresence mode="popLayout">
              {board.length === 0 ? (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-white/40 italic text-center py-8"
                >
                  Place the first domino to start!
                </motion.p>
              ) : (
                board.map((domino, idx) => (
                  <motion.div
                    key={`board-${domino.id}-${idx}`}
                    initial={{ opacity: 0, scale: 0, rotateY: 180 }}
                    animate={{ opacity: 1, scale: 1, rotateY: 0 }}
                    exit={{ opacity: 0, scale: 0 }}
                    transition={{
                      type: "spring",
                      stiffness: 300,
                      damping: 25,
                    }}
                  >
                    <DominoTile2D domino={domino} horizontal size="normal" />
                  </motion.div>
                ))
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// Main game page
export default function GamePage() {
  const [socket, setSocket] = useState<GameSocket | null>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [playerName, setPlayerName] = useState("");
  const [gameId, setGameId] = useState("");
  const [selectedTeam, setSelectedTeam] = useState<Team>("team1");
  const [joined, setJoined] = useState(false);
  const [selectedDomino, setSelectedDomino] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [showRules, setShowRules] = useState(false);
  const [chatMessages, setChatMessages] = useState<
    { playerName: string; message: string }[]
  >([]);
  const [chatInput, setChatInput] = useState("");
  const [gameMode, setGameMode] = useState<GameMode>("multiplayer");
  const [aiDifficulty, setAIDifficulty] = useState<AIDifficulty>("medium");
  const [connectionKey, setConnectionKey] = useState(0);
  const deviceId = useRef(typeof window !== "undefined" ? getDeviceId() : "");
  const [reconnecting, setReconnecting] = useState(false);

  useEffect(() => {
    const newSocket: GameSocket = io({
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    setSocket(newSocket);

    newSocket.on("gameState", (state) => {
      setGameState(state);
      setError(null);
    });

    newSocket.on("error", (message) => {
      setError(message);
      setTimeout(() => setError(null), 3000);
    });

    newSocket.on("chatMessage", (data) => {
      setChatMessages((prev) => [...prev, data].slice(-50));
    });

    newSocket.on("reconnected", (data) => {
      setJoined(true);
      setReconnecting(false);
      setGameId(data.gameId);
      setPlayerName(data.playerName);
      console.log(`Reconnected to game ${data.gameId} as ${data.playerName}`);
    });

    // On connect (including auto-reconnect), try to rejoin via device ID
    newSocket.on("connect", () => {
      if (deviceId.current) {
        newSocket.emit("reconnectGame", { deviceId: deviceId.current });
      }
    });

    return () => {
      newSocket.disconnect();
    };
  }, [connectionKey]);

  const showToast = useCallback((message: string) => {
    setToast(message);
    setTimeout(() => setToast(null), 2000);
  }, []);

  const leaveMatch = useCallback(() => {
    socket?.disconnect();
    setSocket(null);
    setJoined(false);
    setGameState(null);
    setSelectedDomino(null);
    setChatMessages([]);
    setError(null);
    setConnectionKey((k) => k + 1);
  }, [socket]);

  const joinGame = useCallback(() => {
    if (!socket || !playerName.trim() || !gameId.trim()) return;

    if (gameMode === "multiplayer") {
      socket.emit("joinGame", {
        gameId: gameId.trim().toUpperCase(),
        playerName: playerName.trim(),
        team: selectedTeam,
        deviceId: deviceId.current,
      });
    } else {
      socket.emit("createAIGame", {
        gameId: gameId.trim().toUpperCase(),
        playerName: playerName.trim(),
        team: selectedTeam,
        gameMode,
        aiDifficulty,
        deviceId: deviceId.current,
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
      setSelectedDomino(null);
    },
    [socket, gameState],
  );

  const pass = useCallback(() => {
    if (!socket || !gameState) return;
    socket.emit("pass", gameState.id);
  }, [socket, gameState]);

  const sendChat = useCallback(() => {
    if (!socket || !gameState || !chatInput.trim()) return;
    socket.emit("sendChat", {
      gameId: gameState.id,
      message: chatInput.trim(),
    });
    setChatInput("");
  }, [socket, gameState, chatInput]);

  const copyRoomCode = useCallback(async () => {
    if (!gameState?.id) return;
    try {
      await navigator.clipboard.writeText(gameState.id);
      showToast("Room code copied");
    } catch {
      showToast("Copy failed");
    }
  }, [gameState?.id, showToast]);

  const currentPlayer = gameState?.players.find((p) => p.id === socket?.id);
  const isMyTurn =
    gameState?.players[gameState.currentPlayerIndex]?.id === socket?.id;
  const currentTurn = gameState?.players[gameState.currentPlayerIndex];

  const myIndex =
    gameState?.players.findIndex((p) => p.id === socket?.id) ?? -1;
  const leftPlayer =
    myIndex >= 0 && gameState
      ? gameState.players[(myIndex + 1) % gameState.players.length]
      : undefined;
  const topPlayer =
    myIndex >= 0 && gameState
      ? gameState.players[(myIndex + 2) % gameState.players.length]
      : undefined;
  const rightPlayer =
    myIndex >= 0 && gameState
      ? gameState.players[(myIndex + 3) % gameState.players.length]
      : undefined;

  const getPlayableSides = (domino: Domino): ("left" | "right")[] => {
    if (!gameState) return [];
    const boardEmpty = gameState.board.length === 0;
    const { canPlay, sides } = canPlayDomino(
      domino,
      gameState.boardLeftEnd,
      gameState.boardRightEnd,
      boardEmpty,
    );
    return canPlay ? sides : [];
  };

  const canPass =
    currentPlayer?.hand.every((d) => getPlayableSides(d).length === 0) ?? false;

  const isBlockedEnd =
    gameState?.gamePhase === "finished" && gameState.passCount >= 4;

  const activeSeat = (() => {
    if (!gameState || myIndex < 0) return null;
    const rel =
      (gameState.currentPlayerIndex - myIndex + gameState.players.length) %
      gameState.players.length;
    const seats: Array<"bottom" | "left" | "top" | "right"> = [
      "bottom",
      "left",
      "top",
      "right",
    ];
    return seats[rel] ?? null;
  })();

  const autoFillAI = () => {
    if (!socket || !gameState) return;
    socket.emit("autoFillAI", {
      gameId: gameState.id,
      difficulty: aiDifficulty,
    });
  };

  const handSum = (hand: Domino[]) =>
    hand.reduce((sum, d) => sum + d.left + d.right, 0);

  const teamTotals = gameState
    ? {
        team1: gameState.players
          .filter((p) => p.team === "team1")
          .reduce((sum, p) => sum + handSum(p.hand), 0),
        team2: gameState.players
          .filter((p) => p.team === "team2")
          .reduce((sum, p) => sum + handSum(p.hand), 0),
      }
    : { team1: 0, team2: 0 };

  const loserTeam =
    gameState?.winner === "team1"
      ? "team2"
      : gameState?.winner === "team2"
        ? "team1"
        : null;
  const loserPoints = loserTeam ? teamTotals[loserTeam] : null;

  // Login/Join screen
  if (!joined) {
    return (
      <div className="min-h-screen relative overflow-hidden flex items-center justify-center p-2 sm:p-4">
        <AnimatedBackground />

        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.6, type: "spring", bounce: 0.3 }}
          className="relative z-10 w-full max-w-lg max-h-[95vh] overflow-y-auto"
        >
          {/* Glow effect */}
          <div className="absolute -inset-1 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-3xl blur-lg opacity-30" />

          <div className="relative bg-white/10 backdrop-blur-xl rounded-3xl border border-white/20 shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="px-4 pt-4 pb-3 sm:px-8 sm:pt-10 sm:pb-6 text-center">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", delay: 0.2 }}
                className="inline-flex items-center justify-center w-14 h-14 sm:w-24 sm:h-24 bg-gradient-to-br from-emerald-400 to-green-600 rounded-2xl shadow-lg mb-3 sm:mb-6 transform hover:rotate-6 transition-transform duration-300"
              >
                <span className="text-3xl sm:text-5xl drop-shadow-md">🁣</span>
              </motion.div>
              <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-emerald-200 via-white to-teal-200 drop-shadow-sm">
                Domino
              </h1>
              <p className="text-white/60 mt-1 sm:mt-2 font-medium tracking-wide uppercase text-xs sm:text-sm">
                Next-Gen Multiplayer
              </p>
            </div>

            <div className="px-4 pb-6 space-y-4 sm:px-8 sm:pb-10 sm:space-y-6">
              {/* Game Mode Selection */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-white/50 uppercase tracking-widest pl-1">
                  Game Mode
                </label>
                <div className="grid grid-cols-1 gap-3">
                  {[
                    {
                      mode: "multiplayer" as GameMode,
                      icon: "👥",
                      title: "Multiplayer",
                      desc: "Play with friends",
                      color: "from-blue-500/20 to-indigo-600/20",
                      activeColor: "from-blue-500 to-indigo-600",
                    },
                    {
                      mode: "vs-ai" as GameMode,
                      icon: "🤖",
                      title: "Play vs AI",
                      desc: "Train solo",
                      color: "from-purple-500/20 to-violet-600/20",
                      activeColor: "from-purple-500 to-violet-600",
                    },
                    {
                      mode: "with-ai-partner" as GameMode,
                      icon: "🤝",
                      title: "AI Partner",
                      desc: "Co-op vs Humans",
                      color: "from-pink-500/20 to-rose-600/20",
                      activeColor: "from-pink-500 to-rose-600",
                    },
                  ].map((item) => (
                    <button
                      key={item.mode}
                      onClick={() => setGameMode(item.mode)}
                      className={`
                        relative flex items-center gap-4 p-3 rounded-xl transition-all duration-300 border
                        ${
                          gameMode === item.mode
                            ? `bg-gradient-to-r ${item.activeColor} border-transparent text-white shadow-lg scale-[1.02]`
                            : `bg-gradient-to-r ${item.color} border-white/10 text-white/70 hover:bg-white/10 hover:border-white/20`
                        }
                      `}
                    >
                      <span className="text-2xl bg-black/20 p-2 rounded-lg">
                        {item.icon}
                      </span>
                      <div className="text-left">
                        <p
                          className={`font-bold ${gameMode === item.mode ? "text-white" : "text-white/90"}`}
                        >
                          {item.title}
                        </p>
                        <p
                          className={`text-xs ${gameMode === item.mode ? "text-white/80" : "text-white/50"}`}
                        >
                          {item.desc}
                        </p>
                      </div>
                      {gameMode === item.mode && (
                        <motion.div
                          layoutId="active-check"
                          className="absolute right-4 text-white text-xl"
                        >
                          ✓
                        </motion.div>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* AI Difficulty */}
              <AnimatePresence>
                {gameMode !== "multiplayer" && (
                  <motion.div
                    initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                    animate={{ opacity: 1, height: "auto", marginBottom: 24 }}
                    exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                    className="overflow-hidden"
                  >
                    <label className="block text-xs font-bold text-white/50 uppercase tracking-widest pl-1 mb-2">
                      Difficulty
                    </label>
                    <div className="flex bg-black/20 p-1 rounded-xl">
                      {(["easy", "medium", "hard"] as const).map((diff) => (
                        <button
                          key={diff}
                          onClick={() => setAIDifficulty(diff)}
                          className={`
                            flex-1 py-2 rounded-lg text-sm font-bold capitalize transition-all
                            ${
                              aiDifficulty === diff
                                ? "bg-white text-emerald-900 shadow-md"
                                : "text-white/50 hover:text-white hover:bg-white/5"
                            }
                          `}
                        >
                          {diff}
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Inputs */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-white/50 uppercase tracking-widest pl-1">
                    Your Name
                  </label>
                  <input
                    type="text"
                    value={playerName}
                    onChange={(e) => setPlayerName(e.target.value)}
                    placeholder="Enter name"
                    className="w-full px-4 py-3 bg-black/20 border border-white/10 rounded-xl focus:ring-2 focus:ring-emerald-400 focus:border-transparent text-white placeholder-white/30 transition-all outline-none"
                    maxLength={20}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-white/50 uppercase tracking-widest pl-1">
                    Room Code
                  </label>
                  <input
                    type="text"
                    value={gameId}
                    onChange={(e) => setGameId(e.target.value.toUpperCase())}
                    placeholder="GAME1"
                    className="w-full px-4 py-3 bg-black/20 border border-white/10 rounded-xl focus:ring-2 focus:ring-emerald-400 focus:border-transparent text-white placeholder-white/30 font-mono tracking-wider transition-all outline-none uppercase"
                    maxLength={10}
                  />
                </div>
              </div>

              {/* Team Selection */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-white/50 uppercase tracking-widest pl-1">
                  Select Team
                </label>
                <div className="flex gap-4">
                  {[
                    {
                      team: "team1",
                      color: "bg-blue-500",
                      label: "Team 1",
                      border: "border-blue-400",
                      ring: "ring-blue-400",
                    },
                    {
                      team: "team2",
                      color: "bg-red-500",
                      label: "Team 2",
                      border: "border-red-400",
                      ring: "ring-red-400",
                    },
                  ].map((t) => (
                    <button
                      key={t.team}
                      onClick={() => setSelectedTeam(t.team as Team)}
                      className={`
                        flex-1 py-3 rounded-xl font-bold text-white transition-all transform
                        ${
                          selectedTeam === t.team
                            ? `${t.color} shadow-lg scale-105 ring-2 ring-offset-2 ring-offset-black/20 ${t.ring}`
                            : "bg-white/5 text-white/50 hover:bg-white/10"
                        }
                      `}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Join Button */}
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={joinGame}
                disabled={!playerName.trim() || !gameId.trim()}
                className="w-full py-4 mt-2 bg-gradient-to-r from-emerald-400 to-green-500 text-white rounded-xl font-bold text-lg hover:from-emerald-500 hover:to-green-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg hover:shadow-emerald-500/25"
              >
                {gameMode === "multiplayer" ? "Join Lobby" : "Start Game"}
              </motion.button>

              <p className="text-center text-xs text-white/30 pt-2">
                Ready to play? 2v2 Dominoes action awaits!
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  // Main game screen
  return (
    <div className="min-h-screen relative overflow-hidden safe-area-pad">
      <AnimatedBackground />
      <div className="rotate-hint sm:hidden fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md">
        <div className="flex flex-col items-center gap-4 px-8 py-10 rounded-2xl bg-white/10 border border-white/15 shadow-2xl text-center max-w-[280px]">
          <span className="rotate-phone-icon text-5xl">📱</span>
          <p className="text-white font-bold text-lg leading-tight">
            Rotate Your Phone
          </p>
          <p className="text-white/60 text-sm">
            Turn your device sideways for the best experience
          </p>
        </div>
      </div>

      <div className="game-shell relative z-10 p-3 md:p-6 max-w-7xl mx-auto">
        {/* Error Toast */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -50, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -50, scale: 0.9 }}
              className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-red-500 text-white px-6 py-3 rounded-xl shadow-2xl font-semibold"
            >
              ⚠️ {error}
            </motion.div>
          )}
        </AnimatePresence>
        <AnimatePresence>
          {toast && (
            <motion.div
              initial={{ opacity: 0, y: -40, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -40, scale: 0.95 }}
              className="fixed top-16 left-1/2 -translate-x-1/2 z-50 bg-emerald-500 text-white px-6 py-2 rounded-full shadow-xl font-semibold"
            >
              {toast}
            </motion.div>
          )}
        </AnimatePresence>
        <AnimatePresence>
          {showRules && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
            >
              <motion.div
                initial={{ y: 20, scale: 0.98 }}
                animate={{ y: 0, scale: 1 }}
                exit={{ y: 20, scale: 0.98 }}
                className="w-full max-w-lg bg-white/95 rounded-2xl p-6 shadow-2xl border border-white/20"
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-bold text-gray-900">
                    How to play
                  </h3>
                  <button
                    onClick={() => setShowRules(false)}
                    className="px-3 py-1 rounded-lg bg-gray-100 hover:bg-gray-200"
                  >
                    Close
                  </button>
                </div>
                <ul className="space-y-2 text-gray-700 text-sm leading-relaxed">
                  <li>• Match either end value on the board.</li>
                  <li>• Doubles are placed vertically.</li>
                  <li>• If you can’t play, pass your turn.</li>
                  <li>
                    • Round ends when a player empties their hand or all players
                    pass.
                  </li>
                  <li>
                    • Scores are based on remaining pips in the opponents’
                    hands.
                  </li>
                </ul>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="game-header hidden sm:flex relative z-50 bg-black/40 backdrop-blur-xl rounded-2xl p-3 mb-6 flex-wrap justify-between items-center gap-4 border border-white/10 shadow-lg"
        >
          <div className="flex items-center gap-4">
            <div className="header-logo bg-white/10 p-2 rounded-xl border border-white/10">
              <span className="text-3xl">🁣</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-white tracking-wide">
                  Room{" "}
                  <span className="font-mono text-emerald-400">
                    {gameState?.id}
                  </span>
                </h1>
                {gameState?.gameMode &&
                  gameState.gameMode !== "multiplayer" && (
                    <span className="px-2 py-0.5 bg-purple-500/20 text-purple-200 border border-purple-500/30 rounded-full text-xs font-bold uppercase tracking-wider">
                      {gameState.gameMode === "vs-ai" ? "AI Mode" : "Co-op"}
                    </span>
                  )}
              </div>
              {currentTurn && (
                <div className="flex items-center gap-2 mt-0.5 text-xs text-white/60 font-medium">
                  <span>Turn:</span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-white ${
                      currentTurn.team === "team1"
                        ? "bg-blue-500/50"
                        : "bg-red-500/50"
                    }`}
                  >
                    {currentTurn.name}
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="score-panel flex items-center gap-2 bg-black/30 p-1.5 rounded-xl border border-white/5">
            <div className="flex flex-col items-center justify-center px-4 py-1 bg-blue-500/10 rounded-lg border border-blue-500/20 min-w-15 sm:min-w-20">
              <span className="score-icon text-2xl drop-shadow-md">🔵</span>
              <span className="score-val text-white font-bold text-lg leading-tight">
                {gameState?.scores.team1 || 0}
              </span>
            </div>
            <div className="h-8 w-px bg-white/10 mx-1"></div>
            <div className="flex flex-col items-center justify-center px-4 py-1 bg-red-500/10 rounded-lg border border-red-500/20 min-w-15 sm:min-w-20">
              <span className="score-icon text-2xl drop-shadow-md">🔴</span>
              <span className="score-val text-white font-bold text-lg leading-tight">
                {gameState?.scores.team2 || 0}
              </span>
            </div>
          </div>

          <div className="header-actions hidden sm:flex items-center gap-2">
            <button
              onClick={copyRoomCode}
              className="p-2 sm:p-3 rounded-xl bg-white/5 text-white/80 hover:bg-white/10 hover:text-white border border-white/5 transition-all"
              title="Copy Room Code"
            >
              📋
            </button>
            <button
              onClick={() => setShowRules(true)}
              className="p-2 sm:p-3 rounded-xl bg-white/5 text-white/80 hover:bg-white/10 hover:text-white border border-white/5 transition-all hidden sm:block"
              title="Rules"
            >
              ℹ️
            </button>
            <button
              onClick={leaveMatch}
              className="px-3 py-2 sm:px-4 sm:py-2.5 rounded-xl bg-red-500/10 text-red-200 hover:bg-red-500 hover:text-white border border-red-500/20 transition-all font-semibold text-xs sm:text-sm"
            >
              Exit
            </button>
          </div>
        </motion.div>

        <div className="mobile-hud sm:hidden mb-1 px-2 py-1 rounded-lg bg-black/40 border border-white/10 backdrop-blur-md flex items-center justify-between gap-1">
          <p className="text-emerald-300 font-mono font-bold text-[11px] truncate">
            {gameState?.id}
          </p>
          <div className="flex items-center gap-1.5">
            <span className="px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-200 text-[10px] font-bold">
              🔵{gameState?.scores.team1 || 0}
            </span>
            <span className="px-1.5 py-0.5 rounded bg-red-500/20 text-red-200 text-[10px] font-bold">
              🔴{gameState?.scores.team2 || 0}
            </span>
          </div>
          {currentTurn && (
            <p className="text-white text-[10px] font-semibold truncate max-w-16">
              🎯{currentTurn.name}
            </p>
          )}
          <div className="flex items-center gap-1">
            <button
              onClick={copyRoomCode}
              className="p-1 rounded bg-white/10 text-[10px]"
              title="Copy"
            >
              📋
            </button>
            <button
              onClick={() => setShowRules(true)}
              className="p-1 rounded bg-white/10 text-[10px]"
              title="Rules"
            >
              ℹ️
            </button>
            <button
              onClick={leaveMatch}
              className="p-1 rounded bg-red-500/20 text-[10px]"
              title="Exit"
            >
              🚪
            </button>
          </div>
        </div>

        {/* Players */}
        <div className="players-row hidden sm:grid grid-cols-4 gap-2 sm:gap-3 mb-4">
          {[0, 1, 2, 3].map((index) => (
            <PlayerCard
              key={index}
              player={gameState?.players[index]}
              isCurrentTurn={gameState?.currentPlayerIndex === index}
              isMe={gameState?.players[index]?.id === socket?.id}
              index={index}
            />
          ))}
        </div>

        {/* Game content */}
        {gameState?.gamePhase === "waiting" ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="max-w-2xl mx-auto mt-4 sm:mt-8 md:mt-20"
          >
            <div className="bg-black/40 backdrop-blur-2xl rounded-2xl sm:rounded-3xl p-4 sm:p-8 md:p-12 text-center border border-white/10 shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-2/3 h-1 bg-gradient-to-r from-transparent via-emerald-500 to-transparent shadow-[0_0_20px_rgba(16,185,129,0.5)]"></div>

              <div className="relative z-10">
                <motion.div
                  animate={{
                    rotate: 360,
                    filter: [
                      "brightness(1)",
                      "brightness(1.2)",
                      "brightness(1)",
                    ],
                  }}
                  transition={{
                    rotate: { duration: 20, repeat: Infinity, ease: "linear" },
                    filter: { duration: 2, repeat: Infinity },
                  }}
                  className="inline-block text-4xl sm:text-7xl mb-3 sm:mb-6 drop-shadow-[0_0_30px_rgba(16,185,129,0.3)]"
                >
                  🁣
                </motion.div>

                <h2 className="text-2xl sm:text-4xl font-extrabold text-white mb-1 sm:mb-2 tracking-tight">
                  Lobby
                </h2>
                <p className="text-white/50 text-sm sm:text-xl mb-4 sm:mb-10 font-medium">
                  {gameState.players.length} / 4 Players Ready
                </p>

                <div className="flex justify-center gap-3 sm:gap-6 mb-6 sm:mb-12">
                  {[0, 1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className="flex flex-col items-center gap-2 sm:gap-3"
                    >
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className={`w-4 h-4 rounded-full shadow-lg ${
                          gameState.players[i]
                            ? "bg-emerald-400 shadow-emerald-500/50"
                            : "bg-white/10 border border-white/10"
                        }`}
                      />
                      {gameState.players[i] && (
                        <div className="w-10 sm:w-16 h-1 bg-white/20 rounded-full overflow-hidden">
                          <motion.div
                            className="h-full bg-emerald-400"
                            initial={{ width: 0 }}
                            animate={{ width: "100%" }}
                          />
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {gameState.players.length === 4 ? (
                  <motion.button
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={startGame}
                    className="w-full max-w-sm px-6 py-3 sm:px-8 sm:py-4 bg-gradient-to-r from-emerald-500 to-green-600 text-white rounded-xl sm:rounded-2xl font-bold text-base sm:text-xl shadow-xl shadow-emerald-900/20 hover:shadow-emerald-500/30 transition-all border border-emerald-400/20"
                  >
                    🚀 Start Game
                  </motion.button>
                ) : (
                  <div className="flex flex-col items-center gap-6">
                    <div className="p-4 bg-white/5 rounded-xl border border-white/5 inline-block">
                      <p className="text-white/40 text-sm animate-pulse">
                        Waiting for more players...
                      </p>
                    </div>

                    {/* Auto Fill AI */}
                    <button
                      onClick={autoFillAI}
                      className="w-full max-w-sm px-4 py-3 sm:px-6 sm:py-4 rounded-xl bg-gradient-to-r from-purple-500/20 to-violet-600/20 text-purple-200 border border-purple-500/20 hover:from-purple-500/30 hover:to-violet-600/30 transition-all font-bold text-sm sm:text-base flex items-center justify-center gap-2 sm:gap-3 active:scale-95"
                    >
                      <span className="text-lg sm:text-xl">🤖</span> Auto Fill
                      with AI
                    </button>
                  </div>
                )}

                <div className="mt-4 sm:mt-8 flex flex-wrap justify-center gap-2 sm:gap-4">
                  <button
                    onClick={copyRoomCode}
                    className="flex items-center gap-2 px-4 py-2 sm:px-6 sm:py-3 rounded-xl bg-white/5 text-white/80 font-semibold text-sm sm:text-base border border-white/10 hover:bg-white/10 hover:text-white transition-all"
                  >
                    <span>📋</span> Copy Code
                  </button>
                  <button
                    onClick={leaveMatch}
                    className="flex items-center gap-2 px-4 py-2 sm:px-6 sm:py-3 rounded-xl bg-red-500/10 text-red-300 font-semibold text-sm sm:text-base border border-red-500/20 hover:bg-red-500 hover:text-white transition-all"
                  >
                    <span>🚪</span> Leave
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        ) : isBlockedEnd ? (
          <>
            <GameBoard3DNoSSR
              board={gameState?.board || []}
              boardLeftEnd={gameState?.boardLeftEnd ?? -1}
              boardRightEnd={gameState?.boardRightEnd ?? -1}
              hand={currentPlayer?.hand || []}
              isMyTurn={false}
              getPlayableSides={() => []}
              onPlay={playDomino}
              onPass={pass}
              canPass={false}
              topHandCount={topPlayer?.hand.length ?? 0}
              leftHandCount={leftPlayer?.hand.length ?? 0}
              rightHandCount={rightPlayer?.hand.length ?? 0}
              revealAllHands
              revealTopHand={topPlayer?.hand ?? []}
              revealLeftHand={leftPlayer?.hand ?? []}
              revealRightHand={rightPlayer?.hand ?? []}
              showTurnOverlay={false}
              activeSeat={null}
              bottomTeam={currentPlayer?.team ?? null}
              leftTeam={leftPlayer?.team ?? null}
              topTeam={topPlayer?.team ?? null}
              rightTeam={rightPlayer?.team ?? null}
            />
            <div className="mt-3 sm:mt-6 bg-white/10 backdrop-blur-md rounded-xl sm:rounded-2xl p-3 sm:p-4 text-center border border-white/10">
              <h3 className="text-lg sm:text-2xl font-bold text-white mb-1 sm:mb-2">
                Game Blocked
              </h3>
              <p className="text-white/70 text-xs sm:text-base mb-3 sm:mb-4">
                {gameState.lastAction}
              </p>
              <div className="flex flex-wrap justify-center gap-2 sm:gap-3">
                <button
                  onClick={startGame}
                  className="px-4 py-2 sm:px-6 sm:py-3 bg-linear-to-r from-emerald-500 to-green-600 text-white rounded-xl font-semibold text-sm sm:text-base"
                >
                  Play Again
                </button>
                <button
                  onClick={leaveMatch}
                  className="px-4 py-2 sm:px-6 sm:py-3 bg-linear-to-r from-gray-700 to-gray-800 text-white rounded-xl font-semibold text-sm sm:text-base"
                >
                  Leave
                </button>
              </div>
            </div>
          </>
        ) : gameState?.gamePhase === "finished" ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white/10 backdrop-blur-md rounded-2xl sm:rounded-3xl p-4 sm:p-8 text-center border border-white/10"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 200, delay: 0.2 }}
              className="text-4xl sm:text-7xl mb-2 sm:mb-4"
            >
              🎉
            </motion.div>
            <h2 className="text-2xl sm:text-4xl font-bold text-white mb-2 sm:mb-4">
              Game Over!
            </h2>
            <p className="text-white/80 text-sm sm:text-xl mb-4 sm:mb-8">
              {gameState.lastAction}
            </p>

            <div className="flex justify-center gap-6 sm:gap-12">
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="text-center"
              >
                <span className="text-3xl sm:text-6xl">🔵</span>
                <p className="text-white text-base sm:text-2xl font-bold mt-1 sm:mt-2">
                  Team 1
                </p>
                <p className="text-2xl sm:text-4xl font-bold text-white mt-1 sm:mt-2">
                  {gameState.scores.team1} pts
                </p>
              </motion.div>
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="text-center"
              >
                <span className="text-3xl sm:text-6xl">🔴</span>
                <p className="text-white text-base sm:text-2xl font-bold mt-1 sm:mt-2">
                  Team 2
                </p>
                <p className="text-2xl sm:text-4xl font-bold text-white mt-1 sm:mt-2">
                  {gameState.scores.team2} pts
                </p>
              </motion.div>
            </div>

            <div className="mt-3 sm:mt-6 text-white/80 text-xs sm:text-lg">
              {gameState.winner === "draw" ? (
                <span>
                  Draw — Team 1: {teamTotals.team1} pts • Team 2:{" "}
                  {teamTotals.team2} pts
                </span>
              ) : (
                <span>Losing team tiles: {loserPoints ?? 0} pts</span>
              )}
            </div>

            <div className="mt-4 sm:mt-8 grid grid-cols-1 md:grid-cols-2 gap-2 sm:gap-4 text-left">
              {gameState.players.map((player, idx) => (
                <div
                  key={`${player.id}-${idx}`}
                  className="bg-black/20 rounded-xl sm:rounded-2xl p-2 sm:p-4 border border-white/10"
                >
                  <div className="flex items-center justify-between">
                    <div className="text-white font-bold text-sm sm:text-lg">
                      {player.name}
                    </div>
                    <div className="text-white/60 text-[10px] sm:text-sm">
                      {player.team === "team1" ? "T1" : "T2"}
                    </div>
                  </div>
                  <div className="text-white/70 text-[10px] sm:text-sm mt-0.5 sm:mt-1">
                    {player.hand.length} tiles • {handSum(player.hand)} pts
                  </div>
                  <div className="mt-2 sm:mt-3 flex flex-wrap gap-1 sm:gap-2">
                    {player.hand.length === 0 ? (
                      <span className="text-white/40 text-sm italic">
                        No tiles
                      </span>
                    ) : (
                      player.hand.map((d) => (
                        <DominoTile2D
                          key={`${player.id}-${d.id}`}
                          domino={d}
                          horizontal
                          size="small"
                        />
                      ))
                    )}
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 sm:mt-8 flex flex-wrap justify-center gap-2 sm:gap-3">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={startGame}
                className="px-6 py-2.5 sm:px-10 sm:py-4 bg-linear-to-r from-emerald-500 to-green-600 text-white rounded-xl sm:rounded-2xl font-bold text-sm sm:text-lg shadow-2xl"
              >
                Play Again
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={leaveMatch}
                className="px-6 py-2.5 sm:px-10 sm:py-4 bg-linear-to-r from-gray-700 to-gray-800 text-white rounded-xl sm:rounded-2xl font-bold text-sm sm:text-lg shadow-2xl"
              >
                Leave
              </motion.button>
            </div>
          </motion.div>
        ) : (
          <>
            {/* 3D Board with drag-and-drop hand */}
            <GameBoard3DNoSSR
              board={gameState?.board || []}
              boardLeftEnd={gameState?.boardLeftEnd ?? -1}
              boardRightEnd={gameState?.boardRightEnd ?? -1}
              hand={currentPlayer?.hand || []}
              isMyTurn={!!isMyTurn}
              getPlayableSides={getPlayableSides}
              onPlay={playDomino}
              onPass={pass}
              canPass={canPass}
              topHandCount={topPlayer?.hand.length ?? 0}
              leftHandCount={leftPlayer?.hand.length ?? 0}
              rightHandCount={rightPlayer?.hand.length ?? 0}
              activeSeat={activeSeat}
              bottomTeam={currentPlayer?.team ?? null}
              leftTeam={leftPlayer?.team ?? null}
              topTeam={topPlayer?.team ?? null}
              rightTeam={rightPlayer?.team ?? null}
            />
          </>
        )}

        {/* Chat */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="chat-section mt-4 bg-white/10 backdrop-blur-md rounded-2xl border border-white/10 overflow-hidden hidden sm:block"
        >
          <div className="px-4 pb-4 pt-3">
            <h3 className="text-white font-bold mb-3 flex items-center gap-2 text-sm sm:text-base">
              <span>💬</span> Chat
            </h3>
            <div className="h-20 sm:h-24 overflow-y-auto bg-black/20 rounded-xl p-2 sm:p-3 mb-2 sm:mb-3">
              {chatMessages.map((msg, idx) => (
                <motion.p
                  key={idx}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="text-xs sm:text-sm mb-1"
                >
                  <strong className="text-white">{msg.playerName}:</strong>{" "}
                  <span className="text-white/70">{msg.message}</span>
                </motion.p>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && sendChat()}
                placeholder="Type a message..."
                className="flex-1 px-3 sm:px-4 py-2 sm:py-3 bg-white/10 border border-white/20 rounded-xl text-white text-sm placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-white/30"
                maxLength={100}
              />
              <button
                onClick={sendChat}
                className="px-4 sm:px-6 py-2 sm:py-3 bg-white/20 hover:bg-white/30 text-white rounded-xl font-semibold text-sm transition-colors"
              >
                Send
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
