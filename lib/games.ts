/* Registre des jeux — source de vérité pour le HUB et le routing. */
export interface GameMeta {
  id: string;
  name: string;
  tagline: string;
  icon: string; // emoji / glyphe stylisé
  accent: "cyan" | "violet" | "rose" | "success";
  href: string;
  ready: boolean; // false = carte "bientôt disponible"
  /** Espace est une commande du jeu : il ne doit pas déclencher le STOP global (Échap reste actif). */
  usesSpace?: boolean;
}

export const GAMES: GameMeta[] = [
  { id: "tetris", name: "Tetris", tagline: "Empile, casse, monte en intensité", icon: "▚", accent: "cyan", href: "/games/tetris", ready: true, usesSpace: true },
  { id: "pong", name: "Pong", tagline: "Duel de raquettes néon", icon: "◗", accent: "violet", href: "/games/pong", ready: true },
  { id: "runner", name: "Endless Runner", tagline: "Cours, saute, ne t'arrête pas", icon: "⛰", accent: "cyan", href: "/games/runner", ready: true, usesSpace: true },
  { id: "aim", name: "Aim Trainer", tagline: "Vise, enchaîne les combos", icon: "◎", accent: "rose", href: "/games/aim", ready: true },
  { id: "snake", name: "Snake", tagline: "Grandis sans te mordre", icon: "⌇", accent: "success", href: "/games/snake", ready: true },
  { id: "casino", name: "Grand Saloon", tagline: "5 rouleaux, 3 jackpots, vibes surprises", icon: "🎰", accent: "violet", href: "/games/casino", ready: true },
  { id: "breakout", name: "Breakout", tagline: "Brise le mur, monte le combo", icon: "▦", accent: "rose", href: "/games/breakout", ready: true },
  { id: "rhythm", name: "Boîte à Rythme", tagline: "16 pads, 16 sensations", icon: "🎛️", accent: "rose", href: "/games/rhythm", ready: true },
  { id: "scanline", name: "Scanline", tagline: "Suis la ligne, tiens le tempo", icon: "♫", accent: "cyan", href: "/games/scanline", ready: true, usesSpace: true },
  { id: "neon-tiles", name: "Neon Tiles", tagline: "Tape les tuiles, garde le combo", icon: "▮", accent: "rose", href: "/games/neon-tiles", ready: true },
  { id: "descente", name: "Descente", tagline: "Roguelike : le risque EST l'intensité", icon: "🕳️", accent: "violet", href: "/games/descente", ready: true },
  { id: "number-shooter", name: "Number Bloom", tagline: "Vise, fusionne, fais éclore les combos", icon: "◈", accent: "rose", href: "/games/number-shooter", ready: true },
];

/** Jeu correspondant à une route (« /games/runner » ou « /games/runner/ »). */
export function gameForPath(pathname: string): GameMeta | undefined {
  const path = pathname.replace(/\/+$/, "");
  return GAMES.find((g) => g.href === path);
}

export function getGame(id: string): GameMeta | undefined {
  return GAMES.find((g) => g.id === id);
}
