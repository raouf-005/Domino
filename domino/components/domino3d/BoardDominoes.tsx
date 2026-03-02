"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Domino } from "../../lib/gameTypes";
import type { LayoutItem, Vec3 } from "./types";
import { DominoPiece, FlyInPiece } from "./DominoPiece";

/** 3D positions where each seat's hand lives */
const SEAT_ORIGINS: Record<string, Vec3> = {
  bottom: [0, 1.5, 16],
  left: [-17, 1.5, 0],
  top: [0, 1.5, -17],
  right: [17, 1.5, 0],
};

/** Starting rotation for the tile leaving each seat (face-down, angled toward center) */
const SEAT_ROTS: Record<string, Vec3> = {
  bottom: [-Math.PI / 2, 0, 0],
  left: [-Math.PI / 2, 0, Math.PI / 2],
  top: [-Math.PI / 2, 0, Math.PI],
  right: [-Math.PI / 2, 0, -Math.PI / 2],
};

type Seat = "bottom" | "left" | "top" | "right";

export function BoardDominoes({
  board,
  items,
  playSeat,
}: {
  board: Domino[];
  items: LayoutItem[];
  /** Which seat just played (the one whose turn it was BEFORE the current turn). */
  playSeat?: Seat | null;
}) {
  // Track which pieces we've "seen" so only new ones animate in
  const seenRef = useRef(new Set<string>());
  // IDs that are currently mid-flight (key: domino id)
  const [flying, setFlying] = useState<Set<string>>(new Set());

  // Mark new pieces & detect the one new tile to animate
  const { isNew, flyId } = useMemo(() => {
    const result: boolean[] = [];
    let newId: string | null = null;
    for (const d of board) {
      const fresh = !seenRef.current.has(d.id);
      result.push(fresh);
      if (fresh) newId = d.id; // last new tile
    }
    // Update seen set
    seenRef.current = new Set(board.map((d) => d.id));
    return { isNew: result, flyId: newId };
  }, [board]);

  const onFlyDone = useCallback((id: string) => {
    setFlying((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, []);

  // When we detect a new fly tile, register it
  useEffect(() => {
    if (flyId && playSeat && playSeat !== "bottom") {
      setFlying((prev) => {
        const next = new Set(prev);
        next.add(flyId);
        return next;
      });
    }
  }, [flyId, playSeat]);

  return (
    <>
      {board.map((domino, idx) => {
        const layout = items[idx];
        if (!layout) return null;

        // If this is the new tile from an opponent, show fly-in animation
        if (
          domino.id === flyId &&
          isNew[idx] &&
          playSeat &&
          playSeat !== "bottom" &&
          (flying.has(domino.id) || isNew[idx])
        ) {
          const origin = SEAT_ORIGINS[playSeat] ?? SEAT_ORIGINS.top;
          const originRot = SEAT_ROTS[playSeat] ?? SEAT_ROTS.top;
          return (
            <FlyInPiece
              key={`fly-${domino.id}`}
              domino={domino}
              fromPos={origin}
              fromRot={originRot}
              targetPos={layout.pos}
              targetRot={layout.rot}
              onDone={() => onFlyDone(domino.id)}
            />
          );
        }

        return (
          <DominoPiece
            key={`b-${domino.id}`}
            domino={domino}
            targetPos={layout.pos}
            targetRot={layout.rot}
            dropIn={isNew[idx]}
            dropDelay={isNew[idx] ? 0 : idx * 0.04}
          />
        );
      })}
    </>
  );
}
