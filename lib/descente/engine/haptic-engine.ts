/* ============================================================
   DESCENTE — Moteur haptique à couches empilables.
   baseline continue (pilotée par le heat) + événements ponctuels à enveloppe,
   sommés puis clampés [0, safetyMax ≤ 20].
   Ne parle jamais au réseau : update() renvoie une intensité, l'appelant
   (HapticDirector) l'envoie au toy. Kill switch immédiat inclus.
   ============================================================ */
import {
  clamp,
  envelopeDuration,
  envelopeValue,
  heatToIntensity,
  MAX_INTENSITY,
  type CurveKind,
  type Envelope,
} from "./curves";

export interface SpikeSpec {
  peak: number; // intensité crête 0-20
  env: Envelope;
}

/** Hooks de relique = décorateurs du mapping haptique. */
export interface RelicHook {
  id: string;
  /** Transforme/remplace la baseline calculée depuis le heat. */
  mapBaseline?: (heat: number, curve: CurveKind) => number;
  /** Réagit à un spike ; peut en programmer d'autres (ex. Écho). */
  onSpike?: (spec: SpikeSpec, schedule: (spec: SpikeSpec, delayMs: number) => void) => void;
}

interface ActiveLayer {
  spec: SpikeSpec;
  tMs: number;
}
interface PendingLayer {
  spec: SpikeSpec;
  inMs: number;
}

/** Durée du pattern de mort : montée au max puis coupure sèche. */
export const DISCHARGE_MS = 1500;

export class HapticEngine {
  curve: CurveKind = "linear";
  /** Clamp de sécurité global — jamais dépassé, quoi que fassent les couches. */
  safetyMax = MAX_INTENSITY;

  private layers: ActiveLayer[] = [];
  private pending: PendingLayer[] = [];
  private relics: RelicHook[] = [];
  private killed = false;
  private dischargeT: number | null = null;

  isKilled() {
    return this.killed;
  }
  addRelic(hook: RelicHook) {
    this.relics.push(hook);
  }
  clearRelics() {
    this.relics = [];
  }

  /** Événement ponctuel (combat, dégât, piège) → nouvelle couche à enveloppe. */
  spike(spec: SpikeSpec) {
    if (this.killed) return;
    const schedule = (s: SpikeSpec, delayMs: number) => this.pending.push({ spec: s, inMs: delayMs });
    for (const r of this.relics) r.onSpike?.(spec, schedule);
    this.layers.push({ spec, tMs: 0 });
  }

  /** Pattern de mort : montée rapide au max (~1.5 s) puis coupure. */
  discharge() {
    if (this.killed) return;
    this.layers = [];
    this.pending = [];
    this.dischargeT = 0;
  }

  /** Kill switch immédiat (Espace) : tout à zéro tant que pas réarmé. */
  kill() {
    this.killed = true;
    this.layers = [];
    this.pending = [];
    this.dischargeT = null;
  }
  rearm() {
    this.killed = false;
  }

  /** Avance de dtMs et renvoie l'intensité 0-20 à envoyer au toy. */
  update(dtMs: number, heat: number): number {
    if (this.killed) return 0;

    if (this.dischargeT !== null) {
      this.dischargeT += dtMs;
      if (this.dischargeT >= DISCHARGE_MS) {
        this.dischargeT = null; // coupure sèche
        return 0;
      }
      return clamp((this.dischargeT / DISCHARGE_MS) * MAX_INTENSITY, 0, this.safetyMax);
    }

    // Baseline continue pilotée par le heat (transformable par relique).
    let baseline = heatToIntensity(heat, this.curve);
    for (const r of this.relics) if (r.mapBaseline) baseline = r.mapBaseline(heat, this.curve);

    // Couches actives : avance + somme.
    let sum = baseline;
    const alive: ActiveLayer[] = [];
    for (const l of this.layers) {
      l.tMs += dtMs;
      sum += envelopeValue(l.spec.env, l.tMs) * l.spec.peak;
      if (l.tMs < envelopeDuration(l.spec.env)) alive.push(l);
    }
    this.layers = alive;

    // Couches différées (ex. Écho) : déclenchées avec compensation du dépassement.
    const stillPending: PendingLayer[] = [];
    for (const p of this.pending) {
      p.inMs -= dtMs;
      if (p.inMs <= 0) {
        const layer: ActiveLayer = { spec: p.spec, tMs: -p.inMs };
        sum += envelopeValue(layer.spec.env, layer.tMs) * layer.spec.peak;
        if (layer.tMs < envelopeDuration(layer.spec.env)) this.layers.push(layer);
      } else {
        stillPending.push(p);
      }
    }
    this.pending = stillPending;

    return clamp(sum, 0, this.safetyMax);
  }

  reset() {
    this.layers = [];
    this.pending = [];
    this.dischargeT = null;
  }
}
