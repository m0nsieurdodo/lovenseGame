"use client";

import { useEffect, useRef, useState } from "react";
import { GameShell } from "@/components/game-shell";
import { GlowBar, Card, CardTitle } from "@/components/ui";
import { useLovense } from "@/components/lovense-provider";
import type { Overlay } from "@/lib/engine-types";
import { DEFAULT_BEATMAP } from "@/lib/scanline/beatmaps";
import { AudioClock } from "@/lib/scanline/engine/audio-clock";
import { ScanlineGame, type GameStats } from "@/lib/scanline/engine/game-engine";
import type { Judgement } from "@/lib/scanline/engine/judgement";
import { renderTrack } from "@/lib/scanline/engine/synth-track";
import { HapticEngine, type HapticSnapshot } from "@/lib/scanline/haptics/haptic-engine";
import { ArcadeLovenseOutput } from "@/lib/scanline/lovense/output";
import { ScanlineRenderer } from "@/lib/scanline/render/renderer";

const LEAD_IN_MS = 2400; // compte à rebours avant le premier échantillon audio
const KEYS = new Set(["f", "j", "d", "k", " "]);

const J_LABEL: Record<Judgement, string> = { perfect: "PERFECT", great: "GREAT", good: "GOOD", miss: "MISS" };
const J_CLASS: Record<Judgement, string> = {
  perfect: "text-cyan",
  great: "text-violet",
  good: "text-[#ffcc55]",
  miss: "text-danger",
};

