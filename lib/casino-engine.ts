/* ============================================================
   GRAND SALOON ENGINE — machine à sous western 5 rouleaux × 3 lignes.

   Règles (inspirées des slots saloon) :
     - 5 lignes de paiement : 3 horizontales + V + Λ.
       Gain si 3+ symboles identiques consécutifs depuis la gauche.
     - 🥃 whisky = scatter → 3+ n'importe où = spins gratuits.
     - 🤠 chapeau = bonus → 3+ n'importe où = tirage jackpot
       MINOR (500) / MAJOR (2000) / GRAND (10000), pondéré.
     - Near-miss : 2 scatters/bonus → double tic de tease.
     - Vibration mystère : ~7% des spins, intensité et durée
       aléatoires, déclenchée avec un léger délai surprise.

   Mapping vibration :
     tick rouleau   → 8-24% (croissant, à chaque arrêt)
     perte          → 12% courte
     near-miss      → double tic 25%
     gain           → 35 / 55 / 75% selon le montant
     très gros gain → climax
     jackpot MINOR  → 85% pendant 1,8s
     jackpot MAJOR  → climax
     jackpot GRAND  → séquence 100% ≈ 3,5s 🔥
     mystère        → 20-100% aléatoire
   ============================================================ */
import { Lovense } from "./lovense";
import { saveBestScore } from "./settings";

export const REELS = 5;
export const ROWS = 3;
export const SPIN_COST = 10;

export type SymbolId = "J" | "Q" | "K" | "A" | "clover" | "bag" | "gun" | "whisky" | "hat";

interface SymbolDef {
  id: SymbolId;
  glyph: string;
  weight: number;
  pay: [number, number, number]; // gain pour 3 / 4 / 5 alignés
  pay2?: number; // micro-gain dès 2 alignés (symbole le plus commun)
  kind: "normal" | "scatter" | "bonus";
}

const SYMBOLS: SymbolDef[] = [
  { id: "clover", glyph: "🍀", weight: 20, pay: [15, 35, 90], pay2: 5, kind: "normal" },
  { id: "J", glyph: "J", weight: 18, pay: [25, 50, 110], kind: "normal" },
  { id: "Q", glyph: "Q", weight: 16, pay: [25, 50, 110], kind: "normal" },
  { id: "K", glyph: "K", weight: 14, pay: [30, 60, 130], kind: "normal" },
  { id: "A", glyph: "A", weight: 12, pay: [35, 80, 160], kind: "normal" },
  { id: "bag", glyph: "💰", weight: 8, pay: [50, 120, 250], kind: "normal" },
  { id: "gun", glyph: "🔫", weight: 6, pay: [80, 200, 400], kind: "normal" },
  { id: "whisky", glyph: "🥃", weight: 5, pay: [20, 50, 150], kind: "scatter" }, // pay = bonus crédits pour 3/4/5 scatters
  { id: "hat", glyph: "🤠", weight: 2, pay: [0, 0, 0], kind: "bonus" },
];
const TOTAL_WEIGHT = SYMBOLS.reduce((s, x) => s + x.weight, 0);
const BY_ID = Object.fromEntries(SYMBOLS.map((s) => [s.id, s])) as Record<SymbolId, SymbolDef>;

export const GLYPHS: Record<SymbolId, string> = Object.fromEntries(
  SYMBOLS.map((s) => [s.id, s.glyph]),
) as Record<SymbolId, string>;

export type JackpotTier = "minor" | "major" | "grand";
export const JACKPOTS: Record<JackpotTier, number> = { minor: 500, major: 2000, grand: 10000 };
const JACKPOT_WEIGHTS: [JackpotTier, number][] = [["minor", 70], ["major", 25], ["grand", 5]];

/* Lignes de paiement : index de rangée pour chaque rouleau. */
const PAYLINES: number[][] = [
  [1, 1, 1, 1, 1], // milieu
  [0, 0, 0, 0, 0], // haut
  [2, 2, 2, 2, 2], // bas
  [0, 1, 2, 1, 0], // V
  [2, 1, 0, 1, 2], // Λ
];

export interface LineWin {
  line: number;
  symbol: SymbolId;
  count: number;
  amount: number;
}

export interface SpinResult {
  grid: SymbolId[][]; // [rouleau][rangée]
  lineWins: LineWin[];
  winCells: boolean[][]; // [rouleau][rangée] — cellules gagnantes à illuminer
  scatterCount: number;
  freeSpinsWon: number;
  jackpot: { tier: JackpotTier; amount: number } | null;
  mystery: { pct: number } | null;
  nearMiss: boolean;
  totalWin: number;
  credits: number;
  free: boolean; // ce spin était un spin gratuit
}

export interface HistoryEntry {
  id: number;
  label: string;
  amount: number; // gain total (0 = perte)
}

function pickSymbol(): SymbolDef {
  let r = Math.random() * TOTAL_WEIGHT;
  for (const s of SYMBOLS) {
    if (r < s.weight) return s;
    r -= s.weight;
  }
  return SYMBOLS[0];
}

function drawJackpot(): JackpotTier {
  let r = Math.random() * 100;
  for (const [tier, w] of JACKPOT_WEIGHTS) {
    if (r < w) return tier;
    r -= w;
  }
  return "minor";
}

export class CasinoEngine {
  credits = 500;
  freeSpins = 0;
  history: HistoryEntry[] = [];
  private seq = 0;

