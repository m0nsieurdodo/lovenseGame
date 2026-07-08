"use client";

import { useEffect, useRef, useState } from "react";
import { GameShell } from "@/components/game-shell";
import { Card, CardTitle, GlowBar } from "@/components/ui";
import { useLovense } from "@/components/lovense-provider";
import { DescenteGame, type DescenteStats } from "@/lib/descente/game/game";
import { ArcadeLovense } from "@/lib/descente/lovense/arcade-adapter";
import { getRelic } from "@/lib/descente/engine/relics";
import type { CurveKind } from "@/lib/descente/engine/curves";
import type { HeatState } from "@/lib/descente/engine/heat-machine";
import type { Overlay } from "@/lib/engine-types";

const CURVE_KEY = "descente-curve";
const STATE_LABEL: Record<HeatState, string> = {
  idle: "CALME",
  rising: "MONTÉE",
  spiking: "SPIKE",
  decaying: "RETOMBÉE",
};

const INITIAL_STATS: DescenteStats = {
  hp: 6,
  maxHp: 6,
  floor: 1,
  cleared: 0,
  total: 0,
  relics: [],
  haptic: { heat: 0, state: "idle", intensity: 0, killed: false },
};

export default function DescentePage() {
  const { vibe } = useLovense();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<DescenteGame | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [stats, setStats] = useState<DescenteStats>(INITIAL_STATS);
  const [toast, setToast] = useState<string | null>(null);
  const [curve, setCurve] = useState<CurveKind>("linear");
  const [overlay, setOverlay] = useState<Overlay>({
    show: true,
    title: "DESCENTE",
    sub: "Plus tu t'exposes au danger, plus ça monte. Reste en salle sûre pour laisser retomber… ou pousse plus loin. Espace = STOP immédiat.",
    btn: "▶ Descendre",
  });

  useEffect(() => {
    if (!canvasRef.current) return;
    const game = new DescenteGame(
      canvasRef.current,
      {
        onStats: setStats,
        onOverlay: setOverlay,
        onToast: (msg) => {
          setToast(msg);
          if (toastTimer.current) clearTimeout(toastTimer.current);
          toastTimer.current = setTimeout(() => setToast(null), 2400);
        },
      },
      new ArcadeLovense(),
    );
    gameRef.current = game;
    (window as unknown as { __descente?: DescenteGame }).__descente = game; // debug console
    game.fit();

    const saved = localStorage.getItem(CURVE_KEY);
    if (saved === "easeIn" || saved === "linear") {
      setCurve(saved);
      game.setCurve(saved);
    }

    const onResize = () => game.fit();
    window.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", onResize);
    window.visualViewport?.addEventListener("resize", onResize);

    const onKeyDown = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (["arrowleft", "arrowright", "arrowup", "arrowdown", " "].includes(k)) e.preventDefault();
      if (e.repeat) return;
      if (k === " ") return game.killSwitch(); // kill switch immédiat
      if (k === "p") return game.togglePause();
      if (["x", "j", "k", "enter"].includes(k)) return game.attack();
      if (k === "arrowleft" || k === "q" || k === "a") game.setMove("left", true);
      if (k === "arrowright" || k === "d") game.setMove("right", true);
      if (k === "arrowup" || k === "z" || k === "w") game.setMove("up", true);
      if (k === "arrowdown" || k === "s") game.setMove("down", true);
    };
    const onKeyUp = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (k === "arrowleft" || k === "q" || k === "a") game.setMove("left", false);
      if (k === "arrowright" || k === "d") game.setMove("right", false);
      if (k === "arrowup" || k === "z" || k === "w") game.setMove("up", false);
      if (k === "arrowdown" || k === "s") game.setMove("down", false);
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);

    // Onglet caché → rAF gelé → le toy resterait bloqué sur le dernier niveau.
    // Auto-pause de sécurité (coupe le toy, le heat est gelé).
    const onVisibility = () => {
      if (document.hidden && game.isRunning() && !game.isPaused()) game.togglePause();
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("orientationchange", onResize);
      window.visualViewport?.removeEventListener("resize", onResize);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      document.removeEventListener("visibilitychange", onVisibility);
      if (toastTimer.current) clearTimeout(toastTimer.current);
      game.destroy();
    };
  }, []);

  const startOrResume = () => {
    const g = gameRef.current;
    if (!g) return;
    if (g.isPaused()) g.togglePause();
    else g.start();
  };

  const onTabChange = (t: "game" | "settings") => {
    const g = gameRef.current;
    if (t === "settings" && g?.isRunning() && !g.isPaused()) g.togglePause();
    if (t === "game") requestAnimationFrame(() => g?.fit());
  };

  const changeCurve = (c: CurveKind) => {
    setCurve(c);
    localStorage.setItem(CURVE_KEY, c);
    gameRef.current?.setCurve(c);
  };

  const hearts = "♥".repeat(stats.hp) + "♡".repeat(Math.max(0, stats.maxHp - stats.hp));
  const h = stats.haptic;

  return (
    <GameShell title="Descente × Lovense" onTabChange={onTabChange} settingsExtra={<DescenteSettings curve={curve} onCurve={changeCurve} />}>
      {/* Stats */}
      <div className="flex flex-none items-stretch gap-2">
        <Stat k="PV" v={hearts} accent="#ff3d7a" />
        <Stat k="ÉTAGE" v={String(stats.floor)} />
        <Stat k="SALLES" v={`${stats.cleared}/${stats.total}`} />
        <button
          onClick={() => gameRef.current?.togglePause()}
          className="w-11 flex-none rounded-[10px] border border-line bg-[#0d0b20] text-lg text-ink active:border-cyan"
          title="Pause"
        >
          ⏸
        </button>
      </div>

      {/* Jauges heat + intensité toy (debug/feedback) */}
      <div className="flex flex-none flex-col gap-1.5">
        <div className="flex items-center gap-2">
          <span className="w-14 text-[9px] tracking-widest text-muted">
            HEAT <b className="text-ink">{Math.round(h.heat)}</b>
          </span>
          <div className="h-3 flex-1 overflow-hidden rounded-full border border-line bg-[#0d0b20]">
            <div
              className="h-full rounded-full transition-[width] duration-150"
              style={{
                width: `${h.heat}%`,
                background: "linear-gradient(90deg, #ffc94d, #ff3d7a, #ff2d55)",
                boxShadow: h.state === "spiking" ? "0 0 12px #ff2d55" : "0 0 6px #ff3d7a66",
              }}
            />
          </div>
          <span className={`w-16 text-right text-[9px] tracking-widest ${h.state === "spiking" ? "text-[#ff2d55]" : "text-muted"}`}>
            {STATE_LABEL[h.state]}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-14 text-[9px] tracking-widest text-muted">
            TOY <b className="text-ink">{Math.round(h.intensity)}/20</b>
          </span>
          <div className="flex-1">
            <GlowBar value={vibe} />
          </div>
          <span className="w-16 text-right text-[9px] tracking-widest text-muted">
            {stats.relics.map((id) => (
              <span key={id} title={getRelic(id)?.name}>
                {getRelic(id)?.icon}
              </span>
            ))}
          </span>
        </div>
      </div>

      {/* Kill switch */}
      {h.killed ? (
        <button
          onClick={() => gameRef.current?.rearm()}
          className="flex-none rounded-[10px] border border-[#ff2d55] bg-[#2a0a14] py-2 text-[12px] font-bold tracking-wide text-[#ff8aa5]"
        >
          ⛔ TOY COUPÉ — toucher pour réarmer
        </button>
      ) : (
        <button
          onClick={() => gameRef.current?.killSwitch()}
          className="flex-none rounded-[10px] border border-line bg-[#0d0b20] py-1.5 text-[11px] font-bold tracking-wide text-muted active:border-[#ff2d55] active:text-[#ff8aa5]"
        >
          ⛔ STOP TOY (Espace)
        </button>
      )}

      {/* Scène */}
      <div className="flex min-h-0 flex-1 items-center justify-center">
        <div className="relative flex h-full w-full items-center justify-center leading-[0]">
          <canvas
            ref={canvasRef}
            className="block rounded-[14px] border-2 border-[#2b2750] bg-gradient-to-b from-[#0b0920] to-[#0a0818]"
            style={{ boxShadow: "0 0 40px #8a2be222, inset 0 0 60px #0006", touchAction: "none" }}
          />
          {toast && (
            <div className="pointer-events-none absolute top-3 left-1/2 -translate-x-1/2 rounded-full border border-line bg-[#05040cdd] px-4 py-1.5 text-[11px] tracking-wide text-ink backdrop-blur-sm">
              {toast}
            </div>
          )}
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

      {/* Contrôles tactiles : d-pad + attaque */}
      <div className="flex flex-none items-stretch gap-2">
        <div className="grid flex-1 grid-cols-3 grid-rows-2 gap-1.5">
          <div />
          <PadBtn label="▲" dir="up" gameRef={gameRef} />
          <div />
          <PadBtn label="◀" dir="left" gameRef={gameRef} />
          <PadBtn label="▼" dir="down" gameRef={gameRef} />
          <PadBtn label="▶" dir="right" gameRef={gameRef} />
        </div>
        <button
          onPointerDown={(e) => {
            e.preventDefault();
            gameRef.current?.attack();
          }}
          onContextMenu={(e) => e.preventDefault()}
          className="w-24 select-none rounded-[10px] border border-[#5a2a50] bg-[#2a1030] text-2xl font-semibold text-ink transition active:border-rose"
          style={{ touchAction: "none" }}
        >
          ⚔
        </button>
      </div>
    </GameShell>
  );
}

