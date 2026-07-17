"use client";

import { useEffect, useRef, useState } from "react";
import { GameShell } from "@/components/game-shell";
import { GlowBar, Card, CardTitle } from "@/components/ui";
import { useLovense } from "@/components/lovense-provider";
import { Lovense } from "@/lib/lovense";
import { AudioClock } from "@/lib/scanline/engine/audio-clock";
import {
  compileTileChart,
  generateDemoChart,
  judgeTileHit,
  type TileJudgement,
} from "@/lib/neon-tiles/engine";
import { renderTileTrack } from "@/lib/neon-tiles/synth-track";

const CHART = generateDemoChart(128);
const TILES = compileTileChart(CHART);
const APPROACH_MS = 1_800;
const HIT_LINE_PERCENT = 76;
const KEYS = ["d", "f", "j", "k"];

interface Stats {
  score: number;
  combo: number;
  maxCombo: number;
  misses: number;
  judgement: TileJudgement | "miss" | null;
}

const INITIAL_STATS: Stats = { score: 0, combo: 0, maxCombo: 0, misses: 0, judgement: null };
const POINTS: Record<TileJudgement, number> = { perfect: 1000, great: 700, good: 400 };
const PULSE: Record<TileJudgement, [number, number]> = {
  perfect: [45, 170],
  great: [30, 140],
  good: [18, 110],
};

