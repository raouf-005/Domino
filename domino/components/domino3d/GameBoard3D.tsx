"use client";

import React, { Suspense, useCallback, memo } from "react";
import { Canvas } from "@react-three/fiber";
import * as THREE from "three";
import type { Domino, Team } from "../../lib/gameTypes";
import { GameScene } from "./GameScene";
import { BoardBadge, EndLabels, TurnOverlay } from "./Overlays";

export type RenderQuality = "low" | "medium" | "high";

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
  quality?: RenderQuality;
  containerClassName?: string;
  fullscreen?: boolean;
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
  quality = "medium",
  containerClassName,
  fullscreen = false,
}: GameBoard3DProps) {
  const qualityConfig =
    quality === "low"
      ? {
          dpr: [0.75, 1] as [number, number],
          antialias: false,
          shadows: false,
          powerPreference: "high-performance" as const,
        }
      : quality === "high"
        ? {
            dpr: [1, 1.5] as [number, number],
            antialias: true,
            shadows: true,
            powerPreference: "high-performance" as const,
          }
        : {
            dpr: [1, 1] as [number, number],
            antialias: false,
            shadows: false,
            powerPreference: "high-performance" as const,
          };

  const handleCreated = useCallback(
    ({ gl }: { gl: THREE.WebGLRenderer }) => {
      gl.setPixelRatio(1);
      gl.outputColorSpace = THREE.SRGBColorSpace;
      gl.toneMapping =
        quality === "high" ? THREE.ACESFilmicToneMapping : THREE.NoToneMapping;
    },
    [quality],
  );

  const boardWrapperClassName = fullscreen
    ? `board-wrapper relative w-screen h-dvh min-h-dvh bg-black ${containerClassName ?? ""}`
    : `board-wrapper relative w-full rounded-xl sm:rounded-2xl md:rounded-3xl border border-white/10 shadow-2xl bg-gradient-to-b from-emerald-900/60 to-emerald-950/80 p-0.5 sm:p-1 md:p-2 h-[50vh] sm:h-[55vh] md:h-[65vh] landscape:h-[70vh] min-h-60 sm:min-h-75 md:min-h-130 ${containerClassName ?? ""}`;

  return (
    <div className={boardWrapperClassName}>
      {/* Soft inner shadow */}
      {!fullscreen && (
        <div
          className="absolute inset-0 rounded-3xl pointer-events-none"
          style={{ boxShadow: "inset 0 0 120px rgba(0,0,0,.35)" }}
        />
      )}

      <Canvas
        shadows={qualityConfig.shadows}
        dpr={qualityConfig.dpr}
        camera={{ position: [0, 12, 14], fov: 45 }}
        gl={{
          antialias: qualityConfig.antialias,
          alpha: false,
          powerPreference: qualityConfig.powerPreference,
        }}
        style={{
          borderRadius: fullscreen ? 0 : 24,
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
