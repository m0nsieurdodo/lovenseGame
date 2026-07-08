/* ============================================================
   DESCENTE — Moteur de courbes haptiques.
   Fonctions PURES, zéro dépendance DOM/jeu → testées unitairement.
   heat (0-100) → intensité Lovense (0-20) + enveloppes ADSR simplifiées.
   ============================================================ */

/** Intensité Lovense maximale (protocole Game Mode : Vibrate 0-20). */
export const MAX_INTENSITY = 20;

export type CurveKind = "linear" | "easeIn";

export const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

/** Fonction pure : heat 0-100 → intensité 0-20 selon la courbe choisie.
    linear  : proportionnel (défaut).
    easeIn  : quadratique — doux en bas d'échelle, raide vers le haut. */
export function heatToIntensity(heat: number, curve: CurveKind = "linear"): number {
  const h = clamp(heat, 0, 100) / 100;
  const t = curve === "easeIn" ? h * h : h;
  return t * MAX_INTENSITY;
}

/** Enveloppe attaque / maintien / relâche (ADSR simplifié, sustain = maintien à 1). */
export interface Envelope {
  attackMs: number;
  holdMs: number;
  releaseMs: number;
}

export function envelopeDuration(env: Envelope): number {
  return env.attackMs + env.holdMs + env.releaseMs;
}

/** Valeur 0-1 de l'enveloppe à l'instant tMs (0 avant le début et après la fin). */
export function envelopeValue(env: Envelope, tMs: number): number {
  if (tMs < 0) return 0;
  if (tMs < env.attackMs) return tMs / env.attackMs;
  const afterAttack = tMs - env.attackMs;
  if (afterAttack < env.holdMs) return 1;
  const afterHold = afterAttack - env.holdMs;
  if (afterHold < env.releaseMs) return 1 - afterHold / env.releaseMs;
  return 0;
}
