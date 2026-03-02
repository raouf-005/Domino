"use client";

import React, { Suspense, useCallback, memo } from "react";
import { Canvas } from "@react-three/fiber";
import * as THREE from "three";
import type { Domino, Team } from "../../lib/gameTypes";
import { GameScene } from "./GameScene";
import { BoardBadge, EndLabels } from "./Overlays";

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
  activeSeat?: "bottom" | "left" | "top" | "right" | null;
  bottomTeam?: Team | null;
  leftTeam?: Team | null;
  topTeam?: Team | null;
  rightTeam?: Team | null;
  bottomPlayerName?: string;
  leftPlayerName?: string;
  topPlayerName?: string;
  rightPlayerName?: string;
  quality?: RenderQuality;
  containerClassName?: string;
  fullscreen?: boolean;
  gameFinished?: boolean;
  blockedEnd?: boolean;
  winSlamEnabled?: boolean;
  screenShakeEnabled?: boolean;
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
  activeSeat = null,
  bottomTeam = null,
  leftTeam = null,
  topTeam = null,
  rightTeam = null,
  bottomPlayerName,
  leftPlayerName,
  topPlayerName,
  rightPlayerName,
  quality = "medium",
  containerClassName,
  fullscreen = false,
  gameFinished = false,
  blockedEnd = false,
  winSlamEnabled = true,
  screenShakeEnabled = true,
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
    ? `board-fullscreen absolute inset-0 ${containerClassName ?? ""}`
    : `board-wrapper relative w-full rounded-xl sm:rounded-2xl md:rounded-3xl border border-white/10 shadow-2xl bg-gradient-to-b from-emerald-900/60 to-emerald-950/80 p-0.5 sm:p-1 md:p-2 h-[calc(100dvh-3.25rem)] sm:h-[55vh] md:h-[65vh] landscape:h-[70vh] min-h-60 sm:min-h-75 md:min-h-130 ${containerClassName ?? ""}`;

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
          width: "100%",
          height: "100%",
          display: "block",
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
            bottomPlayerName={bottomPlayerName}
            leftPlayerName={leftPlayerName}
            topPlayerName={topPlayerName}
            rightPlayerName={rightPlayerName}
            gameFinished={gameFinished}
            blockedEnd={blockedEnd}
            winSlamEnabled={winSlamEnabled}
            screenShakeEnabled={screenShakeEnabled}
          />
        </Suspense>
      </Canvas>

      {/* UI Overlays */}
      <BoardBadge />
      <EndLabels left={boardLeftEnd} right={boardRightEnd} />

      {/* Turn indicator – bottom-right */}
      {isMyTurn && !revealAllHands && (
        <div className="absolute bottom-2 right-2 sm:bottom-3 sm:right-3 z-10 flex items-center gap-1.5">
          <span
            className="animate-pulse inline-flex items-center gap-1 select-none"
            style={{
              padding: "3px 8px",
              borderRadius: 10,
              background:
                "linear-gradient(135deg, rgba(16,185,129,0.85), rgba(5,150,105,0.75))",
              color: "#fff",
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: 0.3,
              boxShadow:
                "0 0 10px rgba(16,185,129,0.5), 0 1px 4px rgba(0,0,0,0.35)",
              border: "1px solid rgba(255,255,255,0.25)",
              backdropFilter: "blur(8px)",
            }}
          >
            <span style={{ fontSize: 18 }}>🎲</span>
            Your turn
          </span>
          {canPass && (
            <button
              onClick={onPass}
              style={{
                padding: "9px 20px",
                borderRadius: 10,
                background:
                  "linear-gradient(135deg, rgba(239,68,68,0.85), rgba(220,38,38,0.75))",
                color: "#fff",
                fontSize: 10,
                fontWeight: 700,
                border: "1px solid rgba(255,255,255,0.25)",
                cursor: "pointer",
                boxShadow: "0 1px 4px rgba(0,0,0,0.35)",
                backdropFilter: "blur(8px)",
              }}
            >
              Pass
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export const GameBoard3D = memo(GameBoard3DComponent);
