export type PointerPoint = { x: number; y: number };
export type TetrisGesture =
  | { action: "rotate" }
  | { action: "move"; amount: number }
  | { action: "soft_drop"; amount: number }
  | { action: "hard_drop" }
  | { action: "none" };

const TAP_DISTANCE = 18;
const HARD_DROP_DISTANCE = 180;

/** Converts a completed direct-manipulation gesture into one bounded game action. */
export function classifyTetrisGesture(start: PointerPoint, end: PointerPoint, cellSize = 30): TetrisGesture {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  if (Math.abs(dx) <= TAP_DISTANCE && Math.abs(dy) <= TAP_DISTANCE) return { action: "rotate" };
  if (Math.abs(dx) > Math.abs(dy)) return { action: "move", amount: Math.max(1, Math.round(Math.abs(dx) / cellSize)) * Math.sign(dx) };
  if (dy <= 0) return { action: "none" };
  if (dy >= HARD_DROP_DISTANCE) return { action: "hard_drop" };
  return { action: "soft_drop", amount: Math.max(1, Math.round(dy / cellSize)) };
}
