/* ============================================================
   GAME ENGINE — machine à états des notes + matching input↔note.

   Ne connaît NI le canvas NI le Lovense : il consomme des instants
   (issus de l'AudioClock) et émet des événements sémantiques.

   Cycle de vie d'une note :
     idle → hit                      (tap réussi)
     idle → holding → hit            (hold tenu jusqu'au bout)
     idle → holding → missed         (hold relâché trop tôt)
     idle → missed                   (fenêtre dépassée sans frappe)

   Règles hold : la tête est jugée comme un tap (combo + score
   immédiats) ; relâcher avant `endMs - fenêtre GOOD` casse le combo ;
   tenir jusqu'au bout donne un bonus (HOLD_COMPLETE_BONUS).
   ============================================================ */
import { beatOfMs, compileBeatmap, msOfBeat, type Beatmap, type ChartNote } from "./beatmap";
import type { GameEvent, GameEventListener } from "./events";
import { isExpired, judge, JUDGEMENT_WINDOWS_MS, type Judgement } from "./judgement";
import { accuracy, comboMultiplier, HOLD_COMPLETE_BONUS, noteScore } from "./scoring";

/** Rayon de matching pour les taps pointeur (coordonnées normalisées 0..1). */
export const HIT_RADIUS_X = 0.17;
export const HIT_RADIUS_Y = 0.13;

export type NoteState = "idle" | "holding" | "hit" | "missed";

export interface NoteRuntime {
  note: ChartNote;
  state: NoteState;
  judgement: Judgement | null; // jugement de la tête
  displayJudgement: Judgement | null; // ce que le rendu affiche (MISS écrase en cas de hold cassé)
  resolvedAtMs: number; // instant de résolution (popup, effets)
  holdInput: string | null; // id de l'input qui tient le hold
}

export interface GameStats {
  score: number;
  combo: number;
  maxCombo: number;
  counts: Record<Judgement, number>;
  accuracy: number;
  resolved: number;
  total: number;
}

export class ScanlineGame {
  readonly map: Beatmap;
  readonly notes: NoteRuntime[];

  private listeners = new Set<GameEventListener>();
  private score = 0;
  private combo = 0;
  private maxCombo = 0;
  private counts: Record<Judgement, number> = { perfect: 0, great: 0, good: 0, miss: 0 };
  private endEmitted = false;

  constructor(map: Beatmap) {
    this.map = map;
    this.notes = compileBeatmap(map).map((note) => ({
      note,
      state: "idle",
      judgement: null,
      displayJudgement: null,
      resolvedAtMs: 0,
      holdInput: null,
    }));
  }

  onEvent(fn: GameEventListener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit(ev: GameEvent): void {
    this.listeners.forEach((fn) => fn(ev));
  }

  /** Beat courant (peut être négatif pendant le lead-in). */
  beatAt(tMs: number): number {
    return beatOfMs(this.map, tMs);
  }

  get finished(): boolean {
    return this.endEmitted;
  }

  get stats(): GameStats {
    const resolved =
      this.counts.perfect + this.counts.great + this.counts.good + this.counts.miss;
    return {
      score: this.score,
      combo: this.combo,
      maxCombo: this.maxCombo,
      counts: { ...this.counts },
      accuracy: accuracy(this.counts),
      resolved,
      total: this.notes.length,
    };
  }

  /**
   * Frappe (touche clavier ou pointeur). `pos` (normalisé 0..1) restreint le
   * matching à la zone touchée ; sans pos (clavier), la note la plus proche
   * temporellement dans la fenêtre GOOD est choisie. Tap dans le vide = ignoré.
   */
  press(inputId: string, tMs: number, pos?: { x: number; y: number }): void {
    let best: NoteRuntime | null = null;
    let bestDelta = Infinity;
    for (const n of this.notes) {
      if (n.state !== "idle") continue;
      const delta = tMs - n.note.timeMs;
      if (Math.abs(delta) > JUDGEMENT_WINDOWS_MS.good) continue;
      if (pos && (Math.abs(pos.x - n.note.x) > HIT_RADIUS_X || Math.abs(pos.y - n.note.y) > HIT_RADIUS_Y))
        continue;
      if (Math.abs(delta) < Math.abs(bestDelta)) {
        best = n;
        bestDelta = delta;
      }
    }
    if (!best) return;

    const j = judge(bestDelta);
    if (!j) return; // par construction impossible (filtré par la fenêtre GOOD)

    best.judgement = j;
    best.displayJudgement = j;
    best.resolvedAtMs = tMs;
    this.counts[j]++;
    this.score += noteScore(j, this.combo);
    this.combo++;
    this.maxCombo = Math.max(this.maxCombo, this.combo);
    if (best.note.type === "hold") {
      best.state = "holding";
      best.holdInput = inputId;
    } else {
      best.state = "hit";
    }
    this.emit({ type: "note_hit", noteId: best.note.id, judgement: j });
    this.emit({ type: "combo_changed", combo: this.combo });
  }

  /** Relâchement d'un input : résout le hold éventuellement tenu par cet input. */
  release(inputId: string, tMs: number): void {
    const n = this.notes.find((x) => x.state === "holding" && x.holdInput === inputId);
    if (!n) return;
    if (tMs >= n.note.endMs - JUDGEMENT_WINDOWS_MS.good) {
      this.completeHold(n, tMs);
    } else {
      n.state = "missed";
      n.displayJudgement = "miss";
      n.resolvedAtMs = tMs;
      n.holdInput = null;
      this.emit({ type: "hold_broken", noteId: n.note.id });
      this.breakCombo();
    }
  }

  private completeHold(n: NoteRuntime, tMs: number): void {
    n.state = "hit";
    n.holdInput = null;
    n.resolvedAtMs = tMs;
    this.score += Math.round(HOLD_COMPLETE_BONUS * comboMultiplier(this.combo));
    this.emit({ type: "hold_complete", noteId: n.note.id });
  }

  private breakCombo(): void {
    if (this.combo === 0) return;
    const lost = this.combo;
    this.combo = 0;
    this.emit({ type: "combo_broken", lostCombo: lost });
    this.emit({ type: "combo_changed", combo: 0 });
  }

  /** À appeler à chaque frame avec l'heure audio : misses auto, fins de hold, fin de piste. */
  update(tMs: number): void {
    for (const n of this.notes) {
      if (n.state === "idle" && isExpired(tMs, n.note.timeMs)) {
        n.state = "missed";
        n.judgement = "miss";
        n.displayJudgement = "miss";
        n.resolvedAtMs = tMs;
        this.counts.miss++;
        this.emit({ type: "note_hit", noteId: n.note.id, judgement: "miss" });
        this.breakCombo();
      } else if (n.state === "holding" && tMs >= n.note.endMs) {
        this.completeHold(n, tMs); // tenu jusqu'au bout, même si l'input est encore enfoncé
      }
    }
    if (!this.endEmitted && tMs >= msOfBeat(this.map, this.map.durationBeats)) {
      this.endEmitted = true;
      this.emit({ type: "song_end" });
    }
  }
}
