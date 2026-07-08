import { describe, expect, it } from "vitest";
import { envelopeDuration, envelopeValue, heatToIntensity, MAX_INTENSITY } from "../curves";

describe("heatToIntensity", () => {
  it("mappe linéairement 0-100 → 0-20 par défaut", () => {
    expect(heatToIntensity(0)).toBe(0);
    expect(heatToIntensity(50)).toBe(10);
    expect(heatToIntensity(100)).toBe(MAX_INTENSITY);
  });

  it("clampe les entrées hors bornes", () => {
    expect(heatToIntensity(-30)).toBe(0);
    expect(heatToIntensity(250)).toBe(MAX_INTENSITY);
  });

  it("courbe easeIn : quadratique, douce en bas d'échelle", () => {
    expect(heatToIntensity(50, "easeIn")).toBe(5); // 0.5² × 20
    expect(heatToIntensity(100, "easeIn")).toBe(MAX_INTENSITY);
    expect(heatToIntensity(25, "easeIn")).toBeLessThan(heatToIntensity(25, "linear"));
  });
});

describe("envelopeValue (ADSR simplifié)", () => {
  const env = { attackMs: 100, holdMs: 200, releaseMs: 400 };

  it("monte linéairement pendant l'attaque", () => {
    expect(envelopeValue(env, 0)).toBe(0);
    expect(envelopeValue(env, 50)).toBeCloseTo(0.5);
  });

  it("tient à 1 pendant le maintien", () => {
    expect(envelopeValue(env, 100)).toBe(1);
    expect(envelopeValue(env, 299)).toBe(1);
  });

  it("redescend linéairement pendant la relâche", () => {
    expect(envelopeValue(env, 500)).toBeCloseTo(0.5); // milieu de release
  });

  it("vaut 0 avant le début et après la fin", () => {
    expect(envelopeValue(env, -10)).toBe(0);
    expect(envelopeValue(env, envelopeDuration(env))).toBe(0);
    expect(envelopeValue(env, 9999)).toBe(0);
  });

  it("attaque nulle → plein niveau immédiat", () => {
    expect(envelopeValue({ attackMs: 0, holdMs: 100, releaseMs: 0 }, 0)).toBe(1);
  });
});
