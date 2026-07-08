# Format de beatmap — Scanline

Une beatmap est un fichier JSON 100 % déclaratif. Ajouter une musique = déposer un
JSON ici + le référencer dans [`index.ts`](index.ts). Aucun code moteur à toucher.

## Convention de temps : les BEATS

Toutes les notes sont exprimées en **beats** (temps musicaux), pas en millisecondes :

```
ms(beat) = offsetMs + beat × 60000 / bpm
```

- `beat 0` = premier temps musical, situé à `offsetMs` dans le fichier audio.
- Avantage : changer le BPM re-cale toute la map, et les positions de la
  scanline restent cohérentes (elle est elle-même définie en beats).

## Champs

```jsonc
{
  "id": "neon-pulse",          // identifiant unique
  "title": "Neon Pulse",
  "artist": "…",               // optionnel
  "bpm": 100,                  // tempo (constant)
  "offsetMs": 0,               // position du beat 0 dans l'audio (ms)
  "scanCycleBeats": 4,         // beats pour UNE traversée de la scanline (haut→bas).
                               // L'aller-retour complet dure 2 × scanCycleBeats.
  "durationBeats": 96,         // longueur de la piste (déclenche la fin de partie)
  "notes": [
    { "beat": 8,  "x": 0.3, "type": "tap" },
    { "beat": 32, "x": 0.25, "type": "hold", "durationBeats": 2 }
  ]
}
```

### Notes

| Champ | Description |
|---|---|
| `beat` | instant de frappe (fractions autorisées : `8.5` = contretemps) |
| `x` | position horizontale `0..1` (garde `0.12–0.88` pour rester à l'écran) |
| `type` | `"tap"` ou `"hold"` |
| `durationBeats` | holds uniquement : durée de maintien en beats |

### Le `y` n'existe pas dans le format — il est dérivé

La position verticale d'une note est calculée par le moteur : c'est la position de
la scanline au `beat` de la note. Impossible donc de poser une note que la ligne
ne traverserait pas au bon moment.

### Contrainte sur les holds

Un hold doit tenir dans **une demi-traversée** de la scanline (elle ne doit pas
faire demi-tour en plein maintien). Avec `scanCycleBeats: 4`, les demi-traversées
sont `[0,4)`, `[4,8)`, `[8,12)`… Un hold peut finir *pile* sur un demi-tour.
`compileBeatmap` rejette les maps invalides avec un message explicite.

## Audio

Par défaut la piste est **synthétisée au BPM de la map** (`engine/synth-track.ts`)
— aucun asset à fournir. Pour utiliser un vrai morceau : décoder le fichier en
`AudioBuffer` (`ctx.decodeAudioData`) et le passer à `AudioClock.play()` à la place
du buffer synthétisé, puis caler `offsetMs` sur le premier temps du morceau.
