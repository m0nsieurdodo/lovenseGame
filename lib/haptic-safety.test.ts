import { describe, expect, it } from "vitest";
import { GAMES, gameForPath } from "./games";
import { isEmergencyStopKey, isInteractiveTarget, shouldStopWhenDocumentHidden } from "./haptic-safety";

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

  it("leaves Space to the game when the game uses it, but Escape always stops", () => {
    expect(isEmergencyStopKey(" ", { spaceIsGameKey: true })).toBe(false);
    expect(isEmergencyStopKey("Escape", { spaceIsGameKey: true })).toBe(true);
  });

  it("leaves Space to a focused field or button, but Escape always stops", () => {
    expect(isEmergencyStopKey(" ", { targetIsInteractive: true })).toBe(false);
    expect(isEmergencyStopKey("Escape", { targetIsInteractive: true })).toBe(true);
  });

  it("detects fields and controls that consume Space", () => {
    expect(isInteractiveTarget({ tagName: "INPUT" })).toBe(true);
    expect(isInteractiveTarget({ tagName: "button" })).toBe(true);
    expect(isInteractiveTarget({ tagName: "DIV", isContentEditable: true })).toBe(true);
    expect(isInteractiveTarget({ tagName: "CANVAS" })).toBe(false);
    expect(isInteractiveTarget(null)).toBe(false);
  });

  it("stops when the document becomes hidden", () => {
    expect(shouldStopWhenDocumentHidden("hidden")).toBe(true);
    expect(shouldStopWhenDocumentHidden("visible")).toBe(false);
  });
});

describe("game registry and the Space key", () => {
  it("resolves a game from its route, with or without trailing slash", () => {
    expect(gameForPath("/games/runner/")?.id).toBe("runner");
    expect(gameForPath("/games/runner")?.id).toBe("runner");
    expect(gameForPath("/")).toBeUndefined();
  });

  it("flags every game whose controls use Space", () => {
    const flagged = GAMES.filter((game) => game.usesSpace).map((game) => game.id).sort();
    expect(flagged).toEqual(["runner", "scanline", "tetris"]);
  });
});
