"use client";

import { useEffect, useRef, useState } from "react";
import { GameShell } from "@/components/game-shell";
import { GlowBar, Card, CardTitle } from "@/components/ui";
import { useLovense } from "@/components/lovense-provider";
import { TetrisEngine, type Overlay, type Stats } from "@/lib/tetris-engine";
import { classifyTetrisGesture, type PointerPoint } from "@/lib/tetris-gestures";

export default function TetrisPage() {
  const { vibe } = useLovense();
  const boardRef = useRef<HTMLCanvasElement>(null);
  const nextRef = useRef<HTMLCanvasElement>(null);
  const shellRef = useRef<HTMLDivElement>(null);
  const gestureStart = useRef<PointerPoint | null>(null);
  const engineRef = useRef<TetrisEngine | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [canFullscreen, setCanFullscreen] = useState(false);

  const [stats, setStats] = useState<Stats>({ score: 0, lines: 0, level: 1 });
  const [overlay, setOverlay] = useState<Overlay>({
    show: true,
    title: "PRÊT ?",
    sub: "Ouvre l'onglet Réglages pour connecter ton Lovense, puis lance la partie.",
    btn: "▶ Jouer",
  });

  // Instanciation du moteur (client only) + gestion du redimensionnement.
  useEffect(() => {
    if (!boardRef.current || !nextRef.current) return;
    const engine = new TetrisEngine(boardRef.current, nextRef.current, {
      onStats: setStats,
      onOverlay: setOverlay,
    });
    engineRef.current = engine;
    engine.fit();

    const onResize = () => engine.fit();
    const onOrient = () => setTimeout(() => engine.fit(), 200);
    window.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", onOrient);
    window.visualViewport?.addEventListener("resize", onResize);

    // Inputs clavier
    const onKey = (e: KeyboardEvent) => {
      if (["ArrowLeft", "ArrowRight", "ArrowDown", "ArrowUp", " "].includes(e.key)) e.preventDefault();
      if (e.key === "p" || e.key === "P") return engine.togglePause();
      switch (e.key) {
        case "ArrowLeft": engine.move(-1); break;
        case "ArrowRight": engine.move(1); break;
        case "ArrowDown": engine.softDrop(); break;
        case "ArrowUp": case "x": case "X": engine.tryRotate(); break;
        case " ": engine.hardDrop(); break;
      }
    };
    window.addEventListener("keydown", onKey);

    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("orientationchange", onOrient);
      window.visualViewport?.removeEventListener("resize", onResize);
      window.removeEventListener("keydown", onKey);
      engine.destroy();
    };
  }, []);

  useEffect(() => {
    const syncFullscreen = () => setIsFullscreen(document.fullscreenElement === shellRef.current);
    setCanFullscreen(document.fullscreenEnabled);
    document.addEventListener("fullscreenchange", syncFullscreen);
    syncFullscreen();
    return () => document.removeEventListener("fullscreenchange", syncFullscreen);
  }, []);

  const toggleFullscreen = async () => {
    const shell = shellRef.current;
    if (!shell || !document.fullscreenEnabled) return;
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await shell.requestFullscreen();
    } catch {
      // Fullscreen is optional: the game remains playable in its normal viewport.
    }
  };

  const startOrResume = () => {
    const e = engineRef.current;
    if (!e) return;
    if (e.isPaused()) e.togglePause();
    else e.start();
  };

  // Auto-pause en quittant l'onglet Jeu.
  const onTabChange = (t: "game" | "settings") => {
    const e = engineRef.current;
    if (t === "settings" && e?.isRunning() && !e.isPaused()) e.togglePause();
    if (t === "game") requestAnimationFrame(() => e?.fit());
  };

  // Contrôles tactiles avec répétition au maintien.
  const bindTouch = (fn: () => void, repeat = false) => {
    let hold: ReturnType<typeof setTimeout> | null = null;
    let rep: ReturnType<typeof setInterval> | null = null;
    const start = (ev: React.PointerEvent) => {
      ev.preventDefault();
      fn();
      if (repeat) hold = setTimeout(() => (rep = setInterval(fn, 70)), 200);
    };
    const end = () => {
      if (hold) clearTimeout(hold);
      if (rep) clearInterval(rep);
      hold = rep = null;
    };
    return { onPointerDown: start, onPointerUp: end, onPointerLeave: end, onPointerCancel: end, onContextMenu: (e: React.MouseEvent) => e.preventDefault() };
  };

  const e = () => engineRef.current;

  const onBoardPointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    gestureStart.current = { x: event.clientX, y: event.clientY };
  };
  const onBoardPointerUp = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const start = gestureStart.current;
    gestureStart.current = null;
    if (!start) return;
    event.preventDefault();
    const cellSize = Math.max(8, event.currentTarget.clientWidth / 10);
    const gesture = classifyTetrisGesture(start, { x: event.clientX, y: event.clientY }, cellSize);
    const engine = e();
    if (!engine) return;
    if (gesture.action === "rotate") engine.tryRotate();
    if (gesture.action === "move") for (let i = 0; i < Math.abs(gesture.amount); i++) engine.move(Math.sign(gesture.amount));
    if (gesture.action === "soft_drop") for (let i = 0; i < gesture.amount; i++) engine.softDrop();
    if (gesture.action === "hard_drop") engine.hardDrop();
  };

  return (
    <GameShell
      title="Tetris × Lovense"
      onTabChange={onTabChange}
      settingsExtra={<VibeMap />}
      rootRef={shellRef}
      immersive={isFullscreen}
    >
      {/* HUD */}
      <div className="flex flex-none items-stretch gap-2">
        <Stat k="SCORE" v={stats.score} />
        <Stat k="LIGNES" v={stats.lines} />
        <Stat k="NIVEAU" v={stats.level} />
        <div className="flex flex-col items-center justify-center gap-0.5 rounded-[10px] border border-line bg-[#0d0b20] px-2 py-1.5">
          <span className="text-[9px] tracking-widest text-muted">SUIVANT</span>
          <canvas ref={nextRef} />
        </div>
        <button
          onClick={() => e()?.togglePause()}
          className="w-11 flex-none rounded-[10px] border border-line bg-[#0d0b20] text-lg text-ink active:border-cyan"
          title="Pause"
          aria-label="Mettre le jeu en pause"
        >
          ⏸
        </button>
        <button
          onClick={toggleFullscreen}
          disabled={!canFullscreen}
          className="w-11 flex-none rounded-[10px] border border-line bg-[#0d0b20] text-lg text-ink active:border-cyan disabled:opacity-40"
          title={isFullscreen ? "Quitter le plein écran" : "Plein écran"}
          aria-label={isFullscreen ? "Quitter le plein écran" : "Passer en plein écran"}
        >
          {isFullscreen ? "⤢" : "⛶"}
        </button>
      </div>

      {/* Barre de vibration */}
      <div className="flex-none">
        <GlowBar value={vibe} />
      </div>

      {/* Plateau */}
      <div className="flex min-h-0 flex-1 items-center justify-center">
        <div className="relative leading-[0]">
          <canvas
            ref={boardRef}
            width={300}
            height={600}
            className="block rounded-[14px] border-2 border-[#2b2750] bg-gradient-to-b from-[#0b0920] to-[#0a0818]"
            style={{ boxShadow: "0 0 40px #00e5ff22, inset 0 0 60px #0006", touchAction: "none" }}
            onPointerDown={onBoardPointerDown}
            onPointerUp={onBoardPointerUp}
            onPointerCancel={() => { gestureStart.current = null; }}
            aria-label="Plateau Tetris : glisse pour déplacer ou descendre, touche pour tourner"
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

      {/* Gestes directs sur le plateau ; les boutons restent une alternative tactile. */}
      <div className="flex-none text-center text-[10px] tracking-wide text-muted">Touche : tourner · Glisse : déplacer · Descends : drop</div>
      <div className="grid flex-none grid-cols-3 gap-2">
        <TouchBtn label="Gauche" bind={bindTouch(() => e()?.move(-1), true)} />
        <TouchBtn label="Tourner" bind={bindTouch(() => e()?.tryRotate())} />
        <TouchBtn label="Droite" bind={bindTouch(() => e()?.move(1), true)} />
        <div className="col-span-3 grid grid-cols-2 gap-2">
          <TouchBtn label="↓ Doux" bind={bindTouch(() => e()?.softDrop(), true)} small />
          <TouchBtn label="⤓ Hard" bind={bindTouch(() => e()?.hardDrop())} small />
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

function TouchBtn({ label, bind, small }: { label: string; bind: object; small?: boolean }) {
  return (
    <button
      {...bind}
      className={`select-none rounded-[10px] border border-[#3a3670] bg-[#1a1638] font-semibold text-ink transition active:border-cyan active:glow-low ${
        small ? "py-3 text-sm" : "py-4 text-2xl"
      }`}
      style={{ touchAction: "none" }}
    >
      {label}
    </button>
  );
}

function VibeMap() {
  return (
    <Card>
      <CardTitle>Intensités — Tetris</CardTitle>
      <div className="text-[11px] leading-[1.9] text-muted">
        <b className="text-ink">Pose</b> → 12% · <b className="text-ink">Rotation</b> → 6% · <b className="text-ink">Hard drop</b> → 18%
        <br />
        <b className="text-ink">1 ligne</b> → 28% · <b className="text-ink">2</b> → 44%
        <br />
        <b className="text-ink">3 lignes</b> → 62% · <b className="text-ink">4 (Tétris)</b> → 82%
        <br />
        <b className="text-ink">Tétris à la suite</b> → séquence maximale 🔥
      </div>
    </Card>
  );
}
