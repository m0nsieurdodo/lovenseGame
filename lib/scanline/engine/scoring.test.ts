import { describe, expect, it } from "vitest";
import { accuracy, comboMultiplier, noteScore } from "./scoring";

describe("scoring — jugement × combo", () => {
  it("score de base sans combo", () => {
    expect(noteScore("perfect", 0)).toBe(1000);
    expect(noteScore("great", 0)).toBe(700);
    expect(noteScore("good", 0)).toBe(400);
    expect(noteScore("miss", 0)).toBe(0);
  });
  it("le combo multiplie (+1 %/combo, plafonné ×2 à 100)", () => {
    expect(comboMultiplier(50)).toBe(1.5);
    expect(noteScore("perfect", 50)).toBe(1500);
    expect(noteScore("perfect", 100)).toBe(2000);
    expect(noteScore("perfect", 400)).toBe(2000); // plafond
  });
});

describe("accuracy — précision pondérée", () => {
  it("100 % si que des PERFECT", () => {
    expect(accuracy({ perfect: 10, great: 0, good: 0, miss: 0 })).toBe(1);
  });
  it("pondère great/good et pénalise les miss", () => {
    expect(accuracy({ perfect: 0, great: 10, good: 0, miss: 0 })).toBeCloseTo(0.7);
    expect(accuracy({ perfect: 5, great: 0, good: 0, miss: 5 })).toBeCloseTo(0.5);
  });
  it("vaut 1 sans note résolue (début de partie)", () => {
    expect(accuracy({ perfect: 0, great: 0, good: 0, miss: 0 })).toBe(1);
  });
});
