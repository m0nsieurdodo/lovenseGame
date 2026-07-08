/* ============================================================
   SCORING — fonctions pures : jugement × combo → points.
   ============================================================ */
import type { Judgement } from "./judgement";

export const BASE_SCORE: Record<Judgement, number> = {
  perfect: 1000,
  great: 700,
  good: 400,
  miss: 0,
};

/** Bonus accordé quand un hold est tenu jusqu'au bout. */
export const HOLD_COMPLETE_BONUS = 500;

/** Multiplicateur de combo : +1 % par combo, plafonné à ×2 (combo 100). */
export function comboMultiplier(combo: number): number {
  return 1 + Math.min(Math.max(combo, 0), 100) / 100;
}

/** Points d'une note, `combo` = combo AVANT la frappe. */
export function noteScore(judgement: Judgement, combo: number): number {
  return Math.round(BASE_SCORE[judgement] * comboMultiplier(combo));
}

/** Précision pondérée 0..1 sur les notes résolues. */
export function accuracy(counts: Record<Judgement, number>): number {
  const total = counts.perfect + counts.great + counts.good + counts.miss;
  if (total === 0) return 1;
  return (counts.perfect + counts.great * 0.7 + counts.good * 0.4) / total;
}
