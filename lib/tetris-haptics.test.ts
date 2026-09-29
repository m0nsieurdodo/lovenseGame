import { describe, expect, it } from "vitest";
import { tetrisHapticPlan } from "./tetris-haptics";

describe("tetrisHapticPlan", () => {
  it("gives a short, restrained confirmation on a piece lock", () => {
    expect(tetrisHapticPlan({ kind: "lock" })).toEqual({ kind: "pulse", intensity: 12, durationMs: 120 });
  });

  it("makes line clears progressively stronger", () => {
    expect(tetrisHapticPlan({ kind: "clear", lines: 1, backToBackTetris: false })).toEqual({ kind: "pulse", intensity: 28, durationMs: 280 });
    expect(tetrisHapticPlan({ kind: "clear", lines: 4, backToBackTetris: false })).toEqual({ kind: "pulse", intensity: 82, durationMs: 900 });
  });

  it("reserves the climax pattern for a back-to-back tetris", () => {
    expect(tetrisHapticPlan({ kind: "clear", lines: 4, backToBackTetris: true })).toEqual({ kind: "climax" });
  });

  it("keeps tactile gameplay feedback brief", () => {
    expect(tetrisHapticPlan({ kind: "rotate" })).toEqual({ kind: "pulse", intensity: 6, durationMs: 45 });
    expect(tetrisHapticPlan({ kind: "hard_drop" })).toEqual({ kind: "pulse", intensity: 18, durationMs: 110 });
  });
});
