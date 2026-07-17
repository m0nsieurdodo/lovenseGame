export const TILE_LANES = 4;

export type TileJudgement = "perfect" | "great" | "good";

export interface TileNote {
  beat: number;
  lane: number;
}

export interface TileChart {
  id: string;
  title: string;
  artist?: string;
  bpm: number;
  offsetMs: number;
  durationBeats: number;
  notes: TileNote[];
}

export interface CompiledTile extends TileNote {
  id: number;
  timeMs: number;
}

export const TILE_TIMING_WINDOWS_MS = {
  perfect: 35,
  great: 75,
  good: 135,
} as const;

export function beatDurationMs(bpm: number): number {
  return 60_000 / bpm;
}

export function compileTileChart(chart: TileChart): CompiledTile[] {
  if (!(chart.bpm > 0)) throw new Error("bpm doit être supérieur à 0");
  if (!Number.isFinite(chart.offsetMs)) throw new Error("offsetMs doit être un nombre fini");
  if (!(chart.durationBeats > 0)) throw new Error("durationBeats doit être supérieur à 0");

  return [...chart.notes]
    .sort((a, b) => a.beat - b.beat || a.lane - b.lane)
    .map((note, id) => {
      if (!Number.isFinite(note.beat) || note.beat < 0 || note.beat > chart.durationBeats)
        throw new Error(`note ${id} : beat invalide`);
      if (!Number.isInteger(note.lane) || note.lane < 0 || note.lane >= TILE_LANES)
        throw new Error(`note ${id} : lane doit être entre 0 et ${TILE_LANES - 1}`);
      return { ...note, id, timeMs: chart.offsetMs + note.beat * beatDurationMs(chart.bpm) };
    });
}

/** Ratio de déplacement vertical par seconde, borné pour rester jouable sur mobile. */
export function tileSpeedForBpm(bpm: number): number {
  if (!(bpm > 0)) throw new Error("bpm doit être supérieur à 0");
  return Math.min(1, Math.max(0.32, 0.36 + bpm / 420));
}

export function judgeTileHit(deltaMs: number): TileJudgement | null {
  const abs = Math.abs(deltaMs);
  if (abs <= TILE_TIMING_WINDOWS_MS.perfect) return "perfect";
  if (abs <= TILE_TIMING_WINDOWS_MS.great) return "great";
  if (abs <= TILE_TIMING_WINDOWS_MS.good) return "good";
  return null;
}

/**
 * Piste de démonstration sans média sous licence. La grille est déterministe,
 * afin que le rendu et le scoring restent reproductibles.
 */
export function generateDemoChart(bpm = 128): TileChart {
  const pattern = [0, 1, 2, 3, 2, 1, 0, 2, 1, 3, 0, 1, 3, 2, 1, 0];
  const notes = Array.from({ length: 48 }, (_, index) => ({
    beat: index * 0.5 + (index % 8 === 7 ? 0.25 : 0),
    lane: pattern[index % pattern.length],
  }));

  return {
    id: "neon-intro",
    title: "Neon Intro",
    artist: "Lovense Arcade",
    bpm,
    offsetMs: 0,
    durationBeats: notes.at(-1)!.beat + 2,
    notes,
  };
}
