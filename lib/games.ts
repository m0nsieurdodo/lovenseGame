/* Registre des jeux — source de vérité pour le HUB et le routing. */
export interface GameMeta {
  id: string;
  name: string;
  tagline: string;
  icon: string; // emoji / glyphe stylisé
  accent: "cyan" | "violet" | "rose" | "success";
  href: string;
  ready: boolean; // false = carte "bientôt disponible"
}

export const GAMES: GameMeta[] = [
  { id: "tetris", name: "Tetris", tagline: "Empile, casse, monte en intensité", icon: "▚", accent: "cyan", href: "/games/tetris", ready: true },
  { id: "pong", name: "Pong", tagline: "Duel de raquettes néon", icon: "◗", accent: "violet", href: "/games/pong", ready: true },
  { id: "runner", name: "Endless Runner", tagline: "Cours, saute, ne t'arrête pas", icon: "⛰", accent: "cyan", href: "/games/runner", ready: true },
  { id: "aim", name: "Aim Trainer", tagline: "Vise, enchaîne les combos", icon: "◎", accent: "rose", href: "/games/aim", ready: true },
  { id: "snake", name: "Snake", tagline: "Grandis sans te mordre", icon: "⌇", accent: "success", href: "/games/snake", ready: true },
  { id: "casino", name: "Grand Saloon", tagline: "5 rouleaux, 3 jackpots, vibes surprises", icon: "🎰", accent: "violet", href: "/games/casino", ready: true },
  { id: "breakout", name: "Breakout", tagline: "Brise le mur, monte le combo", icon: "▦", accent: "rose", href: "/games/breakout", ready: true },
  { id: "rhythm", name: "Boîte à Rythme", tagline: "16 pads, 16 sensations", icon: "🎛️", accent: "rose", href: "/games/rhythm", ready: true },
];

export function getGame(id: string): GameMeta | undefined {
  return GAMES.find((g) => g.id === id);
}
