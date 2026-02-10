/** Table size constraints for the snake layout */
export const TABLE_HALF_W = 18; // max X extent before turning
export const PIECE_GAP = 0.3;
export const DOUBLE_W = 1.2;
export const NORMAL_W = 2.2;
export const TURN_RADIUS = 2.5; // spacing when the chain turns a corner

/** Domino dot positions by pip count */
export const DOT_MAP: Record<number, [number, number][]> = {
  0: [],
  1: [[0, 0]],
  2: [
    [0.25, 0.25],
    [-0.25, -0.25],
  ],
  3: [
    [0.25, 0.25],
    [0, 0],
    [-0.25, -0.25],
  ],
  4: [
    [-0.25, 0.25],
    [0.25, 0.25],
    [-0.25, -0.25],
    [0.25, -0.25],
  ],
  5: [
    [-0.25, 0.25],
    [0.25, 0.25],
    [0, 0],
    [-0.25, -0.25],
    [0.25, -0.25],
  ],
  6: [
    [-0.25, 0.25],
    [0.25, 0.25],
    [-0.25, 0],
    [0.25, 0],
    [-0.25, -0.25],
    [0.25, -0.25],
  ],
};
