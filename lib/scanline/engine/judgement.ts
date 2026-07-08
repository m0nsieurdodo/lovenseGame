/* ============================================================
   JUGEMENT — fenêtres de précision (ms), du meilleur au pire.
   Configurables ici. Le jugement se fait UNIQUEMENT sur le delta
   temporel (horloge audio), jamais sur la position rendue.
   ============================================================ */

export const JUDGEMENT_WINDOWS_MS = {
  perfect: 40, // ±40 ms
  great: 80, // ±80 ms
  good: 120, // ±120 ms — au-delà : la note n'est pas frappable
} as const;

/** Compensation de latence d'entrée (clavier/écran), soustraite au delta. */
export const INPUT_LATENCY_MS = 0;

export type Judgement = "perfect" | "great" | "good" | "miss";

/**
 * Juge un delta (msFrappe - msNote). Retourne null si le tap est hors de
 * toute fenêtre : il est ignoré (pas de pénalité pour un tap dans le vide).
 */
export function judge(deltaMs: number): Exclude<Judgement, "miss"> | null {
  const d = Math.abs(deltaMs - INPUT_LATENCY_MS);
  if (d <= JUDGEMENT_WINDOWS_MS.perfect) return "perfect";
  if (d <= JUDGEMENT_WINDOWS_MS.great) return "great";
  if (d <= JUDGEMENT_WINDOWS_MS.good) return "good";
  return null;
}

/** Une note non frappée devient MISS quand l'horloge dépasse sa fenêtre GOOD. */
export function isExpired(songMs: number, noteMs: number): boolean {
  return songMs > noteMs + JUDGEMENT_WINDOWS_MS.good;
}
