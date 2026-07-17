import { describe, expect, it } from "vitest";
import { isEmergencyStopKey, shouldStopWhenDocumentHidden } from "./haptic-safety";

describe("haptic safety triggers", () => {
  it("recognizes Escape and Space as emergency stop keys", () => {
    expect(isEmergencyStopKey("Escape")).toBe(true);
    expect(isEmergencyStopKey(" ")).toBe(true);
    expect(isEmergencyStopKey("Spacebar")).toBe(true);
  });

  it("does not stop for regular gameplay keys", () => {
    expect(isEmergencyStopKey("ArrowUp")).toBe(false);
    expect(isEmergencyStopKey("a")).toBe(false);
  });

  it("stops when the document becomes hidden", () => {
    expect(shouldStopWhenDocumentHidden("hidden")).toBe(true);
    expect(shouldStopWhenDocumentHidden("visible")).toBe(false);
  });
});
