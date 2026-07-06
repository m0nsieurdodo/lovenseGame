"use client";

import { useState } from "react";
import { GAMES } from "@/lib/games";
import { useLovense } from "@/components/lovense-provider";
import { GameCard } from "@/components/game-card";
import { SettingsPanel } from "@/components/settings-panel";
import { Button, StatusDot } from "@/components/ui";

export default function HubPage() {
  const { status, statusText } = useLovense();
  // Panneau ouvert par défaut : la connexion Lovense ne persiste pas au
  // rechargement, et ne se fait que depuis le Hub (jamais dans un jeu).
  const [showSettings, setShowSettings] = useState(true);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-6xl flex-col gap-6 px-4 py-6 md:px-8 md:py-10">
      {/* ---- Navbar ---- */}
      <header className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-neon font-[var(--font-display)] text-2xl font-extrabold uppercase tracking-[3px] md:text-3xl">
            Arcade
          </h1>
          <p className="text-xs tracking-widest text-muted">× LOVENSE</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden items-center gap-2 text-xs text-muted sm:flex">
            <StatusDot state={status} />
            {status === "connected" ? "Lovense ON" : "Lovense OFF"}
          </span>
          <Button variant={showSettings ? "primary" : "secondary"} onClick={() => setShowSettings((v) => !v)}>
            ⚙️ Réglages
          </Button>
        </div>
      </header>

      <div className="flex flex-col gap-6 lg:flex-row">
        {/* ---- Grid des jeux ---- */}
        <section className="flex-1">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {GAMES.map((g) => (
              <GameCard key={g.id} game={g} />
            ))}
          </div>
        </section>

        {/* ---- Panneau réglages (drawer sur desktop, empilé sur mobile) ---- */}
        {showSettings && (
          <aside className="w-full shrink-0 lg:w-80">
            <div className="lg:sticky lg:top-6">
              <div className="mb-2 flex items-center justify-between">
                <h2 className="text-sm font-bold uppercase tracking-widest text-ink">Réglages globaux</h2>
                <button onClick={() => setShowSettings(false)} className="text-muted hover:text-ink" aria-label="Fermer">
                  ✕
                </button>
              </div>
              <SettingsPanel />
            </div>
          </aside>
        )}
      </div>

      <footer className="mt-auto pt-4 text-center text-[11px] text-muted">
        {statusText} · 100% frontend · aucune donnée ne quitte ton appareil
      </footer>
    </main>
  );
}