function Stat({ k, v, accent }: { k: string; v: string; accent?: string }) {
  return (
    <div className="flex flex-1 flex-col justify-center rounded-[10px] border border-line bg-[#0d0b20] px-2 py-1.5">
      <span className="text-[9px] tracking-widest text-muted">{k}</span>
      <span className="font-mono text-base font-extrabold leading-none tabular-nums" style={accent ? { color: accent } : undefined}>
        {v}
      </span>
    </div>
  );
}

function PadBtn({
  label,
  dir,
  gameRef,
}: {
  label: string;
  dir: "up" | "down" | "left" | "right";
  gameRef: React.RefObject<DescenteGame | null>;
}) {
  return (
    <button
      onPointerDown={(e) => {
        e.preventDefault();
        e.currentTarget.setPointerCapture(e.pointerId);
        gameRef.current?.setMove(dir, true);
      }}
      onPointerUp={() => gameRef.current?.setMove(dir, false)}
      onPointerCancel={() => gameRef.current?.setMove(dir, false)}
      onContextMenu={(e) => e.preventDefault()}
      className="select-none rounded-[10px] border border-[#3a3670] bg-[#1a1638] py-2.5 text-lg font-semibold text-ink transition active:border-cyan"
      style={{ touchAction: "none" }}
    >
      {label}
    </button>
  );
}

