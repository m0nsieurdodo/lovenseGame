import { describe, expect, it } from "vitest";
import { HeatMachine, type HeatConfig } from "../heat-machine";

// Config ronde pour des assertions exactes.
const CFG: HeatConfig = { riseRate: 2, decayRate: 4, decayDelayMs: 1500, spikeRate: 80 };

describe("HeatMachine", () => {
  it("démarre idle à 0", () => {
    const m = new HeatMachine(CFG);
    expect(m.heat).toBe(0);
    expect(m.state).toBe("idle");
  });

  it("monte en continu quand le joueur est exposé (rising)", () => {
    const m = new HeatMachine(CFG);
    m.update(1000, true);
    expect(m.heat).toBeCloseTo(2);
    expect(m.state).toBe("rising");
  });

  it("spike : montée rapide vers la cible puis retour au régime courant", () => {
    const m = new HeatMachine(CFG);
    m.spike(20);
    m.update(100, true); // +8 pts (80/s), cible pas atteinte
    expect(m.state).toBe("spiking");
    expect(m.heat).toBeCloseTo(8);
    m.update(200, true); // dépasse la cible → clampé à 20
    expect(m.heat).toBeCloseTo(20);
    expect(m.state).toBe("rising");
  });

  it("les spikes s'accumulent tant que la montée est en cours", () => {
    const m = new HeatMachine(CFG);
    m.spike(10);
    m.spike(10);
    m.update(1000, false);
    expect(m.heat).toBeCloseTo(20);
  });

  it("en sécurité : pas de decay avant le délai, puis descente (decaying)", () => {
    const m = new HeatMachine(CFG);
    m.spike(20);
    m.update(1000, true); // heat = 20
    m.update(1000, false); // safe depuis 1000 ms < 1500 → tient
    expect(m.heat).toBeCloseTo(20);
    m.update(1000, false); // délai passé → -4
    expect(m.heat).toBeCloseTo(16);
    expect(m.state).toBe("decaying");
  });

  it("clampe à 100 et retombe à idle à 0", () => {
    const m = new HeatMachine(CFG);
    m.spike(500);
    m.update(10000, true);
    expect(m.heat).toBe(100);
    const m2 = new HeatMachine(CFG);
    m2.spike(2);
    m2.update(1000, false);
    m2.update(5000, false); // décayé jusqu'à 0
    expect(m2.heat).toBe(0);
    expect(m2.state).toBe("idle");
  });

  it("relique Palier : le heat ne redescend pas sous les multiples de 25 atteints", () => {
    const m = new HeatMachine(CFG);
    m.addFloor((maxReached) => Math.floor(maxReached / 25) * 25);
    m.spike(60);
    m.update(1000, true); // heat = 60, maxReached = 60 → plancher 50
    m.update(2000, false);
    m.update(60000, false); // decay long
    expect(m.heat).toBe(50);
    expect(m.state).toBe("decaying"); // heat > 0, jamais idle avec un plancher
  });

  it("reset : run suivante repart de zéro (planchers conservés séparément)", () => {
    const m = new HeatMachine(CFG);
    m.spike(80);
    m.update(2000, true);
    m.reset();
    expect(m.heat).toBe(0);
    expect(m.maxReached).toBe(0);
    expect(m.state).toBe("idle");
  });
});
