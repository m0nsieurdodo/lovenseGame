import { describe, expect, it } from "vitest";
import {
  BASELINE_TIERS,
  comboToBaseline,
  judgementToPulse,
  MAX_LEVEL,
  mixIntensity,
  pulseEnvelope,
} from "./curves";

describe("comboToBaseline — paliers tous les 25 combos", () => {
  it("reste à 0 sous le premier palier", () => {
    expect(comboToBaseline(0)).toBe(0);
    expect(comboToBaseline(24)).toBe(0);
  });
  it("monte d'un cran à chaque palier", () => {
    expect(comboToBaseline(25)).toBe(3);
    expect(comboToBaseline(49)).toBe(3);
    expect(comboToBaseline(50)).toBe(5);
    expect(comboToBaseline(75)).toBe(7);
    expect(comboToBaseline(100)).toBe(9);
  });
  it("plafonne au dernier palier", () => {
    expect(comboToBaseline(125)).toBe(10);
    expect(comboToBaseline(9999)).toBe(BASELINE_TIERS[BASELINE_TIERS.length - 1]);
  });
  it("tolère un combo négatif", () => {
    expect(comboToBaseline(-5)).toBe(0);
  });
});

describe("judgementToPulse — amplitude selon le jugement", () => {
  it("PERFECT > GREAT > GOOD, MISS ne pulse pas", () => {
    const p = judgementToPulse("perfect")!;
    const g = judgementToPulse("great")!;
    const n = judgementToPulse("good")!;
    expect(p.amp).toBeGreaterThan(g.amp);
    expect(g.amp).toBeGreaterThan(n.amp);
    expect(judgementToPulse("miss")).toBeNull();
  });
});

describe("pulseEnvelope — attaque/relâche", () => {
  const spec = { amp: 10, attackMs: 20, releaseMs: 200 };
  it("vaut 0 avant le départ et après la fin", () => {
    expect(pulseEnvelope(spec, -1)).toBe(0);
    expect(pulseEnvelope(spec, 220)).toBe(0);
    expect(pulseEnvelope(spec, 10_000)).toBe(0);
  });
  it("atteint l'amplitude crête en fin d'attaque", () => {
    expect(pulseEnvelope(spec, 20)).toBe(10);
    expect(pulseEnvelope(spec, 10)).toBe(5); // mi-attaque
  });
  it("décroît linéairement pendant la relâche", () => {
    expect(pulseEnvelope(spec, 120)).toBeCloseTo(5); // mi-relâche
  });
});

describe("mixIntensity — somme + clamp 0..20", () => {
  it("somme baseline et pulses", () => {
    expect(mixIntensity(5, [3, 2])).toBe(10);
  });
  it("clampe à 20 (échelle Lovense)", () => {
    expect(mixIntensity(10, [9, 9])).toBe(MAX_LEVEL);
  });
  it("ne descend jamais sous 0", () => {
    expect(mixIntensity(-4, [])).toBe(0);
  });
});
