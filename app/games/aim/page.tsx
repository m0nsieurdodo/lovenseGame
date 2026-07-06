"use client";

import { useEffect, useRef, useState } from "react";
import { GameShell } from "@/components/game-shell";
import { GlowBar, Card, CardTitle } from "@/components/ui";
import { useLovense } from "@/components/lovense-provider";
import { AimEngine, type Stats, type Target } from "@/lib/aim-engine";
import type { Overlay } from "@/lib/engine-types";

export default function AimPage() {
  const { vibe } = useLovense();
  const engineRef = useRef<AimEngine | null>(null);
  const areaRef = useRef<HTMLDivElement>(null);

  const [stats, setStats] = useState<Stats>({ score: 0, combo: 0, timeLeft: 60_000, misses: 0 });
  const [target, setTarget] = useState<Target | null>(null);
  const [overlay, setOverlay] = useState<Overlay>({
    show: true,
    title: "PRÊT ?",
    sub: "Clique les cibles le plus vite possible. 60 secondes chrono.",
    btn: "▶ Jouer",
  });

  useEffect(() => {
    const engine = new AimEngine({ onStats: setStats, onTarget: setTarget, onOverlay: setOverlay });
    engineRef.current = engine;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "p" || e.key === "P") engine.togglePause();
    };
    window.addEventListener("keydown", onKeyDown);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      engine.destroy();
    };
  }, []);

  const startOrResume = () => {
    const e = engineRef.current;
    if (!e) return;
    if (e.isPaused()) e.togglePause();
    else e.start();
  };

  const onTabChange = (t: "game" | "settings") => {
    const e = engineRef.current;
    if (t === "settings" && e?.isRunning() && !e.isPaused()) e.togglePause();
  };

  const onAreaClick = (ev: React.MouseEvent) => {
    // clic géré par la cible elle-même (stopPropagation) ; ici on ne reçoit que les ratés.
    engineRef.current?.missClick();
  };

  return (
    <GameShell title="Aim Trainer × Lovense" onTabChange={onTabChange} settingsExtra={<VibeMap />}>
      <div className="flex flex-none items-stretch gap-2">
        <Stat k="TEMPS" v={`${Math.ceil(stats.timeLeft / 1000)}s`} />
        <Stat k="HITS" v={stats.score} />
        <Stat k="COMBO" v={stats.combo} />
        <button
          onClick={() => engineRef.current?.togglePause()}
          className="w-11 flex-none rounded-[10px] border border-line bg-[#0d0b20] text-lg text-ink active:border-cyan"
          title="Pause"
        >
          ⏸
        </button>
      </div>

      <div className="flex-none">
        <GlowBar value={vibe} />
      </div>

      <div className="flex min-h-0 flex-1">
        <div
          ref={areaRef}
          onPointerDown={onAreaClick}
          className="relative w-full flex-1 overflow-hidden rounded-[14px] border-2 border-[#2b2750] bg-gradient-to-b from-[#0b0920] to-[#0a0818]"
          style={{ boxShadow: "0 0 40px #00e5ff22, inset 0 0 60px #0006", touchAction: "none" }}
        >
          {target && (
            <button
              key={target.key}
              onPointerDown={(e) => { e.stopPropagation(); engineRef.current?.hitTarget(target.key); }}
              className="absolute h-11 w-11 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-rose bg-rose/20 transition active:scale-90"
              style={{
                left: `${target.x}%`,
                top: `${target.y}%`,
                boxShadow: "0 0 20px #ff3df2aa, inset 0 0 12px #ff3df255",
              }}
              aria-label="Cible"
            />
          )}
          {overlay.show && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[#05040ccc] p-4 text-center backdrop-blur-sm">
              <h2 className="m-0 text-2xl tracking-[2px]">{overlay.title}</h2>
              <div className="max-w-[260px] text-[11px] leading-relaxed text-muted">{overlay.sub}</div>
              <button
                onPointerDown={(e) => { e.stopPropagation(); startOrResume(); }}
                className="cursor-pointer rounded-[10px] border-none bg-gradient-to-r from-cyan to-rose px-5 py-2.5 font-bold text-[#06040f]"
              >
                {overlay.btn}
              </button>
            </div>
          )}
        </div>
      </div>
    </GameShell>
  );
}

function Stat({ k, v }: { k: string; v: number | string }) {
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
      <CardTitle>Intensités — Aim Trainer</CardTitle>
      <div className="text-[11px] leading-[1.9] text-muted">
        <b className="text-ink">Hit</b> → 0.2s (10-20%)
        <br />
        <b className="text-ink">Combo x10</b> → continue légère
        <br />
        <b className="text-ink">Combo x25</b> → forte pulsée 🔥
        <br />
        <b className="text-ink">Miss</b> → baisse légère
      </div>
    </Card>
  );
}
