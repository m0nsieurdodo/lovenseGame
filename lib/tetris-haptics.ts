export type TetrisHapticEvent =
  | { kind: "lock" }
  | { kind: "rotate" }
  | { kind: "hard_drop" }
  | { kind: "clear"; lines: 1 | 2 | 3 | 4; backToBackTetris: boolean };

export type TetrisHapticPlan =
  | { kind: "pulse"; intensity: number; durationMs: number }
  | { kind: "climax" };

const clearPlans: Record<1 | 2 | 3 | 4, Extract<TetrisHapticPlan, { kind: "pulse" }>> = {
  1: { kind: "pulse", intensity: 28, durationMs: 280 },
  2: { kind: "pulse", intensity: 44, durationMs: 420 },
  3: { kind: "pulse", intensity: 62, durationMs: 620 },
  4: { kind: "pulse", intensity: 82, durationMs: 900 },
};

/** Semantic, bounded haptic feedback for Tetris events. Global Lovense scaling remains authoritative. */
export function tetrisHapticPlan(event: TetrisHapticEvent): TetrisHapticPlan {
  if (event.kind === "lock") return { kind: "pulse", intensity: 12, durationMs: 120 };
  if (event.kind === "rotate") return { kind: "pulse", intensity: 6, durationMs: 45 };
  if (event.kind === "hard_drop") return { kind: "pulse", intensity: 18, durationMs: 110 };
  if (event.lines === 4 && event.backToBackTetris) return { kind: "climax" };
  return clearPlans[event.lines];
}
