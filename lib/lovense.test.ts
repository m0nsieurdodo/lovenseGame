import { afterEach, describe, expect, it, vi } from "vitest";
import { HOLD_SEC, KEEPALIVE_MS, Lovense, parseIPv4 } from "./lovense";

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
  const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: vi.fn().mockResolvedValue(discovery) });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function sentBodies(fetchMock: ReturnType<typeof vi.fn>) {
  return fetchMock.mock.calls.map((call) => JSON.parse(call[1].body as string));
}

afterEach(async () => {
  await Lovense.stop();
  Lovense.useMock();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("parseIPv4", () => {
  it("accepts a plain IPv4 address and trims it", () => {
    expect(parseIPv4(" 192.168.1.20 ")).toBe("192.168.1.20");
  });

  it("rejects anything that could alter the request URL", () => {
    expect(parseIPv4("")).toBeNull();
    expect(parseIPv4("192.168.1")).toBeNull();
    expect(parseIPv4("192.168.1.256")).toBeNull();
    expect(parseIPv4("evil.example.com")).toBeNull();
    expect(parseIPv4("192.168.1.20/x?")).toBeNull();
    expect(parseIPv4("192.168.1.20:80@evil.test")).toBeNull();
  });
});

describe("LovenseController discovery and targeting", () => {
  it("does not send any request for an invalid address", async () => {
    const fetchMock = mockFetch();

    const result = await Lovense.connect("evil.example.com/", "https");

    expect(result).toMatchObject({ ok: false, reason: "invalid-ip" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("reports an HTTP error from Lovense Remote as a failed connection", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500, json: vi.fn() }));

    const result = await Lovense.connect("127.0.0.1", "http");

    expect(result).toMatchObject({ ok: false, reason: "unreachable" });
    expect(Lovense.isConnected()).toBe(false);
  });

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
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
    await Lovense.stop();
    fetchMock.mockClear();
    Lovense.setContinuous(50);
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    const body = sentBodies(fetchMock)[0];
    expect(body).toMatchObject({ command: "Function", action: "Vibrate:10", toy: "lush" });
    expect(body.toy).not.toBe("");
  });
});

describe("LovenseController transport safety", () => {
  async function connectWithActiveToy() {
    const fetchMock = mockFetch();
    await Lovense.connect("127.0.0.1", "http");
    Lovense.setToyActive("lush", true);
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
    await Lovense.stop();
    fetchMock.mockClear();
    return fetchMock;
  }

  it("never sends a vibration without a finite duration", async () => {
    const fetchMock = await connectWithActiveToy();

    Lovense.setContinuous(100);
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    expect(sentBodies(fetchMock)[0]).toMatchObject({ action: "Vibrate:20", timeSec: HOLD_SEC });
    expect(HOLD_SEC * 1000).toBeGreaterThan(KEEPALIVE_MS);
  });

  it("refreshes a held level before the device-side timeout, then stops refreshing once muted", async () => {
    const fetchMock = await connectWithActiveToy();
    vi.useFakeTimers();

    Lovense.setContinuous(50);
    await vi.advanceTimersByTimeAsync(KEEPALIVE_MS + 10);
    expect(sentBodies(fetchMock).map((body) => body.action)).toEqual(["Vibrate:10", "Vibrate:10"]);

    Lovense.mute();
    await vi.advanceTimersByTimeAsync(KEEPALIVE_MS * 3);
    expect(sentBodies(fetchMock).map((body) => body.action)).toEqual(["Vibrate:10", "Vibrate:10", "Stop"]);
  });

  it("keeps one command in flight and skips straight to the latest level", async () => {
    const fetchMock = await connectWithActiveToy();
    const release: Array<() => void> = [];
    fetchMock.mockImplementation(() => new Promise((resolve) => {
      release.push(() => resolve({ ok: true, json: async () => ({ code: 200 }) }));
    }));

    Lovense.setContinuous(25);
    Lovense.setContinuous(50);
    Lovense.setContinuous(75);
    Lovense.mute();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    release[0]();
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    release[1]();
    fetchMock.mockImplementation(async () => ({ ok: true, json: async () => ({ code: 200 }) }));

    // Les niveaux intermédiaires ne partent jamais ; le dernier ordre reçu est le Stop.
    expect(sentBodies(fetchMock).map((body) => body.action)).toEqual(["Vibrate:5", "Stop"]);
  });

  it("re-sends Stop after a command that was already in flight when the emergency stop fired", async () => {
    const fetchMock = await connectWithActiveToy();
    let releaseVibrate = () => {};
    fetchMock.mockImplementationOnce(() => new Promise((resolve) => {
      releaseVibrate = () => resolve({ ok: true, json: async () => ({ code: 200 }) });
    }));

    Lovense.setContinuous(100);
    const stopped = Lovense.stop();
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    releaseVibrate();
    await stopped;

    const actions = sentBodies(fetchMock).map((body) => body.action);
    expect(actions[0]).toBe("Vibrate:20");
    expect(actions.at(-1)).toBe("Stop");
    expect(actions.filter((action) => action === "Stop").length).toBeGreaterThanOrEqual(2);
  });
});

describe("LovenseController emergency stop", () => {
  it("cancels every queued climax pulse after an emergency stop", async () => {
    vi.useFakeTimers();
    const emitted: number[] = [];
    const unsubscribe = Lovense.onVibe((level) => emitted.push(level));

    Lovense.climax();
    await Lovense.stop();
    emitted.length = 0;
    await vi.runAllTimersAsync();

    unsubscribe();
    expect(emitted.filter((level) => level > 0)).toEqual([]);
  });

  it("cancels a game sequence, including its later steps", async () => {
    vi.useFakeTimers();
    const emitted: number[] = [];
    const unsubscribe = Lovense.onVibe((level) => emitted.push(level));

    Lovense.sequence([[30, 100], [60, 100], [90, 100]]);
    await vi.advanceTimersByTimeAsync(50);
    await Lovense.stop();
    emitted.length = 0;
    await vi.runAllTimersAsync();

    unsubscribe();
    expect(emitted.filter((level) => level > 0)).toEqual([]);
  });
});
