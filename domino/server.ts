import { createServer } from "http";
import { Server } from "socket.io";
import next from "next";
import {
  GameState,
  Player,
  Domino,
  Team,
  GameMode,
  AIDifficulty,
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

// Device-based session tracking for reconnection
// deviceId -> { playerId, gameId, playerName }
const deviceSessions: Map<
  string,
  { playerId: string; gameId: string; playerName: string }
> = new Map();

// AI Names
const AI_NAMES = ["Bot Alpha", "Bot Beta", "Bot Gamma", "Bot Delta"];

const AI_WEIGHT_PRESETS: Array<
  Record<
    | "board_control"
    | "blocking"
    | "hand_safety"
    | "tempo"
    | "partnership"
    | "prediction",
    number
  >
> = [
  {
    board_control: 0.2014498660662075,
    blocking: 0.24908829220870865,
    hand_safety: 0.24537179204042062,
    tempo: 0.3040900496846632,
    partnership: 0.0,
    prediction: 0.0,
  },
  {
    board_control: 0.25304110495272236,
    blocking: 0.2724435351947136,
    hand_safety: 0.2587932248933106,
    tempo: 0.21572213495925355,
    partnership: 0.0,
    prediction: 0.0,
  },
  {
    board_control: 0.17506381959753758,
    blocking: 0.33263144184289395,
    hand_safety: 0.3333154338599927,
    tempo: 0.15898930469957576,
    partnership: 0.0,
    prediction: 0.0,
  },
  {
    board_control: 0.28163152547688874,
    blocking: 0.23428658809204297,
    hand_safety: 0.22462572462271846,
    tempo: 0.25624735170259827,
    partnership: 0.00320881010575162,
    prediction: 0.0,
  },
];

class LearningAI {
  playerId: string;
  style: "learning";
  difficulty: AIDifficulty;
  trainingEnabled: boolean;
  learningRate: number;
  qTable: Map<string, Map<string, number>>;
  strategyWeights: Record<
    | "board_control"
    | "blocking"
    | "hand_safety"
    | "tempo"
    | "partnership"
    | "prediction",
    number
  >;
  experienceBuffer: Array<{ state: string; action: string }>;
  wins: number;
  losses: number;
  gamesPlayed: number;
  winRateHistory: number[];
  epsilon: number;
  epsilonDecay: number;
  minEpsilon: number;
  qWeight: number;
  heuristicWeight: number;
  predictionWeight: number;
  numberCounts: number[];
  estimatedOpponentHands: Map<string, Domino[]>;

  constructor(
    playerId: string,
    style: "learning" = "learning",
    learningRate = 0.1,
    difficulty: AIDifficulty = "medium",
    trainingEnabled = false,
    weightsOverride?: Record<
      | "board_control"
      | "blocking"
      | "hand_safety"
      | "tempo"
      | "partnership"
      | "prediction",
      number
    >,
  ) {
    this.playerId = playerId;
    this.style = style;
    this.difficulty = difficulty;
    this.trainingEnabled = trainingEnabled;
    this.learningRate = learningRate;
    this.qTable = new Map();
    this.strategyWeights = this.initializeWeights();
    this.experienceBuffer = [];
    this.wins = 0;
    this.losses = 0;
    this.gamesPlayed = 0;
    this.winRateHistory = [];
    this.epsilon = 0.3;
    this.epsilonDecay = 0.995;
    this.minEpsilon = 0.05;
    this.qWeight = 0.6;
    this.heuristicWeight = 0.2;
    this.predictionWeight = 0.2;
    this.numberCounts = [0, 0, 0, 0, 0, 0, 0];
    this.estimatedOpponentHands = new Map();

    if (weightsOverride) {
      this.strategyWeights = weightsOverride;
      this.epsilon = 0.05;
      this.minEpsilon = 0.05;
      this.epsilonDecay = 1;
      this.qWeight = 0;
      this.heuristicWeight = 1;
      this.predictionWeight = 0;
    }
  }

  initializeWeights() {
    const baseWeights = {
      board_control: 0.25 + (Math.random() - 0.5) * 0.2,
      blocking: 0.25 + (Math.random() - 0.5) * 0.2,
      hand_safety: 0.25 + (Math.random() - 0.5) * 0.2,
      tempo: 0.25 + (Math.random() - 0.5) * 0.2,
      partnership: 0.0 + (Math.random() - 0.5) * 0.1,
      prediction: 0.0,
    };
    const total = Object.values(baseWeights).reduce((a, b) => a + b, 0);
    (Object.keys(baseWeights) as Array<keyof typeof baseWeights>).forEach(
      (k) => (baseWeights[k] /= total),
    );
    return baseWeights;
  }

  getStateKey(game: GameState, player: Player): string {
    const boardEmpty = game.board.length === 0;
    const handPoints = player.hand.reduce((s, d) => s + d.left + d.right, 0);
    const doublesInHand = player.hand.filter((d) => d.left === d.right).length;
    const validMoves = getPlayableDominoes(
      player.hand,
      game.boardLeftEnd,
      game.boardRightEnd,
      boardEmpty,
    ).length;
    const leftEnd = boardEmpty ? -1 : game.boardLeftEnd;
    const rightEnd = boardEmpty ? -1 : game.boardRightEnd;
    const stateKey = [
      Math.min(player.hand.length, 7),
      Math.min(Math.floor(handPoints / 7), 10),
      Math.min(doublesInHand, 7),
      leftEnd,
      rightEnd,
      Math.min(Math.floor(game.board.length / 3), 10),
      Math.min(validMoves, 10),
    ].join("|");
    return stateKey;
  }

  analyzeHand(player: Player) {
    this.numberCounts = [0, 0, 0, 0, 0, 0, 0];
    for (const d of player.hand) {
      this.numberCounts[d.left] += 1;
      this.numberCounts[d.right] += 1;
    }
  }

  estimateOpponentHands(game: GameState, player: Player) {
    const allTiles = generateDominoes();
    const knownIds = new Set<string>();

    for (const d of game.board) knownIds.add(d.id);
    for (const d of player.hand) knownIds.add(d.id);

    const partner = game.players.find(
      (p) => p.team === player.team && p.id !== player.id,
    );
    if (partner) {
      for (const d of partner.hand) knownIds.add(d.id);
    }

    const unknown = allTiles.filter((t) => !knownIds.has(t.id));
    const shuffled = shuffle(unknown);

    const opponents = game.players.filter((p) => p.team !== player.team);
    const sizes = new Map(opponents.map((p) => [p.id, p.hand.length]));

    const estimated = new Map<string, Domino[]>();
    opponents.forEach((p) => estimated.set(p.id, []));

    let idx = 0;
    while (idx < shuffled.length) {
      for (const opp of opponents) {
        const left = sizes.get(opp.id) ?? 0;
        if (left > 0 && idx < shuffled.length) {
          estimated.get(opp.id)!.push(shuffled[idx]);
          sizes.set(opp.id, left - 1);
          idx += 1;
        }
        if (idx >= shuffled.length) break;
      }
      if (opponents.length === 0) break;
    }

    this.estimatedOpponentHands = estimated;
  }

  getMoveKey(domino: Domino, side: "left" | "right"): string {
    const a = Math.min(domino.left, domino.right);
    const b = Math.max(domino.left, domino.right);
    return `${a}-${b}-${side}`;
  }

  getOrCreateState(stateKey: string): Map<string, number> {
    const existing = this.qTable.get(stateKey);
    if (existing) return existing;
    const map = new Map<string, number>();
    this.qTable.set(stateKey, map);
    return map;
  }

  evaluateMove(
    game: GameState,
    player: Player,
    domino: Domino,
    side: "left" | "right",
  ): number {
    const boardEmpty = game.board.length === 0;
    const newEnds = getNewEnds(
      boardEmpty,
      game.boardLeftEnd,
      game.boardRightEnd,
      domino,
      side,
    );
    const newHand = player.hand.filter((d) => d.id !== domino.id);

    let score = 0;
    const weights = this.strategyWeights;

    // Board control
    const leftPlayable = newHand.filter(
      (d) => d.left === newEnds.left || d.right === newEnds.left,
    ).length;
    const rightPlayable = newHand.filter(
      (d) => d.left === newEnds.right || d.right === newEnds.right,
    ).length;
    let boardControl = (leftPlayable + rightPlayable) * 10;
    if (leftPlayable > 0 && rightPlayable > 0) boardControl += 20;
    score += boardControl * weights.board_control;

    // Blocking (penalize leaving ends opponents likely have)
    let blocking = 0;
    for (const oppHand of this.estimatedOpponentHands.values()) {
      const oppCount = oppHand.filter(
        (d) =>
          d.left === newEnds.left ||
          d.right === newEnds.left ||
          d.left === newEnds.right ||
          d.right === newEnds.right,
      ).length;
      blocking -= oppCount * 7;
    }
    score += blocking * weights.blocking;

    // Hand safety
    const numbersInHand = new Set<number>();
    newHand.forEach((d) => {
      numbersInHand.add(d.left);
      numbersInHand.add(d.right);
    });
    const handPoints = newHand.reduce((s, d) => s + d.left + d.right, 0);
    let handSafety = numbersInHand.size * 5 - handPoints * 2;
    score += handSafety * weights.hand_safety;

    // Tempo
    let tempo = 0;
    if (domino.left === domino.right) tempo += 15;
    tempo += (domino.left + domino.right) * 2;
    score += tempo * weights.tempo;

    // Partnership
    const partner = game.players.find(
      (p) => p.team === player.team && p.id !== player.id,
    );
    let partnership = 0;
    if (partner) {
      const partnerHand = partner.hand;
      const partnerPlayable = partnerHand.filter(
        (d) =>
          d.left === newEnds.left ||
          d.right === newEnds.left ||
          d.left === newEnds.right ||
          d.right === newEnds.right,
      ).length;
      partnership += partnerPlayable * 6;
    }
    score += partnership * weights.partnership;

    return score;
  }

  evaluatePrediction(
    game: GameState,
    player: Player,
    domino: Domino,
    side: "left" | "right",
  ): number {
    const boardEmpty = game.board.length === 0;
    const newEnds = getNewEnds(
      boardEmpty,
      game.boardLeftEnd,
      game.boardRightEnd,
      domino,
      side,
    );

    const nextIndex = getNextPlayerIndex(game);
    const nextPlayer = game.players[nextIndex];
    if (nextPlayer.team === player.team) return 0;

    const estimated = this.estimatedOpponentHands.get(nextPlayer.id) || [];
    const playable = getPlayableDominoes(
      estimated,
      newEnds.left,
      newEnds.right,
      false,
    );

    if (playable.length === 0) return 25;

    let bestScore = -Infinity;
    for (const move of playable) {
      for (const moveSide of move.sides) {
        let score = 0;
        if (move.domino.left === move.domino.right) score += 10;
        score += move.domino.left + move.domino.right;
        const ends = getNewEnds(
          false,
          newEnds.left,
          newEnds.right,
          move.domino,
          moveSide,
        );
        const countInHand = estimated.filter(
          (d) => d.left === ends.left || d.right === ends.left,
        ).length;
        score += countInHand * 4;
        if (score > bestScore) bestScore = score;
      }
    }

    return -bestScore * 0.5;
  }

  chooseMove(game: GameState, player: Player) {
    this.analyzeHand(player);
    this.estimateOpponentHands(game, player);

    const boardEmpty = game.board.length === 0;
    const playable = getPlayableDominoes(
      player.hand,
      game.boardLeftEnd,
      game.boardRightEnd,
      boardEmpty,
    );
    if (playable.length === 0) return null;

    if (playable.length === 1) {
      const side = playable[0].sides[0];
      return { domino: playable[0].domino, side };
    }

    const stateKey = this.getStateKey(game, player);
    const stateMap = this.getOrCreateState(stateKey);

    if (Math.random() < this.epsilon) {
      const choice = playable[Math.floor(Math.random() * playable.length)];
      const side =
        choice.sides[Math.floor(Math.random() * choice.sides.length)];
      this.experienceBuffer.push({
        state: stateKey,
        action: this.getMoveKey(choice.domino, side),
      });
      return { domino: choice.domino, side };
    }

    let bestScore = -Infinity;
    let bestMove: { domino: Domino; side: "left" | "right" } | null = null;

    for (const option of playable) {
      for (const side of option.sides) {
        const moveKey = this.getMoveKey(option.domino, side);
        const qValue = stateMap.get(moveKey) ?? 0;
        const heuristic = this.evaluateMove(game, player, option.domino, side);
        const prediction = this.evaluatePrediction(
          game,
          player,
          option.domino,
          side,
        );
        const combined =
          this.qWeight * qValue +
          this.heuristicWeight * heuristic +
          this.predictionWeight * prediction;
        if (combined > bestScore) {
          bestScore = combined;
          bestMove = { domino: option.domino, side };
        }
      }
    }

    const finalMove = bestMove ?? {
      domino: playable[0].domino,
      side: playable[0].sides[0],
    };

    this.experienceBuffer.push({
      state: stateKey,
      action: this.getMoveKey(finalMove.domino, finalMove.side),
    });

    return finalMove;
  }

  learnFromGame(game: GameState, result: "win" | "loss" | "draw") {
    if (!this.trainingEnabled) return;
    this.gamesPlayed += 1;

    const winningPoints =
      game.winner === "team1"
        ? game.scores.team1
        : game.winner === "team2"
          ? game.scores.team2
          : 0;

    let finalReward = 0;
    if (result === "win") {
      this.wins += 1;
      finalReward = winningPoints;
    } else if (result === "loss") {
      this.losses += 1;
      finalReward = -winningPoints;
    }

    const winRate = this.gamesPlayed > 0 ? this.wins / this.gamesPlayed : 0;
    this.winRateHistory.push(winRate);

    let discounted = finalReward;
    const discountFactor = 0.95;

    for (let i = this.experienceBuffer.length - 1; i >= 0; i -= 1) {
      const exp = this.experienceBuffer[i];
      const stateMap = this.getOrCreateState(exp.state);
      const oldQ = stateMap.get(exp.action) ?? 0;
      const updated = oldQ + this.learningRate * (discounted - oldQ);
      stateMap.set(exp.action, updated);
      discounted *= discountFactor;
    }

    this.experienceBuffer = [];
    this.epsilon = Math.max(this.minEpsilon, this.epsilon * this.epsilonDecay);
  }
}

const learningAIs: Map<string, LearningAI> = new Map();

function createGame(
  gameId: string,
  gameMode: GameMode = "multiplayer",
  aiDifficulty: AIDifficulty = "medium",
): GameState {
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
    gameMode,
    aiDifficulty,
  };
}

