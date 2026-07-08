/* ============================================================
   BOÎTE À RYTHME — 16 pads, chacun avec une intensité fixe
   ou un pattern de vibration qui boucle.

   3 types de pads :
     steady  → intensité constante (ré-envoyée en boucle pour
               que le toy ne retombe jamais sur le baseline)
     pattern → séquence [pct, ms] jouée en boucle
     random  → chaque étape est tirée au hasard (chaos)

   Un seul pad actif à la fois : appuyer sur un autre pad
   bascule dessus, ré-appuyer sur le pad actif l'arrête.
   ============================================================ */
import { Lovense } from "./lovense";

export type PadKind = "steady" | "pattern" | "random";

export interface PadStep {
  pct: number;
  ms: number;
}

export interface Pad {
  id: number;
  label: string;
  icon: string;
  kind: PadKind;
  intensity?: number; // steady
  steps?: PadStep[]; // pattern (boucle)
}

export const PADS: Pad[] = [
  /* ---- Rangée 1 : intensités fixes ---- */
  { id: 0, label: "Souffle", icon: "🫧", kind: "steady", intensity: 10 },
  { id: 1, label: "Doux", icon: "🌙", kind: "steady", intensity: 25 },
  { id: 2, label: "Medium", icon: "☀️", kind: "steady", intensity: 50 },
  { id: 3, label: "Fort", icon: "⚡", kind: "steady", intensity: 75 },
  /* ---- Rangée 2 : max + patterns doux ---- */
  { id: 4, label: "Max", icon: "🔥", kind: "steady", intensity: 100 },
  {
    id: 5, label: "Cœur", icon: "💓", kind: "pattern",
    steps: [{ pct: 70, ms: 120 }, { pct: 0, ms: 90 }, { pct: 55, ms: 110 }, { pct: 0, ms: 680 }],
  },
  {
    id: 6, label: "Vague", icon: "🌊", kind: "pattern",
    steps: [
      { pct: 15, ms: 160 }, { pct: 35, ms: 160 }, { pct: 60, ms: 160 }, { pct: 85, ms: 180 },
      { pct: 100, ms: 220 }, { pct: 85, ms: 180 }, { pct: 60, ms: 160 }, { pct: 35, ms: 160 },
      { pct: 15, ms: 160 }, { pct: 0, ms: 240 },
    ],
  },
  {
    id: 7, label: "Montée", icon: "📈", kind: "pattern",
    steps: [
      { pct: 10, ms: 300 }, { pct: 25, ms: 300 }, { pct: 40, ms: 300 }, { pct: 55, ms: 300 },
      { pct: 70, ms: 300 }, { pct: 85, ms: 300 }, { pct: 100, ms: 600 }, { pct: 0, ms: 400 },
    ],
  },
  /* ---- Rangée 3 : patterns rythmés ---- */
  {
    id: 8, label: "Mitraille", icon: "🥁", kind: "pattern",
    steps: [{ pct: 100, ms: 90 }, { pct: 0, ms: 110 }],
  },
  {
    id: 9, label: "Double tap", icon: "👆", kind: "pattern",
    steps: [{ pct: 80, ms: 110 }, { pct: 0, ms: 80 }, { pct: 80, ms: 110 }, { pct: 0, ms: 620 }],
  },
  {
    id: 10, label: "Galop", icon: "🐎", kind: "pattern",
    steps: [
      { pct: 60, ms: 100 }, { pct: 0, ms: 60 }, { pct: 75, ms: 100 },
      { pct: 0, ms: 60 }, { pct: 90, ms: 120 }, { pct: 0, ms: 260 },
    ],
  },
  {
    id: 11, label: "Long-court", icon: "➖", kind: "pattern",
    steps: [{ pct: 100, ms: 500 }, { pct: 0, ms: 180 }, { pct: 45, ms: 180 }, { pct: 0, ms: 180 }],
  },
  /* ---- Rangée 4 : patterns joueurs ---- */
  {
    id: 12, label: "Tease", icon: "😏", kind: "pattern",
    steps: [
      { pct: 35, ms: 900 }, { pct: 0, ms: 500 }, { pct: 60, ms: 250 }, { pct: 0, ms: 900 },
      { pct: 45, ms: 500 }, { pct: 0, ms: 300 }, { pct: 90, ms: 150 }, { pct: 0, ms: 1100 },
    ],
  },
  {
    id: 13, label: "SOS", icon: "🆘", kind: "pattern",
    steps: [
      { pct: 80, ms: 140 }, { pct: 0, ms: 110 }, { pct: 80, ms: 140 }, { pct: 0, ms: 110 }, { pct: 80, ms: 140 }, { pct: 0, ms: 240 },
      { pct: 80, ms: 420 }, { pct: 0, ms: 110 }, { pct: 80, ms: 420 }, { pct: 0, ms: 110 }, { pct: 80, ms: 420 }, { pct: 0, ms: 240 },
      { pct: 80, ms: 140 }, { pct: 0, ms: 110 }, { pct: 80, ms: 140 }, { pct: 0, ms: 110 }, { pct: 80, ms: 140 }, { pct: 0, ms: 700 },
    ],
  },
  { id: 14, label: "Chaos", icon: "🎲", kind: "random" },
  {
    id: 15, label: "Climax", icon: "💥", kind: "pattern",
    steps: [
      { pct: 100, ms: 300 }, { pct: 60, ms: 120 }, { pct: 100, ms: 350 },
      { pct: 70, ms: 120 }, { pct: 100, ms: 450 }, { pct: 0, ms: 250 },
    ],
  },
];

export class RhythmEngine {
  activeId: number | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;

  /** Active un pad (coupe le précédent) ; ré-appuyer sur le pad actif = stop. */
  toggle(padId: number): number | null {
    if (this.activeId === padId) {
      this.stop();
      return null;
    }
    this.clear();
    this.activeId = padId;
    const pad = PADS.find((p) => p.id === padId);
    if (pad) this.run(pad, 0);
    return this.activeId;
  }

  private run(pad: Pad, idx: number) {
    if (this.activeId !== pad.id) return;

    let pct: number;
    let ms: number;
    if (pad.kind === "steady") {
      pct = pad.intensity ?? 0;
      ms = 700; // ré-envoi périodique pour tenir l'intensité en continu
    } else if (pad.kind === "random") {
      pct = Math.random() < 0.25 ? 0 : 10 + Math.random() * 90; // silences surprises
      ms = 120 + Math.random() * 700;
    } else {
      const step = pad.steps![idx % pad.steps!.length];
      pct = step.pct;
      ms = step.ms;
    }

    // durée pulse > durée step : pas de trou entre deux étapes
    Lovense.pulse(pct, ms + 300);
    this.timer = setTimeout(() => this.run(pad, idx + 1), ms);
  }

  stop() {
    this.clear();
    this.activeId = null;
    Lovense.mute();
  }

  private clear() {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  destroy() {
    this.stop();
  }
}
