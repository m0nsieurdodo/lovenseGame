/* ============================================================
   DESCENTE — HapticDirector : la seule pièce qui relie le jeu au toy.
   Écoute les événements sémantiques du bus, les traduit en spikes de heat
   (proportionnels au danger réel) + couches haptiques, puis pousse
   l'intensité résultante vers le LovenseToy (throttlée aux changements).
   ============================================================ */
import type { EventBus, GameEvent } from "../events";
import type { LovenseToy } from "../lovense/controller";
import { clamp, type Envelope } from "./curves";
import { HapticEngine } from "./haptic-engine";
import { HeatMachine, type HeatState } from "./heat-machine";
import { getRelic } from "./relics";

const FAST: Envelope = { attackMs: 80, holdMs: 200, releaseMs: 500 };
const HEAVY: Envelope = { attackMs: 120, holdMs: 400, releaseMs: 900 };
const SOFT: Envelope = { attackMs: 60, holdMs: 120, releaseMs: 400 };

export interface HapticFrame {
  heat: number;
  state: HeatState;
  intensity: number; // 0-20 envoyée au toy
  killed: boolean;
}

export class HapticDirector {
  readonly machine = new HeatMachine();
  readonly engine = new HapticEngine();
  private lastLevel = -1;
  private off: () => void;

  constructor(bus: EventBus, private toy: LovenseToy) {
    this.off = bus.on((e) => this.handle(e));
  }

  private handle(e: GameEvent) {
    switch (e.type) {
      case "enter_room":
        if (!e.safe) this.machine.spike(2 + e.danger); // frisson d'entrée en zone inconnue
        break;
      case "combat_start":
        // Spike proportionnel au danger réel : nombre d'ennemis + niveau de la salle.
        this.machine.spike(clamp(6 + e.enemies * 4 + e.danger * 3, 0, 35));
        this.engine.spike({ peak: clamp(4 + e.enemies * 1.5, 0, 12), env: HEAVY });
        break;
      case "took_damage":
        this.machine.spike(clamp(e.amount * 8, 0, 30));
        this.engine.spike({ peak: clamp(6 + e.amount * 3, 0, 16), env: FAST });
        break;
      case "trap_triggered":
        this.machine.spike(clamp(e.damage * 10, 0, 30));
        this.engine.spike({ peak: 10, env: FAST });
        break;
      case "room_cleared":
        this.engine.spike({ peak: 5, env: SOFT });
        break;
      case "relic_pickup": {
        const relic = getRelic(e.relicId);
        if (relic?.hook) this.engine.addRelic(relic.hook);
        if (relic?.heatFloor) this.machine.addFloor(relic.heatFloor);
        this.engine.spike({ peak: 8, env: HEAVY });
        break;
      }
      case "floor_descend":
        this.machine.spike(8 + e.floor * 2);
        break;
      case "player_death":
        this.engine.discharge(); // montée au max ~1.5 s puis coupure
        this.machine.reset(); // heat à zéro : silence total après la coupure
        break;
    }
  }

  /** À appeler chaque frame de jeu. `exposed` = joueur en zone dangereuse. */
  update(dtMs: number, exposed: boolean): HapticFrame {
    this.machine.update(dtMs, exposed);
    const intensity = this.engine.update(dtMs, this.machine.heat);
    const level = Math.round(intensity);
    if (level !== this.lastLevel) {
      this.lastLevel = level;
      this.toy.setIntensity(level);
    }
    return { heat: this.machine.heat, state: this.machine.state, intensity, killed: this.engine.isKilled() };
  }

  /** Kill switch (Espace) : coupe le toy immédiatement, jusqu'à réarmement. */
  killSwitch() {
    this.engine.kill();
    this.lastLevel = 0;
    this.toy.stop();
  }
  rearm() {
    this.engine.rearm();
    this.lastLevel = -1;
  }
  isKilled() {
    return this.engine.isKilled();
  }

  /** Silence temporaire (pause / menu) sans perdre l'état. */
  mute() {
    this.lastLevel = -1;
    this.toy.stop();
  }

  /** Nouvelle run : heat, couches et reliques remis à zéro. */
  resetRun() {
    this.machine.reset();
    this.machine.clearFloors();
    this.engine.reset();
    this.engine.clearRelics();
    this.lastLevel = -1;
    this.toy.stop();
  }

  destroy() {
    this.off();
    this.toy.stop();
  }
}