function DescenteSettings({ curve, onCurve }: { curve: CurveKind; onCurve: (c: CurveKind) => void }) {
  return (
    <>
      <Card>
        <CardTitle>Courbe heat → intensité</CardTitle>
        <div className="grid grid-cols-2 gap-1.5">
          {(["linear", "easeIn"] as CurveKind[]).map((c) => (
            <button
              key={c}
              onClick={() => onCurve(c)}
              className={`rounded-[9px] border py-2 text-[12px] font-bold tracking-wide transition ${
                curve === c ? "border-cyan text-ink glow-low" : "border-line text-muted"
              }`}
            >
              {c === "linear" ? "Linéaire" : "Ease-in (doux)"}
            </button>
          ))}
        </div>
        <div className="mt-2 text-[11px] leading-relaxed text-muted">
          Ease-in : discret sous 50 de heat, raide au-dessus — pour des runs plus contrastées.
        </div>
      </Card>
      <div className="mt-3">
        <Card>
          <CardTitle>Mapping — Descente</CardTitle>
          <div className="text-[11px] leading-[1.9] text-muted">
            <b className="text-ink">Heat</b> = ton exposition au risque, pas tes récompenses.
            <br />
            <b className="text-ink">Salle non nettoyée</b> → le heat monte en continu
            <br />
            <b className="text-ink">Combat / dégâts / pièges</b> → spike proportionnel au danger
            <br />
            <b className="text-ink">Salle sûre</b> → le heat retombe (après 1,5 s)
            <br />
            <b className="text-ink">Mort</b> → décharge : montée au max ~1,5 s puis coupure
            <br />
            <b className="text-ink">Espace</b> → kill switch immédiat du toy
          </div>
        </Card>
      </div>
    </>
  );
}
