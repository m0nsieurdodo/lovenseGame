"use client";

import { useEffect, useRef, useState } from "react";
import { GameShell } from "@/components/game-shell";
import { GlowBar, Card, CardTitle, Button } from "@/components/ui";
import { useLovense } from "@/components/lovense-provider";
import {
  CasinoEngine, GLYPHS, JACKPOTS, REELS, ROWS, SPIN_COST,
  type HistoryEntry, type SpinResult, type SymbolId,
} from "@/lib/casino-engine";

/* Couleurs des lettres façon saloon (cf. Q vert / A rouge / J violet). */
const LETTER_COLOR: Record<string, string> = {
  A: "text-danger",
  K: "text-[#f5a623]",
  Q: "text-success",
  J: "text-violet",
};

const ALL_GLYPHS = Object.values(GLYPHS);
const SPIN_TICK_MS = 70;
const FIRST_STOP_MS = 600;
const STOP_GAP_MS = 320;

type Grid = SymbolId[][];

const START_GRID: Grid = Array.from({ length: REELS }, (_, r) =>
  Array.from({ length: ROWS }, (_, row) => (["clover", "J", "Q", "K", "A"] as SymbolId[])[(r + row) % 5]),
);
const NO_WIN: boolean[][] = Array.from({ length: REELS }, () => Array(ROWS).fill(false));

