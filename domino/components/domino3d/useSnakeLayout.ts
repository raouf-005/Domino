"use client";

import { useMemo } from "react";
import type { Domino } from "../../lib/gameTypes";
import {
  DOUBLE_W,
  NORMAL_W,
  PIECE_GAP,
  TABLE_HALF_W,
  TURN_RADIUS,
} from "./constants";
import type { LayoutItem, Vec3 } from "./types";

interface SnakeLayoutOptions {
  rowSpacing?: number;
}

export interface LayoutBounds {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

/**
 * Snake-style board layout.
 *
 * Pieces are placed left-to-right along X.  When the chain would exceed
 * TABLE_HALF_W it drops to a new row (+Z) and reverses direction, just like
 * a real domino table.
 *
 * Rotation is applied via the **Z** Euler component (Euler order XYZ) because
 * the DominoPiece body is [1 wide, 2 tall, 0.18 thick] with:
 *   • domino.left  pips at local +Y
 *   • domino.right pips at local -Y
 *
 * After the X=-π/2 tilt (face-up on table), a Z rotation swings the local Y
 * axis into the world X-Z plane:
 *   • rotZ =  π/2  (going right) → left at world −X, right at world +X
 *   • rotZ = −π/2  (going left)  → left at world +X, right at world −X
 *   • rotZ =  0    (double)      → left at world −Z, right at world +Z
 *
 * Consecutive pieces in the board array satisfy board[i].right === board[i+1].left,
 * so adjacent pieces always show matching numbers facing each other.
 */
export function useSnakeLayout(
  board: Domino[],
  options: SnakeLayoutOptions = {},
) {
  const { rowSpacing = TURN_RADIUS } = options;

  return useMemo(() => {
    if (board.length === 0) {
      return {
        items: [] as LayoutItem[],
        leftDrop: [0, 0, 0] as Vec3,
        rightDrop: [0, 0, 0] as Vec3,
        bounds: { minX: -5, maxX: 5, minZ: -5, maxZ: 5 } as LayoutBounds,
      };
    }

    const items: LayoutItem[] = [];

    // Direction along X: 1 = right, -1 = left
    let dir = 1;
    let x = 0;
    let z = 0;
    let prevHalfW = 0;
    // Track whether the previous piece was a turn piece so the next
    // piece advances to the new row.
    let needsRowAdvance = false;

    for (let i = 0; i < board.length; i++) {
      const d = board[i];
      const isDouble = d.left === d.right;
      const chainHalfW = (isDouble ? DOUBLE_W : NORMAL_W) / 2;
      let halfW = chainHalfW;
      let isTurnPiece = false;

      if (i === 0) {
        // First piece at the origin — always centred
        x = 0;
        z = 0;
      } else if (needsRowAdvance) {
        // Previous piece was a turn piece → advance to the new row
        needsRowAdvance = false;
        z += rowSpacing;
        x = x + dir * (prevHalfW + PIECE_GAP + halfW);
      } else {
        const nextX = x + dir * (prevHalfW + PIECE_GAP + halfW);

        // Would the piece overflow the table edge?
        if (Math.abs(nextX) > TABLE_HALF_W) {
          // ── Turn piece: rotate perpendicular to bridge the rows ──
          isTurnPiece = true;

          // A non-double tile rotated 90° occupies ~DOUBLE_W in X
          if (!isDouble) halfW = DOUBLE_W / 2;

          // Place at the edge of the current row (same z)
          x = x + dir * (prevHalfW + PIECE_GAP + halfW);

          // Flip direction for subsequent pieces
          dir *= -1;
          needsRowAdvance = true;
        } else {
          x = nextX;
        }
      }

      // Turn pieces & doubles face along Z (rotZ = 0);
      // normal pieces face along X in the current direction.
      const rotZ =
        isTurnPiece || isDouble ? 0 : dir > 0 ? Math.PI / 2 : -Math.PI / 2;

      // Nudge turn pieces slightly toward the next row so they sit
      // between the two rows and don't look identical to doubles.
      const zOffset = isTurnPiece ? rowSpacing * 0.35 : 0;

      items.push({
        pos: [x, 0.1, z + zOffset] as Vec3,
        rot: [-Math.PI / 2, 0, rotZ] as Vec3,
        isDouble,
      });

      prevHalfW = halfW;
    }

    // ── Centre the whole chain so piece 0 stays near the middle ─
    const allX = items.map((it) => it.pos[0]);
    const allZ = items.map((it) => it.pos[2]);
    const cx = (Math.min(...allX) + Math.max(...allX)) / 2;
    const cz = (Math.min(...allZ) + Math.max(...allZ)) / 2;
    for (const it of items) {
      it.pos[0] -= cx;
      it.pos[2] -= cz;
    }

    // ── Layout bounds (for auto-zoom) ───────────────────────────
    const pad = NORMAL_W / 2 + 1;
    const bounds: LayoutBounds = {
      minX: Math.min(...items.map((it) => it.pos[0])) - pad,
      maxX: Math.max(...items.map((it) => it.pos[0])) + pad,
      minZ: Math.min(...items.map((it) => it.pos[2])) - pad,
      maxZ: Math.max(...items.map((it) => it.pos[2])) + pad,
    };

    // ── Drop positions: just beyond the first / last piece ──────
    const first = items[0];
    const last = items[items.length - 1];
    const DROP_DIST = 2.2;

    // Chain always starts going right (dir = 1). Left end = opposite.
    const leftDrop: Vec3 = [first.pos[0] - 1 * DROP_DIST, 0, first.pos[2]];

    // If the last piece is a turn piece the next tile goes on the row
    // below it, not to the side.
    let rightDrop: Vec3;
    if (needsRowAdvance) {
      rightDrop = [last.pos[0], 0, last.pos[2] + rowSpacing];
    } else {
      rightDrop = [last.pos[0] + dir * DROP_DIST, 0, last.pos[2]];
    }

    return { items, leftDrop, rightDrop, bounds };
  }, [board, rowSpacing]);
}
