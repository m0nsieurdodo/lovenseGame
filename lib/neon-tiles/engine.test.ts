import { describe, expect, it } from "vitest";
import { compileTileChart, generateDemoChart, judgeTileHit, tileSpeedForBpm, tileTrackDurationSec } from "./engine";

describe("Neon Tiles chart", () => {
  it("converts beat positions into hit timestamps from BPM and offset", () => {
    const tiles = compileTileChart({
      id: "test",
      title: "Test",
      bpm: 120,
      offsetMs: 250,
      durationBeats: 8,
      notes: [{ beat: 2, lane: 3 }],
    });

    expect(tiles).toEqual([{ id: 0, beat: 2, lane: 3, timeMs: 1250 }]);
  });

  it("rejects notes outside the four playable lanes", () => {
    expect(() => compileTileChart({
      id: "test",
      title: "Test",
      bpm: 120,
      offsetMs: 0,
      durationBeats: 8,
      notes: [{ beat: 1, lane: 4 }],
    })).toThrow("lane doit être entre 0 et 3");
  });

  it("uses a faster but bounded falling speed for a higher BPM", () => {
    expect(tileSpeedForBpm(180)).toBeGreaterThan(tileSpeedForBpm(90));
    expect(tileSpeedForBpm(500)).toBeLessThanOrEqual(1);
  });

  it("calculates enough audio duration to contain the chart and its release tail", () => {
    expect(tileTrackDurationSec({ bpm: 120, offsetMs: 500, durationBeats: 8 })).toBe(6);
  });

  it("generates a deterministic demo chart that is playable in four lanes", () => {
    const chart = generateDemoChart(128);

    expect(chart.bpm).toBe(128);
    expect(chart.notes.length).toBeGreaterThan(16);
    expect(chart.notes.every((note) => note.lane >= 0 && note.lane < 4)).toBe(true);
    expect([...chart.notes].map((note) => note.beat)).toEqual([...chart.notes].map((note) => note.beat).sort((a, b) => a - b));
  });
});

describe("Neon Tiles timing judgement", () => {
  it("grades taps from perfect to miss using the tile timing windows", () => {
    expect(judgeTileHit(0)).toBe("perfect");
    expect(judgeTileHit(55)).toBe("great");
    expect(judgeTileHit(110)).toBe("good");
    expect(judgeTileHit(170)).toBeNull();
  });
});
