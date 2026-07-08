/* ============================================================
   DESCENTE — State machine du heat : idle / rising / spiking / decaying.
   Le heat (0-100) mesure l'EXPOSITION AU RISQUE du joueur, pas ses récompenses.
   dt injecté à chaque update → testable isolément, sans horloge réelle.
   ============================================================ */
import { clamp } from "./curves";

export type HeatState = "idle" | "rising" | "spiking" | "decaying";

export interface HeatConfig {
  riseRate: number; // pts/s tant que le joueur est exposé (salle non nettoyée, combat)
  decayRate: number; // pts/s en zone sûre, une fois le délai passé
  decayDelayMs: number; // délai en sécurité avant que le decay démarre
  spikeRate: number; // pts/s pendant la montée rapide d'un spike
}

export const DEFAULT_HEAT_CONFIG: HeatConfig = {
  riseRate: 2.5,
  decayRate: 4,
  decayDelayMs: 1500,
  spikeRate: 80,
};

/** Hook relique : plancher de heat (ex. "Palier"). Reçoit le max atteint sur la run. */
export type HeatFloorFn = (maxReached: number) => number;

export class HeatMachine {
  heat = 0;
  state: HeatState = "idle";
  maxReached = 0;
  private spikeTarget: number | null = null;
  private safeForMs = 0;
  private floors: HeatFloorFn[] = [];

  constructor(private cfg: HeatConfig = DEFAULT_HEAT_CONFIG) {}

  addFloor(fn: HeatFloorFn) {
    this.floors.push(fn);
  }
  clearFloors() {
    this.floors = [];
  }

  /** Spike : montée rapide de `amount` points, proportionnel au danger réel. */
  spike(amount: number) {
    this.spikeTarget = clamp((this.spikeTarget ?? this.heat) + amount, 0, 100);
  }

  /** Avance la machine de dtMs. `exposed` = joueur en zone dangereuse. */
  update(dtMs: number, exposed: boolean) {
    const dt = dtMs / 1000;
    if (this.spikeTarget !== null) {
      this.heat = Math.min(this.spikeTarget, this.heat + this.cfg.spikeRate * dt);
      if (this.heat >= this.spikeTarget) this.spikeTarget = null;
      this.safeForMs = 0;
    } else if (exposed) {
      this.safeForMs = 0;
      this.heat += this.cfg.riseRate * dt;
    } else {
      this.safeForMs += dtMs;
      if (this.safeForMs >= this.cfg.decayDelayMs) this.heat -= this.cfg.decayRate * dt;
    }

    // Planchers de reliques + clamp global 0-100.
    let floor = 0;
    for (const fn of this.floors) floor = Math.max(floor, fn(this.maxReached));
    this.heat = clamp(this.heat, floor, 100);
    this.maxReached = Math.max(this.maxReached, this.heat);

    this.state =
      this.spikeTarget !== null ? "spiking" : exposed ? "rising" : this.heat > 0 ? "decaying" : "idle";
  }

  reset() {
    this.heat = 0;
    this.state = "idle";
    this.maxReached = 0;
    this.spikeTarget = null;
    this.safeForMs = 0;
  }
}
