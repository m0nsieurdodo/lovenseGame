"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { GameShell } from "@/components/game-shell";
import { Button, Card, CardTitle } from "@/components/ui";
import { laneForLauncherPress } from "@/lib/number-shooter-controls";
import { createGame, shootBlock, type NumberShooterEvent, type NumberShooterState } from "@/lib/number-shooter-engine";
import { FetchCommandTransport, GameModeClient, NumberShooterHaptics, type GameModeToy } from "@/lib/number-shooter-lovense";

const LANE_COUNT = 5;
type EventSettings = Record<"low" | "medium" | "high" | "reward", boolean>;

export function NumberShooterGame() {
  const [game, setGame] = useState<NumberShooterState>(() => createGame());
  const [current, setCurrent] = useState(2);
  const [next, setNext] = useState(2);
  const [selectedLane, setSelectedLane] = useState(2);
  const [best, setBest] = useState(0);
  const [paused, setPaused] = useState(false);
  const [flying, setFlying] = useState<number | null>(null);
  const [mergeKey, setMergeKey] = useState("");
  const [message, setMessage] = useState("Vise un couloir, puis tire vers le plafond.");
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const haptics = useRef<NumberShooterHaptics | null>(null);

  const [wantLovense, setWantLovense] = useState(false);
  const [address, setAddress] = useState("");
  const [toys, setToys] = useState<GameModeToy[]>([]);
  const [toyId, setToyId] = useState("");
  const [connectionMessage, setConnectionMessage] = useState("Mode démo actif — aucun jouet requis.");
  const [maxIntensity, setMaxIntensity] = useState(12);
  const [allowAboveTwelve, setAllowAboveTwelve] = useState(false);
  const [restMs, setRestMs] = useState(650);
  const [enabledEvents, setEnabledEvents] = useState<EventSettings>({ low: true, medium: true, high: true, reward: true });

  const activeToy = toys.find((toy) => toy.id === toyId && toy.supportsVibrate);
  const maxAllowed = allowAboveTwelve ? 20 : 12;
  const laneFill = useMemo(() => game.columns.map((lane) => lane.length / game.maxRows), [game]);

  useEffect(() => {
    setBest(Number(window.localStorage.getItem("lovense-arcade:number-shooter-best") || 0));
    return () => {
      timers.current.forEach(clearTimeout);
      void haptics.current?.emergencyStop();
    };
  }, []);

  useEffect(() => {
    haptics.current?.configure({ toyId: activeToy?.id, maxIntensity, restMs, enabledEvents });
  }, [activeToy?.id, enabledEvents, maxIntensity, restMs]);

  const schedule = (fn: () => void, delay: number) => {
    const timer = setTimeout(() => {
      timers.current = timers.current.filter((item) => item !== timer);
      fn();
    }, delay);
    timers.current.push(timer);
  };

  const connect = async () => {
    if (!wantLovense) return;
    try {
      const client = new GameModeClient(new FetchCommandTransport(normalizeAddress(address)));
      const found = await client.getToys();
      setToys(found);
      const first = found.find((toy) => toy.supportsVibrate)?.id ?? "";
      setToyId(first);
      if (first) {
        const director = new NumberShooterHaptics(client);
        director.configure({ toyId: first, maxIntensity, restMs, enabledEvents });
        haptics.current = director;
        setConnectionMessage("Jouet Vibrate détecté. Sélectionne-le ci-dessous.");
      } else setConnectionMessage("Connexion établie, mais aucun jouet ne prend Vibrate en charge.");
    } catch (error) {
      setToys([]);
      setToyId("");
      setConnectionMessage(`Connexion impossible : ${error instanceof Error ? error.message : "erreur réseau"}`);
    }
  };

  const fire = (requestedLane = selectedLane) => {
    if (paused || game.gameOver || flying !== null) return;
    const firedValue = current;
    const lane = laneForLauncherPress({ pressedLane: requestedLane, selectedLane, laneCount: LANE_COUNT });
    if (lane === null) return;
    setSelectedLane(lane);
    const result = shootBlock(game, lane, firedValue);
    setFlying(lane);
    setMessage(`Tir du ${firedValue} dans le couloir ${lane + 1}…`);
    schedule(() => {
      setFlying(null);
      setGame(result.state);
      setCurrent(next);
      setNext(randomBlock(result.state.maxValue));
      const updatedBest = saveBest(result.state.score);
      setBest(updatedBest);
      animateEvents(result.events);
      if (result.state.gameOver) {
        setMessage("Le lanceur est atteint — partie terminée.");
        void haptics.current?.emergencyStop();
      }
    }, 280);
  };

  const animateEvents = (events: NumberShooterEvent[]) => {
    const merges = events.filter((event): event is Extract<NumberShooterEvent, { type: "merged" }> => event.type === "merged");
    merges.forEach((event, index) => {
      schedule(() => {
        setMergeKey(`${event.column}-${event.row}-${event.value}-${index}`);
        setMessage(merges.length >= 3 && index === merges.length - 1 ? `COMBO ×${merges.length} !` : `${event.value} fusionné`);
        void haptics.current?.playMerge(event.value, merges.length);
      }, 360 + index * 360);
    });
  };

  const replay = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    void haptics.current?.emergencyStop();
    haptics.current?.rearm();
    setGame(createGame());
    setCurrent(2);
    setNext(2);
    setPaused(false);
    setFlying(null);
    setMessage("Nouvelle partie. Les piles partent du plafond.");
  };

  const togglePause = () => {
    if (!paused) {
      void haptics.current?.emergencyStop();
      setMessage("Pause : vibrations coupées.");
    } else {
      haptics.current?.rearm();
      setMessage("Reprise.");
    }
    setPaused((value) => !value);
  };

  const emergencyStop = () => {
    void haptics.current?.emergencyStop();
    setMessage("ARRÊT IMMÉDIAT — réactive Lovense pour de nouveaux effets.");
  };

  return (
    <GameShell title="Number Bloom" showGlobalSettings={false} settingsExtra={
      <ShooterSettings
        wantLovense={wantLovense} setWantLovense={setWantLovense} address={address} setAddress={setAddress}
        connect={connect} connectionMessage={connectionMessage} toys={toys} toyId={toyId}
        selectToy={(id) => { setToyId(id); haptics.current?.configure({ toyId: id, maxIntensity, restMs, enabledEvents }); }}
        maxIntensity={maxIntensity} maxAllowed={maxAllowed} setMaxIntensity={setMaxIntensity}
        allowAboveTwelve={allowAboveTwelve} setAllowAboveTwelve={setAllowAboveTwelve}
        restMs={restMs} setRestMs={setRestMs} enabledEvents={enabledEvents} setEnabledEvents={setEnabledEvents}
        preview={(value) => { haptics.current?.rearm(); void haptics.current?.playMerge(value, 3); }}
      />
    }>
      <style>{`@keyframes number-bloom-shot { from { transform: translateY(0) scale(.92); opacity: 1; } to { transform: translateY(-74vh) scale(1); opacity: .15; } } @keyframes number-bloom-merge { 0%,100% { transform: scale(1); filter: brightness(1); } 45% { transform: scale(1.17); filter: brightness(1.7); } }`}</style>
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
        <Hud title="SCORE" value={game.score} /><div className="rounded-lg border border-[#554d80] bg-[#18122d] px-3 py-1 text-center"><span className="block text-[8px] tracking-[.18em] text-muted">OBJECTIF</span><b className="text-lg text-amber-300">512</b></div><Hud title="MAX" value={game.maxValue} />
      </div>
      <div className="mx-auto flex w-full max-w-[450px] items-center justify-between px-1 text-[10px] text-muted"><span>MEILLEUR <b className="font-mono text-ink">{best}</b></span><span className="rounded-full border border-line px-2 py-0.5 text-cyan">{game.combo ? `COMBO ×${game.combo}` : "5 COULOIRS"}</span><span>À VENIR <b className="font-mono text-ink">{next}</b></span></div>
      <div className="relative mx-auto min-h-0 w-full max-w-[450px] flex-1 overflow-hidden rounded-2xl border border-[#393059] bg-[#080916] shadow-[inset_0_0_55px_#0008,0_0_28px_#8a2be244]" onPointerMove={(event) => setSelectedLane(Math.min(LANE_COUNT - 1, Math.max(0, Math.floor((event.nativeEvent.offsetX / event.currentTarget.clientWidth) * LANE_COUNT))))}>
        <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-2 border-b border-violet/70 bg-gradient-to-r from-violet via-cyan to-violet" />
        <div className="grid h-full grid-cols-5 gap-1.5 px-2 pt-3 pb-2">
          {game.columns.map((lane, column) => <Lane key={column} lane={lane} column={column} maxRows={game.maxRows} selected={selectedLane === column} fill={laneFill[column]} mergeKey={mergeKey} />)}
        </div>
        {flying !== null && <div className="pointer-events-none absolute bottom-3 z-20 flex justify-center" style={{ width: "20%", left: `${flying * 20}%`, animation: "number-bloom-shot 280ms ease-out forwards" }}><NumberBlock value={current} flying /></div>}
        {(paused || game.gameOver) && <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-3 bg-[#070611e8] p-5 text-center backdrop-blur-sm"><b className="text-xl tracking-[.16em]">{game.gameOver ? "LANCEUR BLOQUÉ" : "PAUSE"}</b><p className="m-0 max-w-[250px] text-xs text-muted">{game.gameOver ? "Une pile a atteint la ligne de tir." : "Les vibrations ont été arrêtées."}</p><Button variant="primary" onClick={game.gameOver ? replay : togglePause}>{game.gameOver ? "↻ Rejouer" : "▶ Reprendre"}</Button></div>}
      </div>
      <div className="mx-auto grid w-full max-w-[450px] grid-cols-5 gap-1.5 rounded-xl border border-line bg-[#0d0b20] p-2">
        {Array.from({ length: LANE_COUNT }, (_, lane) => <button key={lane} onClick={() => fire(lane)} className={`min-h-14 rounded-lg border text-center transition active:scale-95 ${selectedLane === lane ? "border-cyan bg-[#182b43] shadow-[0_0_16px_#00e5ff44]" : "border-[#272142] bg-[#141225]"}`} aria-label={`Tirer le bloc ${current} dans le couloir ${lane + 1}`}><span className="block text-[8px] text-muted">{lane + 1}</span>{selectedLane === lane ? <NumberBlock value={current} compact /> : <span className="text-muted">⌃</span>}</button>)}
      </div>
      <div className="flex items-center justify-between gap-2"><p className="m-0 min-w-0 flex-1 truncate text-[10px] text-muted">{message}</p><Button onClick={togglePause} aria-label="Pause">{paused ? "▶" : "Ⅱ"}</Button></div>
      <button onClick={emergencyStop} className="fixed bottom-4 right-4 z-40 rounded-full border-2 border-danger bg-[#320b17] px-4 py-3 text-xs font-black tracking-wide text-danger shadow-[0_0_20px_#ff3b3b77]">■ ARRÊT IMMÉDIAT</button>
    </GameShell>
  );
}

function Lane({ lane, column, maxRows, selected, fill, mergeKey }: { lane: number[]; column: number; maxRows: number; selected: boolean; fill: number; mergeKey: string }) {
  return <div className={`relative flex min-w-0 flex-col overflow-hidden rounded-b-lg border-x border-b ${selected ? "border-cyan/60 bg-[#102137]" : "border-[#24213a] bg-[#111020]"}`}><div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#304a6733] to-transparent transition-[height] duration-300" style={{ height: `${fill * 100}%` }} />{lane.map((value, row) => <div key={`${row}-${value}`} className="relative z-10 aspect-square p-0.5"><NumberBlock value={value} active={mergeKey.startsWith(`${column}-${row}-${value}`)} /></div>)}{Array.from({ length: Math.max(0, maxRows - lane.length) }, (_, index) => <div className="relative z-10 flex-1" key={`space-${index}`} />)}</div>;
}

function NumberBlock({ value, active = false, compact = false, flying = false }: { value: number; active?: boolean; compact?: boolean; flying?: boolean }) {
  const palette = value >= 256 ? "from-amber-400 to-orange-500" : value >= 64 ? "from-rose-500 to-red-500" : value >= 16 ? "from-violet-500 to-fuchsia-500" : value >= 4 ? "from-blue-500 to-cyan-400" : "from-teal-400 to-cyan-300";
  return <span className={`flex h-full w-full items-center justify-center rounded-md border border-white/20 bg-gradient-to-br ${palette} font-black text-white shadow-[inset_0_2px_5px_#fff5,0_4px_7px_#0007] ${compact ? "min-h-7 text-sm" : "text-[clamp(.78rem,4.6vw,1.55rem)]"} ${active ? "animate-[pulse_.35s_ease-in-out_2]" : ""} ${flying ? "aspect-square max-h-12 max-w-12 text-xl" : ""}`}>{value}</span>;
}

function Hud({ title, value }: { title: string; value: number }) { return <div className="rounded-lg border border-line bg-[#0d0b20] px-3 py-1.5"><span className="block text-[8px] tracking-[.18em] text-muted">{title}</span><b className="font-mono text-xl leading-none tabular-nums">{value}</b></div>; }

function ShooterSettings(props: { wantLovense: boolean; setWantLovense: (value: boolean) => void; address: string; setAddress: (value: string) => void; connect: () => void; connectionMessage: string; toys: GameModeToy[]; toyId: string; selectToy: (id: string) => void; maxIntensity: number; maxAllowed: number; setMaxIntensity: (value: number) => void; allowAboveTwelve: boolean; setAllowAboveTwelve: (value: boolean) => void; restMs: number; setRestMs: (value: number) => void; enabledEvents: EventSettings; setEnabledEvents: (value: EventSettings) => void; preview: (value: number) => void }) {
  const events: [keyof EventSettings, string, number][] = [["low", "4 / 8", 4], ["medium", "16 / 32", 16], ["high", "64 / 128 / 512", 64], ["reward", "1024+", 1024]];
  return <div className="flex flex-col gap-3"><Card><CardTitle>Lovense — opt-in</CardTitle><label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={props.wantLovense} onChange={(event) => props.setWantLovense(event.target.checked)} className="accent-rose" />Connecter Lovense (facultatif)</label>{props.wantLovense && <><input value={props.address} onChange={(event) => props.setAddress(event.target.value)} placeholder="IP Game Mode ou URL HTTPS" className="mt-3 w-full rounded-lg border border-line-soft bg-[#0d0b20] p-2 text-sm outline-none focus:border-cyan" /><Button className="mt-2 w-full" onClick={props.connect}>Tester la connexion</Button><p className="mb-0 text-xs text-muted">{props.connectionMessage}</p>{props.toys.map((toy) => <label key={toy.id} className="mt-2 flex items-center justify-between text-xs"><span>{toy.nickName || toy.name} {!toy.supportsVibrate && "— Vibrate non pris en charge"}</span><input type="radio" disabled={!toy.supportsVibrate} checked={props.toyId === toy.id} onChange={() => props.selectToy(toy.id)} /></label>)}</>}</Card><Card><CardTitle>Profil vibrations</CardTitle><label className="block text-xs text-muted">Maximum : {props.maxIntensity}/20<input className="mt-1 w-full accent-rose" type="range" min="0" max={props.maxAllowed} value={props.maxIntensity} onChange={(event) => props.setMaxIntensity(Number(event.target.value))} /></label><label className="mt-2 flex gap-2 text-xs"><input type="checkbox" checked={props.allowAboveTwelve} onChange={(event) => props.setAllowAboveTwelve(event.target.checked)} />Autoriser explicitement plus de 12/20</label><label className="mt-3 block text-xs text-muted">Repos : {props.restMs} ms<input className="mt-1 w-full accent-rose" type="range" min="0" max="2000" step="50" value={props.restMs} onChange={(event) => props.setRestMs(Number(event.target.value))} /></label>{events.map(([key, label, value]) => <div className="mt-3 flex items-center gap-2 text-xs" key={key}><input type="checkbox" checked={props.enabledEvents[key]} onChange={(event) => props.setEnabledEvents({ ...props.enabledEvents, [key]: event.target.checked })} /><span className="flex-1">Fusion {label}</span><Button onClick={() => props.preview(value)}>Prévisualiser</Button></div>)}</Card></div>;
}

function normalizeAddress(value: string) { const trimmed = value.trim(); if (/^https?:\/\//.test(trimmed)) return trimmed; return `https://${trimmed.replace(/\./g, "-")}.lovense.club:30010`; }
function randomBlock(maxValue: number) { const values = maxValue >= 64 ? [2, 4, 8, 16] : [2, 4, 8]; return values[Math.floor(Math.random() * values.length)]; }
function saveBest(score: number) { const key = "lovense-arcade:number-shooter-best"; const best = Math.max(Number(window.localStorage.getItem(key) || 0), score); window.localStorage.setItem(key, String(best)); return best; }
