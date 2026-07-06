"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { useLovense } from "./lovense-provider";
import { SettingsPanel } from "./settings-panel";
import { StatusDot } from "./ui";

type Tab = "game" | "settings";

/* Cadre commun à tous les jeux : format téléphone, header retour HUB + statut,
   onglets Jeu / Réglages. Le contenu gameplay est fourni en children. */
export function GameShell({
  title,
  children,
  settingsExtra,
  onTabChange,
}: {
  title: string;
  children: ReactNode;
  settingsExtra?: ReactNode;
  onTabChange?: (tab: Tab) => void;
}) {
  const { status } = useLovense();
  const [tab, setTab] = useState<Tab>("game");

  const switchTab = (t: Tab) => {
    setTab(t);
    onTabChange?.(t);
  };

  return (
    <div className="mx-auto flex h-dvh w-full max-w-[460px] flex-col gap-2.5 px-3 pb-[calc(env(safe-area-inset-bottom)+10px)] pt-[calc(env(safe-area-inset-top)+8px)]">
      {/* Header */}
      <header className="flex flex-none flex-col gap-2">
        <div className="flex items-center justify-between gap-2.5">
          <Link href="/" className="text-lg text-muted transition hover:text-cyan" aria-label="Retour au hub">
            ‹ Hub
          </Link>
          <h1 className="text-neon whitespace-nowrap text-[17px] font-extrabold uppercase tracking-[2px]">{title}</h1>
          <span className="flex items-center gap-1.5 text-[11px] text-muted">
            <StatusDot state={status} />
            {status === "connected" ? "ON" : "OFF"}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-1.5 rounded-xl border border-line bg-[#0d0b20] p-1">
          {(["game", "settings"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => switchTab(t)}
              className={`rounded-[9px] py-2.5 text-[13px] font-bold tracking-wide transition ${
                tab === t ? "bg-gradient-to-r from-[#1c1840] to-[#2a1550] text-ink glow-low" : "text-muted"
              }`}
            >
              {t === "game" ? "🎮 Jeu" : "⚙️ Réglages"}
            </button>
          ))}
        </div>
      </header>

      {/* Panneaux */}
      <main className="flex min-h-0 flex-1">
        <section className={`min-h-0 w-full flex-1 flex-col ${tab === "game" ? "flex" : "hidden"}`}>{children}</section>
        <section
          className={`w-full flex-1 overflow-y-auto pr-0.5 ${tab === "settings" ? "block" : "hidden"}`}
        >
          <SettingsPanel />
          {settingsExtra && <div className="mt-3">{settingsExtra}</div>}
        </section>
      </main>
    </div>
  );
}