export default function ScanlinePage() {
  const { vibe } = useLovense();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const clockRef = useRef<AudioClock | null>(null);
  const gameRef = useRef<ScanlineGame | null>(null);
  const hapticsRef = useRef<HapticEngine | null>(null);
  const rendererRef = useRef<ScanlineRenderer | null>(null);
  const bufferRef = useRef<AudioBuffer | null>(null);
  const rafRef = useRef(0);
  const pausedRef = useRef(false);
  const lastHudAtRef = useRef(0);

  const [stats, setStats] = useState<GameStats | null>(null);
  const [lastJudgement, setLastJudgement] = useState<Judgement | null>(null);
  const [haptic, setHaptic] = useState<HapticSnapshot>({ baseline: 0, pulse: 0, total: 0 });
  const [busy, setBusy] = useState(false);
  const [overlay, setOverlay] = useState<Overlay>({
    show: true,
    title: "SCANLINE",
    sub: "La ligne balaie l'écran au rythme de la musique. Tape (F/J ou doigt) quand elle passe sur une note — maintiens les notes longues. Précision + combo = intensité.",
    btn: "▶ Jouer",
  });

  /* ---- renderer + resize (une fois) ---- */
  useEffect(() => {
    if (!canvasRef.current) return;
    const renderer = new ScanlineRenderer(canvasRef.current);
    rendererRef.current = renderer;
    renderer.fit();
    const onResize = () => renderer.fit();
    window.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", onResize);
    window.visualViewport?.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("orientationchange", onResize);
      window.visualViewport?.removeEventListener("resize", onResize);
      cancelAnimationFrame(rafRef.current);
      hapticsRef.current?.kill();
      clockRef.current?.destroy();
    };
  }, []);

  /* ---- clavier ---- */
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (!KEYS.has(k) || e.repeat) return;
      e.preventDefault();
      const clock = clockRef.current;
      if (clock?.isPlaying() && !pausedRef.current) gameRef.current?.press(`kb:${k}`, clock.nowMs());
    };
    const up = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (!KEYS.has(k)) return;
      const clock = clockRef.current;
      if (clock?.isPlaying()) gameRef.current?.release(`kb:${k}`, clock.nowMs());
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  /* ---- boucle : l'heure vient de l'horloge AUDIO, rAF ne sert qu'au rendu ---- */
  const loop = () => {
    const clock = clockRef.current;
    const game = gameRef.current;
    const renderer = rendererRef.current;
    const haptics = hapticsRef.current;
    if (!clock || !game || !renderer || !haptics) return;

    const t = clock.nowMs();
    if (!pausedRef.current && Number.isFinite(t)) {
      game.update(t);
      const snap = haptics.tick(t);
      const now = performance.now();
      if (now - lastHudAtRef.current > 120) {
        lastHudAtRef.current = now;
        setHaptic(snap);
      }
      renderer.draw({
        tMs: t,
        beat: game.beatAt(t),
        notes: game.notes,
        combo: game.stats.combo,
        bpm: game.map.bpm,
        cycleBeats: game.map.scanCycleBeats,
        countdownMs: t < 0 ? -t : null,
      });
    }
    rafRef.current = requestAnimationFrame(loop);
  };

  const start = async () => {
    if (busy) return;
    setBusy(true);
    try {
      if (!clockRef.current) clockRef.current = new AudioClock();
      const clock = clockRef.current;
      await clock.unlock(); // geste utilisateur → contexte audio autorisé
      if (!bufferRef.current) bufferRef.current = await renderTrack(DEFAULT_BEATMAP); // synthèse hors-ligne (~1 s)

      hapticsRef.current?.kill();
      const game = new ScanlineGame(DEFAULT_BEATMAP);
      const haptics = new HapticEngine(new ArcadeLovenseOutput());
      game.onEvent((ev) => {
        haptics.handleEvent(ev, clock.nowMs());
        if (ev.type === "note_hit") setLastJudgement(ev.judgement);
        if (ev.type === "note_hit" || ev.type === "combo_changed" || ev.type === "hold_complete")
          setStats(game.stats);
        if (ev.type === "song_end") finish(game.stats);
      });
      gameRef.current = game;
      hapticsRef.current = haptics;
      setStats(game.stats);
      setLastJudgement(null);
      pausedRef.current = false;
      setOverlay((o) => ({ ...o, show: false }));

      clock.play(bufferRef.current, LEAD_IN_MS);
      cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(loop);
    } finally {
      setBusy(false);
    }
  };

  const finish = (s: GameStats) => {
    hapticsRef.current?.kill();
    clockRef.current?.stop();
    setOverlay({
      show: true,
      title: "TERMINÉ !",
      sub: `Score ${s.score.toLocaleString("fr-FR")} · combo max ${s.maxCombo} · précision ${Math.round(s.accuracy * 100)} % — ${s.counts.perfect} PERFECT / ${s.counts.great} GREAT / ${s.counts.good} GOOD / ${s.counts.miss} MISS`,
      btn: "↻ Rejouer",
    });
  };

  const onTabChange = (t: "game" | "settings") => {
    const clock = clockRef.current;
    if (t === "settings" && clock?.isPlaying() && !pausedRef.current) {
      pausedRef.current = true;
      clock.pause();
      hapticsRef.current?.suspend();
    }
    if (t === "game") {
      requestAnimationFrame(() => rendererRef.current?.fit());
      if (clock?.isPlaying() && pausedRef.current) {
        pausedRef.current = false;
        clock.resume();
      }
    }
  };

  /* ---- taps à l'écran ---- */
  const onPointerDown = (ev: React.PointerEvent) => {
    const clock = clockRef.current;
    const renderer = rendererRef.current;
    if (!clock?.isPlaying() || pausedRef.current || !renderer) return;
    ev.currentTarget.setPointerCapture(ev.pointerId);
    gameRef.current?.press(`pt:${ev.pointerId}`, clock.nowMs(), renderer.clientToNorm(ev.clientX, ev.clientY));
  };
  const onPointerUp = (ev: React.PointerEvent) => {
    const clock = clockRef.current;
    if (!clock?.isPlaying()) return;
    gameRef.current?.release(`pt:${ev.pointerId}`, clock.nowMs());
  };

  const s = stats;
  return (
    <GameShell title="Scanline × Lovense" onTabChange={onTabChange} settingsExtra={<VibeMap />}>
      {/* Jauges debug : score / combo / précision / dernier jugement */}
      <div className="flex flex-none items-stretch gap-2">
        <Stat k="SCORE" v={s ? s.score.toLocaleString("fr-FR") : "0"} />
        <Stat k="COMBO" v={s ? `${s.combo}` : "0"} />
        <Stat k="PRÉCISION" v={s && s.resolved > 0 ? `${Math.round(s.accuracy * 100)}%` : "—"} />
        <div className="flex flex-1 flex-col justify-center rounded-[10px] border border-line bg-[#0d0b20] px-2 py-1.5">
          <span className="text-[9px] tracking-widest text-muted">JUGEMENT</span>
          <span className={`font-mono text-sm font-extrabold leading-none ${lastJudgement ? J_CLASS[lastJudgement] : "text-muted"}`}>
            {lastJudgement ? J_LABEL[lastJudgement] : "—"}
          </span>
        </div>
      </div>

      {/* Intensité toy : jauge + décomposition baseline/pulse */}
      <div className="flex flex-none items-center gap-2">
        <div className="flex-1">
          <GlowBar value={vibe} />
        </div>
        <span className="w-[150px] flex-none text-right font-mono text-[10px] tabular-nums text-muted">
          base {haptic.baseline.toFixed(0)} + pulse {haptic.pulse.toFixed(1)} → {haptic.total.toFixed(0)}/20
        </span>
      </div>

      <div className="flex min-h-0 flex-1 items-center justify-center">
        <div className="relative h-full w-full leading-[0]">
          <canvas
            ref={canvasRef}
            onPointerDown={onPointerDown}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            className="mx-auto block h-full w-full rounded-[14px] border-2 border-[#2b2750] bg-gradient-to-b from-[#0b0920] to-[#0a0818]"
            style={{ boxShadow: "0 0 40px #00e5ff22, inset 0 0 60px #0006", touchAction: "none" }}
          />
          {overlay.show && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-[14px] bg-[#05040ccc] p-4 text-center backdrop-blur-sm">
              <h2 className="m-0 text-2xl tracking-[2px]">{overlay.title}</h2>
              <div className="max-w-[280px] text-[11px] leading-relaxed text-muted">{overlay.sub}</div>
              <button
                onClick={start}
                disabled={busy}
                className="cursor-pointer rounded-[10px] border-none bg-gradient-to-r from-cyan to-rose px-5 py-2.5 font-bold text-[#06040f] disabled:opacity-50"
              >
                {busy ? "Synthèse audio…" : overlay.btn}
              </button>
            </div>
          )}
        </div>
      </div>
    </GameShell>
  );
}

function Stat({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex flex-1 flex-col justify-center rounded-[10px] border border-line bg-[#0d0b20] px-2 py-1.5">
      <span className="text-[9px] tracking-widest text-muted">{k}</span>
      <span className="font-mono text-sm font-extrabold leading-none tabular-nums">{v}</span>
    </div>
  );
}

function VibeMap() {
  return (
    <Card>
      <CardTitle>Intensités — Scanline</CardTitle>
      <div className="text-[11px] leading-[1.9] text-muted">
        <b className="text-ink">Baseline combo</b> → palier tous les 25 : 0 / 3 / 5 / 7 / 9 / 10 (sur 20)
        <br />
        <b className="text-ink">PERFECT</b> → pulse +9 · <b className="text-ink">GREAT</b> → +6 · <b className="text-ink">GOOD</b> → +3
        <br />
        <b className="text-ink">MISS</b> → aucun pulse + micro-coupure 400 ms + chute de la baseline
        <br />
        <b className="text-ink">Somme clampée à 20</b> (échelle Lovense) · STOP = kill switch
      </div>
    </Card>
  );
}
