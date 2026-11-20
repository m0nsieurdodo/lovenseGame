import type { Transport } from "./lovense";

/* Réglages globaux persistés en localStorage, partagés HUB + jeux. */
export interface Settings {
  ip: string;
  transport: Transport;
  maxIntensity: number; // 0-100
  warmup: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  ip: "",
  transport: "https",
  maxIntensity: 100,
  warmup: false,
};

const KEY = "lovense-arcade:settings";

export function loadSettings(): Settings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return DEFAULT_SETTINGS;
    return sanitizeSettings(JSON.parse(raw));
  } catch {
    return DEFAULT_SETTINGS;
  }
}

/** Le stockage local peut contenir n'importe quoi (ancienne version, édition
    manuelle) : on ne garde que des valeurs du bon type et dans les bornes. */
export function sanitizeSettings(value: unknown): Settings {
  const v = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
  const max = typeof v.maxIntensity === "number" && Number.isFinite(v.maxIntensity) ? v.maxIntensity : DEFAULT_SETTINGS.maxIntensity;
  return {
    ip: typeof v.ip === "string" ? v.ip.slice(0, 64) : DEFAULT_SETTINGS.ip,
    transport: v.transport === "http" ? "http" : "https",
    maxIntensity: Math.max(0, Math.min(100, Math.round(max))),
    warmup: v.warmup === true,
  };
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
    const parsed: unknown = JSON.parse(window.localStorage.getItem(SCORE_KEY) || "{}");
    if (!parsed || typeof parsed !== "object") return {};
    return Object.fromEntries(
      Object.entries(parsed).filter((entry): entry is [string, number] => typeof entry[1] === "number" && Number.isFinite(entry[1])),
    );
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
