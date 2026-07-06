"use client";

import { useEffect, useRef, useState } from "react";
import { GameShell } from "@/components/game-shell";
import { GlowBar, Card, CardTitle } from "@/components/ui";
import { useLovense } from "@/components/lovense-provider";
import { SnakeEngine, type Stats } from "@/lib/snake-engine";
import type { Overlay } from "@/lib/engine-types";

export default function SnakePage() {
  const { vibe } = useLovense();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<SnakeEngine | null>(null);

  const [stats, setStats] = useState<Stats>({ score: 0, length: 3 });
  const [overlay, setOverlay] = useState<Overlay>({
    show: true,
    title: "PRÊT ?",
    sub: "Dirige le serpent vers la nourriture. Ne te mords pas la queue !",
    btn: "▶ Jouer",
  });

  useEffect(() => {
    if (!canvasRef.current) return;
    const engine = new SnakeEngine(canvasRef.current, { onStats: setStats, onOverlay: setOverlay });
    engineRef.current = engine;
    engine.fit();

    const onResize = () => engine.fit();
    window.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", onResize);
    window.visualViewport?.addEventListener("resize", onResize);

    const onKeyDown = (e: KeyboardEvent) => {
      if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) e.preventDefault();
      if (e.key === "p" || e.key === "P") return engine.togglePause();
      if (e.key === "ArrowLeft") engine.setDirection("left");
      if (e.key === "ArrowRight") engine.setDirection("right");
      if (e.key === "ArrowUp") engine.setDirection("up");
      if (e.key === "ArrowDown") engine.setDirection("down");
    };
    window.addEventListener("keydown", onKeyDown);

    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("orientationchange", onResize);
      window.visualViewport?.removeEventListener("resize", onResize);
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
    if (t === "game") requestAnimationFrame(() => e?.fit());
  };

  return (
    <GameShell title="Snake × Lovense" onTabChange={onTabChange} settingsExtra={<VibeMap />}>
      <div className="flex flex-none items-stretch gap-2">
        <Stat k="SCORE" v={stats.score} />
        <Stat k="LONGUEUR" v={stats.length} />
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
            className="mx-auto block h-full rounded-[14px] border-2 border-[#2b2750] bg-gradient-to-b from-[#0b0920] to-[#0a0818]"
            style={{ boxShadow: "0 0 40px #00e5ff22, inset 0 0 60px #0006", touchAction: "none" }}
          />
          {overlay.show && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-[14px] bg-[#05040ccc] p-4 text-center backdrop-blur-sm">
              <h2 className="m-0 text-2xl tracking-[2px]">{overlay.title}</h2>
              <div className="max-w-[240px] text-[11px] leading-relaxed text-muted">{overlay.sub}</div>
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

      {/* D-pad tactile */}
      <div className="grid flex-none grid-cols-3 grid-rows-2 gap-2">
        <div />
        <DPadBtn label="▲" onPress={() => engineRef.current?.setDirection("up")} />
        <div />
        <DPadBtn label="◀" onPress={() => engineRef.current?.setDirection("left")} />
        <DPadBtn label="▼" onPress={() => engineRef.current?.setDirection("down")} />
        <DPadBtn label="▶" onPress={() => engineRef.current?.setDirection("right")} />
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

function DPadBtn({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <button
      onPointerDown={(e) => { e.preventDefault(); onPress(); }}
      onContextMenu={(e) => e.preventDefault()}
      className="select-none rounded-[10px] border border-[#3a3670] bg-[#1a1638] py-3 text-xl font-semibold text-ink transition active:border-cyan active:glow-low"
      style={{ touchAction: "none" }}
    >
      {label}
    </button>
  );
}

function VibeMap() {
  return (
    <Card>
      <CardTitle>Intensités — Snake</CardTitle>
      <div className="text-[11px] leading-[1.9] text-muted">
        <b className="text-ink">Nourriture</b> → 10-20%
        <br />
        <b className="text-ink">Tous les 5 fruits</b> → +10% permanent
        <br />
        <b className="text-ink">Collision</b> → 100% puis stop 🔥
      </div>
    </Card>
  );
}
