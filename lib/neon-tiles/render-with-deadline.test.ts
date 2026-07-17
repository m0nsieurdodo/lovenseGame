import { afterEach, describe, expect, it, vi } from "vitest";
import { AudioRenderTimeoutError, renderWithin } from "./render-with-deadline";

afterEach(() => {
  vi.useRealTimers();
});

describe("Neon Tiles audio rendering deadline", () => {
  it("rejects instead of leaving the start button blocked when rendering never settles", async () => {
    vi.useFakeTimers();
    const render = new Promise<never>(() => {});
    const result = renderWithin(render, 8_000);

    const assertion = expect(result).rejects.toBeInstanceOf(AudioRenderTimeoutError);
    await vi.advanceTimersByTimeAsync(8_000);
    await assertion;
  });

  it("returns the rendered track when it completes before the deadline", async () => {
    await expect(renderWithin(Promise.resolve("track"), 8_000)).resolves.toBe("track");
  });
});
