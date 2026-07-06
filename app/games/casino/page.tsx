"use client";

import { useEffect, useRef, useState } from "react";
import { GameShell } from "@/components/game-shell";
import { GlowBar, Card, CardTitle, Button } from "@/components/ui";
import { useLovense } from "@/components/lovense-provider";
import { CasinoEngine, type HistoryEntry, type Outcome } from "@/lib/casino-engine";

const OUTCOME_LABEL: Record<Outcome, string> = {
  loss: "Perdu",
  small: "Gain",
  big: "GROS GAIN",
  jackpot: "JACKPOT !",
};
const OUTCOME_COLOR: Record<Outcome, string> = {
  loss: "text-muted",
  small: "text-success",
  big: "text-violet",
  jackpot: "text-rose",
};

const SPIN_MS = 700;

export default function CasinoPage() {
  const { vibe } = useLovense();
  const engineRef = useRef<CasinoEngine>(new CasinoEngine());

  const [reels, setReels] = useState<[string, string, string]>(["🍒", "🍋", "🔔"]);
  const [spinning, setSpinning] = useState(false);
  const [credits, setCredits] = useState(500);
  const [lastOutcome, setLastOutcome] = useState<Outcome | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    const engine = engineRef.current;
    setCredits(engine.credits);
    return () => engine.destroy();
  }, []);

  const doSpin = () => {
    const engine = engineRef.current;
    if (spinning || !engine.canSpin()) return;
    setSpinning(true);
    setLastOutcome(null);

    const cycle = setInterval(() => {
      setReels([randomGlyph(), randomGlyph(), randomGlyph()]);
    }, 70);

    setTimeout(() => {
      clearInterval(cycle);
      const result = engine.spin();
      setReels(result.reels);
      setCredits(result.credits);
      setLastOutcome(result.outcome);
      setHistory([...engine.history]);
      setSpinning(false);
    }, SPIN_MS);
  };

  const recharge = () => {
    engineRef.current.recharge();
    setCredits(engineRef.current.credits);
    setLastOutcome(null);
  };

  return (
    <GameShell title="Mini Casino × Lovense" settingsExtra={<VibeMap />}>
      <div className="flex flex-none items-stretch gap-2">
        <Stat k="CRÉDITS" v={credits} />
        <Stat k="MISE" v={10} />
      </div>

      <div className="flex-none">
        <GlowBar value={vibe} />
      </div>

      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-5 overflow-y-auto py-2">
        {/* Machine */}
        <div className="glass flex gap-3 rounded-[16px] border border-line-soft p-5" style={{ boxShadow: "0 0 40px #8a2be233" }}>
          {reels.map((g, i) => (
            <div
              key={i}
              className={`flex h-20 w-16 items-center justify-center rounded-[10px] border border-line bg-[#0d0b20] text-4xl transition ${spinning ? "animate-pulse" : ""}`}
            >
              {g}
            </div>
          ))}
        </div>

        {/* Résultat */}
        <div className="h-6 text-center">
          {lastOutcome && !spinning && (
            <span className={`text-lg font-extrabold uppercase tracking-widest ${OUTCOME_COLOR[lastOutcome]}`}>
              {OUTCOME_LABEL[lastOutcome]}
            </span>
          )}
        </div>

        {credits < 10 ? (
          <Button variant="danger" onClick={recharge}>↻ Recharger les crédits</Button>
        ) : (
          <Button variant="primary" onClick={doSpin} disabled={spinning}>
            {spinning ? "…" : "🎰 SPIN"}
          </Button>
        )}

        {/* Historique */}
        <div className="w-full max-w-[280px]">
          <div className="mb-1 text-[10px] uppercase tracking-widest text-muted">Historique</div>
          <div className="flex flex-col gap-1">
            {history.length === 0 && <div className="text-[11px] text-muted">Aucun spin pour l'instant.</div>}
            {history.map((h) => (
              <div key={h.id} className="flex items-center justify-between rounded-lg border border-line bg-[#0d0b20] px-2 py-1 text-xs">
                <span>{h.reels.join(" ")}</span>
                <span className={OUTCOME_COLOR[h.outcome]}>{h.payout > 0 ? `+${h.payout}` : "—"}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </GameShell>
  );
}

function randomGlyph() {
  const g = ["🍒", "🍋", "🔔", "⭐", "💎", "7️⃣"];
  return g[(Math.random() * g.length) | 0];
}

function Stat({ k, v }: { k: string; v: number }) {
  return (
    <div className="flex flex-1 flex-col justify-center rounded-[10px] border border-line bg-[#0d0b20] px-2 py-1.5">
      <span className="text-[9px] tracking-widest text-muted">{k}</span>
      <span className="font-mono text-xl font-extrabold leading-none tabular-nums">{v}</span>
    </div>
  );
}

function VibeMap() {
  return (
    <Card>
      <CardTitle>Intensités — Mini Casino</CardTitle>
      <div className="text-[11px] leading-[1.9] text-muted">
        <b className="text-ink">Perte</b> → 10% courte
        <br />
        <b className="text-ink">Gain simple</b> → 30%
        <br />
        <b className="text-ink">Gros gain</b> → 70%
        <br />
        <b className="text-ink">Jackpot</b> → 100% pendant 3s 🔥
      </div>
    </Card>
  );
}