export default function NeonTilesPage() {
  const { vibe } = useLovense();
  const [stats, setStats] = useState<Stats>(INITIAL_STATS);
  const [nowMs, setNowMs] = useState(0);
  const [busy, setBusy] = useState(false);
  const [overlay, setOverlay] = useState({
    show: true,
    title: "NEON TILES",
    sub: "Tape les tuiles quand elles atteignent la ligne. Clavier : D · F · J · K. La musique originale est synchronisée à 128 BPM ; tes MP3 et leurs beatmaps pourront être ajoutés ensuite.",
    btn: "▶ Jouer",
  });

  const runningRef = useRef(false);
  const rafRef = useRef(0);
  const clockRef = useRef<AudioClock | null>(null);
  const bufferRef = useRef<AudioBuffer | null>(null);
  const statesRef = useRef<Map<number, "pending" | "hit" | "miss">>(new Map());
  const statsRef = useRef<Stats>(INITIAL_STATS);

  const publishStats = (next: Stats) => {
    statsRef.current = next;
    setStats(next);
  };

  const finish = () => {
    if (!runningRef.current) return;
    runningRef.current = false;
    cancelAnimationFrame(rafRef.current);
    clockRef.current?.stop();
    Lovense.mute();
    const s = statsRef.current;
    setOverlay({
      show: true,
      title: "TERMINÉ !",
      sub: `Score ${s.score.toLocaleString("fr-FR")} · combo max ${s.maxCombo} · ${s.misses} raté${s.misses === 1 ? "" : "s"}.`,
      btn: "↻ Rejouer",
    });
  };

  const markExpiredTiles = (time: number) => {
    let next = statsRef.current;
    let changed = false;
    for (const tile of TILES) {
      if (statesRef.current.get(tile.id) === "pending" && time - tile.timeMs > 135) {
        statesRef.current.set(tile.id, "miss");
        next = { ...next, combo: 0, misses: next.misses + 1, judgement: "miss" };
        changed = true;
      }
    }
    if (changed) {
      Lovense.mute();
      publishStats(next);
    }
  };

  const tick = () => {
    if (!runningRef.current) return;
    const time = clockRef.current?.nowMs() ?? Number.NEGATIVE_INFINITY;
    if (!Number.isFinite(time)) return;
    setNowMs(time);
    markExpiredTiles(time);
    if (time > TILES.at(-1)!.timeMs + 1_000) finish();
    else rafRef.current = requestAnimationFrame(tick);
  };

  const start = async () => {
    if (busy) return;
    setBusy(true);
    try {
      if (!clockRef.current) clockRef.current = new AudioClock();
      const clock = clockRef.current;
      await clock.unlock();
      if (!bufferRef.current) bufferRef.current = await renderTileTrack(CHART);

      cancelAnimationFrame(rafRef.current);
      Lovense.mute();
      statesRef.current = new Map(TILES.map((tile) => [tile.id, "pending"]));
      publishStats(INITIAL_STATS);
      setNowMs(-900);
      runningRef.current = true;
      setOverlay((current) => ({ ...current, show: false }));
      clock.play(bufferRef.current, 900);
      rafRef.current = requestAnimationFrame(tick);
    } finally {
      setBusy(false);
    }
  };

  const hitLane = (lane: number) => {
    if (!runningRef.current) return;
    const time = clockRef.current?.nowMs() ?? Number.NEGATIVE_INFINITY;
    if (!Number.isFinite(time)) return;
    const candidate = TILES
      .filter((tile) => tile.lane === lane && statesRef.current.get(tile.id) === "pending")
      .map((tile) => ({ tile, delta: time - tile.timeMs }))
      .filter(({ delta }) => Math.abs(delta) <= 135)
      .sort((a, b) => Math.abs(a.delta) - Math.abs(b.delta))[0];
    if (!candidate) return;

    const judgement = judgeTileHit(candidate.delta);
    if (!judgement) return;
    statesRef.current.set(candidate.tile.id, "hit");
    const previous = statsRef.current;
    const combo = previous.combo + 1;
    publishStats({
      score: previous.score + Math.round(POINTS[judgement] * (1 + Math.min(previous.combo, 100) / 100)),
      combo,
      maxCombo: Math.max(previous.maxCombo, combo),
      misses: previous.misses,
      judgement,
    });
    const [intensity, duration] = PULSE[judgement];
    Lovense.pulse(intensity, duration);
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      const lane = KEYS.indexOf(key);
      if (lane < 0 || event.repeat) return;
      event.preventDefault();
      hitLane(lane);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      cancelAnimationFrame(rafRef.current);
      clockRef.current?.destroy();
      Lovense.mute();
    };
  }, []);

  const onTabChange = (tab: "game" | "settings") => {
    if (tab === "settings" && runningRef.current) finish();
  };

  return (
    <GameShell title="Neon Tiles × Lovense" onTabChange={onTabChange} settingsExtra={<VibeMap />}>
      <div className="flex flex-none items-stretch gap-2">
        <Stat k="SCORE" v={stats.score.toLocaleString("fr-FR")} />
        <Stat k="COMBO" v={stats.combo} />
        <Stat k="BPM" v={CHART.bpm} />
        <Stat k="JUGE" v={stats.judgement ? stats.judgement.toUpperCase() : "—"} accent={stats.judgement} />
      </div>
      <div className="flex-none"><GlowBar value={vibe} /></div>

      <div className="relative min-h-0 flex-1 overflow-hidden rounded-[14px] border-2 border-[#2b2750] bg-[#090717]" style={{ boxShadow: "0 0 40px #00e5ff22, inset 0 0 60px #0006" }}>
        <div className="pointer-events-none absolute inset-0 grid grid-cols-4">
          {KEYS.map((key, lane) => (
            <div key={key} className={`relative border-r border-[#2b2750] last:border-r-0 ${lane % 2 ? "bg-[#0d0b20]" : "bg-[#0a0818]"}`}>
              {TILES.filter((tile) => tile.lane === lane).map((tile) => {
                const status = statesRef.current.get(tile.id) ?? "pending";
                const top = HIT_LINE_PERCENT - ((tile.timeMs - nowMs) / APPROACH_MS) * HIT_LINE_PERCENT;
                if (top < -18 || top > 105 || status !== "pending") return null;
                return <div key={tile.id} className="absolute left-1.5 right-1.5 h-10 rounded-lg border border-cyan bg-cyan/30 shadow-[0_0_18px_#00e5ff99]" style={{ top: `${top}%` }} />;
              })}
            </div>
          ))}
        </div>
        <div className="pointer-events-none absolute left-0 right-0 z-10 border-t-2 border-rose shadow-[0_0_16px_#ff3df2]" style={{ top: `${HIT_LINE_PERCENT}%` }} />
        <div className="absolute bottom-2 left-2 right-2 z-20 grid grid-cols-4 gap-1.5">
          {KEYS.map((key, lane) => <button key={key} onPointerDown={() => hitLane(lane)} className="rounded-lg border border-[#5a4080] bg-[#201743] py-3 font-mono font-bold uppercase text-ink active:border-cyan active:bg-cyan/30">{key}</button>)}
        </div>
        {overlay.show && <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-3 bg-[#05040ccc] p-4 text-center backdrop-blur-sm">
          <h2 className="m-0 text-2xl tracking-[2px]">{overlay.title}</h2>
          <p className="max-w-[290px] text-[11px] leading-relaxed text-muted">{overlay.sub}</p>
          <button disabled={busy} onPointerDown={start} className="rounded-[10px] bg-gradient-to-r from-cyan to-rose px-5 py-2.5 font-bold text-[#06040f] disabled:opacity-50">{busy ? "Préparation audio…" : overlay.btn}</button>
        </div>}
      </div>
    </GameShell>
  );
}

function Stat({ k, v, accent }: { k: string; v: string | number; accent?: string | null }) {
  const color = accent === "perfect" ? "text-cyan" : accent === "great" ? "text-violet" : accent === "good" ? "text-[#ffcc55]" : accent === "miss" ? "text-danger" : "text-ink";
  return <div className="flex min-w-0 flex-1 flex-col justify-center rounded-[10px] border border-line bg-[#0d0b20] px-2 py-1.5"><span className="text-[9px] tracking-widest text-muted">{k}</span><span className={`truncate font-mono text-sm font-extrabold leading-none ${color}`}>{v}</span></div>;
}

function VibeMap() {
  return <Card><CardTitle>Intensités — Neon Tiles</CardTitle><div className="text-[11px] leading-[1.9] text-muted"><b className="text-ink">PERFECT</b> → 45 % / 170 ms<br /><b className="text-ink">GREAT</b> → 30 % / 140 ms<br /><b className="text-ink">GOOD</b> → 18 % / 110 ms<br /><b className="text-ink">Raté / fin / Réglages</b> → silence immédiat. Le calibrage global reste appliqué.</div></Card>;
}
