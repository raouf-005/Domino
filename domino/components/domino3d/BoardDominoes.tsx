"use client";

import { useMemo, useRef } from "react";
import type { Domino } from "../../lib/gameTypes";
import type { LayoutItem } from "./types";
import { DominoPiece } from "./DominoPiece";

export function BoardDominoes({
  board,
  items,
}: {
  board: Domino[];
  items: LayoutItem[];
}) {
  // Track which pieces we've "seen" so only new ones animate in
  const seenRef = useRef(new Set<string>());

  // Mark new pieces
  const isNew = useMemo(() => {
    const result: boolean[] = [];
    const incoming = new Set(board.map((d) => d.id));
    for (const d of board) {
      result.push(!seenRef.current.has(d.id));
    }
    // Update seen set
    seenRef.current = incoming;
    return result;
  }, [board]);

  return (
    <>
      {board.map((domino, idx) => {
        const layout = items[idx];
        if (!layout) return null;
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
