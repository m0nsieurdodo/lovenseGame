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
npm test        # tests unitaires (vitest) — moteurs purs (jugement, courbes haptiques…)
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

## Scanline — jeu de rythme façon Cytus

Une ligne balaie l'écran verticalement au rythme de la musique ; on frappe les notes
(tap + hold) quand elle les traverse. Timing 100 % Web Audio (`audioContext.currentTime`),
jugement à 4 niveaux (PERFECT ±40 ms / GREAT ±80 / GOOD ±120 / MISS), piste synthétisée
au BPM de la beatmap (zéro asset audio).

- **Haptique** : baseline continue pilotée par le combo (palier tous les 25) + pulses
  événementiels selon le jugement, sommés et clampés à 20 — voir `lib/scanline/haptics/`
  (fonctions pures testées).
- **Beatmaps data-driven** : ajouter une musique = un JSON, aucun code moteur à toucher.
  Format documenté dans [`lib/scanline/beatmaps/README.md`](lib/scanline/beatmaps/README.md).

## Descente — roguelike top-down

Dungeon crawler procédural (grille de salles façon Binding of Isaac, une salle à l'écran,
portes N/S/E/O, 5-8 salles + boss par étage). **L'intensité du toy est indexée sur
l'exposition au risque, pas sur les récompenses** : un "heat meter" (0-100) monte tant
qu'on est en salle non nettoyée, spike au combat/dégât/piège proportionnellement au danger
réel, et retombe en salle sûre. Difficulté et plaisir sont la même variable.

- **Moteur de courbes** (`lib/descente/engine/`, pur et testé — `npm test`) :
  - `heatToIntensity(0-100) → 0-20`, courbe linéaire ou ease-in (Réglages du jeu) ;
  - couches empilables : baseline continue pilotée par le heat + événements ponctuels à
    enveloppe attaque/maintien/relâche, sommés puis clampés ;
  - state machine du heat `idle / rising / spiking / decaying` (dt injecté, testée isolément) ;
  - mort = décharge (montée au max ~1,5 s puis coupure) + reset de la run.
- **Découplage strict** : la boucle de jeu émet des événements sémantiques
  (`enter_room`, `combat_start`, `took_damage`, `trap_triggered`, `room_cleared`,
  `relic_pickup`, `floor_descend`, `player_death`) sur un event bus ; seul le
  `HapticDirector` les traduit en intensité.
- **Reliques** = decorators du mapping (pas des stats) : *Sang-froid inversé* (baseline
  inversée), *Écho* (spikes répétés à -50 % après 2 s), *Palier* (heat plancher aux
  multiples de 25 atteints). En ajouter une = une entrée dans `engine/relics.ts`.
- **Sécurité** : clamp global ≤ 20, **Espace = kill switch immédiat** (réarmement manuel),
  auto-pause + toy coupé quand l'onglet passe en arrière-plan.
- **Contrôles** : ZQSD/WASD/flèches, X/J/K = attaque, P = pause, ou d-pad + ⚔ tactiles.

### Brancher le vrai toy (à la place du mock)

Rien de spécifique à Descente : le jeu passe par `ArcadeLovense`
(`lib/descente/lovense/arcade-adapter.ts`), un adaptateur vers le contrôleur partagé du
HUB. Connecte le toy dans **Réglages** (Game Mode + IP locale, cf. section Lovense
ci-dessus) et Descente le pilote — multi-toys, intensité max et STOP d'urgence globaux
inclus. Sans connexion, le mock intégré prend le relais (jauge + logs console).
Pour un transport alternatif (ex. Bluetooth Web API sans l'app Lovense), implémenter
l'interface `LovenseToy` de `lib/descente/lovense/controller.ts` et l'injecter dans la
page — TODO tracé dans `arcade-adapter.ts`.

## Mapping vibration — Tetris

- Pose de pièce → 10 %
- 1 ligne → 20 % · 2 → 30 % · 3 → 40 %
- Tétris (4 lignes) → 70 % · Tétris à la suite → 100 % (pulsations)
- Warm-up : fond léger qui monte avec le niveau · curseur « Intensité max » pour calibrer

> Le V1 (Tetris single-file `index.html`) reste disponible dans l'historique git.
