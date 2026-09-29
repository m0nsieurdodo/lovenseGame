"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { GameShell } from "@/components/game-shell";
import { Button, Card, CardTitle } from "@/components/ui";
import { saveBestScore } from "@/lib/settings";
import { createGame, dropBlock, type NumberShooterEvent, type NumberShooterState } from "@/lib/number-shooter-engine";
import { FetchCommandTransport, GameModeClient, NumberShooterHaptics, type GameModeToy } from "@/lib/number-shooter-lovense";

const ROWS = 8;
const COLUMNS = 5;
type EventSettings = Record<"low" | "medium" | "high" | "reward", boolean>;

export default function NumberShooterPage() {
  const [game, setGame] = useState<NumberShooterState>(() => createGame(ROWS, COLUMNS));
  const [current, setCurrent] = useState(2);
  const [next, setNext] = useState(2);
  const [selectedColumn, setSelectedColumn] = useState(2);
  const [best, setBest] = useState(0);
  const [paused, setPaused] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);
  const [address, setAddress] = useState("");
  const [wantLovense, setWantLovense] = useState(false);
  const [toys, setToys] = useState<GameModeToy[]>([]);
  const [toyId, setToyId] = useState("");
  const [connectionMessage, setConnectionMessage] = useState("Mode démo — aucun jouet requis");
  const [maxIntensity, setMaxIntensity] = useState(12);
  const [allowAboveTwelve, setAllowAboveTwelve] = useState(false);
  const [restMs, setRestMs] = useState(650);
  const [enabledEvents, setEnabledEvents] = useState<EventSettings>({ low: true, medium: true, high: true, reward: true });
  const haptics = useRef<NumberShooterHaptics | null>(null);

  const activeToy = toys.find((toy) => toy.id === toyId && toy.supportsVibrate);
  const maxAllowed = allowAboveTwelve ? 20 : 12;
  const cells = useMemo(() => game.board.flat(), [game.board]);

  useEffect(() => {
    setBest(Number(window.localStorage.getItem("lovense-arcade:number-shooter-best") || 0));
    return () => { void haptics.current?.emergencyStop(); };
  }, []);

  useEffect(() => {
    haptics.current?.configure({ toyId: activeToy?.id, maxIntensity, restMs, enabledEvents });
  }, [activeToy?.id, enabledEvents, maxIntensity, restMs]);

  const configureHaptics = (client: GameModeClient, selectedToy: string) => {
    const director = new NumberShooterHaptics(client);
    director.configure({ toyId: selectedToy, maxIntensity, restMs, enabledEvents });
    haptics.current = director;
    return director;
  };

  const testConnection = async () => {
    if (!wantLovense) return;
    try {
      const client = new GameModeClient(new FetchCommandTransport(normalizeAddress(address)));
      const found = await client.getToys();
      const available = found.filter((toy) => toy.supportsVibrate);
      setToys(found);
      const selected = available[0]?.id ?? "";
      setToyId(selected);
      if (selected) configureHaptics(client, selected);
      setConnectionMessage(selected ? `${available.length} jouet(s) compatible(s) détecté(s)` : "Aucun jouet compatible Vibrate détecté");
    } catch (error) {
      setToys([]);
      setToyId("");
      setConnectionMessage(`Connexion impossible : ${error instanceof Error ? error.message : "erreur réseau/CORS"}`);
    }
  };

  const fire = () => {
    if (paused || game.gameOver) return;
    const result = dropBlock(game, selectedColumn, current);
    if (result.events.length === 1 && result.events[0].type === "game_over") return;
    setGame(result.state);
    setBest(saveNumberShooterBest(result.state.score));
    setCurrent(next);
    setNext(randomBlock(result.state.maxValue));
    playEvents(result.events);
    if (result.state.gameOver) {
      void haptics.current?.emergencyStop();
      setFlash("PLATEAU SATURÉ — REJOUER");
    }
  };

  const playEvents = (events: NumberShooterEvent[]) => {
    for (const [index, event] of events.entries()) {
      if (event.type !== "merged") continue;
      window.setTimeout(() => {
        setFlash(`×${event.value}`);
        window.setTimeout(() => setFlash(null), 360);
        void haptics.current?.playMerge(event.value, events.filter((item) => item.type === "merged").length);
      }, index * 380);
    }
  };

  const replay = () => {
    void haptics.current?.emergencyStop();
    haptics.current?.rearm();
    setGame(createGame(ROWS, COLUMNS));
    setCurrent(2);
    setNext(2);
    setPaused(false);
    setFlash(null);
  };

  const togglePause = () => {
    if (!paused) void haptics.current?.emergencyStop();
    else haptics.current?.rearm();
    setPaused((value) => !value);
  };

  const emergencyStop = () => {
    void haptics.current?.emergencyStop();
    setFlash("ARRÊT IMMÉDIAT — réactive Lovense pour reprendre");
  };

  const preview = (value: number) => {
    haptics.current?.rearm();
    void haptics.current?.playMerge(value, value >= 64 ? 3 : 1);
  };

  return (
    <GameShell title="Number Bloom" settingsExtra={
      <Settings
        wantLovense={wantLovense} setWantLovense={setWantLovense} address={address} setAddress={setAddress}
        testConnection={testConnection} message={connectionMessage} toys={toys} toyId={toyId}
        selectToy={(id) => { setToyId(id); if (haptics.current) haptics.current.configure({ toyId: id, maxIntensity, restMs, enabledEvents }); }}
        maxIntensity={maxIntensity} maxAllowed={maxAllowed} setMaxIntensity={setMaxIntensity}
        allowAboveTwelve={allowAboveTwelve} setAllowAboveTwelve={setAllowAboveTwelve}
        restMs={restMs} setRestMs={setRestMs} enabledEvents={enabledEvents} setEnabledEvents={setEnabledEvents} preview={preview}
      />
    }>
      <div className="grid grid-cols-4 gap-2">
        <Stat name="SCORE" value={game.score} /><Stat name="MEILLEUR" value={best} /><Stat name="MAX" value={game.maxValue} /><Stat name="COMBO" value={game.combo ? `×${game.combo}` : "—"} />
      </div>
      <div className="relative mx-auto flex min-h-0 w-full max-w-[440px] flex-1 items-center">
        <div className="grid aspect-[5/8] w-full grid-cols-5 gap-1.5 rounded-2xl border border-violet/60 bg-[#09071a] p-2 shadow-[0_0_32px_#8a2be244]">
          {cells.map((value, index) => <Cell key={index} value={value} selected={index % COLUMNS === selectedColumn} />)}
        </div>
        {(paused || game.gameOver) && <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-2xl bg-[#05040ce6] p-5 text-center"><b className="text-xl tracking-widest">{game.gameOver ? "FIN DE PARTIE" : "PAUSE"}</b><p className="m-0 text-xs text-muted">{game.gameOver ? "Plus aucune colonne ne peut recevoir de bloc." : "Les vibrations ont été arrêtées."}</p><Button variant="primary" onClick={game.gameOver ? replay : togglePause}>{game.gameOver ? "↻ Rejouer" : "▶ Reprendre"}</Button></div>}
        {flash && <div className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 text-center text-3xl font-black text-rose drop-shadow-[0_0_14px_#ff3df2]">{flash}</div>}
      </div>
      <div className="mx-auto flex w-full max-w-[440px] items-center justify-between gap-3 rounded-xl border border-line bg-[#0d0b20] p-2">
        <div className="text-center"><span className="block text-[9px] tracking-widest text-muted">SUIVANT</span><Block value={next} compact /></div>
        <button onClick={fire} onPointerMove={(event) => setSelectedColumn(Math.max(0, Math.min(COLUMNS - 1, Math.floor((event.nativeEvent.offsetX / event.currentTarget.clientWidth) * COLUMNS))))} className="flex flex-1 items-center justify-center gap-3 rounded-lg bg-gradient-to-r from-cyan to-rose py-3 font-black text-[#09051a] active:brightness-90" aria-label="Viser et lancer le bloc"><Block value={current} compact /> LANCER</button>
        <Button onClick={togglePause} aria-label="Pause">{paused ? "▶" : "Ⅱ"}</Button>
      </div>
      <p className="m-0 text-center text-[10px] text-muted">Déplace ton doigt ou la souris sur LANCER pour viser une colonne, puis relâche. Les fusions suivent la priorité gauche → bas → droite → haut.</p>
      <button onClick={emergencyStop} className="fixed bottom-4 right-4 z-30 rounded-full border-2 border-danger bg-[#320b17] px-4 py-3 text-xs font-black tracking-wide text-danger shadow-[0_0_20px_#ff3b3b77]">■ ARRÊT IMMÉDIAT</button>
    </GameShell>
  );
}

function Settings(props: {
  wantLovense: boolean; setWantLovense: (value: boolean) => void; address: string; setAddress: (value: string) => void; testConnection: () => void; message: string; toys: GameModeToy[]; toyId: string; selectToy: (id: string) => void; maxIntensity: number; maxAllowed: number; setMaxIntensity: (value: number) => void; allowAboveTwelve: boolean; setAllowAboveTwelve: (value: boolean) => void; restMs: number; setRestMs: (value: number) => void; enabledEvents: EventSettings; setEnabledEvents: (value: EventSettings) => void; preview: (value: number) => void;
}) {
  const labels: [keyof EventSettings, string, number][] = [["low", "4 / 8", 4], ["medium", "16 / 32", 16], ["high", "64 à 512", 64], ["reward", "1024+", 1024]];
  return <div className="flex flex-col gap-3"><Card><CardTitle>Lovense — opt-in</CardTitle><label className="flex gap-2 text-xs"><input type="checkbox" checked={props.wantLovense} onChange={(event) => props.setWantLovense(event.target.checked)} className="accent-rose" />Connecter Lovense (facultatif)</label>{props.wantLovense && <><input value={props.address} onChange={(event) => props.setAddress(event.target.value)} placeholder="IP Game Mode ou URL HTTPS" className="mt-3 w-full rounded-lg border border-line-soft bg-[#0d0b20] p-2 text-sm" /><Button className="mt-2 w-full" onClick={props.testConnection}>Tester la connexion</Button><p className="mb-0 text-xs text-muted">{props.message}</p>{props.toys.map((toy) => <label key={toy.id} className="mt-2 flex items-center justify-between text-xs"><span>{toy.nickName || toy.name} {!toy.supportsVibrate && "— Vibrate non pris en charge"}</span><input type="radio" disabled={!toy.supportsVibrate} checked={props.toyId === toy.id} onChange={() => props.selectToy(toy.id)} /></label>)}</>}</Card><Card><CardTitle>Profil vibrations</CardTitle><label className="text-xs text-muted">Maximum : {props.maxIntensity}/20<input className="mt-1 w-full accent-rose" type="range" min="0" max={props.maxAllowed} value={props.maxIntensity} onChange={(event) => props.setMaxIntensity(Number(event.target.value))} /></label><label className="mt-2 flex gap-2 text-xs"><input type="checkbox" checked={props.allowAboveTwelve} onChange={(event) => props.setAllowAboveTwelve(event.target.checked)} />Autoriser explicitement plus de 12/20</label><label className="mt-3 block text-xs text-muted">Repos : {props.restMs} ms<input className="mt-1 w-full accent-rose" type="range" min="0" max="2000" step="50" value={props.restMs} onChange={(event) => props.setRestMs(Number(event.target.value))} /></label>{labels.map(([key, label, value]) => <div className="mt-3 flex items-center gap-2 text-xs" key={key}><input type="checkbox" checked={props.enabledEvents[key]} onChange={(event) => props.setEnabledEvents({ ...props.enabledEvents, [key]: event.target.checked })} /><span className="flex-1">Fusion {label}</span><Button onClick={() => props.preview(value)}>Prévisualiser</Button></div>)}</Card></div>;
}

function Stat({ name, value }: { name: string; value: number | string }) { return <div className="rounded-lg border border-line bg-[#0d0b20] p-2"><span className="block text-[8px] tracking-widest text-muted">{name}</span><b className="font-mono text-lg">{value}</b></div>; }
function Cell({ value, selected }: { value: number | null; selected: boolean }) { return <div className={`flex min-h-0 items-center justify-center rounded-lg border ${selected ? "border-cyan/70" : "border-[#211b43]"} ${value ? "bg-[#21154b] shadow-[inset_0_0_18px_#8a2be255]" : "bg-[#0d0a20]"}`}>{value && <Block value={value} />}</div>; }
function Block({ value, compact = false }: { value: number; compact?: boolean }) { return <span className={`${compact ? "text-lg" : "text-[clamp(0.85rem,4.8vw,1.65rem)]"} font-black text-cyan drop-shadow-[0_0_7px_#00e5ff]`}>{value}</span>; }
function randomBlock(maxValue: number) { const values = maxValue >= 64 ? [2, 4, 8, 16] : [2, 4, 8]; return values[Math.floor(Math.random() * values.length)]; }
function normalizeAddress(value: string) { const trimmed = value.trim(); if (/^https?:\/\//.test(trimmed)) return trimmed; const host = trimmed.replace(/\./g, "-"); return `https://${host}.lovense.club:30010`; }
function saveNumberShooterBest(score: number) { const key = "lovense-arcade:number-shooter-best"; const best = Math.max(Number(window.localStorage.getItem(key) || 0), score); window.localStorage.setItem(key, String(best)); return best; }
