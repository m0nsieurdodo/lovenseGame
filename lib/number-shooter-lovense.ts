export interface CommandTransport {
  post(body: Record<string, unknown>): Promise<unknown>;
}

export interface GameModeToy {
  id: string;
  name: string;
  nickName?: string;
  battery?: number;
  supportsVibrate: boolean;
}

export class FetchCommandTransport implements CommandTransport {
  constructor(private readonly baseUrl: string) {}

  async post(body: Record<string, unknown>): Promise<unknown> {
    const response = await fetch(`${this.baseUrl.replace(/\/$/, "")}/command`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-platform": "Lovense Arcade Number Shooter" },
      body: JSON.stringify(body),
    });
    if (!response.ok) throw new Error(`Lovense Remote a répondu HTTP ${response.status}`);
    return response.json();
  }
}

export class GameModeClient {
  constructor(private readonly transport: CommandTransport) {}

  async getToys(): Promise<GameModeToy[]> {
    const response = (await this.transport.post({ command: "GetToys" })) as {
      code?: number;
      data?: { toys?: string };
    };
    if (response.code !== 200 || !response.data?.toys) throw new Error("Lovense Remote n'a retourné aucun jouet");
    const toys = JSON.parse(response.data.toys) as Record<string, {
      id?: string; name?: string; nickName?: string; battery?: number; fullFunctionNames?: string[];
    }>;
    return Object.entries(toys).map(([id, toy]) => ({
      id: toy.id ?? id,
      name: toy.name ?? id,
      nickName: toy.nickName || undefined,
      battery: toy.battery,
      supportsVibrate: toy.fullFunctionNames?.includes("Vibrate") ?? false,
    }));
  }

  async sendPattern(toyId: string, strengths: number[], intervalMs = 200): Promise<void> {
    const response = (await this.transport.post({
      command: "Pattern",
      rule: `V:1;F:v;S:${Math.max(101, intervalMs)}#`,
      strength: strengths.map((strength) => Math.max(0, Math.min(20, Math.round(strength)))).join(";"),
      // Standard API requires a finite duration greater than 1 second.
      timeSec: 2,
      toy: toyId,
      apiVer: 2,
    })) as { code?: number; message?: string };
    if (response.code !== undefined && response.code !== 200) throw new Error(response.message || `Lovense Remote a refusé le motif (${response.code})`);
  }

  async stop(toyId?: string): Promise<void> {
    await this.transport.post({ command: "Function", action: "Stop", timeSec: 0, ...(toyId ? { toy: toyId } : {}), apiVer: 1 });
  }
}

export interface HapticConfiguration {
  toyId?: string;
  maxIntensity: number;
  restMs: number;
  enabledEvents: Record<"low" | "medium" | "high" | "reward", boolean>;
}

const DEFAULT_CONFIGURATION: HapticConfiguration = {
  maxIntensity: 12,
  restMs: 650,
  enabledEvents: { low: true, medium: true, high: true, reward: true },
};

export class NumberShooterHaptics {
  private configuration = DEFAULT_CONFIGURATION;
  private stopped = false;
  private busy = false;
  private pending?: { priority: number; strengths: number[]; resolve: () => void };

  constructor(private readonly client: GameModeClient, private readonly onError?: (message: string) => void) {}

  configure(configuration: HapticConfiguration) {
    this.configuration = {
      ...configuration,
      maxIntensity: Math.max(0, Math.min(20, configuration.maxIntensity)),
      restMs: Math.max(0, configuration.restMs),
    };
  }

  rearm() {
    this.stopped = false;
  }

  async emergencyStop(): Promise<void> {
    this.stopped = true;
    this.pending?.resolve();
    this.pending = undefined;
    await this.client.stop(this.configuration.toyId);
  }

  playMerge(value: number, combo: number): Promise<void> {
    const event = eventFor(value);
    if (this.stopped || !this.configuration.toyId || !this.configuration.enabledEvents[event.group]) return Promise.resolve();
    const strengths = buildPattern(event.kind, Math.min(this.configuration.maxIntensity, event.intensity + (combo >= 3 ? 2 : 0)));
    return new Promise((resolve) => this.enqueue({ priority: value, strengths, resolve }));
  }

  private enqueue(task: { priority: number; strengths: number[]; resolve: () => void }) {
    if (!this.busy) {
      this.busy = true;
      void this.run(task);
      return;
    }
    // A stronger merge replaces only an effect not yet sent to the toy.
    if (!this.pending || task.priority > this.pending.priority) {
      this.pending?.resolve();
      this.pending = task;
    } else {
      task.resolve();
    }
  }

  private async run(task: { priority: number; strengths: number[]; resolve: () => void }) {
    try {
      if (!this.stopped && this.configuration.toyId) {
        await this.client.sendPattern(this.configuration.toyId, task.strengths);
        await delay(2000 + this.configuration.restMs);
      }
    } catch (error) {
      this.onError?.(error instanceof Error ? error.message : "La commande Lovense a échoué.");
    } finally {
      task.resolve();
      const next = this.stopped ? undefined : this.pending;
      this.pending = undefined;
      if (next) void this.run(next);
      else this.busy = false;
    }
  }
}

function eventFor(value: number) {
  if (value <= 8) return { group: "low" as const, intensity: 4, kind: "pulse" as const };
  if (value <= 32) return { group: "medium" as const, intensity: 7, kind: "double" as const };
  if (value <= 128) return { group: "high" as const, intensity: 10, kind: "rise" as const };
  if (value <= 512) return { group: "high" as const, intensity: 13, kind: "surge" as const };
  return { group: "reward" as const, intensity: 16, kind: "reward" as const };
}

function buildPattern(kind: "pulse" | "double" | "rise" | "surge" | "reward", intensity: number): number[] {
  const half = Math.round(intensity / 2);
  if (kind === "pulse") return [intensity, 0];
  if (kind === "double") return [intensity, 0, intensity, 0];
  if (kind === "rise") return [half, intensity, half, 0];
  if (kind === "surge") return [half, intensity, intensity, 0, intensity, 0];
  return [half, intensity, 0, intensity, 0, intensity, 0];
}

function delay(milliseconds: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, milliseconds));
}
