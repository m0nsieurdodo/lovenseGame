/* ============================================================
   HAPTIC ENGINE — traduit les événements sémantiques du jeu en
   intensité 0..20, via les courbes pures de curves.ts.

   Couches empilées à chaque tick (horloge audio) :
     baseline = comboToBaseline(combo)   (0 pendant la micro-coupure MISS)
     pulses   = enveloppes actives des jugements
     total    = clamp(baseline + Σ pulses, 0..20) → output.setIntensity()

   kill() = kill switch immédiat (vide tout + output.stop()).
   ============================================================ */
import type { GameEvent } from "../engine/events";
import type { HapticOutput } from "../lovense/output";
import {
  comboToBaseline,
  judgementToPulse,
  MISS_DIP_MS,
  mixIntensity,
  pulseEnvelope,
  type PulseSpec,
} from "./curves";

export interface HapticSnapshot {
  baseline: number;
  pulse: number;
  total: number; // 0..20, ce qui part vers le toy
}

interface ActivePulse {
  spec: PulseSpec;
  startMs: number;
}

export class HapticEngine {
  private pulses: ActivePulse[] = [];
  private combo = 0;
  private dipUntilMs = -Infinity;
  private killed = false;
  private lastSnapshot: HapticSnapshot = { baseline: 0, pulse: 0, total: 0 };

  constructor(private output: HapticOutput) {}

  /** Traduit un événement de jeu. `tMs` = heure audio de l'événement. */
  handleEvent(ev: GameEvent, tMs: number): void {
    if (this.killed) return;
    switch (ev.type) {
      case "note_hit": {
        const spec = judgementToPulse(ev.judgement);
        if (spec) this.pulses.push({ spec, startMs: tMs });
        break;
      }
      case "hold_complete": {
        // Fin de hold tenue = petit pulse de récompense (même profil que GOOD).
        const spec = judgementToPulse("good");
        if (spec) this.pulses.push({ spec, startMs: tMs });
        break;
      }
      case "combo_changed":
        this.combo = ev.combo;
        break;
      case "combo_broken":
        // Punition : micro-coupure de la baseline (la chute de palier suit
        // d'elle-même via combo_changed → combo 0).
        this.dipUntilMs = tMs + MISS_DIP_MS;
        this.pulses = [];
        break;
      case "song_end":
        this.pulses = [];
        break;
    }
  }

  /** À appeler régulièrement (~30 Hz) avec l'heure audio. */
  tick(tMs: number): HapticSnapshot {
    if (this.killed) return this.lastSnapshot;
    this.pulses = this.pulses.filter(
      (p) => tMs - p.startMs < p.spec.attackMs + p.spec.releaseMs,
    );
    const baseline = tMs < this.dipUntilMs ? 0 : comboToBaseline(this.combo);
    const pulse = this.pulses.reduce((acc, p) => acc + pulseEnvelope(p.spec, tMs - p.startMs), 0);
    const total = mixIntensity(baseline, [pulse]);
    this.output.setIntensity(Math.round(total));
    this.lastSnapshot = { baseline, pulse, total };
    return this.lastSnapshot;
  }

  /** Silence sans perdre l'état (pause) — le prochain tick reprendra. */
  suspend(): void {
    this.output.stop();
  }

  /** KILL SWITCH — tout s'arrête immédiatement et définitivement. */
  kill(): void {
    this.killed = true;
    this.pulses = [];
    this.combo = 0;
    this.lastSnapshot = { baseline: 0, pulse: 0, total: 0 };
    this.output.stop();
  }
}