  canSpin() {
    return this.freeSpins > 0 || this.credits >= SPIN_COST;
  }

  /** Tick haptique à chaque arrêt de rouleau (i = 0..4, de plus en plus fort). */
  reelTick(i: number) {
    Lovense.pulse(8 + i * 4, 130);
  }

  /** Tire le résultat complet du spin (sans vibrer — voir settle()). */
  spin(): SpinResult {
    const free = this.freeSpins > 0;
    if (free) this.freeSpins--;
    else this.credits -= SPIN_COST;

    const grid: SymbolId[][] = [];
    for (let r = 0; r < REELS; r++) {
      grid.push([pickSymbol().id, pickSymbol().id, pickSymbol().id]);
    }

    /* ---- lignes de paiement ---- */
    const lineWins: LineWin[] = [];
    const winCells: boolean[][] = grid.map((col) => col.map(() => false));
    PAYLINES.forEach((rows, li) => {
      const first = grid[0][rows[0]];
      if (BY_ID[first].kind !== "normal") return;
      let count = 1;
      while (count < REELS && grid[count][rows[count]] === first) count++;
      const def = BY_ID[first];
      const amount = count >= 3 ? def.pay[count - 3] : count === 2 && def.pay2 ? def.pay2 : 0;
      if (amount > 0) {
        lineWins.push({ line: li, symbol: first, count, amount });
        for (let r = 0; r < count; r++) winCells[r][rows[r]] = true;
      }
    });

    /* ---- scatter (spins gratuits) & bonus (jackpot) ---- */
    const countAll = (id: SymbolId) => grid.flat().filter((s) => s === id).length;
    const scatterCount = countAll("whisky");
    const hatCount = countAll("hat");

    const freeSpinsWon = scatterCount >= 3 ? scatterCount : 0;
    let scatterPay = 0;
    if (freeSpinsWon) {
      this.freeSpins += freeSpinsWon;
      scatterPay = BY_ID.whisky.pay[Math.min(scatterCount, 5) - 3];
      grid.forEach((col, r) => col.forEach((s, row) => { if (s === "whisky") winCells[r][row] = true; }));
    }

    let jackpot: SpinResult["jackpot"] = null;
    if (hatCount >= 3) {
      const tier = drawJackpot();
      jackpot = { tier, amount: JACKPOTS[tier] };
      grid.forEach((col, r) => col.forEach((s, row) => { if (s === "hat") winCells[r][row] = true; }));
    }

    /* ---- surprises ---- */
    const mystery = Math.random() < 0.07 ? { pct: Math.round(20 + Math.random() * 80) } : null;
    const nearMiss = !jackpot && !freeSpinsWon && (scatterCount === 2 || hatCount === 2);

    const totalWin = lineWins.reduce((s, w) => s + w.amount, 0) + scatterPay + (jackpot?.amount ?? 0);
    this.credits += totalWin;
    saveBestScore("casino", this.credits);

    /* ---- historique ---- */
    let label: string;
    if (jackpot) label = `🤠 ${jackpot.tier.toUpperCase()} +${jackpot.amount}`;
    else if (freeSpinsWon) label = `🥃 +${freeSpinsWon} spins${totalWin > 0 ? ` +${totalWin}` : ""}`;
    else if (totalWin > 0) label = `+${totalWin}`;
    else label = "—";
    this.history.unshift({ id: this.seq++, label, amount: totalWin });
    if (this.history.length > 8) this.history.length = 8;

    return {
      grid, lineWins, winCells, scatterCount, freeSpinsWon,
      jackpot, mystery, nearMiss, totalWin, credits: this.credits, free,
    };
  }

  /** À appeler quand le dernier rouleau est affiché : joue la séquence haptique. */
  settle(r: SpinResult) {
    if (r.jackpot) {
      if (r.jackpot.tier === "grand") {
        this.burst([[70, 300], [100, 500], [60, 150], [100, 700], [80, 200], [100, 1500]]);
      } else if (r.jackpot.tier === "major") {
        Lovense.climax();
      } else {
        Lovense.pulse(85, 1800);
      }
    } else if (r.freeSpinsWon) {
      this.burst([[65, 220], [0, 120], [65, 220], [0, 120], [80, 450]]);
    } else if (r.totalWin >= 300) {
      Lovense.climax();
    } else if (r.totalWin >= 120) {
      Lovense.pulse(75, 1300);
    } else if (r.totalWin >= 40) {
      Lovense.pulse(55, 800);
    } else if (r.totalWin > 0) {
      Lovense.pulse(35, 500);
    } else if (r.nearMiss) {
      this.burst([[25, 150], [0, 100], [25, 320]]);
    } else {
      Lovense.pulse(12, 200);
    }

    // Vibration mystère : arrive en décalé, quand on ne l'attend plus.
    if (r.mystery) {
      const { pct } = r.mystery;
      setTimeout(() => Lovense.pulse(pct, 400 + Math.random() * 1100), 500 + Math.random() * 700);
    }
  }

  /** Joue une séquence d'impulsions enchaînées. */
  private burst(steps: [number, number][]) {
    let t = 0;
    for (const [pct, ms] of steps) {
      setTimeout(() => Lovense.pulse(pct, ms + 150), t);
      t += ms;
    }
  }

  recharge() {
    this.credits = 500;
  }

  destroy() {
    Lovense.mute();
  }
}
