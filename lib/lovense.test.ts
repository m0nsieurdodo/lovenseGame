import { afterEach, describe, expect, it, vi } from "vitest";
import { Lovense } from "./lovense";

afterEach(async () => {
  await Lovense.stop();
  vi.useRealTimers();
});

describe("LovenseController emergency stop", () => {
  it("cancels every queued climax pulse after an emergency stop", async () => {
    vi.useFakeTimers();
    const emitted: number[] = [];
    const unsubscribe = Lovense.onVibe((level) => emitted.push(level));

    Lovense.climax();
    await Lovense.stop();
    await vi.runAllTimersAsync();

    unsubscribe();
    expect(emitted.filter((level) => level > 0)).toEqual([]);
  });
});
