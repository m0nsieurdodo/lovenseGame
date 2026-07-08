/* ============================================================
   ÉVÉNEMENTS SÉMANTIQUES — seule interface entre le jeu et le
   moteur haptique. Le jeu ne connaît JAMAIS l'intensité brute.
   ============================================================ */
import type { Judgement } from "./judgement";

export type GameEvent =
  | { type: "note_hit"; noteId: number; judgement: Judgement } // toute note résolue (miss inclus)
  | { type: "hold_complete"; noteId: number } // hold tenu jusqu'au bout
  | { type: "hold_broken"; noteId: number } // hold relâché trop tôt
  | { type: "combo_changed"; combo: number }
  | { type: "combo_broken"; lostCombo: number } // valeur du combo perdu
  | { type: "song_end" };

export type GameEventListener = (ev: GameEvent) => void;
