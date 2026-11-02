import { afterEach, describe, expect, it, vi } from "vitest";
import { Lovense } from "./lovense";

afterEach(async () => {
  await Lovense.stop();
  vi.useRealTimers();
});

describe("LovenseController discovery and targeting", () => {
  const discovery = {
    code: 200,
    data: {
      toys: JSON.stringify({
        lush: { id: "lush", name: "Lush", fullFunctionNames: ["Vibrate", "Preset"] },
        nora: { id: "nora", name: "Nora", fullFunctionNames: ["Rotate"] },
      }),
    },
  };

  function mockFetch() {
    const fetchMock = vi.fn().mockResolvedValue({ json: vi.fn().mockResolvedValue(discovery) });
    vi.stubGlobal("fetch", fetchMock);
    return fetchMock;
  }

  it("parses Vibrate capability and leaves every discovered toy inactive", async () => {
    mockFetch();

    const result = await Lovense.connect("127.0.0.1", "http");

    expect(result.toys).toMatchObject([
      { id: "lush", name: "Lush", supportsVibrate: true },
      { id: "nora", name: "Nora", supportsVibrate: false },
    ]);
    expect(Lovense.isToyActive("lush")).toBe(false);
    expect(Lovense.isToyActive("nora")).toBe(false);
  });

  it("refuses activation for a toy without Vibrate support", async () => {
    mockFetch();
    await Lovense.connect("127.0.0.1", "http");

    Lovense.setToyActive("nora", true);

    expect(Lovense.isToyActive("nora")).toBe(false);
  });

  it("sends commands only to explicitly activated compatible toy ids", async () => {
    const fetchMock = mockFetch();
    await Lovense.connect("127.0.0.1", "http");
    fetchMock.mockClear();

    Lovense.setContinuous(50);
    await Promise.resolve();
    expect(fetchMock).not.toHaveBeenCalled();

    Lovense.setToyActive("lush", true);
    await Promise.resolve();
    fetchMock.mockClear();
    Lovense.setContinuous(50);
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(body).toMatchObject({ command: "Function", action: "Vibrate:10", toy: "lush" });
    expect(body.toy).not.toBe("");
  });
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
