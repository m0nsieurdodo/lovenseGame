"use client";

import { useEffect, useRef, useState } from "react";
import { GameShell } from "@/components/game-shell";
import { GlowBar, Card, CardTitle } from "@/components/ui";
import { useLovense } from "@/components/lovense-provider";
import { PongEngine, type Stats } from "@/lib/pong-engine";
import type { Overlay } from "@/lib/engine-types";

export default function PongPage() {
  const { vibe } = useLovense();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<PongEngine | null>(null);

  const [stats, setStats] = useState<Stats>({ player: 0, ai: 0, combo: 0 });
  const [overlay, setOverlay] = useState<Overlay>({
    show: true,
    title: "PRÊT ?",
    sub: "Déplace ta raquette (bas, cyan) au doigt ou avec ← →. Premier à 7 points gagne.",
    btn: "▶ Jouer",
  });

  useEffect(() => {
    if (!canvasRef.current) return;
    const engine = new PongEngine(canvasRef.current, { onStats: setStats, onOverlay: setOverlay });
    engineRef.current = engine;
    engine.fit();

    const onResize = () => engine.fit();
    window.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", onResize);
    window.visualViewport?.addEventListener("resize", onResize);

    const onKeyDown = (e: KeyboardEvent) => {
      if (["ArrowLeft", "ArrowRight"].includes(e.key)) e.preventDefault();
      if (e.key === "p" || e.key === "P") return engine.togglePause();
      if (e.key === "ArrowLeft") engine.setMoveDir(-1);
      if (e.key === "ArrowRight") engine.setMoveDir(1);
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft" || e.key === "ArrowRight") engine.setMoveDir(0);
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);

    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("orientationchange", onResize);
      window.visualViewport?.removeEventListener("resize", onResize);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
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
    if (t === "game") requestAnimationFrame(() => e?.fit());
  };

  const toGameX = (clientX: number) => {
    const cv = canvasRef.current;
    if (!cv) return 0;
    const rect = cv.getBoundingClientRect();
    return ((clientX - rect.left) / rect.width) * 300;
  };
  const onPointerDown = (ev: React.PointerEvent) => engineRef.current?.setPointerX(toGameX(ev.clientX));
  const onPointerMove = (ev: React.PointerEvent) => {
    if (ev.buttons === 0 && ev.pointerType === "mouse") return;
    engineRef.current?.setPointerX(toGameX(ev.clientX));
  };
  const onPointerUp = () => engineRef.current?.setPointerX(null);

  return (
    <GameShell title="Pong × Lovense" onTabChange={onTabChange} settingsExtra={<VibeMap />}>
      <div className="flex flex-none items-stretch gap-2">
        <Stat k="TOI" v={stats.player} />
        <Stat k="IA" v={stats.ai} />
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

      <div className="flex min-h-0 flex-1 items-center justify-center">
        <div className="relative h-full w-full leading-[0]">
          <canvas
            ref={canvasRef}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerLeave={onPointerUp}
            className="mx-auto block h-full rounded-[14px] border-2 border-[#2b2750] bg-gradient-to-b from-[#0b0920] to-[#0a0818]"
            style={{ boxShadow: "0 0 40px #00e5ff22, inset 0 0 60px #0006", touchAction: "none" }}
          />
          {overlay.show && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-[14px] bg-[#05040ccc] p-4 text-center backdrop-blur-sm">
              <h2 className="m-0 text-2xl tracking-[2px]">{overlay.title}</h2>
              <div className="max-w-[260px] text-[11px] leading-relaxed text-muted">{overlay.sub}</div>
              <button
                onClick={startOrResume}
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
      <CardTitle>Intensités — Pong</CardTitle>
      <div className="text-[11px] leading-[1.9] text-muted">
        <b className="text-ink">Échange</b> → 5-10%
        <br />
        <b className="text-ink">Combo 5 échanges</b> → +10% cumulatif
        <br />
        <b className="text-ink">Point marqué</b> → 80% pendant 0.5s
        <br />
        <b className="text-ink">Point perdu</b> → stop
      </div>
    </Card>
  );
}
