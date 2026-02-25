"use client";

import React, { Suspense, useCallback, memo } from "react";
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

function GameBoard3DComponent({
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
  const handleCreated = useCallback(({ gl }: { gl: THREE.WebGLRenderer }) => {
    gl.setPixelRatio(1);
    gl.outputColorSpace = THREE.SRGBColorSpace;
    gl.toneMapping = THREE.NoToneMapping;
  }, []);

  return (
    <div className="board-wrapper relative w-full rounded-xl sm:rounded-2xl md:rounded-3xl border border-white/10 shadow-2xl bg-gradient-to-b from-emerald-900/60 to-emerald-950/80 p-0.5 sm:p-1 md:p-2 h-[50vh] sm:h-[55vh] md:h-[65vh] landscape:h-[70vh] min-h-60 sm:min-h-75 md:min-h-130">
      {/* Soft inner shadow */}
      <div
        className="absolute inset-0 rounded-3xl pointer-events-none"
        style={{ boxShadow: "inset 0 0 120px rgba(0,0,0,.35)" }}
      />

      <Canvas
        shadows={false}
        dpr={[1, 1]}
        camera={{ position: [0, 12, 14], fov: 45 }}
        gl={{
          antialias: false,
          alpha: false,
          powerPreference: "high-performance",
        }}
        style={{
          borderRadius: 24,
          background: "linear-gradient(180deg,#0a2e1a 0%,#153d25 100%)",
        }}
        onCreated={handleCreated}
      >
        <Suspense fallback={null}>
          <GameScene
            board={board}
            hand={hand}
            isMyTurn={isMyTurn}
            getPlayableSidesAction={getPlayableSides}
            onPlayAction={onPlay}
            boardLeftEnd={boardLeftEnd}
            boardRightEnd={boardRightEnd}
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

      {/* UI Overlays */}
      <BoardBadge />

      {showTurnOverlay && (
        <TurnOverlay myTurn={isMyTurn} canPass={canPass} onPass={onPass} />
      )}

      <EndLabels left={boardLeftEnd} right={boardRightEnd} />

      {showTurnOverlay && hand.length > 0 && (
        <div className="absolute bottom-10 sm:bottom-14 left-0 right-0 flex justify-center pointer-events-none">
          <span className="text-white/60 text-[10px] sm:text-sm font-medium backdrop-blur-md bg-black/30 px-3 py-1 rounded-full">
            {revealAllHands
              ? "All hands revealed"
              : `Your tiles (${hand.length})`}
          </span>
        </div>
      )}
    </div>
  );
}

export const GameBoard3D = memo(GameBoard3DComponent);
