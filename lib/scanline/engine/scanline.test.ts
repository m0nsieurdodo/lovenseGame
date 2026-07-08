import { describe, expect, it } from "vitest";
import { scanlineDir, scanlineY, sweepIndex } from "./scanline";

describe("scanlineY — onde triangle dérivée du beat", () => {
  it("descend de 0 à 1 sur la première demi-période", () => {
    expect(scanlineY(0, 4)).toBe(0);
    expect(scanlineY(2, 4)).toBe(0.5);
    expect(scanlineY(4, 4)).toBe(1);
  });
  it("remonte de 1 à 0 sur la seconde", () => {
    expect(scanlineY(6, 4)).toBe(0.5);
    expect(scanlineY(8, 4)).toBe(0);
  });
  it("est périodique et supporte les beats négatifs (lead-in)", () => {
    expect(scanlineY(10, 4)).toBe(scanlineY(2, 4));
    expect(scanlineY(-2, 4)).toBe(scanlineY(6, 4));
  });
});

describe("scanlineDir / sweepIndex", () => {
  it("direction : descend puis remonte", () => {
    expect(scanlineDir(1, 4)).toBe(1);
    expect(scanlineDir(5, 4)).toBe(-1);
  });
  it("index de demi-traversée", () => {
    expect(sweepIndex(3.9, 4)).toBe(0);
    expect(sweepIndex(4, 4)).toBe(1);
    expect(sweepIndex(9, 4)).toBe(2);
  });
});
