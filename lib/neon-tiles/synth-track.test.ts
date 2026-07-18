import { describe, expect, it, vi } from "vitest";
import { createSilentTileTrack } from "./synth-track";

const chart = {
  id: "test",
  title: "Test",
  bpm: 120,
  offsetMs: 500,
  durationBeats: 8,
  notes: [],
};

describe("Neon Tiles compatible audio fallback", () => {
  it("creates a silent timing track long enough to keep gameplay and live music synchronized", () => {
    const buffer = { tag: "silent-timing-track" } as unknown as AudioBuffer;
    const context = {
      sampleRate: 1_000,
      createBuffer: vi.fn(() => buffer),
    } as unknown as AudioContext;

    expect(createSilentTileTrack(context, chart)).toBe(buffer);
    expect(context.createBuffer).toHaveBeenCalledWith(1, 6_000, 1_000);
  });
});