export default function CasinoPage() {
  const { vibe } = useLovense();
  const engineRef = useRef<CasinoEngine>(new CasinoEngine());

  const [grid, setGrid] = useState<Grid>(START_GRID);
  const [stopped, setStopped] = useState<boolean[]>(Array(REELS).fill(true));
  const [winCells, setWinCells] = useState<boolean[][]>(NO_WIN);
  const [spinning, setSpinning] = useState(false);
  const [credits, setCredits] = useState(500);
  const [freeSpins, setFreeSpins] = useState(0);
  const [result, setResult] = useState<SpinResult | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    const engine = engineRef.current;
    const timers = timersRef.current;
    setCredits(engine.credits);
    return () => {
      timers.forEach(clearTimeout);
      engine.destroy();
    };
  }, []);

  const doSpin = () => {
    const engine = engineRef.current;
    if (spinning || !engine.canSpin()) return;

    const res = engine.spin(); // résultat tiré d'avance, révélé rouleau par rouleau
    setSpinning(true);
    setResult(null);
    setWinCells(NO_WIN);
    setStopped(Array(REELS).fill(false));
    setCredits(res.credits - res.totalWin); // mise débitée, gain affiché au settle
    setFreeSpins(engine.freeSpins - res.freeSpinsWon); // les spins gagnés se révèlent au settle

    const flags = Array(REELS).fill(false);
    const cycle = setInterval(() => {
      setGrid((prev) =>
        prev.map((col, r) => (flags[r] ? col : col.map(() => randomGlyphId()))),
      );
    }, SPIN_TICK_MS);

    // Suspense : si 2+ scatters/bonus, les derniers rouleaux trainent un peu plus.
    const tension = res.scatterCount >= 2 || res.grid.flat().filter((s) => s === "hat").length >= 2;

    for (let r = 0; r < REELS; r++) {
      const extra = tension && r >= 3 ? (r - 2) * 380 : 0;
      const t = setTimeout(() => {
        flags[r] = true;
        setGrid((prev) => prev.map((col, i) => (i === r ? res.grid[r] : col)));
        setStopped((prev) => prev.map((s, i) => (i === r ? true : s)));
        engine.reelTick(r);

        if (r === REELS - 1) {
          clearInterval(cycle);
          engine.settle(res);
          setResult(res);
          setWinCells(res.winCells);
          setCredits(res.credits);
          setFreeSpins(engine.freeSpins);
          setHistory([...engine.history]);
          setSpinning(false);
        }
      }, FIRST_STOP_MS + r * STOP_GAP_MS + extra);
      timersRef.current.push(t);
    }
  };

  const recharge = () => {
    engineRef.current.recharge();
    setCredits(engineRef.current.credits);
    setResult(null);
  };

  const broke = credits < SPIN_COST && freeSpins === 0;

  return (
    <GameShell title="Grand Saloon × Lovense" settingsExtra={<VibeMap />}>
      {/* Bannières jackpot */}
      <div className="flex flex-none gap-1.5">
        <JackpotBanner label="Minor" value={JACKPOTS.minor} className="border-success text-success" />
        <JackpotBanner label="Major" value={JACKPOTS.major} className="border-cyan text-cyan" />
        <JackpotBanner label="Grand" value={JACKPOTS.grand} className="border-danger text-danger" />
      </div>

      <div className="flex flex-none items-stretch gap-2">
        <Stat k="CRÉDITS" v={credits} />
        <Stat k="MISE" v={SPIN_COST} />
        <Stat k="FREE" v={freeSpins} highlight={freeSpins > 0} />
      </div>

      <div className="flex-none">
        <GlowBar value={vibe} />
      </div>

      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 overflow-y-auto py-1">
        {/* Machine 5×3 */}
        <div
          className="glass grid w-full max-w-[400px] grid-cols-5 gap-1.5 rounded-[16px] border border-line-soft p-3"
          style={{ boxShadow: "0 0 40px #8a2be233" }}
        >
          {Array.from({ length: ROWS }, (_, row) =>
            Array.from({ length: REELS }, (_, r) => {
              const sym = grid[r][row];
              const win = winCells[r][row];
              const glyph = GLYPHS[sym];
              const letter = LETTER_COLOR[glyph];
              return (
                <div
                  key={`${r}-${row}`}
                  className={`flex h-14 items-center justify-center rounded-[10px] border transition ${
                    win
                      ? "border-cyan bg-[#16123a] shadow-[0_0_14px_#22d3ee88]"
                      : "border-line bg-[#0d0b20]"
                  } ${spinning && !stopped[r] ? "animate-pulse opacity-70" : ""} ${
                    letter ? `text-2xl font-extrabold ${letter}` : "text-2xl"
                  }`}
                >
                  {glyph}
                </div>
              );
            }),
          )}
        </div>

        {/* Résultat */}
        <div className="flex min-h-[3rem] flex-col items-center justify-center text-center">
          {result && !spinning && <ResultBanner r={result} />}
        </div>

        {broke ? (
          <Button variant="danger" onClick={recharge}>↻ Recharger les crédits</Button>
        ) : (
          <Button variant="primary" onClick={doSpin} disabled={spinning} className="min-w-[180px]">
            {spinning ? "…" : freeSpins > 0 ? `🥃 SPIN GRATUIT (${freeSpins})` : "🎰 SPIN"}
          </Button>
        )}

        {/* Historique */}
        <div className="w-full max-w-[280px]">
          <div className="mb-1 text-[10px] uppercase tracking-widest text-muted">Historique</div>
          <div className="flex flex-col gap-1">
            {history.length === 0 && <div className="text-[11px] text-muted">Aucun spin pour l'instant.</div>}
            {history.map((h) => (
              <div key={h.id} className="flex items-center justify-between rounded-lg border border-line bg-[#0d0b20] px-2 py-1 text-xs">
                <span className={h.amount > 0 ? "text-success" : "text-muted"}>{h.label}</span>
                <span className="text-muted">{h.amount > 0 ? `+${h.amount}` : "-10"}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </GameShell>
  );
}

function randomGlyphId(): SymbolId {
  const ids = Object.keys(GLYPHS) as SymbolId[];
  return ids[(Math.random() * ids.length) | 0];
}

function JackpotBanner({ label, value, className }: { label: string; value: number; className: string }) {
  return (
    <div className={`flex flex-1 flex-col items-center rounded-[10px] border bg-[#0d0b20] px-1 py-1 ${className}`}>
      <span className="text-[10px] font-extrabold uppercase tracking-[2px]">{label}</span>
      <span className="font-mono text-sm font-extrabold tabular-nums text-ink">{value.toLocaleString("fr-FR")}</span>
    </div>
  );
}

function ResultBanner({ r }: { r: SpinResult }) {
  return (
    <>
      {r.jackpot && (
        <span className="text-lg font-extrabold uppercase tracking-widest text-danger">
          🤠 JACKPOT {r.jackpot.tier.toUpperCase()} +{r.jackpot.amount.toLocaleString("fr-FR")} !
        </span>
      )}
      {r.freeSpinsWon > 0 && (
        <span className="text-sm font-extrabold uppercase tracking-widest text-cyan">
          🥃 +{r.freeSpinsWon} spins gratuits !
        </span>
      )}
      {!r.jackpot && r.totalWin > 0 && (
        <span className="text-lg font-extrabold uppercase tracking-widest text-success">+{r.totalWin}</span>
      )}
      {!r.jackpot && !r.freeSpinsWon && r.totalWin === 0 && (
        <span className={`text-sm font-bold uppercase tracking-widest ${r.nearMiss ? "text-violet" : "text-muted"}`}>
          {r.nearMiss ? "Presque… 😏" : "Perdu"}
        </span>
      )}
      {r.mystery && (
        <span className="text-xs font-bold uppercase tracking-widest text-rose">⚡ Vibration mystère !</span>
      )}
    </>
  );
}

function Stat({ k, v, highlight = false }: { k: string; v: number; highlight?: boolean }) {
  return (
    <div className={`flex flex-1 flex-col justify-center rounded-[10px] border bg-[#0d0b20] px-2 py-1.5 ${highlight ? "border-cyan" : "border-line"}`}>
      <span className="text-[9px] tracking-widest text-muted">{k}</span>
      <span className={`font-mono text-xl font-extrabold leading-none tabular-nums ${highlight ? "text-cyan" : ""}`}>{v}</span>
    </div>
  );
}

function VibeMap() {
  return (
    <Card>
      <CardTitle>Intensités — Grand Saloon</CardTitle>
      <div className="text-[11px] leading-[1.9] text-muted">
        <b className="text-ink">Arrêt de rouleau</b> → tic 8-24% (croissant)
        <br />
        <b className="text-ink">Perte</b> → 12% courte
        <br />
        <b className="text-ink">Near-miss</b> (2×🥃 ou 2×🤠) → double tic tease
        <br />
        <b className="text-ink">Gain</b> → 35 / 55 / 75% selon le montant
        <br />
        <b className="text-ink">Très gros gain</b> → climax
        <br />
        <b className="text-ink">🥃 ×3+</b> → spins gratuits + rafale
        <br />
        <b className="text-ink">🤠 ×3+</b> → JACKPOT : Minor 85% · Major climax · Grand 100% en rafales 🔥
        <br />
        <b className="text-ink">Vibration mystère</b> → ~7% des spins, intensité aléatoire, en décalé ⚡
      </div>
    </Card>
  );
}