function createAIPlayer(
  name: string,
  team: Team,
  difficulty: AIDifficulty,
): Player {
  const player: Player = {
    id: `ai-${uuidv4()}`,
    name,
    team,
    hand: [],
    isReady: true,
    isConnected: true,
    isAI: true,
    aiDifficulty: difficulty,
  };

  const presetIndex = AI_NAMES.indexOf(name);
  const weightsOverride =
    presetIndex >= 0 ? AI_WEIGHT_PRESETS[presetIndex] : undefined;
  learningAIs.set(
    player.id,
    new LearningAI(
      player.id,
      "learning",
      0.1,
      difficulty,
      false,
      weightsOverride,
    ),
  );
  return player;
}

function dealDominoes(game: GameState): void {
  const allDominoes = shuffle(generateDominoes());

  // Each player gets 7 dominoes
  game.players.forEach((player, index) => {
    player.hand = allDominoes.slice(index * 7, (index + 1) * 7);
  });
}

function resetRound(game: GameState): void {
  (game as any)._lastWinner = game.winner;
  game.board = [];
  game.boardLeftEnd = -1;
  game.boardRightEnd = -1;
  game.passCount = 0;
  game.winner = null;
  game.players.forEach((player) => {
    player.hand = [];
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

function getNewEnds(
  boardEmpty: boolean,
  leftEnd: number,
  rightEnd: number,
  domino: Domino,
  side: "left" | "right",
): { left: number; right: number } {
  if (boardEmpty) {
    return { left: domino.left, right: domino.right };
  }
  if (side === "left") {
    const newLeft = domino.right === leftEnd ? domino.left : domino.right;
    return { left: newLeft, right: rightEnd };
  }
  const newRight = domino.left === rightEnd ? domino.right : domino.left;
  return { left: leftEnd, right: newRight };
}

function updateLearningOnGameEnd(game: GameState) {
  if (!game.winner) return;

  for (const player of game.players) {
    if (!player.isAI) continue;
    const ai = learningAIs.get(player.id);
    if (!ai) continue;

    let result: "win" | "loss" | "draw" = "draw";
    if (game.winner === "draw") {
      result = "draw";
    } else if (player.team === game.winner) {
      result = "win";
    } else {
      result = "loss";
    }
    ai.learnFromGame(game, result);
  }
}

function checkGameOver(game: GameState): boolean {
  // Check if current player has no dominoes
  const currentPlayer = game.players[game.currentPlayerIndex];
  if (currentPlayer.hand.length === 0) {
    game.gamePhase = "finished";
    game.winner = currentPlayer.team;

    const winningPoints = game.players
      .filter((p) => p.team !== currentPlayer.team)
      .reduce((sum, p) => sum + calculateHandScore(p.hand), 0);

    const currentScores = game.scores ?? { team1: 0, team2: 0 };
    game.scores =
      currentPlayer.team === "team1"
        ? {
            team1: currentScores.team1 + winningPoints,
            team2: currentScores.team2,
          }
        : {
            team1: currentScores.team1,
            team2: currentScores.team2 + winningPoints,
          };
    game.lastAction = `${currentPlayer.name} wins! ${currentPlayer.team === "team1" ? "Team 1" : "Team 2"} wins the round!`;
    updateLearningOnGameEnd(game);
    return true;
  }

  // Check if game is blocked (all players passed)
  if (game.passCount >= 4) {
    game.gamePhase = "finished";

    const playerTotals = game.players.map((p) => ({
      id: p.id,
      team: p.team,
      total: calculateHandScore(p.hand),
    }));

    const minTotal = Math.min(...playerTotals.map((p) => p.total));
    const minPlayers = playerTotals.filter((p) => p.total === minTotal);

    if (minPlayers.length > 1) {
      const teams = new Set(minPlayers.map((p) => p.team));
      game.winner = teams.size === 1 ? minPlayers[0].team : "draw";
    } else {
      game.winner = minPlayers[0].team;
    }

    if (game.winner === "draw") {
      game.scores = game.scores ?? { team1: 0, team2: 0 };
    } else {
      const winnerPlayerId = minPlayers[0]?.id;
      const winningPoints = playerTotals
        .filter((p) => p.id !== winnerPlayerId)
        .reduce((sum, p) => sum + p.total, 0);
      const currentScores = game.scores ?? { team1: 0, team2: 0 };
      game.scores =
        game.winner === "team1"
          ? {
              team1: currentScores.team1 + winningPoints,
              team2: currentScores.team2,
            }
          : {
              team1: currentScores.team1,
              team2: currentScores.team2 + winningPoints,
            };
    }

    game.lastAction = `Game blocked! ${game.winner === "draw" ? "It's a draw!" : `${game.winner === "team1" ? "Team 1" : "Team 2"} wins!`}`;
    updateLearningOnGameEnd(game);
    return true;
  }

  return false;
}

// AI Logic Functions
function getPlayableDominoes(
  hand: Domino[],
  leftEnd: number,
  rightEnd: number,
  boardEmpty: boolean,
): { domino: Domino; sides: ("left" | "right")[] }[] {
  const playable: { domino: Domino; sides: ("left" | "right")[] }[] = [];

  for (const domino of hand) {
    const { canPlay, sides } = canPlayDomino(
      domino,
      leftEnd,
      rightEnd,
      boardEmpty,
    );
    if (canPlay) {
      playable.push({ domino, sides });
    }
  }

  return playable;
}

function aiSelectMove(
  game: GameState,
  player: Player,
): { domino: Domino; side: "left" | "right" } | null {
  const boardEmpty = game.board.length === 0;
  const playable = getPlayableDominoes(
    player.hand,
    game.boardLeftEnd,
    game.boardRightEnd,
    boardEmpty,
  );

  if (playable.length === 0) return null;

  const difficulty = player.aiDifficulty || "medium";

  const learningAI = learningAIs.get(player.id);
  if (learningAI) {
    return learningAI.chooseMove(game, player);
  }

  // Hard: Strategic play
  // 1. Play doubles first
  // 2. Try to match numbers that appear frequently in hand (control the game)
  // 3. Avoid leaving opponent with easy plays
  // 4. Keep variety in hand

  const numberCounts: number[] = [0, 0, 0, 0, 0, 0, 0];
  for (const d of player.hand) {
    numberCounts[d.left]++;
    numberCounts[d.right]++;
  }

  let bestScore = -Infinity;
  let bestChoice: { domino: Domino; side: "left" | "right" } | null = null;

  for (const { domino, sides } of playable) {
    for (const side of sides) {
      let score = 0;

      // Prefer doubles
      if (domino.left === domino.right) {
        score += 20;
      }

      // Prefer high pip count (get rid of heavy tiles)
      score += (domino.left + domino.right) * 2;

      // Calculate what end we'd leave
      let newEnd: number;
      if (boardEmpty) {
        newEnd = side === "left" ? domino.left : domino.right;
      } else if (side === "left") {
        newEnd =
          domino.right === game.boardLeftEnd ? domino.left : domino.right;
      } else {
        newEnd =
          domino.left === game.boardRightEnd ? domino.right : domino.left;
      }

      // Prefer leaving numbers we have more of
      score += numberCounts[newEnd] * 5;

      if (score > bestScore) {
        bestScore = score;
        bestChoice = { domino, side };
      }
    }
  }

  return bestChoice;
}

// Process AI turn
function processAITurn(
  game: GameState,
  io: Server<ClientToServerEvents, ServerToClientEvents>,
): void {
  const currentPlayer = game.players[game.currentPlayerIndex];

  if (!currentPlayer.isAI || game.gamePhase !== "playing") return;

  // Add delay to make it feel more natural
  setTimeout(
    () => {
      const move = aiSelectMove(game, currentPlayer);

      if (move) {
        // Play the domino
        const { domino, side } = move;
        const dominoIndex = currentPlayer.hand.findIndex(
          (d) => d.id === domino.id,
        );
        currentPlayer.hand.splice(dominoIndex, 1);

        const boardEmpty = game.board.length === 0;

        if (boardEmpty) {
          game.board.push(domino);
          game.boardLeftEnd = domino.left;
          game.boardRightEnd = domino.right;
        } else if (side === "left") {
          if (domino.right === game.boardLeftEnd) {
            game.board.unshift(domino);
            game.boardLeftEnd = domino.left;
          } else {
            const flipped = {
              ...domino,
              left: domino.right,
              right: domino.left,
            };
            game.board.unshift(flipped);
            game.boardLeftEnd = flipped.left;
          }
        } else {
          if (domino.left === game.boardRightEnd) {
            game.board.push(domino);
            game.boardRightEnd = domino.right;
          } else {
            const flipped = {
              ...domino,
              left: domino.right,
              right: domino.left,
            };
            game.board.push(flipped);
            game.boardRightEnd = flipped.right;
          }
        }

        game.passCount = 0;
        game.lastAction = `${currentPlayer.name} played [${domino.left}|${domino.right}]`;
      } else {
        // AI must pass
        game.passCount++;
        game.lastAction = `${currentPlayer.name} passed`;
      }

      if (!checkGameOver(game)) {
        game.currentPlayerIndex = getNextPlayerIndex(game);
        game.lastAction += ` - ${game.players[game.currentPlayerIndex].name}'s turn`;

        io.to(game.id).emit("gameState", game);

        // If next player is also AI, process their turn
        if (game.players[game.currentPlayerIndex].isAI) {
          processAITurn(game, io);
        }
      } else {
        io.to(game.id).emit("gameState", game);
        io.to(game.id).emit("gameOver", game.winner!, game.scores);
      }
    },
    800 + Math.random() * 700,
  ); // Random delay between 0.8-1.5 seconds
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

    // Reconnect handler – client sends its deviceId, server finds their session
    socket.on("reconnectGame", ({ deviceId }) => {
      if (!deviceId) {
        socket.emit("error", "No device ID provided.");
        return;
      }

      const session = deviceSessions.get(deviceId);
      if (!session) {
        socket.emit("error", "No active session found for this device.");
        return;
      }

      const game = games.get(session.gameId);
      if (!game) {
        deviceSessions.delete(deviceId);
        socket.emit("error", "Game no longer exists.");
        return;
      }

      const player = game.players.find((p) => p.id === session.playerId);
      if (!player) {
        deviceSessions.delete(deviceId);
        socket.emit("error", "Player no longer in game.");
        return;
      }

      // Swap old socket id with new one
      const oldSocketId = player.id;
      player.id = socket.id;
      player.isConnected = true;
      session.playerId = socket.id;

      playerSockets.delete(oldSocketId);
      playerSockets.set(socket.id, player.id);

      socket.join(session.gameId);
      game.lastAction = `${player.name} reconnected`;
      console.log(
        `[Reconnect] ${player.name} (device=${deviceId}) rejoined game ${session.gameId}`,
      );

      socket.emit("reconnected", {
        gameId: session.gameId,
        playerName: player.name,
      });
      io.to(session.gameId).emit("gameState", game);

      // If it's this player's turn and they're not AI, they can now play
      if (
        game.gamePhase === "playing" &&
        game.players[game.currentPlayerIndex]?.id === socket.id &&
        !player.isAI
      ) {
        // Nothing extra needed – the client will see the gameState and can act
      }
    });

    // Create AI Game handler
    socket.on(
      "createAIGame",
      ({ gameId, playerName, team, gameMode, aiDifficulty, deviceId }) => {
        let game = games.get(gameId);

        if (game) {
          socket.emit(
            "error",
            "Game room already exists! Try a different code.",
          );
          return;
        }

        game = createGame(gameId, gameMode, aiDifficulty);
        games.set(gameId, game);

        // Create the human player
        const humanPlayer: Player = {
          id: socket.id,
          name: playerName,
          team,
          hand: [],
          isReady: true,
          isConnected: true,
          isAI: false,
        };

        game.players.push(humanPlayer);
        playerSockets.set(socket.id, humanPlayer.id);

        // Store device session for reconnection
        if (deviceId) {
          deviceSessions.set(deviceId, {
            playerId: socket.id,
            gameId,
            playerName,
          });
        }

        // Add AI players based on game mode
        if (gameMode === "vs-ai") {
          // Human + AI partner vs 2 AI opponents
          const partnerTeam = team;
          const opponentTeam: Team = team === "team1" ? "team2" : "team1";

          // Add AI partner
          game.players.push(
            createAIPlayer(AI_NAMES[0], partnerTeam, aiDifficulty),
          );
          // Add AI opponents
          game.players.push(
            createAIPlayer(AI_NAMES[1], opponentTeam, aiDifficulty),
          );
          game.players.push(
            createAIPlayer(AI_NAMES[2], opponentTeam, aiDifficulty),
          );
        } else if (gameMode === "with-ai-partner") {
          // Human + AI partner - waiting for 2 more human players
          game.players.push(createAIPlayer(AI_NAMES[0], team, aiDifficulty));
        }

        // Reorder players: T1P1, T2P1, T1P2, T2P2
        const team1Players = game.players.filter((p) => p.team === "team1");
        const team2Players = game.players.filter((p) => p.team === "team2");
        game.players = [];
        for (let i = 0; i < 2; i++) {
          if (team1Players[i]) game.players.push(team1Players[i]);
          if (team2Players[i]) game.players.push(team2Players[i]);
        }

        socket.join(gameId);
        game.lastAction = `${playerName} created ${gameMode === "vs-ai" ? "AI Game" : "game with AI partner"}`;

        io.to(gameId).emit("gameState", game);
        console.log(`${playerName} created AI game ${gameId} (${gameMode})`);
      },
    );

    socket.on("joinGame", ({ gameId, playerName, team, deviceId }) => {
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
        isAI: false,
      };

      game.players.push(player);
      playerSockets.set(socket.id, player.id);

      // Store device session for reconnection
      if (deviceId) {
        deviceSessions.set(deviceId, {
          playerId: socket.id,
          gameId,
          playerName,
        });
      }

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

      if (game.gamePhase === "finished") {
        resetRound(game);
      } else if (game.gamePhase !== "waiting") {
        socket.emit("error", "Game already started!");
        return;
      }

      // Deal dominoes
      dealDominoes(game);

      // If a team won the last round, the first player on that team starts (can play any tile)
      const lastWinner = (game as any)._lastWinner as Team | "draw" | null;
      if (lastWinner && lastWinner !== "draw") {
        const firstWinnerIdx = game.players.findIndex(
          (p) => p.team === lastWinner,
        );
        game.currentPlayerIndex =
          firstWinnerIdx >= 0 ? firstWinnerIdx : findStartingPlayer(game);
      } else {
        game.currentPlayerIndex = findStartingPlayer(game);
      }
      (game as any)._lastWinner = null;
      game.gamePhase = "playing";
      game.lastAction = `Game started! ${game.players[game.currentPlayerIndex].name}'s turn`;

      io.to(gameId).emit("gameStarted", game);
      io.to(gameId).emit("gameState", game);

      // If starting player is AI, process their turn
      if (game.players[game.currentPlayerIndex].isAI) {
        processAITurn(game, io);
      }
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
      } else if (game.players[game.currentPlayerIndex].isAI) {
        // Trigger AI turn
        processAITurn(game, io);
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
      } else if (game.players[game.currentPlayerIndex].isAI) {
        // Trigger AI turn
        processAITurn(game, io);
      }
    });

    socket.on("addAIPlayer", ({ gameId, team, difficulty }) => {
      console.log(
        `[Server] addAIPlayer request: gameId=${gameId}, team=${team}, diff=${difficulty}`,
      );
      const game = games.get(gameId);
      if (!game) {
        socket.emit("error", "Game not found!");
        return;
      }

      // Clear disconnected humans in lobby to free seats
      if (game.gamePhase === "waiting") {
        game.players = game.players.filter((p) => p.isConnected || p.isAI);
      }

      if (game.gamePhase !== "waiting") {
        socket.emit("error", "Cannot add AI during active game!");
        return;
      }

      if (game.players.length >= 4) {
        socket.emit("error", "Lobby is full!");
        return;
      }

      // Determine team if not specified
      let targetTeam: Team = team || "team1";
      if (!team) {
        const team1Count = game.players.filter(
          (p) => p.team === "team1",
        ).length;
        const team2Count = game.players.filter(
          (p) => p.team === "team2",
        ).length;
        targetTeam = team1Count <= team2Count ? "team1" : "team2";
      }

      // Validate team has space (max 2 per team)
      const teamCount = game.players.filter(
        (p) => p.team === targetTeam,
      ).length;
      if (teamCount >= 2) {
        // Try other team
        targetTeam = targetTeam === "team1" ? "team2" : "team1";
        if (game.players.filter((p) => p.team === targetTeam).length >= 2) {
          socket.emit("error", "Both teams are full!");
          return;
        }
      }

      // Pick a unique AI Name
      const usedNames = new Set(game.players.map((p) => p.name));
      const availableNames = AI_NAMES.filter((n) => !usedNames.has(n));
      const aiName =
        availableNames[0] || `Bot ${Math.floor(Math.random() * 1000)}`;

      const aiDifficulty = difficulty ?? game.aiDifficulty ?? "medium";
      const newBot = createAIPlayer(aiName, targetTeam, aiDifficulty);
      game.players.push(newBot);

      // Re-sort players to maintain turn order T1, T2, T1, T2
      const team1Players = game.players.filter((p) => p.team === "team1");
      const team2Players = game.players.filter((p) => p.team === "team2");
      game.players = [];
      for (let i = 0; i < 2; i++) {
        if (team1Players[i]) game.players.push(team1Players[i]);
        if (team2Players[i]) game.players.push(team2Players[i]);
      }

      game.lastAction = `${newBot.name} (AI) added to ${targetTeam === "team1" ? "Team 1" : "Team 2"}`;
      io.to(gameId).emit("gameState", game);
    });

    socket.on("autoFillAI", ({ gameId, difficulty }) => {
      console.log(
        `[Server] autoFillAI request: gameId=${gameId}, diff=${difficulty}`,
      );
      const game = games.get(gameId);
      if (!game) {
        socket.emit("error", "Game not found!");
        return;
      }

      if (game.gamePhase !== "waiting") {
        socket.emit("error", "Cannot add AI during active game!");
        return;
      }

      // Clear disconnected humans to free seats
      game.players = game.players.filter((p) => p.isConnected || p.isAI);

      const diff = difficulty ?? game.aiDifficulty ?? "medium";
      let added = 0;

      while (game.players.length < 4) {
        // Pick team with fewer players
        const t1 = game.players.filter((p) => p.team === "team1").length;
        const t2 = game.players.filter((p) => p.team === "team2").length;
        let targetTeam: Team;
        if (t1 <= t2 && t1 < 2) targetTeam = "team1";
        else if (t2 < 2) targetTeam = "team2";
        else break;

        const usedNames = new Set(game.players.map((p) => p.name));
        const availableNames = AI_NAMES.filter((n) => !usedNames.has(n));
        const aiName =
          availableNames[0] || `Bot ${Math.floor(Math.random() * 1000)}`;
        const newBot = createAIPlayer(aiName, targetTeam, diff);
        game.players.push(newBot);
        added++;
      }

      // Re-sort players: T1, T2, T1, T2
      const team1Players = game.players.filter((p) => p.team === "team1");
      const team2Players = game.players.filter((p) => p.team === "team2");
      game.players = [];
      for (let i = 0; i < 2; i++) {
        if (team1Players[i]) game.players.push(team1Players[i]);
        if (team2Players[i]) game.players.push(team2Players[i]);
      }

      game.lastAction =
        added > 0
          ? `${added} AI player${added > 1 ? "s" : ""} added to the lobby`
          : "Lobby is already full";
      io.to(gameId).emit("gameState", game);
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

      // Find and mark player as disconnected (keep deviceSession so they can reconnect)
      games.forEach((game, gameId) => {
        const player = game.players.find((p) => p.id === socket.id);
        if (player) {
          player.isConnected = false;
          game.lastAction = `${player.name} disconnected`;
          io.to(gameId).emit("gameState", game);

          // If the game is finished or all humans disconnected in waiting phase, clean up sessions
          const allHumansDisconnected = game.players
            .filter((p) => !p.isAI)
            .every((p) => !p.isConnected);
          if (
            game.gamePhase === "finished" ||
            (game.gamePhase === "waiting" && allHumansDisconnected)
          ) {
            // Clean up device sessions for this game
            for (const [devId, session] of deviceSessions) {
              if (session.gameId === gameId) {
                deviceSessions.delete(devId);
              }
            }
          }
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
