/* ============================================================
   MINI CASINO ENGINE — machine à sous 3 rouleaux, RNG pondéré.
   Mapping vibration (prompt/jeu5.md) :
     perte       → 10% courte
     gain simple → 30%
     gros gain   → 70%
     jackpot     → 100% pendant 3s
   ============================================================ */
import { Lovense } from "./lovense";
import { saveBestScore } from "./settings";

export type Outcome = "loss" | "small" | "big" | "jackpot";

interface Symbol { glyph: string; weight: number; tier: "small" | "big" | "jackpot" }

const SYMBOLS: Symbol[] = [
  { glyph: "🍒", weight: 30, tier: "small" },
  { glyph: "🍋", weight: 25, tier: "small" },
  { glyph: "🔔", weight: 20, tier: "small" },
  { glyph: "⭐", weight: 15, tier: "big" },
  { glyph: "💎", weight: 7, tier: "big" },
  { glyph: "7️⃣", weight: 3, tier: "jackpot" },
];
const TOTAL_WEIGHT = SYMBOLS.reduce((s, x) => s + x.weight, 0);
const SPIN_COST = 10;
const PAYOUT: Record<Outcome, number> = { loss: 0, small: 20, big: 100, jackpot: 500 };

export interface SpinResult {
  reels: [string, string, string];
  outcome: Outcome;
  payout: number;
  credits: number;
}
export interface HistoryEntry extends SpinResult { id: number }

function pickSymbol(): Symbol {
  let r = Math.random() * TOTAL_WEIGHT;
  for (const s of SYMBOLS) {
    if (r < s.weight) return s;
    r -= s.weight;
  }
  return SYMBOLS[0];
}

export class CasinoEngine {
  credits = 500;
  history: HistoryEntry[] = [];
  private seq = 0;

  canSpin() {
    return this.credits >= SPIN_COST;
  }

  spin(): SpinResult {
    this.credits -= SPIN_COST;
    const picks = [pickSymbol(), pickSymbol(), pickSymbol()];
    const reels: [string, string, string] = [picks[0].glyph, picks[1].glyph, picks[2].glyph];

    const allSame = picks[0].glyph === picks[1].glyph && picks[1].glyph === picks[2].glyph;
    const twoSame = !allSame && (picks[0].glyph === picks[1].glyph || picks[1].glyph === picks[2].glyph || picks[0].glyph === picks[2].glyph);

    let outcome: Outcome;
    if (allSame && picks[0].tier === "jackpot") outcome = "jackpot";
    else if (allSame && picks[0].tier === "big") outcome = "big";
    else if (allSame || twoSame) outcome = "small";
    else outcome = "loss";

    const payout = PAYOUT[outcome];
    this.credits += payout;
    saveBestScore("casino", this.credits);

    switch (outcome) {
      case "loss": Lovense.pulse(10, 200); break;
      case "small": Lovense.pulse(30, 400); break;
      case "big": Lovense.pulse(70, 600); break;
      case "jackpot": Lovense.pulse(100, 3000); break;
    }

    const entry: HistoryEntry = { id: this.seq++, reels, outcome, payout, credits: this.credits };
    this.history.unshift(entry);
    if (this.history.length > 8) this.history.length = 8;
    return entry;
  }

  recharge() {
    this.credits = 500;
  }

  destroy() {
    Lovense.mute();
  }
}
