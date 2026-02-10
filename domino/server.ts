import { createServer } from "http";
import { Server } from "socket.io";
import next from "next";
import {
  GameState,
  Player,
  Domino,
  Team,
  generateDominoes,
  shuffle,
  canPlayDomino,
  calculateHandScore,
  ServerToClientEvents,
  ClientToServerEvents,
} from "./lib/gameTypes";
import { v4 as uuidv4 } from "uuid";

const dev = process.env.NODE_ENV !== "production";
const hostname = "0.0.0.0";
const port = parseInt(process.env.PORT || "3000", 10);

const app = next({ dev, hostname, port });
const handler = app.getRequestHandler();

// Store all games
const games: Map<string, GameState> = new Map();
const playerSockets: Map<string, string> = new Map(); // socketId -> playerId

function createGame(gameId: string): GameState {
  return {
    id: gameId,
    players: [],
    board: [],
    boardLeftEnd: -1,
    boardRightEnd: -1,
    currentPlayerIndex: 0,
    gamePhase: "waiting",
    winner: null,
    lastAction: "Waiting for players...",
    passCount: 0,
    scores: { team1: 0, team2: 0 },
  };
}

function dealDominoes(game: GameState): void {
  const allDominoes = shuffle(generateDominoes());

  // Each player gets 7 dominoes
  game.players.forEach((player, index) => {
    player.hand = allDominoes.slice(index * 7, (index + 1) * 7);
  });
}

function findStartingPlayer(game: GameState): number {
  // Find player with double 6, then double 5, etc.
  for (let double = 6; double >= 0; double--) {
    for (let i = 0; i < game.players.length; i++) {
      const hasDouble = game.players[i].hand.some(
        (d) => d.left === double && d.right === double,
      );
      if (hasDouble) {
        return i;
      }
    }
  }
  return 0;
}

function getNextPlayerIndex(game: GameState): number {
  // Players sit in order: Team1-P1, Team2-P1, Team1-P2, Team2-P2
  // So next player is always (current + 1) % 4
  return (game.currentPlayerIndex + 1) % 4;
}

function checkGameOver(game: GameState): boolean {
  // Check if current player has no dominoes
  const currentPlayer = game.players[game.currentPlayerIndex];
  if (currentPlayer.hand.length === 0) {
    game.gamePhase = "finished";
    game.winner = currentPlayer.team;

    // Calculate scores
    const team1Score = game.players
      .filter((p) => p.team === "team2")
      .reduce((sum, p) => sum + calculateHandScore(p.hand), 0);
    const team2Score = game.players
      .filter((p) => p.team === "team1")
      .reduce((sum, p) => sum + calculateHandScore(p.hand), 0);

    game.scores = { team1: team1Score, team2: team2Score };
    game.lastAction = `${currentPlayer.name} wins! ${currentPlayer.team === "team1" ? "Team 1" : "Team 2"} wins the round!`;
    return true;
  }

  // Check if game is blocked (all players passed)
  if (game.passCount >= 4) {
    game.gamePhase = "finished";

    // Calculate scores for each team
    const team1Total = game.players
      .filter((p) => p.team === "team1")
      .reduce((sum, p) => sum + calculateHandScore(p.hand), 0);
    const team2Total = game.players
      .filter((p) => p.team === "team2")
      .reduce((sum, p) => sum + calculateHandScore(p.hand), 0);

    if (team1Total < team2Total) {
      game.winner = "team1";
      game.scores = { team1: team2Total, team2: 0 };
    } else if (team2Total < team1Total) {
      game.winner = "team2";
      game.scores = { team1: 0, team2: team1Total };
    } else {
      game.winner = "draw";
      game.scores = { team1: 0, team2: 0 };
    }

    game.lastAction = `Game blocked! ${game.winner === "draw" ? "It's a draw!" : `${game.winner === "team1" ? "Team 1" : "Team 2"} wins!`}`;
    return true;
  }

  return false;
}

