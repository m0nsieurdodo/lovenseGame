import { describe, expect, it } from "vitest";
import { classifyTetrisGesture } from "./tetris-gestures";

describe("classifyTetrisGesture", () => {
  it("rotates on a deliberate tap", () => {
    expect(classifyTetrisGesture({ x: 100, y: 100 }, { x: 106, y: 104 })).toEqual({ action: "rotate" });
  });

  it("moves horizontally by the number of crossed cells", () => {
    expect(classifyTetrisGesture({ x: 20, y: 100 }, { x: 150, y: 105 }, 30)).toEqual({ action: "move", amount: 4 });
    expect(classifyTetrisGesture({ x: 170, y: 100 }, { x: 100, y: 110 }, 30)).toEqual({ action: "move", amount: -2 });
  });

  it("uses a short downward swipe as soft drop and a long one as hard drop", () => {
    expect(classifyTetrisGesture({ x: 100, y: 100 }, { x: 105, y: 160 }, 30)).toEqual({ action: "soft_drop", amount: 2 });
    expect(classifyTetrisGesture({ x: 100, y: 100 }, { x: 105, y: 320 }, 30)).toEqual({ action: "hard_drop" });
  });

  it("ignores upward swipes to avoid accidental actions", () => {
    expect(classifyTetrisGesture({ x: 100, y: 200 }, { x: 102, y: 120 }, 30)).toEqual({ action: "none" });
  });
});
