"use client";

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { Lovense } from "@/lib/lovense";
import { DEFAULT_SETTINGS, loadSettings, saveSettings, type Settings } from "@/lib/settings";

type Status = "idle" | "connecting" | "connected" | "error";

interface LovenseCtx {
  settings: Settings;
  update: (patch: Partial<Settings>) => void;
  status: Status;
  statusText: string;
  vibe: number; // niveau courant 0-100 (pour feedback visuel)
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
    } else {
      setStatus("error");
      setStatusText("Échec — vérifie l'IP / le transport");
    }
  };

  const test = () => Lovense.test();
  const stop = () => {
    Lovense.stop();
    update({ warmup: false });
  };

  return (
    <Ctx.Provider value={{ settings, update, status, statusText, vibe, connect, test, stop }}>
      {children}
    </Ctx.Provider>
  );
}
