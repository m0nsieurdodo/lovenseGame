import { describe, expect, it } from "vitest";
import { FixedStep } from "./fixed-step";

function stepsOverOneSecond(hz: number) {
  const clock = new FixedStep();
  let total = 0;
  const frame = 1000 / hz;
  for (let i = 0; i <= hz; i++) total += clock.advance(i * frame);
  return total;
}

describe("FixedStep", () => {
  it("simulates the same amount of game time on 60, 120 and 144 Hz displays", () => {
    expect(stepsOverOneSecond(60)).toBe(60);
    expect(stepsOverOneSecond(120)).toBe(60);
    expect(stepsOverOneSecond(144)).toBe(60);
  });

  it("runs exactly one step per frame when a 60 Hz display jitters", () => {
    const clock = new FixedStep();
    clock.advance(0);
    const steps = [15.9, 17.4, 16.2, 17.1, 16.0].map(((t) => (dt: number) => clock.advance((t += dt)))(0));
    expect(steps).toEqual([1, 1, 1, 1, 1]);
  });

  it("freezes while inactive and does not catch up after a pause", () => {
    const clock = new FixedStep();
    clock.advance(0);
    expect(clock.advance(1000 / 60)).toBe(1);
    expect(clock.advance(5000, false)).toBe(0);
    expect(clock.advance(60_000)).toBe(0);
    expect(clock.advance(60_000 + 1000 / 60)).toBe(1);
  });

  it("caps the catch-up after a long frozen frame", () => {
    const clock = new FixedStep(1000 / 60, 5);
    clock.advance(0);
    expect(clock.advance(3000)).toBe(5);
    expect(clock.advance(3000 + 1000 / 60)).toBe(1);
  });
});
