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

/**
 * Snake-style board layout.
 *
 * Pieces are placed left-to-right. When the chain would exceed TABLE_HALF_W
 * it turns DOWN then continues in the opposite direction, like a real domino
 * table. Doubles are always vertical (narrow), others horizontal (wide).
 *
 * Returns per-piece position + rotation, plus drop-zone anchor positions.
 */
export function useSnakeLayout(board: Domino[]) {
  return useMemo(() => {
    if (board.length === 0) {
      return {
        items: [] as LayoutItem[],
        leftDrop: [0, 0, 0] as Vec3,
        rightDrop: [0, 0, 0] as Vec3,
      };
    }

    const items: LayoutItem[] = [];

    // Direction: 1 = right, -1 = left
    let dir = 1;
    let x = 0;
    let z = 0;
    let prevHalfW = 0;

    for (let i = 0; i < board.length; i++) {
      const d = board[i];
      const isDouble = d.left === d.right;
      const halfW = (isDouble ? DOUBLE_W : NORMAL_W) / 2;

      if (i === 0) {
        // First piece at origin
        x = 0;
        z = 0;
      } else {
        const nextX = x + dir * (prevHalfW + PIECE_GAP + halfW);

        // Check if we'd go out of bounds
        if (Math.abs(nextX) > TABLE_HALF_W) {
          // Turn: move down, flip direction
          z += TURN_RADIUS;
          dir *= -1;
          x = x + dir * (prevHalfW + PIECE_GAP + halfW);
        } else {
          x = nextX;
        }
      }

      // Flat on table, face up.
      // Vertical vs horizontal is controlled by Z rotation.
      // Y rotation keeps left/right aligned with the snake direction.

      const rotY = dir > 0 ? Math.PI / 2 : -Math.PI / 2;
      const rotZ = isDouble ? 0 : rotY;
      items.push({
        pos: [x, 0.1, z],
        rot: [-Math.PI / 2, 0, rotZ],
        isDouble,
      });

      prevHalfW = halfW;
    }

    // Center the whole chain
    const allX = items.map((it) => it.pos[0]);
    const allZ = items.map((it) => it.pos[2]);
    const cx = (Math.min(...allX) + Math.max(...allX)) / 2;
    const cz = (Math.min(...allZ) + Math.max(...allZ)) / 2;
    for (const it of items) {
      it.pos[0] -= cx;
      it.pos[2] -= cz;
    }

    // Drop positions: just beyond the first / last piece
    const first = items[0];
    const last = items[items.length - 1];
    const fHW = board[0].left === board[0].right ? DOUBLE_W / 2 : NORMAL_W / 2;
    const lHW =
      board[board.length - 1].left === board[board.length - 1].right
        ? DOUBLE_W / 2
        : NORMAL_W / 2;

    // Left drop: opposite to the direction the chain started
    const leftDrop: Vec3 = [first.pos[0] - 1.8 * (fHW + 0.5), 0, first.pos[2]];
    const rightDrop: Vec3 = [
      last.pos[0] + (items.length > 1 ? dir : 1) * 1.8 * (lHW + 0.5),
      0,
      last.pos[2],
    ];

    return { items, leftDrop, rightDrop };
  }, [board]);
}
