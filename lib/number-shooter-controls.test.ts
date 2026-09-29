import { describe, expect, it } from "vitest";
import { laneForLauncherPress } from "./number-shooter-controls";

describe("Number Shooter launcher controls", () => {
  it("fires in the lane that was pressed, not the previously highlighted lane", () => {
    expect(laneForLauncherPress({ pressedLane: 0, selectedLane: 2, laneCount: 5 })).toBe(0);
    expect(laneForLauncherPress({ pressedLane: 4, selectedLane: 0, laneCount: 5 })).toBe(4);
  });

  it("rejects an out-of-range launcher press", () => {
    expect(laneForLauncherPress({ pressedLane: -1, selectedLane: 2, laneCount: 5 })).toBeNull();
    expect(laneForLauncherPress({ pressedLane: 5, selectedLane: 2, laneCount: 5 })).toBeNull();
  });
});
