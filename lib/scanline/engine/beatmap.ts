/* ============================================================
   BEATMAP — format 100 % déclaratif (JSON), data-driven.

   CONVENTION DE TEMPS : les notes sont exprimées en BEATS (pas en ms).
   - beat 0 = premier temps musical, situé à `offsetMs` dans l'audio.
   - conversion : ms(beat) = offsetMs + beat × 60000 / bpm

   POSITION : `x` ∈ [0,1] est déclaré dans la map ; `y` est DÉRIVÉ du
   beat via la scanline — cela garantit que la ligne passe exactement
   sur la note à son instant de frappe (cohérence Cytus).

   CONTRAINTE HOLD : un hold doit tenir dans UNE demi-traversée de la
   scanline (sinon la ligne ferait demi-tour en plein maintien).
   `compileBeatmap` rejette les maps invalides avec un message clair.
   ============================================================ */
import { scanlineY, sweepIndex } from "./scanline";

export type NoteType = "tap" | "hold";

export interface BeatmapNote {
  beat: number; // instant de frappe, en beats
  x: number; // 0..1 (gauche → droite)
  type: NoteType;
  durationBeats?: number; // holds uniquement
}

export interface Beatmap {
  id: string;
  title: string;
  artist?: string;
  bpm: number;
  offsetMs: number; // position du beat 0 dans l'audio
  scanCycleBeats: number; // beats pour UNE traversée (haut→bas) ; aller-retour = 2×
  durationBeats: number; // longueur de la piste (déclenche song_end)
  notes: BeatmapNote[];
}

/** Note compilée pour le moteur : temps en ms, y dérivés. */
export interface ChartNote {
  id: number;
  type: NoteType;
  beat: number;
  durationBeats: number;
  timeMs: number; // instant de frappe (tête)
  endMs: number; // fin du hold (= timeMs pour un tap)
  x: number;
  y: number; // 0..1, position de la scanline à `beat`
  yEnd: number; // position de la scanline à `beat + durationBeats`
}

export function beatDurMs(bpm: number): number {
  return 60000 / bpm;
}

export function msOfBeat(map: Pick<Beatmap, "bpm" | "offsetMs">, beat: number): number {
  return map.offsetMs + beat * beatDurMs(map.bpm);
}

export function beatOfMs(map: Pick<Beatmap, "bpm" | "offsetMs">, ms: number): number {
  return (ms - map.offsetMs) / beatDurMs(map.bpm);
}

/** Validation runtime d'un JSON inconnu (les beatmaps sont des fichiers externes). */
export function parseBeatmap(json: unknown): Beatmap {
  const m = json as Beatmap;
  if (!m || typeof m !== "object") throw new Error("Beatmap : JSON invalide");
  if (!(m.bpm > 0)) throw new Error("Beatmap : bpm > 0 requis");
  if (!(m.scanCycleBeats > 0)) throw new Error("Beatmap : scanCycleBeats > 0 requis");
  if (!(m.durationBeats > 0)) throw new Error("Beatmap : durationBeats > 0 requis");
  if (typeof m.offsetMs !== "number") throw new Error("Beatmap : offsetMs requis (ms)");
  if (!Array.isArray(m.notes) || m.notes.length === 0) throw new Error("Beatmap : notes[] vide");
  return m;
}

/** Compile la map : tri chronologique, beats→ms, y dérivés, contraintes vérifiées. */
export function compileBeatmap(map: Beatmap): ChartNote[] {
  const cycle = map.scanCycleBeats;
  return [...map.notes]
    .sort((a, b) => a.beat - b.beat)
    .map((n, i) => {
      if (n.x < 0 || n.x > 1) throw new Error(`Note ${i} (beat ${n.beat}) : x doit être dans [0,1]`);
      const dur = n.type === "hold" ? n.durationBeats ?? 0 : 0;
      if (n.type === "hold" && dur <= 0)
        throw new Error(`Note ${i} (beat ${n.beat}) : hold sans durationBeats`);
      // Un hold ne doit pas traverser un demi-tour de scanline (fin de demi-traversée
      // exclusive : finir pile sur le demi-tour est autorisé).
      if (dur > 0) {
        const endBeat = n.beat + dur;
        const sameSweep =
          sweepIndex(n.beat, cycle) === sweepIndex(endBeat, cycle) || endBeat % cycle === 0;
        if (!sameSweep)
          throw new Error(
            `Note ${i} (beat ${n.beat}) : le hold (${dur} beats) traverse un demi-tour de scanline`,
          );
      }
      return {
        id: i,
        type: n.type,
        beat: n.beat,
        durationBeats: dur,
        timeMs: msOfBeat(map, n.beat),
        endMs: msOfBeat(map, n.beat + dur),
        x: n.x,
        y: scanlineY(n.beat, cycle),
        yEnd: scanlineY(n.beat + dur, cycle),
      };
    });
}
