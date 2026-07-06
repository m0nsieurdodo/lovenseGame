# Tetris × Lovense

Jeu Tetris arcade single-file qui pilote un toy Lovense via le **Game Mode** (API locale).

## Mapping vibration
- Pose de pièce → 10 %
- 1 ligne → 20 % · 2 → 30 % · 3 → 40 %
- Tétris (4 lignes) → 70 %
- Tétris à la suite → 100 % (pulsations)
- Warm-up : fond léger qui monte avec le niveau
- Curseur « Intensité max » pour calibrer

## Lovense (côté app)
Lovense Remote → Discover → **Game Mode** activé, téléphone sur le même Wi-Fi.
Renseigner l'IP locale affichée par l'app, choisir le transport, cliquer **Connecter**.

## Déploiement
Site 100 % statique (`index.html`). Aucun build, aucune dépendance.
