"use client";

import { useEffect, useState, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import {
  GameState,
  Domino,
  Team,
  canPlayDomino,
  ServerToClientEvents,
  ClientToServerEvents,
} from "../lib/gameTypes";

type GameSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

export default function GamePage() {
  const [socket, setSocket] = useState<GameSocket | null>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [playerName, setPlayerName] = useState("");
  const [gameId, setGameId] = useState("");
  const [selectedTeam, setSelectedTeam] = useState<Team>("team1");
  const [joined, setJoined] = useState(false);
  const [selectedDomino, setSelectedDomino] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<
    { playerName: string; message: string }[]
  >([]);
  const [chatInput, setChatInput] = useState("");

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
  }, []);

  const joinGame = useCallback(() => {
    if (!socket || !playerName.trim() || !gameId.trim()) return;

    socket.emit("joinGame", {
      gameId: gameId.trim().toUpperCase(),
      playerName: playerName.trim(),
      team: selectedTeam,
    });
    setJoined(true);
  }, [socket, playerName, gameId, selectedTeam]);

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

  // Get current player
  const currentPlayer = gameState?.players.find((p) => p.id === socket?.id);
  const isMyTurn =
    gameState?.players[gameState.currentPlayerIndex]?.id === socket?.id;

  // Check if a domino can be played
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

  // Check if player can pass
  const canPass =
    currentPlayer?.hand.every((d) => getPlayableSides(d).length === 0) ?? false;

  if (!joined) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-900 to-green-700 flex items-center justify-center p-4">
        <div className="bg-white/95 backdrop-blur rounded-2xl shadow-2xl p-8 w-full max-w-md">
          <h1 className="text-4xl font-bold text-center mb-2 text-green-800">
            🁣 Domino
          </h1>
          <p className="text-center text-gray-600 mb-8">2 vs 2 Multiplayer</p>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Your Name
              </label>
              <input
                type="text"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                placeholder="Enter your name"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-gray-900"
                maxLength={20}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Game Room
              </label>
              <input
                type="text"
                value={gameId}
                onChange={(e) => setGameId(e.target.value.toUpperCase())}
                placeholder="Enter room code (e.g., GAME1)"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent uppercase text-gray-900"
                maxLength={10}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Team
              </label>
              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={() => setSelectedTeam("team1")}
                  className={`py-3 px-4 rounded-lg font-semibold transition-all ${
                    selectedTeam === "team1"
                      ? "bg-blue-600 text-white shadow-lg scale-105"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  🔵 Team 1
                </button>
                <button
                  onClick={() => setSelectedTeam("team2")}
                  className={`py-3 px-4 rounded-lg font-semibold transition-all ${
                    selectedTeam === "team2"
                      ? "bg-red-600 text-white shadow-lg scale-105"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  🔴 Team 2
                </button>
              </div>
            </div>

            <button
              onClick={joinGame}
              disabled={!playerName.trim() || !gameId.trim()}
              className="w-full py-4 bg-green-600 text-white rounded-lg font-bold text-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              Join Game
            </button>
          </div>

          <div className="mt-6 p-4 bg-gray-100 rounded-lg">
            <p className="text-sm text-gray-600 text-center">
              Share the room code with friends on the same network!
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-900 to-green-700 p-2 md:p-4">
      {/* Error Toast */}
      {error && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-red-500 text-white px-6 py-3 rounded-lg shadow-lg animate-bounce">
          {error}
        </div>
      )}

      {/* Game Header */}
      <div className="bg-white/90 backdrop-blur rounded-xl p-3 mb-3 flex flex-wrap justify-between items-center gap-2">
        <div>
          <h1 className="text-xl font-bold text-green-800">
            🁣 Room: {gameState?.id}
          </h1>
          <p className="text-sm text-gray-600">{gameState?.lastAction}</p>
        </div>
        <div className="flex gap-4">
          <div className="text-center">
            <span className="text-2xl">🔵</span>
            <p className="font-bold text-blue-600">
              Team 1: {gameState?.scores.team1 || 0}
            </p>
          </div>
          <div className="text-center">
            <span className="text-2xl">🔴</span>
            <p className="font-bold text-red-600">
              Team 2: {gameState?.scores.team2 || 0}
            </p>
          </div>
        </div>
      </div>

      {/* Players List */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
        {[0, 1, 2, 3].map((index) => {
          const player = gameState?.players[index];
          const isCurrentTurn = gameState?.currentPlayerIndex === index;
          const isMe = player?.id === socket?.id;

          return (
            <div
              key={index}
              className={`p-3 rounded-lg transition-all ${
                player
                  ? isCurrentTurn
                    ? "bg-yellow-400 shadow-lg scale-105"
                    : player.team === "team1"
                      ? "bg-blue-100"
                      : "bg-red-100"
                  : "bg-gray-200"
              } ${isMe ? "ring-2 ring-green-500" : ""}`}
            >
              {player ? (
                <>
                  <p
                    className={`font-bold truncate ${player.team === "team1" ? "text-blue-700" : "text-red-700"}`}
                  >
                    {isMe ? "👤 " : ""}
                    {player.name}
                  </p>
                  <p className="text-sm text-gray-600">
                    {player.team === "team1" ? "🔵 Team 1" : "🔴 Team 2"}
                  </p>
                  <p className="text-sm">
                    🁢 {player.hand.length} tiles
                    {!player.isConnected && " ⚠️"}
                  </p>
                </>
              ) : (
                <p className="text-gray-500 italic">Waiting...</p>
              )}
            </div>
          );
        })}
      </div>

      {/* Game Board */}
      {gameState?.gamePhase === "waiting" ? (
        <div className="bg-white/90 backdrop-blur rounded-xl p-8 text-center">
          <h2 className="text-2xl font-bold text-gray-800 mb-4">
            Waiting for players... ({gameState.players.length}/4)
          </h2>
          {gameState.players.length === 4 && (
            <button
              onClick={startGame}
              className="px-8 py-4 bg-green-600 text-white rounded-lg font-bold text-xl hover:bg-green-700 transition-colors animate-pulse"
            >
              🎮 Start Game!
            </button>
          )}
        </div>
      ) : gameState?.gamePhase === "finished" ? (
        <div className="bg-white/90 backdrop-blur rounded-xl p-8 text-center">
          <h2 className="text-3xl font-bold text-gray-800 mb-4">
            🎉 Game Over!
          </h2>
          <p className="text-xl mb-4">{gameState.lastAction}</p>
          <div className="flex justify-center gap-8">
            <div className="text-center">
              <p className="text-4xl">🔵</p>
              <p className="text-2xl font-bold text-blue-600">Team 1</p>
              <p className="text-3xl">{gameState.scores.team1} pts</p>
            </div>
            <div className="text-center">
              <p className="text-4xl">🔴</p>
              <p className="text-2xl font-bold text-red-600">Team 2</p>
              <p className="text-3xl">{gameState.scores.team2} pts</p>
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* Board */}
          <div className="bg-green-800/80 backdrop-blur rounded-xl p-4 mb-3 min-h-[150px] overflow-x-auto">
            <div className="flex items-center justify-start gap-1 min-w-max py-2">
              {gameState?.board.length === 0 ? (
                <p className="text-white/60 italic text-center w-full">
                  Board is empty - play a domino!
                </p>
              ) : (
                gameState?.board.map((domino, idx) => (
                  <DominoTile key={`board-${idx}`} domino={domino} horizontal />
                ))
              )}
            </div>
            {gameState && gameState.board.length > 0 && (
              <div className="flex justify-between mt-2 text-white/80 text-sm">
                <span>◀ Left end: {gameState.boardLeftEnd}</span>
                <span>Right end: {gameState.boardRightEnd} ▶</span>
              </div>
            )}
          </div>

          {/* My Hand */}
          {currentPlayer && (
            <div className="bg-white/90 backdrop-blur rounded-xl p-4">
              <div className="flex justify-between items-center mb-3">
                <h3 className="font-bold text-gray-800">
                  Your Hand ({currentPlayer.hand.length} tiles)
                </h3>
                {isMyTurn && (
                  <span className="bg-yellow-400 text-yellow-900 px-3 py-1 rounded-full font-bold animate-pulse">
                    Your Turn!
                  </span>
                )}
              </div>

              <div className="flex flex-wrap gap-2 justify-center mb-4">
                {currentPlayer.hand.map((domino) => {
                  const playableSides = isMyTurn
                    ? getPlayableSides(domino)
                    : [];
                  const isSelected = selectedDomino === domino.id;

                  return (
                    <div key={domino.id} className="relative">
                      <button
                        onClick={() => {
                          if (isMyTurn && playableSides.length > 0) {
                            if (playableSides.length === 1) {
                              playDomino(domino.id, playableSides[0]);
                            } else {
                              setSelectedDomino(isSelected ? null : domino.id);
                            }
                          }
                        }}
                        disabled={!isMyTurn || playableSides.length === 0}
                        className={`transition-all ${
                          isMyTurn && playableSides.length > 0
                            ? "hover:scale-110 cursor-pointer hover:-translate-y-2"
                            : "opacity-50 cursor-not-allowed"
                        } ${isSelected ? "scale-110 -translate-y-3 ring-4 ring-yellow-400 rounded-lg" : ""}`}
                      >
                        <DominoTile domino={domino} />
                      </button>

                      {/* Side selection popup */}
                      {isSelected && (
                        <div className="absolute -top-16 left-1/2 -translate-x-1/2 flex gap-2 bg-white p-2 rounded-lg shadow-xl z-10">
                          {playableSides.includes("left") && (
                            <button
                              onClick={() => playDomino(domino.id, "left")}
                              className="px-3 py-2 bg-blue-500 text-white rounded font-bold hover:bg-blue-600"
                            >
                              ◀ Left
                            </button>
                          )}
                          {playableSides.includes("right") && (
                            <button
                              onClick={() => playDomino(domino.id, "right")}
                              className="px-3 py-2 bg-green-500 text-white rounded font-bold hover:bg-green-600"
                            >
                              Right ▶
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {isMyTurn && canPass && (
                <button
                  onClick={pass}
                  className="w-full py-3 bg-orange-500 text-white rounded-lg font-bold hover:bg-orange-600 transition-colors"
                >
                  😔 Pass (No playable tiles)
                </button>
              )}
            </div>
          )}
        </>
      )}

      {/* Chat */}
      <div className="mt-3 bg-white/90 backdrop-blur rounded-xl p-4">
        <h3 className="font-bold text-gray-800 mb-2">💬 Team Chat</h3>
        <div className="h-24 overflow-y-auto bg-gray-100 rounded p-2 mb-2 text-sm">
          {chatMessages.map((msg, idx) => (
            <p key={idx}>
              <strong className="text-gray-800">{msg.playerName}:</strong>{" "}
              <span className="text-gray-600">{msg.message}</span>
            </p>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && sendChat()}
            placeholder="Type a message..."
            className="flex-1 px-3 py-2 border rounded-lg text-gray-900"
            maxLength={100}
          />
          <button
            onClick={sendChat}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}

// Domino Tile Component
function DominoTile({
  domino,
  horizontal = false,
}: {
  domino: Domino;
  horizontal?: boolean;
}) {
  const dots = (n: number) => {
    const positions: { [key: number]: string[] } = {
      0: [],
      1: ["center"],
      2: ["top-right", "bottom-left"],
      3: ["top-right", "center", "bottom-left"],
      4: ["top-left", "top-right", "bottom-left", "bottom-right"],
      5: ["top-left", "top-right", "center", "bottom-left", "bottom-right"],
      6: [
        "top-left",
        "top-right",
        "middle-left",
        "middle-right",
        "bottom-left",
        "bottom-right",
      ],
    };

    return positions[n] || [];
  };

  const getDotStyle = (pos: string) => {
    const styles: { [key: string]: string } = {
      "top-left": "top-1 left-1",
      "top-right": "top-1 right-1",
      "middle-left": "top-1/2 -translate-y-1/2 left-1",
      "middle-right": "top-1/2 -translate-y-1/2 right-1",
      center: "top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2",
      "bottom-left": "bottom-1 left-1",
      "bottom-right": "bottom-1 right-1",
    };
    return styles[pos] || "";
  };

  const DotSection = ({ value }: { value: number }) => (
    <div
      className={`relative ${horizontal ? "w-8 h-10" : "w-10 h-8"} bg-white`}
    >
      {dots(value).map((pos, idx) => (
        <div
          key={idx}
          className={`absolute w-2 h-2 bg-gray-800 rounded-full ${getDotStyle(pos)}`}
        />
      ))}
    </div>
  );

  return (
    <div
      className={`flex ${horizontal ? "flex-row" : "flex-col"} bg-white border-2 border-gray-800 rounded-lg overflow-hidden shadow-lg`}
    >
      <DotSection value={domino.left} />
      <div
        className={`${horizontal ? "w-0.5 h-10" : "h-0.5 w-10"} bg-gray-800`}
      />
      <DotSection value={domino.right} />
    </div>
  );
}
