# Arcade × Lovense — V2

Suite de mini-jeux arcade néon (Next.js) pilotant un toy Lovense via le **Game Mode** (API locale).
Un HUB central donne accès à chaque jeu ; les vibrations montent selon le score / les événements gameplay.

## Stack

- **Next.js** (App Router) + **TypeScript** + **Tailwind CSS v4**
- Export **100 % statique** (`output: "export"`) — aucun backend, déployable sur Vercel ou tout hébergeur statique
- Design system néon codifié dans `app/globals.css` + `components/ui.tsx` (source : `prompt/design.md`)

## Développement

```bash
npm install
npm run dev     # http://localhost:3000
npm run build   # export statique dans ./out
```

## Structure

```
app/
  page.tsx              HUB (dashboard des jeux + réglages globaux)
  games/tetris/page.tsx Jeu Tetris (jeu modèle)
components/             UI partagée (GameShell, SettingsPanel, cartes, primitives)
lib/
  lovense.ts            contrôleur Game Mode réel + fallback mock
  settings.ts           réglages + meilleurs scores (localStorage)
  games.ts              registre des jeux
  tetris-engine.ts      moteur Tetris (canvas)
```

## Jeux

| Jeu | État |
|-----|------|
| Tetris | ✅ jouable |
| Pong · Endless Runner · Aim Trainer · Snake · Mini Casino · Breakout | 🚧 à venir |

## Lovense (côté app)

Lovense Remote → Discover → **Game Mode** activé, téléphone sur le même Wi-Fi.
Renseigner l'IP locale affichée par l'app, choisir le transport, cliquer **Connecter**.
Sans matériel connecté, le contrôleur bascule en **mode démo** (feedback visuel + logs console).

## Mapping vibration — Tetris

- Pose de pièce → 10 %
- 1 ligne → 20 % · 2 → 30 % · 3 → 40 %
- Tétris (4 lignes) → 70 % · Tétris à la suite → 100 % (pulsations)
- Warm-up : fond léger qui monte avec le niveau · curseur « Intensité max » pour calibrer

> Le V1 (Tetris single-file `index.html`) reste disponible dans l'historique git.
