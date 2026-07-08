/* ============================================================
   SCANLINE — position de la ligne, dérivée du BEAT (donc du BPM).
   Onde triangle : descend de 0 (haut) à 1 (bas) en `cycleBeats`,
   puis remonte en `cycleBeats`. Cycle complet = 2 × cycleBeats.
   Fonctions pures, testables.
   ============================================================ */

/** Position verticale normalisée (0 = haut, 1 = bas) au beat donné. */
export function scanlineY(beat: number, cycleBeats: number): number {
  const period = 2 * cycleBeats;
  const c = ((beat % period) + period) % period;
  return c < cycleBeats ? c / cycleBeats : 2 - c / cycleBeats;
}

/** Direction de la ligne : 1 = descend, -1 = remonte. */
export function scanlineDir(beat: number, cycleBeats: number): 1 | -1 {
  const period = 2 * cycleBeats;
  const c = ((beat % period) + period) % period;
  return c < cycleBeats ? 1 : -1;
}

/** Index de la demi-traversée (page Cytus) contenant ce beat. */
export function sweepIndex(beat: number, cycleBeats: number): number {
  return Math.floor(beat / cycleBeats);
}
