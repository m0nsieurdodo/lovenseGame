"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { loadBestScores } from "@/lib/settings";
import type { GameMeta } from "@/lib/games";

const ACCENT: Record<GameMeta["accent"], { text: string; glow: string; ring: string }> = {
  cyan: { text: "text-cyan", glow: "group-hover:shadow-[0_0_28px_#00e5ff55]", ring: "group-hover:border-cyan" },
  violet: { text: "text-violet", glow: "group-hover:shadow-[0_0_28px_#8a2be255]", ring: "group-hover:border-violet" },
  rose: { text: "text-rose", glow: "group-hover:shadow-[0_0_28px_#ff3df255]", ring: "group-hover:border-rose" },
  success: { text: "text-success", glow: "group-hover:shadow-[0_0_28px_#00ff8555]", ring: "group-hover:border-success" },
};

export function GameCard({ game }: { game: GameMeta }) {
  const [best, setBest] = useState<number | null>(null);
  const a = ACCENT[game.accent];

  useEffect(() => {
    const scores = loadBestScores();
    setBest(scores[game.id] ?? 0);
  }, [game.id]);

  const inner = (
    <div
      className={`group glass relative flex h-full flex-col gap-3 rounded-[16px] border border-line-soft p-4 transition duration-200 ${a.ring} ${game.ready ? a.glow : ""} ${game.ready ? "" : "opacity-55"}`}
    >
      <div className="flex items-start justify-between">
        <span className={`text-3xl leading-none ${a.text}`}>{game.icon}</span>
        {!game.ready && (
          <span className="rounded-pill bg-[#0d0b20] px-2 py-0.5 text-[9px] uppercase tracking-widest text-muted">
            bientôt
          </span>
        )}
      </div>
      <div>
        <h2 className="text-base font-bold uppercase tracking-wide text-ink">{game.name}</h2>
        <p className="mt-0.5 text-xs text-muted">{game.tagline}</p>
      </div>
      <div className="mt-auto flex items-center justify-between border-t border-line pt-2 text-[11px] text-muted">
        <span>Meilleur</span>
        <span className="font-mono text-ink">{best === null ? "—" : best.toLocaleString("fr-FR")}</span>
      </div>
    </div>
  );

  if (!game.ready) return <div aria-disabled className="cursor-not-allowed">{inner}</div>;
  return (
    <Link href={game.href} className="block h-full focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan rounded-[16px]">
      {inner}
    </Link>
  );
}
