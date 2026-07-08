/* ============================================================
   COURBES HAPTIQUES — fonctions PURES et testables.
   Deux couches empilées :
     1. BASELINE continue pilotée par le COMBO (paliers tous les 25)
     2. PULSES événementiels pilotés par le JUGEMENT (enveloppe A/R)
   Somme des couches puis clamp 0..20 (échelle Lovense).
   Un MISS ne pulse pas : il coupe brièvement la baseline (punition).
   ============================================================ */
import type { Judgement } from "../engine/judgement";

export const MAX_LEVEL = 20;

/** Un palier tous les 25 combos : 0→0, 25→3, 50→5, 75→7, 100→9, 125+→10. */
export const COMBO_TIER_SIZE = 25;
export const BASELINE_TIERS = [0, 3, 5, 7, 9, 10] as const;

export function comboToBaseline(combo: number): number {
  const tier = Math.min(Math.floor(Math.max(combo, 0) / COMBO_TIER_SIZE), BASELINE_TIERS.length - 1);
  return BASELINE_TIERS[tier];
}

export interface PulseSpec {
  amp: number; // amplitude crête (0..20)
  attackMs: number;
  releaseMs: number;
}

/** Amplitude du pulse selon le jugement — MISS ne pulse pas (null). */
export const JUDGEMENT_PULSES: Record<Judgement, PulseSpec | null> = {
  perfect: { amp: 9, attackMs: 20, releaseMs: 280 },
  great: { amp: 6, attackMs: 20, releaseMs: 220 },
  good: { amp: 3, attackMs: 20, releaseMs: 160 },
  miss: null,
};

export function judgementToPulse(j: Judgement): PulseSpec | null {
  return JUDGEMENT_PULSES[j];
}

/** Durée de la micro-coupure de baseline après un combo cassé. */
export const MISS_DIP_MS = 400;

/** Enveloppe attaque/relâche linéaire : valeur du pulse à `elapsedMs` de son départ. */
export function pulseEnvelope(spec: PulseSpec, elapsedMs: number): number {
  if (elapsedMs < 0) return 0;
  if (elapsedMs < spec.attackMs) return spec.amp * (elapsedMs / spec.attackMs);
  const rel = elapsedMs - spec.attackMs;
  if (rel < spec.releaseMs) return spec.amp * (1 - rel / spec.releaseMs);
  return 0;
}

/** Somme des couches + clamp sur l'échelle Lovense 0..20. */
export function mixIntensity(baseline: number, pulses: readonly number[]): number {
  const sum = pulses.reduce((acc, p) => acc + p, baseline);
  return Math.min(MAX_LEVEL, Math.max(0, sum));
}
