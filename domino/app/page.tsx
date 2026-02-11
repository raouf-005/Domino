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
      <div className="w-full h-[65vh] bg-green-900/50 rounded-3xl animate-pulse flex items-center justify-center text-white/50 text-xl">
        Loading 3D Board...
      </div>
    ),
  },
);

type GameSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

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
    <div className="fixed inset-0 -z-10">
      <div className="absolute inset-0 bg-linear-to-br from-emerald-900 via-green-800 to-teal-900" />
      <div className="absolute inset-0 opacity-30">
        <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern
              id="table-pattern"
              x="0"
              y="0"
              width="100"
              height="100"
              patternUnits="userSpaceOnUse"
            >
              <circle cx="50" cy="50" r="1" fill="rgba(255,255,255,0.1)" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#table-pattern)" />
        </svg>
      </div>
      <Particles />
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
      className={`
        relative p-4 rounded-2xl backdrop-blur-md
        transition-all duration-500 ease-out
        ${
          player
            ? isCurrentTurn
              ? "bg-linear-to-br from-yellow-400/90 to-amber-500/90 shadow-2xl shadow-yellow-500/30 scale-105"
              : player.team === "team1"
                ? "bg-linear-to-br from-blue-500/80 to-blue-600/80"
                : "bg-linear-to-br from-red-500/80 to-red-600/80"
            : "bg-white/10"
        }
        ${isMe ? "ring-4 ring-white/50" : ""}
        ${player?.isAI ? "border-2 border-purple-400/50" : ""}
      `}
    >
      {isCurrentTurn && (
        <motion.div
          className="absolute inset-0 rounded-2xl bg-yellow-400/30"
          animate={{ opacity: [0.3, 0.6, 0.3] }}
          transition={{ duration: 1.5, repeat: Infinity }}
        />
      )}

      {player ? (
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-2">
            <div className="h-8 w-8 rounded-full bg-white/20 border border-white/30 flex items-center justify-center text-white font-bold">
              {player.name?.charAt(0)?.toUpperCase()}
            </div>
            {isMe && <span className="text-lg">👤</span>}
            {player.isAI && <span className="text-lg">🤖</span>}
            <p className="font-bold text-white truncate text-lg drop-shadow-md">
              {player.name}
            </p>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-2xl">
                {player.team === "team1" ? "🔵" : "🔴"}
              </span>
              <span className="text-white/80 text-sm font-medium">
                Team {player.team === "team1" ? "1" : "2"}
              </span>
            </div>

            <div className="flex items-center gap-1 bg-black/20 px-3 py-1 rounded-full">
              <span className="text-white text-sm">🁢</span>
              <span className="text-white font-bold">{player.hand.length}</span>
            </div>
          </div>

          {!isMe && (
            <div className="mt-3 flex items-center justify-between">
              <HandPreview count={player.hand.length} />
              <span className="text-white/70 text-xs">tiles</span>
            </div>
          )}

          {!player.isConnected && !player.isAI && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="absolute top-2 right-2"
            >
              <span className="text-yellow-300 text-xl">⚠️</span>
            </motion.div>
          )}
        </div>
      ) : (
        <div className="text-center py-4">
          <motion.div
            animate={{ opacity: [0.4, 0.8, 0.4] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <p className="text-white/50 italic">Waiting for player...</p>
          </motion.div>
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

  useEffect(() => {
    const newSocket: GameSocket = io({
      transports: ["websocket", "polling"],
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
      });
    } else {
      socket.emit("createAIGame", {
        gameId: gameId.trim().toUpperCase(),
        playerName: playerName.trim(),
        team: selectedTeam,
        gameMode,
        aiDifficulty,
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
      <div className="min-h-screen relative overflow-hidden">
        <AnimatedBackground />

        <div className="relative z-10 flex items-center justify-center min-h-screen p-4">
          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl p-8 w-full max-w-md border border-white/20"
          >
            {/* Logo */}
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
              className="text-center mb-6"
            >
              <div className="inline-flex items-center justify-center w-20 h-20 bg-linear-to-br from-emerald-500 to-green-600 rounded-2xl shadow-lg mb-4">
                <span className="text-4xl">🁣</span>
              </div>
              <h1 className="text-4xl font-bold bg-linear-to-r from-emerald-600 to-green-700 bg-clip-text text-transparent">
                Domino
              </h1>
              <p className="text-gray-500 mt-1">2 vs 2 Multiplayer</p>
            </motion.div>

            <div className="space-y-5">
              {/* Game Mode */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-3">
                  Game Mode
                </label>
                <div className="grid grid-cols-1 gap-2">
                  {[
                    {
                      mode: "multiplayer" as GameMode,
                      icon: "👥",
                      title: "Multiplayer",
                      desc: "Play with 4 human players on LAN",
                      bgColor: "bg-gradient-to-r from-green-500 to-emerald-600",
                    },
                    {
                      mode: "vs-ai" as GameMode,
                      icon: "🤖",
                      title: "Play vs AI",
                      desc: "You + AI partner vs 2 AI opponents",
                      bgColor: "bg-gradient-to-r from-purple-500 to-violet-600",
                    },
                    {
                      mode: "with-ai-partner" as GameMode,
                      icon: "🤝",
                      title: "AI Partner",
                      desc: "You + AI vs 2 human players",
                      bgColor: "bg-gradient-to-r from-indigo-500 to-blue-600",
                    },
                  ].map((item, idx) => (
                    <motion.button
                      key={item.mode}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.3 + idx * 0.1 }}
                      onClick={() => setGameMode(item.mode)}
                      className={`
                        relative p-4 rounded-xl font-semibold transition-all text-left overflow-hidden
                        ${
                          gameMode === item.mode
                            ? `${item.bgColor} text-white shadow-lg scale-[1.02]`
                            : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                        }
                      `}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{item.icon}</span>
                        <div>
                          <p className="font-bold">{item.title}</p>
                          <p
                            className={`text-xs ${gameMode === item.mode ? "text-white/80" : "text-gray-500"}`}
                          >
                            {item.desc}
                          </p>
                        </div>
                      </div>
                    </motion.button>
                  ))}
                </div>
              </div>

              {/* AI Difficulty */}
              <AnimatePresence>
                {gameMode !== "multiplayer" && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.3 }}
                  >
                    <label className="block text-sm font-semibold text-gray-700 mb-3">
                      AI Difficulty
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        {
                          diff: "easy" as AIDifficulty,
                          icon: "😊",
                          bgColor: "#22c55e",
                        },
                        {
                          diff: "medium" as AIDifficulty,
                          icon: "🤔",
                          bgColor: "#eab308",
                        },
                        {
                          diff: "hard" as AIDifficulty,
                          icon: "🔥",
                          bgColor: "#ef4444",
                        },
                      ].map((item) => (
                        <button
                          key={item.diff}
                          onClick={() => setAIDifficulty(item.diff)}
                          className="py-3 px-4 rounded-xl font-semibold transition-all"
                          style={{
                            backgroundColor:
                              aiDifficulty === item.diff
                                ? item.bgColor
                                : "#f3f4f6",
                            color:
                              aiDifficulty === item.diff ? "white" : "#374151",
                            transform:
                              aiDifficulty === item.diff
                                ? "scale(1.05)"
                                : "scale(1)",
                          }}
                        >
                          <span className="text-xl">{item.icon}</span>
                          <p className="text-sm capitalize mt-1">{item.diff}</p>
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Name input */}
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.5 }}
              >
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Your Name
                </label>
                <input
                  type="text"
                  value={playerName}
                  onChange={(e) => setPlayerName(e.target.value)}
                  placeholder="Enter your name"
                  className="w-full px-4 py-3 bg-gray-50 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-gray-900 transition-all"
                  maxLength={20}
                />
              </motion.div>

              {/* Room code */}
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.6 }}
              >
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Game Room
                </label>
                <input
                  type="text"
                  value={gameId}
                  onChange={(e) => setGameId(e.target.value.toUpperCase())}
                  placeholder="Enter room code (e.g., GAME1)"
                  className="w-full px-4 py-3 bg-gray-50 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-gray-900 uppercase font-mono tracking-wider transition-all"
                  maxLength={10}
                />
              </motion.div>

              {/* Team selection */}
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.7 }}
              >
                <label className="block text-sm font-semibold text-gray-700 mb-3">
                  Select Team
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { team: "team1" as Team, bgColor: "#3b82f6", emoji: "🔵" },
                    { team: "team2" as Team, bgColor: "#ef4444", emoji: "🔴" },
                  ].map((item) => (
                    <button
                      key={item.team}
                      onClick={() => setSelectedTeam(item.team)}
                      className="py-4 px-4 rounded-xl font-bold transition-all"
                      style={{
                        backgroundColor:
                          selectedTeam === item.team ? item.bgColor : "#f3f4f6",
                        color: selectedTeam === item.team ? "white" : "#374151",
                        transform:
                          selectedTeam === item.team
                            ? "scale(1.05)"
                            : "scale(1)",
                      }}
                    >
                      <span className="text-2xl">{item.emoji}</span>
                      <p className="mt-1">
                        Team {item.team === "team1" ? "1" : "2"}
                      </p>
                    </button>
                  ))}
                </div>
              </motion.div>

              {/* Join button */}
              <motion.button
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.8 }}
                onClick={joinGame}
                disabled={!playerName.trim() || !gameId.trim()}
                className="w-full py-4 bg-linear-to-r from-emerald-500 to-green-600 text-white rounded-xl font-bold text-lg hover:from-emerald-600 hover:to-green-700 disabled:from-gray-300 disabled:to-gray-400 disabled:cursor-not-allowed transition-all shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-[0.98]"
              >
                {gameMode === "multiplayer"
                  ? "🎮 Join Game"
                  : gameMode === "vs-ai"
                    ? "🤖 Start AI Game"
                    : "🤝 Create Room"}
              </motion.button>
            </div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1 }}
              className="mt-6 p-4 bg-linear-to-r from-gray-100 to-gray-50 rounded-xl"
            >
              <p className="text-sm text-gray-600 text-center">
                {gameMode === "multiplayer"
                  ? "📡 Share the room code with friends on your local network!"
                  : gameMode === "vs-ai"
                    ? "🎯 Play instantly against AI opponents!"
                    : "🌐 Create a room and invite 2 friends!"}
              </p>
            </motion.div>
          </motion.div>
        </div>
      </div>
    );
  }

  // Main game screen
  return (
    <div className="min-h-screen relative overflow-hidden">
      <AnimatedBackground />

      <div className="relative z-10 p-3 md:p-6 max-w-7xl mx-auto">
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
          className="bg-white/10 backdrop-blur-md rounded-2xl p-4 mb-4 flex flex-wrap justify-between items-center gap-4 border border-white/10"
        >
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <span className="text-3xl">🁣</span>
              Room: {gameState?.id}
              {gameState?.gameMode && gameState.gameMode !== "multiplayer" && (
                <span className="ml-2 px-3 py-1 bg-purple-500/30 rounded-full text-sm">
                  {gameState.gameMode === "vs-ai"
                    ? "🤖 vs AI"
                    : "🤝 AI Partner"}
                </span>
              )}
            </h1>
            <p className="text-white/70 mt-1">{gameState?.lastAction}</p>
            {currentTurn && (
              <p className="text-white/60 mt-1 text-sm">
                Turn:{" "}
                <span className="font-semibold text-white">
                  {currentTurn.name}
                </span>
                {currentTurn.team
                  ? ` • ${currentTurn.team === "team1" ? "Team 1" : "Team 2"}`
                  : ""}
              </p>
            )}
          </div>

          <div className="flex gap-6">
            <div
              className="text-center px-6 py-3 rounded-xl"
              style={{ backgroundColor: "rgba(59, 130, 246, 0.2)" }}
            >
              <span className="text-3xl">🔵</span>
              <p className="text-white font-bold text-xl">
                {gameState?.scores.team1 || 0}
              </p>
            </div>
            <div
              className="text-center px-6 py-3 rounded-xl"
              style={{ backgroundColor: "rgba(239, 68, 68, 0.2)" }}
            >
              <span className="text-3xl">🔴</span>
              <p className="text-white font-bold text-xl">
                {gameState?.scores.team2 || 0}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={copyRoomCode}
              className="px-4 py-2 rounded-xl bg-white/10 text-white font-semibold border border-white/10 hover:bg-white/20 transition"
            >
              Copy Room
            </button>
            <button
              onClick={() => setShowRules(true)}
              className="px-4 py-2 rounded-xl bg-white/10 text-white font-semibold border border-white/10 hover:bg-white/20 transition"
            >
              Rules
            </button>
            <button
              onClick={leaveMatch}
              className="px-4 py-2 rounded-xl bg-red-500/80 text-white font-semibold hover:bg-red-600 transition"
            >
              Leave Match
            </button>
          </div>
        </motion.div>

        {/* Players */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
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
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white/10 backdrop-blur-md rounded-3xl p-8 text-center border border-white/10"
          >
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
              className="text-6xl mb-4"
            >
              🁣
            </motion.div>
            <h2 className="text-3xl font-bold text-white mb-4">
              Waiting for players...
            </h2>
            <p className="text-white/60 text-xl mb-6">
              {gameState.players.length}/4 players joined
            </p>

            <div className="flex justify-center gap-2 mb-6">
              {[0, 1, 2, 3].map((i) => (
                <motion.div
                  key={i}
                  initial={{ scale: 0 }}
                  animate={{ scale: gameState.players[i] ? 1 : 0.5 }}
                  className={`w-4 h-4 rounded-full ${
                    gameState.players[i] ? "bg-green-400" : "bg-white/30"
                  }`}
                />
              ))}
            </div>

            {gameState.players.length === 4 && (
              <motion.button
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={startGame}
                className="px-12 py-5 bg-linear-to-r from-emerald-500 to-green-600 text-white rounded-2xl font-bold text-2xl shadow-2xl"
              >
                🎮 Start Game!
              </motion.button>
            )}
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <button
                onClick={copyRoomCode}
                className="px-5 py-3 rounded-xl bg-white/10 text-white font-semibold border border-white/10 hover:bg-white/20 transition"
              >
                Copy Room
              </button>
              <button
                onClick={leaveMatch}
                className="px-5 py-3 rounded-xl bg-red-500/80 text-white font-semibold hover:bg-red-600 transition"
              >
                Leave Match
              </button>
            </div>
          </motion.div>
        ) : gameState?.gamePhase === "finished" ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white/10 backdrop-blur-md rounded-3xl p-8 text-center border border-white/10"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 200, delay: 0.2 }}
              className="text-7xl mb-4"
            >
              🎉
            </motion.div>
            <h2 className="text-4xl font-bold text-white mb-4">Game Over!</h2>
            <p className="text-white/80 text-xl mb-8">{gameState.lastAction}</p>

            <div className="flex justify-center gap-12">
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="text-center"
              >
                <span className="text-6xl">🔵</span>
                <p className="text-white text-2xl font-bold mt-2">Team 1</p>
                <p className="text-4xl font-bold text-white mt-2">
                  {gameState.scores.team1} pts
                </p>
              </motion.div>
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="text-center"
              >
                <span className="text-6xl">🔴</span>
                <p className="text-white text-2xl font-bold mt-2">Team 2</p>
                <p className="text-4xl font-bold text-white mt-2">
                  {gameState.scores.team2} pts
                </p>
              </motion.div>
            </div>

            <div className="mt-6 text-white/80 text-lg">
              {gameState.winner === "draw" ? (
                <span>
                  Draw — Team 1 tiles: {teamTotals.team1} pts • Team 2 tiles:{" "}
                  {teamTotals.team2} pts
                </span>
              ) : (
                <span>Losing team tiles total: {loserPoints ?? 0} pts</span>
              )}
            </div>

            <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4 text-left">
              {gameState.players.map((player, idx) => (
                <div
                  key={`${player.id}-${idx}`}
                  className="bg-black/20 rounded-2xl p-4 border border-white/10"
                >
                  <div className="flex items-center justify-between">
                    <div className="text-white font-bold text-lg">
                      {player.name}
                    </div>
                    <div className="text-white/60 text-sm">
                      {player.team === "team1" ? "Team 1" : "Team 2"}
                    </div>
                  </div>
                  <div className="text-white/70 text-sm mt-1">
                    Tiles: {player.hand.length} • Sum: {handSum(player.hand)}{" "}
                    pts
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
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
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={startGame}
                className="px-10 py-4 bg-linear-to-r from-emerald-500 to-green-600 text-white rounded-2xl font-bold text-lg shadow-2xl"
              >
                Play Another Round
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={leaveMatch}
                className="px-10 py-4 bg-linear-to-r from-gray-700 to-gray-800 text-white rounded-2xl font-bold text-lg shadow-2xl"
              >
                Leave Match
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
            />
          </>
        )}

        {/* Chat */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="mt-4 bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/10"
        >
          <h3 className="text-white font-bold mb-3 flex items-center gap-2">
            <span>💬</span> Chat
          </h3>
          <div className="h-24 overflow-y-auto bg-black/20 rounded-xl p-3 mb-3">
            {chatMessages.map((msg, idx) => (
              <motion.p
                key={idx}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="text-sm mb-1"
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
              className="flex-1 px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-white/30"
              maxLength={100}
            />
            <button
              onClick={sendChat}
              className="px-6 py-3 bg-white/20 hover:bg-white/30 text-white rounded-xl font-semibold transition-colors"
            >
              Send
            </button>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
