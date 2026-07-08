/* ============================================================
   DESCENTE — Reliques : elles MODIFIENT le mapping haptique, pas des stats.
   Chaque relique = hooks/decorators greffés sur le moteur de courbes
   (HapticEngine) et/ou la state machine (HeatMachine).
   Pour en ajouter une : une entrée ici, rien à toucher ailleurs.
   ============================================================ */
import { heatToIntensity } from "./curves";
import type { RelicHook } from "./haptic-engine";
import type { HeatFloorFn } from "./heat-machine";

export interface RelicDef {
  id: string;
  name: string;
  icon: string;
  desc: string;
  hook?: RelicHook; // greffé sur HapticEngine
  heatFloor?: HeatFloorFn; // greffé sur HeatMachine
}

export const RELICS: RelicDef[] = [
  {
    id: "sangfroid",
    name: "Sang-froid inversé",
    icon: "🧊",
    desc: "Plus le danger monte, plus la baseline se calme. Force le jeu agressif.",
    hook: {
      id: "sangfroid",
      mapBaseline: (heat, curve) => heatToIntensity(100 - heat, curve),
    },
  },
  {
    id: "echo",
    name: "Écho",
    icon: "🔁",
    desc: "Chaque spike se répète, atténué de moitié, 2 secondes plus tard.",
    hook: {
      id: "echo",
      // Les couches programmées ne repassent pas par onSpike → pas d'écho infini.
      onSpike: (spec, schedule) => schedule({ peak: spec.peak * 0.5, env: spec.env }, 2000),
    },
  },
  {
    id: "palier",
    name: "Palier",
    icon: "🪜",
    desc: "Le heat ne redescend jamais sous les multiples de 25 déjà atteints.",
    heatFloor: (maxReached) => Math.floor(maxReached / 25) * 25,
  },
];

export function getRelic(id: string): RelicDef | undefined {
  return RELICS.find((r) => r.id === id);
}
