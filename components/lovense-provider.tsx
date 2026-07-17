"use client";

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { Lovense, type ToyInfo } from "@/lib/lovense";
import { isEmergencyStopKey, shouldStopWhenDocumentHidden } from "@/lib/haptic-safety";
import { DEFAULT_SETTINGS, loadSettings, saveSettings, type Settings } from "@/lib/settings";

type Status = "idle" | "connecting" | "connected" | "error";

interface LovenseCtx {
  settings: Settings;
  update: (patch: Partial<Settings>) => void;
  status: Status;
  statusText: string;
  vibe: number; // niveau courant 0-100 (pour feedback visuel)
  toys: ToyInfo[]; // toys détectés à la connexion
  activeToys: Set<string>; // ids des toys qui reçoivent les vibrations
  toggleToy: (id: string) => void;
  connect: () => Promise<void>;
  test: () => void;
  stop: () => void;
}

const Ctx = createContext<LovenseCtx | null>(null);

export function useLovense() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useLovense doit être utilisé dans <LovenseProvider>");
  return ctx;
}

export function LovenseProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [status, setStatus] = useState<Status>("idle");
  const [statusText, setStatusText] = useState("Non connecté");
  const [vibe, setVibe] = useState(0);
  const [toys, setToys] = useState<ToyInfo[]>([]);
  const [activeToys, setActiveToys] = useState<Set<string>>(new Set());
  const loaded = useRef(false);

  // Chargement initial depuis localStorage (client only) + abonnement au niveau de vibration.
  useEffect(() => {
    const s = loadSettings();
    setSettings(s);
    Lovense.setScale(s.maxIntensity);
    Lovense.setWarmup(s.warmup);
    loaded.current = true;
    const off = Lovense.onVibe(setVibe);
    return off;
  }, []);

  // Kill switch global : STOP sur Échap/Espace, masquage ou fermeture de l'onglet.
  useEffect(() => {
    const emergencyStop = () => {
      void Lovense.stop();
      setSettings((prev) => ({ ...prev, warmup: false }));
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (!isEmergencyStopKey(event.key)) return;
      event.preventDefault();
      emergencyStop();
    };
    const onVisibilityChange = () => {
      if (shouldStopWhenDocumentHidden(document.visibilityState)) emergencyStop();
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("pagehide", emergencyStop);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("pagehide", emergencyStop);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      void Lovense.stop();
    };
  }, []);

  // Persistance + propagation du calibrage au contrôleur.
  useEffect(() => {
    if (!loaded.current) return;
    saveSettings(settings);
    Lovense.setScale(settings.maxIntensity);
    Lovense.setWarmup(settings.warmup);
  }, [settings]);

  const update = (patch: Partial<Settings>) => setSettings((prev) => ({ ...prev, ...patch }));

  const connect = async () => {
    setStatus("connecting");
    setStatusText("Connexion…");
    const r = await Lovense.connect(settings.ip, settings.transport);
    if (r.ok) {
      setStatus("connected");
      setStatusText(r.names ? `Connecté · ${r.names}` : "Connecté");
      const list = r.toys ?? [];
      setToys(list);
      setActiveToys(new Set(list.map((t) => t.id)));
    } else {
      setStatus("error");
      setStatusText("Échec — vérifie l'IP / le transport");
    }
  };

  const toggleToy = (id: string) => {
    // Effet de bord hors de l'updater (StrictMode double-invoque les updaters).
    const on = !activeToys.has(id);
    Lovense.setToyActive(id, on);
    setActiveToys((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const test = () => Lovense.test();
  const stop = () => {
    Lovense.stop();
    update({ warmup: false });
  };

  return (
    <Ctx.Provider value={{ settings, update, status, statusText, vibe, toys, activeToys, toggleToy, connect, test, stop }}>
      {children}
    </Ctx.Provider>
  );
}
