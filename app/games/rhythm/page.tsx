"use client";

import { useEffect, useRef, useState } from "react";
import { GameShell } from "@/components/game-shell";
import { GlowBar, Card, CardTitle, Button } from "@/components/ui";
import { useLovense } from "@/components/lovense-provider";
import { RhythmEngine, PADS, type Pad } from "@/lib/rhythm-engine";

const KIND_LABEL: Record<Pad["kind"], string> = {
  steady: "continu",
  pattern: "pattern",
  random: "aléatoire",
};

export default function RhythmPage() {
  const { vibe } = useLovense();
  const engineRef = useRef<RhythmEngine>(new RhythmEngine());
  const [activeId, setActiveId] = useState<number | null>(null);

  useEffect(() => {
    const engine = engineRef.current;
    return () => engine.destroy();
  }, []);

  const tap = (padId: number) => {
    setActiveId(engineRef.current.toggle(padId));
  };

  const stopAll = () => {
    engineRef.current.stop();
    setActiveId(null);
  };

  const activePad = activeId !== null ? PADS.find((p) => p.id === activeId) : null;

  return (
    <GameShell title="Boîte à Rythme × Lovense" settingsExtra={<VibeMap />}>
      <div className="flex-none">
        <GlowBar value={vibe} />
      </div>

      {/* Pad actif */}
      <div className="flex h-8 flex-none items-center justify-center">
        {activePad ? (
          <span className="text-sm font-bold uppercase tracking-widest text-cyan">
            {activePad.icon} {activePad.label}
            <span className="ml-2 text-[10px] text-muted">({KIND_LABEL[activePad.kind]})</span>
          </span>
        ) : (
          <span className="text-xs tracking-widest text-muted">Touche un pad pour lancer une vibration</span>
        )}
      </div>

      {/* Grille 4×4 */}
      <div className="flex min-h-0 flex-1 flex-col justify-center gap-3">
        <div className="grid grid-cols-4 gap-2">
          {PADS.map((pad) => {
            const on = pad.id === activeId;
            return (
              <button
                key={pad.id}
                onClick={() => tap(pad.id)}
                className={`flex aspect-square select-none flex-col items-center justify-center gap-1 rounded-[14px] border transition active:scale-95 ${
                  on
                    ? "border-cyan bg-gradient-to-br from-[#1c1840] to-[#2a1550] shadow-[0_0_18px_#22d3ee66]"
                    : "border-line bg-[#0d0b20] hover:border-[#3a3670]"
                }`}
              >
                <span className={`text-2xl ${on ? "animate-pulse" : ""}`}>{pad.icon}</span>
                <span className={`text-[10px] font-bold uppercase tracking-wide ${on ? "text-cyan" : "text-muted"}`}>
                  {pad.label}
                </span>
                {pad.kind === "steady" && (
                  <span className="text-[9px] font-mono text-muted">{pad.intensity}%</span>
                )}
              </button>
            );
          })}
        </div>

        <Button variant="danger" onClick={stopAll} disabled={activeId === null} className="w-full">
          ⏹ STOP
        </Button>
      </div>
    </GameShell>
  );
}

function VibeMap() {
  return (
    <Card>
      <CardTitle>Pads — Boîte à Rythme</CardTitle>
      <div className="text-[11px] leading-[1.9] text-muted">
        <b className="text-ink">Rangée 1-2</b> → intensités continues 10 → 100%
        <br />
        <b className="text-ink">Cœur / Vague / Montée</b> → patterns progressifs en boucle
        <br />
        <b className="text-ink">Mitraille / Galop / SOS</b> → rythmes percussifs
        <br />
        <b className="text-ink">Tease</b> → alternances lentes imprévisibles 😏
        <br />
        <b className="text-ink">Chaos</b> → intensités et durées 100% aléatoires 🎲
        <br />
        <b className="text-ink">Climax</b> → rafales à 100% 💥
        <br />
        Un seul pad actif à la fois — ré-appuie dessus (ou STOP) pour couper.
      </div>
    </Card>
  );
}
