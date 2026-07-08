/* Registre des beatmaps — ajouter une piste = ajouter son JSON ici,
   AUCUN code moteur à toucher (voir README.md pour le format). */
import { parseBeatmap, type Beatmap } from "../engine/beatmap";
import neonPulse from "./neon-pulse.json";

export const BEATMAPS: Beatmap[] = [parseBeatmap(neonPulse)];

export const DEFAULT_BEATMAP = BEATMAPS[0];
