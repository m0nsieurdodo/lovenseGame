import { describe, expect, it } from "vitest";
import type { HapticOutput } from "../lovense/output";
import { JUDGEMENT_PULSES, MISS_DIP_MS } from "./curves";
import { HapticEngine } from "./haptic-engine";

class SpyOutput implements HapticOutput {
  levels: number[] = [];
  stopped = 0;
  setIntensity(level: number) {
    this.levels.push(level);
  }
  stop() {
    this.stopped++;
  }
}

describe("HapticEngine — baseline combo + pulses jugement", () => {
  it("baseline suit le combo, pulse s'ajoute sur un PERFECT, clamp implicite", () => {
    const out = new SpyOutput();
    const h = new HapticEngine(out);
    h.handleEvent({ type: "combo_changed", combo: 50 }, 0);
    expect(h.tick(0).baseline).toBe(5);

    h.handleEvent({ type: "note_hit", noteId: 1, judgement: "perfect" }, 100);
    const snap = h.tick(100 + JUDGEMENT_PULSES.perfect!.attackMs);
    expect(snap.pulse).toBeCloseTo(9);
    expect(snap.total).toBeCloseTo(14); // 5 + 9
  });

  it("MISS ne pulse pas et coupe brièvement la baseline (combo cassé)", () => {
    const out = new SpyOutput();
    const h = new HapticEngine(out);
    h.handleEvent({ type: "combo_changed", combo: 30 }, 0);
    h.handleEvent({ type: "note_hit", noteId: 2, judgement: "miss" }, 1000);
    h.handleEvent({ type: "combo_broken", lostCombo: 30 }, 1000);
    h.handleEvent({ type: "combo_changed", combo: 0 }, 1000);
    expect(h.tick(1100).total).toBe(0); // micro-coupure
    expect(h.tick(1000 + MISS_DIP_MS + 1).baseline).toBe(0); // baseline retombée (combo 0)
  });

  it("kill switch : tout à zéro, plus aucun envoi", () => {
    const out = new SpyOutput();
    const h = new HapticEngine(out);
    h.handleEvent({ type: "note_hit", noteId: 1, judgement: "perfect" }, 0);
    h.kill();
    expect(out.stopped).toBe(1);
    const sends = out.levels.length;
    expect(h.tick(10).total).toBe(0);
    expect(out.levels.length).toBe(sends); // tick post-kill n'envoie rien
  });
});
