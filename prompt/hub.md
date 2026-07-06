# HUB - Arcade Lovense

Tu es un expert développeur Next.js.

## STACK
- Next.js (App Router)
- TypeScript
- Tailwind CSS

## OBJECTIF
Créer un HUB central qui sert de menu vers plusieurs mini-jeux arcade.

---

## ROUTING
- / → hub
- /games/pong
- /games/runner
- /games/aim
- /games/snake
- /games/casino
- /games/breakout

---

## FONCTIONNALITÉS

### 1. Dashboard principal
- 6 cartes cliquables :
  Pong, Endless Runner, Aim Trainer, Snake, Casino, Breakout
- Navigation vers chaque jeu

### 2. Settings globaux
- Toggle ON/OFF Lovense vibration
- Slider intensité globale (0–100%)
- Bouton test vibration
- Sauvegarde localStorage

### 3. Module Lovense
Créer `/lib/lovense.ts` :
- sendVibration(intensity: number, duration?: number)
- abstraction mock (future API Lovense)

### 4. UI
- style arcade néon (fond sombre, cyan/violet)
- responsive mobile + desktop
- navbar simple avec statut Lovense ON/OFF

---

## CONTRAINTES
- 100% frontend
- aucun backend
- prêt pour déploiement Vercel
- code modulaire et scalable