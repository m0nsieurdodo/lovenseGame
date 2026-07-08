import { describe, expect, it } from "vitest";
import { compileBeatmap, msOfBeat, type Beatmap } from "./beatmap";

const base: Beatmap = {
  id: "t",
  title: "test",
  bpm: 120, // 1 beat = 500 ms
  offsetMs: 100,
  scanCycleBeats: 4,
  durationBeats: 16,
  notes: [],
};

describe("compileBeatmap — beats → ms, y dérivé de la scanline", () => {
  it("convertit les beats en ms avec l'offset", () => {
    expect(msOfBeat(base, 0)).toBe(100);
    expect(msOfBeat(base, 4)).toBe(2100);
  });
  it("dérive y de la position de la scanline au beat de frappe", () => {
    const [a, b] = compileBeatmap({
      ...base,
      notes: [
        { beat: 2, x: 0.5, type: "tap" }, // mi-descente → y 0.5
        { beat: 4, x: 0.5, type: "tap" }, // bas de l'écran → y 1
      ],
    });
    expect(a.y).toBe(0.5);
    expect(b.y).toBe(1);
  });
  it("trie les notes par temps et calcule la fin des holds", () => {
    const notes = compileBeatmap({
      ...base,
      notes: [
        { beat: 8, x: 0.5, type: "tap" },
        { beat: 1, x: 0.3, type: "hold", durationBeats: 2 },
      ],
    });
    expect(notes[0].beat).toBe(1);
    expect(notes[0].endMs).toBe(msOfBeat(base, 3));
    expect(notes[0].yEnd).toBe(0.75);
  });
  it("rejette un hold qui traverse un demi-tour de scanline", () => {
    expect(() =>
      compileBeatmap({ ...base, notes: [{ beat: 3, x: 0.5, type: "hold", durationBeats: 2 }] }),
    ).toThrow(/demi-tour/);
  });
  it("accepte un hold qui finit pile sur le demi-tour", () => {
    expect(() =>
      compileBeatmap({ ...base, notes: [{ beat: 2, x: 0.5, type: "hold", durationBeats: 2 }] }),
    ).not.toThrow();
  });
  it("rejette un hold sans durée et un x hors écran", () => {
    expect(() => compileBeatmap({ ...base, notes: [{ beat: 1, x: 0.5, type: "hold" }] })).toThrow();
    expect(() => compileBeatmap({ ...base, notes: [{ beat: 1, x: 1.2, type: "tap" }] })).toThrow();
  });
});
