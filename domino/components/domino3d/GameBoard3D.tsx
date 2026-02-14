"use client";

import { Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import * as THREE from "three";
import type { Domino, Team } from "../../lib/gameTypes";
import { GameScene } from "./GameScene";
import { BoardBadge, EndLabels, TurnOverlay } from "./Overlays";

export interface GameBoard3DProps {
  board: Domino[];
  boardLeftEnd: number;
  boardRightEnd: number;
  hand: Domino[];
  isMyTurn: boolean;
  getPlayableSides: (d: Domino) => ("left" | "right")[];
  onPlay: (id: string, s: "left" | "right") => void;
  onPass: () => void;
  canPass: boolean;
  topHandCount?: number;
  leftHandCount?: number;
  rightHandCount?: number;
  revealAllHands?: boolean;
  revealTopHand?: Domino[];
  revealLeftHand?: Domino[];
  revealRightHand?: Domino[];
  showTurnOverlay?: boolean;
  activeSeat?: "bottom" | "left" | "top" | "right" | null;
  bottomTeam?: Team | null;
  leftTeam?: Team | null;
  topTeam?: Team | null;
  rightTeam?: Team | null;
}

export function GameBoard3D({
  board,
  boardLeftEnd,
  boardRightEnd,
  hand,
  isMyTurn,
  getPlayableSides,
  onPlay,
  onPass,
  canPass,
  topHandCount = 0,
  leftHandCount = 0,
  rightHandCount = 0,
  revealAllHands = false,
  revealTopHand = [],
  revealLeftHand = [],
  revealRightHand = [],
  showTurnOverlay = true,
  activeSeat = null,
  bottomTeam = null,
  leftTeam = null,
  topTeam = null,
  rightTeam = null,
}: GameBoard3DProps) {
  return (
    <div className="relative w-full rounded-3xl border border-white/10 shadow-2xl bg-linear-to-b from-emerald-900/60 to-emerald-950/80 p-2 h-[50vh] md:h-[65vh] min-h-100 md:min-h-130">
      <div
        className="absolute inset-0 rounded-3xl pointer-events-none"
        style={{ boxShadow: "inset 0 0 120px rgba(0,0,0,.35)" }}
      />
      <Canvas
        shadows
        camera={{ position: [0, 14, 16], fov: 50 }}
        style={{
          borderRadius: 24,
          background: "linear-gradient(180deg,#0a2e1a 0%,#153d25 100%)",
        }}
        gl={{ antialias: true, alpha: false }}
        onCreated={({ gl: r }) => {
          r.setClearColor(new THREE.Color("#0a2e1a"));
          r.toneMapping = THREE.ACESFilmicToneMapping;
          r.toneMappingExposure = 1.2;
        }}
      >
        <Suspense fallback={null}>
          <GameScene
            board={board}
            hand={hand}
            isMyTurn={isMyTurn}
            getPlayableSidesAction={getPlayableSides}
            onPlayAction={onPlay}
            topHandCount={topHandCount}
            leftHandCount={leftHandCount}
            rightHandCount={rightHandCount}
            revealAllHands={revealAllHands}
            revealTopHand={revealTopHand}
            revealLeftHand={revealLeftHand}
            revealRightHand={revealRightHand}
            activeSeat={activeSeat}
            bottomTeam={bottomTeam}
            leftTeam={leftTeam}
            topTeam={topTeam}
            rightTeam={rightTeam}
          />
        </Suspense>
      </Canvas>

      <BoardBadge />
      {showTurnOverlay && (
        <TurnOverlay myTurn={isMyTurn} canPass={canPass} onPass={onPass} />
      )}
      <EndLabels left={boardLeftEnd} right={boardRightEnd} />
      {showTurnOverlay && hand.length > 0 && (
        <div className="absolute bottom-14 left-0 right-0 flex justify-center pointer-events-none">
          <span className="text-white/50 text-sm font-medium backdrop-blur-sm bg-black/20 px-3 py-1 rounded-full">
            Your tiles ({hand.length})
          </span>
        </div>
      )}
    </div>
  );
}
