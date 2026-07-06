import type { Transport } from "./lovense";

/* Réglages globaux persistés en localStorage, partagés HUB + jeux. */
export interface Settings {
  ip: string;
  transport: Transport;
  maxIntensity: number; // 0-100
  warmup: boolean;
  enabled: boolean; // toggle ON/OFF global des vibrations
}

export const DEFAULT_SETTINGS: Settings = {
  ip: "192.168.1.28",
  transport: "https",
  maxIntensity: 100,
  warmup: false,
  enabled: true,
};

const KEY = "lovense-arcade:settings";

export function loadSettings(): Settings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(s: Settings) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* quota / mode privé → on ignore */
  }
}

/* Meilleurs scores par jeu (progression affichée sur les cartes du HUB). */
const SCORE_KEY = "lovense-arcade:best";

export function loadBestScores(): Record<string, number> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(window.localStorage.getItem(SCORE_KEY) || "{}");
  } catch {
    return {};
  }
}

export function saveBestScore(gameId: string, score: number): number {
  const all = loadBestScores();
  const best = Math.max(all[gameId] || 0, score);
  all[gameId] = best;
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(SCORE_KEY, JSON.stringify(all));
    } catch {
      /* noop */
    }
  }
  return best;
}
