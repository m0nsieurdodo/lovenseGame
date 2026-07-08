import { describe, expect, it } from "vitest";
import { isExpired, judge, JUDGEMENT_WINDOWS_MS } from "./judgement";

describe("judge — fenêtres de précision", () => {
  it("PERFECT dans ±40 ms", () => {
    expect(judge(0)).toBe("perfect");
    expect(judge(JUDGEMENT_WINDOWS_MS.perfect)).toBe("perfect");
    expect(judge(-JUDGEMENT_WINDOWS_MS.perfect)).toBe("perfect");
  });
  it("GREAT dans ±80 ms", () => {
    expect(judge(JUDGEMENT_WINDOWS_MS.perfect + 1)).toBe("great");
    expect(judge(-JUDGEMENT_WINDOWS_MS.great)).toBe("great");
  });
  it("GOOD dans ±120 ms", () => {
    expect(judge(JUDGEMENT_WINDOWS_MS.great + 1)).toBe("good");
    expect(judge(JUDGEMENT_WINDOWS_MS.good)).toBe("good");
  });
  it("hors fenêtre → null (tap ignoré, pas de pénalité)", () => {
    expect(judge(JUDGEMENT_WINDOWS_MS.good + 1)).toBeNull();
    expect(judge(-500)).toBeNull();
  });
});

describe("isExpired — miss automatique", () => {
  it("expire juste après la fenêtre GOOD", () => {
    expect(isExpired(1120, 1000)).toBe(false);
    expect(isExpired(1121, 1000)).toBe(true);
  });
});