app.prepare().then(() => {
  const httpServer = createServer(handler);

  const io = new Server<ClientToServerEvents, ServerToClientEvents>(
    httpServer,
    {
      cors: {
        origin: "*",
        methods: ["GET", "POST"],
      },
    },
  );

  io.on("connection", (socket) => {
    console.log(`Client connected: ${socket.id}`);

    socket.on("joinGame", ({ gameId, playerName, team }) => {
      let game = games.get(gameId);

      if (!game) {
        game = createGame(gameId);
        games.set(gameId, game);
      }

      // Check if team is full (max 2 per team)
      const teamPlayers = game.players.filter((p) => p.team === team);
      if (teamPlayers.length >= 2) {
        socket.emit("error", `Team ${team === "team1" ? "1" : "2"} is full!`);
        return;
      }

      if (game.players.length >= 4) {
        socket.emit("error", "Game is full!");
        return;
      }

      if (game.gamePhase !== "waiting") {
        socket.emit("error", "Game already started!");
        return;
      }

      const player: Player = {
        id: socket.id,
        name: playerName,
        team,
        hand: [],
        isReady: true,
        isConnected: true,
      };

      game.players.push(player);
      playerSockets.set(socket.id, player.id);

      // Sort players: team1, team2, team1, team2
      game.players.sort((a, b) => {
        if (a.team === b.team) return 0;
        const aIndex = game!.players
          .filter((p) => p.team === a.team)
          .indexOf(a);
        const bIndex = game!.players
          .filter((p) => p.team === b.team)
          .indexOf(b);
        if (aIndex !== bIndex) return aIndex - bIndex;
        return a.team === "team1" ? -1 : 1;
      });

      // Reorder: T1P1, T2P1, T1P2, T2P2
      const team1Players = game.players.filter((p) => p.team === "team1");
      const team2Players = game.players.filter((p) => p.team === "team2");
      game.players = [];
      for (let i = 0; i < 2; i++) {
        if (team1Players[i]) game.players.push(team1Players[i]);
        if (team2Players[i]) game.players.push(team2Players[i]);
      }

      socket.join(gameId);
      game.lastAction = `${playerName} joined ${team === "team1" ? "Team 1" : "Team 2"}`;

      io.to(gameId).emit("gameState", game);
      console.log(`${playerName} joined game ${gameId} on ${team}`);
    });

    socket.on("startGame", (gameId) => {
      const game = games.get(gameId);
      if (!game) {
        socket.emit("error", "Game not found!");
        return;
      }

      if (game.players.length !== 4) {
        socket.emit("error", "Need 4 players to start!");
        return;
      }

      if (game.gamePhase !== "waiting") {
        socket.emit("error", "Game already started!");
        return;
      }

      // Deal dominoes
      dealDominoes(game);

      // Find starting player (highest double)
      game.currentPlayerIndex = findStartingPlayer(game);
      game.gamePhase = "playing";
      game.lastAction = `Game started! ${game.players[game.currentPlayerIndex].name}'s turn`;

      io.to(gameId).emit("gameStarted", game);
      io.to(gameId).emit("gameState", game);
    });

    socket.on("playDomino", ({ gameId, dominoId, side }) => {
      const game = games.get(gameId);
      if (!game) {
        socket.emit("error", "Game not found!");
        return;
      }

      const playerIndex = game.players.findIndex((p) => p.id === socket.id);
      if (playerIndex === -1) {
        socket.emit("error", "You are not in this game!");
        return;
      }

      if (playerIndex !== game.currentPlayerIndex) {
        socket.emit("error", "It's not your turn!");
        return;
      }

      const player = game.players[playerIndex];
      const dominoIndex = player.hand.findIndex((d) => d.id === dominoId);
      if (dominoIndex === -1) {
        socket.emit("error", "Domino not in your hand!");
        return;
      }

      const domino = player.hand[dominoIndex];
      const boardEmpty = game.board.length === 0;
      const { canPlay, sides } = canPlayDomino(
        domino,
        game.boardLeftEnd,
        game.boardRightEnd,
        boardEmpty,
      );

      if (!canPlay) {
        socket.emit("error", "Cannot play this domino!");
        return;
      }

      if (!boardEmpty && !sides.includes(side)) {
        socket.emit("error", `Cannot play on ${side} side!`);
        return;
      }

      // Remove domino from hand
      player.hand.splice(dominoIndex, 1);

      // Add to board
      if (boardEmpty) {
        game.board.push(domino);
        game.boardLeftEnd = domino.left;
        game.boardRightEnd = domino.right;
      } else if (side === "left") {
        // Orient domino correctly
        if (domino.right === game.boardLeftEnd) {
          game.board.unshift(domino);
          game.boardLeftEnd = domino.left;
        } else {
          // Flip domino
          const flipped = { ...domino, left: domino.right, right: domino.left };
          game.board.unshift(flipped);
          game.boardLeftEnd = flipped.left;
        }
      } else {
        // Right side
        if (domino.left === game.boardRightEnd) {
          game.board.push(domino);
          game.boardRightEnd = domino.right;
        } else {
          // Flip domino
          const flipped = { ...domino, left: domino.right, right: domino.left };
          game.board.push(flipped);
          game.boardRightEnd = flipped.right;
        }
      }

      game.passCount = 0;
      game.lastAction = `${player.name} played [${domino.left}|${domino.right}]`;

      // Check game over
      if (!checkGameOver(game)) {
        game.currentPlayerIndex = getNextPlayerIndex(game);
        game.lastAction += ` - ${game.players[game.currentPlayerIndex].name}'s turn`;
      }

      io.to(gameId).emit("gameState", game);

      if (game.gamePhase === "finished") {
        io.to(gameId).emit("gameOver", game.winner!, game.scores);
      }
    });

    socket.on("pass", (gameId) => {
      const game = games.get(gameId);
      if (!game) {
        socket.emit("error", "Game not found!");
        return;
      }

      const playerIndex = game.players.findIndex((p) => p.id === socket.id);
      if (playerIndex === -1 || playerIndex !== game.currentPlayerIndex) {
        socket.emit("error", "It's not your turn!");
        return;
      }

      const player = game.players[playerIndex];

      // Check if player has any playable domino
      const boardEmpty = game.board.length === 0;
      const hasPlayable = player.hand.some(
        (d) =>
          canPlayDomino(d, game.boardLeftEnd, game.boardRightEnd, boardEmpty)
            .canPlay,
      );

      if (hasPlayable) {
        socket.emit("error", "You have a playable domino!");
        return;
      }

      game.passCount++;
      game.lastAction = `${player.name} passed`;

      if (!checkGameOver(game)) {
        game.currentPlayerIndex = getNextPlayerIndex(game);
        game.lastAction += ` - ${game.players[game.currentPlayerIndex].name}'s turn`;
      }

      io.to(gameId).emit("gameState", game);

      if (game.gamePhase === "finished") {
        io.to(gameId).emit("gameOver", game.winner!, game.scores);
      }
    });

    socket.on("sendChat", ({ gameId, message }) => {
      const game = games.get(gameId);
      if (!game) return;

      const player = game.players.find((p) => p.id === socket.id);
      if (!player) return;

      io.to(gameId).emit("chatMessage", { playerName: player.name, message });
    });

    socket.on("disconnect", () => {
      console.log(`Client disconnected: ${socket.id}`);

      // Find and mark player as disconnected
      games.forEach((game, gameId) => {
        const player = game.players.find((p) => p.id === socket.id);
        if (player) {
          player.isConnected = false;
          game.lastAction = `${player.name} disconnected`;
          io.to(gameId).emit("gameState", game);
        }
      });

      playerSockets.delete(socket.id);
    });
  });

  httpServer
    .once("error", (err) => {
      console.error(err);
      process.exit(1);
    })
    .listen(port, () => {
      console.log(`> Ready on http://${hostname}:${port}`);
      console.log(`> Local network access: http://YOUR_LOCAL_IP:${port}`);
    });
});
