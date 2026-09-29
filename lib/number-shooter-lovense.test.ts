import { describe, expect, it } from "vitest";
import {
  GameModeClient,
  NumberShooterHaptics,
  type CommandTransport,
} from "./number-shooter-lovense";

class FakeTransport implements CommandTransport {
  calls: Record<string, unknown>[] = [];
  async post(body: Record<string, unknown>) {
    this.calls.push(body);
    if (body.command === "GetToys") {
      return {
        code: 200,
        data: {
          toys: JSON.stringify({
            lush: { id: "lush", name: "Lush", fullFunctionNames: ["Vibrate"] },
            nora: { id: "nora", name: "Nora", fullFunctionNames: ["Rotate"] },
          }),
        },
      };
    }
    return { code: 200 };
  }
}

describe("Number Shooter Lovense adapter", () => {
  it("discovers toys and only exposes Vibrate-capable ones", async () => {
    const transport = new FakeTransport();
    const client = new GameModeClient(transport);

    await expect(client.getToys()).resolves.toEqual([
      { id: "lush", name: "Lush", supportsVibrate: true },
      { id: "nora", name: "Nora", supportsVibrate: false },
    ]);
    expect(transport.calls[0]).toEqual({ command: "GetToys" });
  });

  it("uses a finite Vibrate pattern and addresses only the selected toy", async () => {
    const transport = new FakeTransport();
    const haptics = new NumberShooterHaptics(new GameModeClient(transport));
    haptics.configure({ toyId: "lush", maxIntensity: 12, restMs: 0, enabledEvents: { low: true, medium: true, high: true, reward: true } });

    await haptics.playMerge(64, 3);

    expect(transport.calls[0]).toMatchObject({
      command: "Pattern",
      rule: "V:1;F:v;S:200#",
      strength: "6;12;6;0",
      timeSec: 2,
      toy: "lush",
      apiVer: 2,
    });
  });

  it("reports a rejected Pattern command instead of silently treating it as a vibration", async () => {
    const transport: CommandTransport = { post: async () => ({ code: 400, message: "toy unreachable" }) };
    await expect(new GameModeClient(transport).sendPattern("lush", [4, 0])).rejects.toThrow("toy unreachable");
  });

  it("stops immediately and ignores all later effects until rearmed", async () => {
    const transport = new FakeTransport();
    const haptics = new NumberShooterHaptics(new GameModeClient(transport));
    haptics.configure({ toyId: "lush", maxIntensity: 12, restMs: 0, enabledEvents: { low: true, medium: true, high: true, reward: true } });

    await haptics.emergencyStop();
    await haptics.playMerge(1024, 0);
    expect(transport.calls).toEqual([{ command: "Function", action: "Stop", timeSec: 0, toy: "lush", apiVer: 1 }]);

    haptics.rearm();
    await haptics.playMerge(4, 0);
    expect(transport.calls).toHaveLength(2);
  });

  it("replaces a lower priority effect that is still waiting in the serial queue", async () => {
    const transport = new FakeTransport();
    const haptics = new NumberShooterHaptics(new GameModeClient(transport));
    haptics.configure({ toyId: "lush", maxIntensity: 12, restMs: 0, enabledEvents: { low: true, medium: true, high: true, reward: true } });

    await Promise.all([haptics.playMerge(4, 0), haptics.playMerge(16, 0), haptics.playMerge(1024, 0)]);

    expect(transport.calls.filter((call) => call.command === "Pattern")).toEqual([
      expect.objectContaining({ strength: "4;0" }),
      expect.objectContaining({ strength: "6;12;0;12;0;12;0" }),
    ]);
  });
});
