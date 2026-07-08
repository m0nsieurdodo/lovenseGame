/* ============================================================
   LOVENSE CONTROLLER — Game Mode Local API
   Porté depuis le V1 (index.html) en TypeScript, partagé par tous les jeux.

   POST {base}/command
   GetToys : { command:"GetToys" }
   Vibrate : { command:"Function", action:"Vibrate:N" (0-20), timeSec, toy:"", apiVer:1 }
   Stop    : { command:"Function", action:"Stop", timeSec:0, toy:"", apiVer:1 }

   Quand aucun toy n'est connecté, le contrôleur bascule en mock
   (log console + événements visuels) pour développer/tester sans matériel.
   ============================================================ */

export type Transport = "https" | "http";
export type VibeListener = (pct: number) => void;

export interface ToyInfo {
  id: string;
  name: string; // ex. "solace", "gemini"
  nickName?: string;
  battery?: number;
}

export interface ConnectResult {
  ok: boolean;
  names?: string;
  toys?: ToyInfo[];
  raw?: unknown;
}

class LovenseController {
  private connected = false;
  private base = "";
  private stopTimer: ReturnType<typeof setTimeout> | null = null;
  private baseline = 0; // fond warm-up (pct 0-100)
  private scale = 1; // intensité max (0..1)
  private warmup = false;
  private mock = true; // true tant qu'aucun toy réel n'est connecté
  private toys: ToyInfo[] = [];
  private active = new Set<string>(); // ids des toys qui reçoivent les commandes
  private listeners = new Set<VibeListener>();

  /* ---- abonnement UI (barre de vibration, feedback visuel) ---- */
  onVibe(fn: VibeListener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
  private emit(pct: number) {
    this.listeners.forEach((fn) => fn(Math.max(0, Math.min(100, pct))));
  }

  isConnected() {
    return this.connected;
  }
  isMock() {
    return this.mock;
  }

  private buildBase(ip: string, transport: Transport) {
    if (transport === "http") return `http://${ip}:20010`;
    const dashed = ip.trim().replace(/\./g, "-"); // IP en tirets → cert lovense.club valide
    return `https://${dashed}.lovense.club:30010`;
  }

  private async post(body: Record<string, unknown>) {
    const res = await fetch(`${this.base}/command`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return res.json();
  }

  async connect(ip: string, transport: Transport): Promise<ConnectResult> {
    this.base = this.buildBase(ip, transport);
    try {
      const data = await this.post({ command: "GetToys" });
      if (data && data.code === 200) {
        this.connected = true;
        this.mock = false;
        this.toys = [];
        try {
          const parsed = JSON.parse(data.data.toys);
          this.toys = Object.entries(parsed).map(([id, t]: [string, any]) => ({
            id: t.id || id,
            name: t.name || id,
            nickName: t.nickName || undefined,
            battery: typeof t.battery === "number" ? t.battery : undefined,
          }));
        } catch {
          /* noop */
        }
        // Par défaut, tous les toys détectés reçoivent les commandes.
        this.active = new Set(this.toys.map((t) => t.id));
        const names = this.toys.map((t) => t.nickName || t.name).join(" + ");
        return { ok: true, names, toys: this.toys };
      }
      this.connected = false;
      return { ok: false, raw: data };
    } catch (err) {
      this.connected = false;
      return { ok: false, raw: err };
    }
  }

  getToys(): ToyInfo[] {
    return this.toys;
  }
  isToyActive(id: string) {
    return this.active.has(id);
  }
  /** Active/désactive un toy ; un toy désactivé est immédiatement stoppé. */
  setToyActive(id: string, on: boolean) {
    if (on) {
      this.active.add(id);
      if (!this.stopTimer) this.toBaseline();
    } else {
      this.active.delete(id);
      if (!this.mock && this.connected) {
        this.post({ command: "Function", action: "Stop", timeSec: 0, toy: id, apiVer: 1 }).catch(() => {});
      }
    }
  }

  /** Cibles des commandes : [""] = broadcast (tous), sinon un envoi par toy actif. */
  private targets(): string[] {
    if (this.toys.length === 0 || this.active.size === this.toys.length) return [""];
    return this.toys.filter((t) => this.active.has(t.id)).map((t) => t.id);
  }

  private async sendFunction(action: string) {
    const tg = this.targets();
    if (tg.length === 0) return; // aucun toy actif → rien à envoyer
    await Promise.all(
      tg.map((toy) => this.post({ command: "Function", action, timeSec: 0, toy, apiVer: 1 })),
    );
  }

  /** Bascule volontairement en mode démo (sans matériel). */
  useMock() {
    this.mock = true;
    this.connected = false;
  }

  private level(pct: number) {
    return Math.max(0, Math.min(20, Math.round(pct / 5))); // 0-100% → 0-20
  }

  /** Envoi direct, intensité max appliquée. */
  private async raw(pct: number) {
    const scaled = pct * this.scale;
    this.emit(scaled);
    if (this.mock) {
      if (scaled > 0) console.debug(`[Lovense mock] Vibrate ${Math.round(scaled)}%`);
      return;
    }
    if (!this.connected) return;
    const lv = this.level(scaled);
    try {
      if (lv <= 0) await this.sendFunction("Stop");
      else await this.sendFunction(`Vibrate:${lv}`);
    } catch {
      /* réseau instable → on ignore, la prochaine impulsion corrigera */
    }
  }

  private toBaseline() {
    this.raw(this.baseline);
  }

  /** Pilotage continu (0-100 %) sans retombée automatique — utilisé par les
      moteurs haptiques qui recalculent le niveau à chaque tick (Descente, Scanline). */
  setContinuous(pct: number) {
    if (this.stopTimer) {
      clearTimeout(this.stopTimer);
      this.stopTimer = null;
    }
    this.raw(pct);
  }

  /** Impulsion : vibre à pct pendant durMs puis retombe sur le fond warm-up. */
  pulse(pct: number, durMs: number) {
    if (this.stopTimer) {
      clearTimeout(this.stopTimer);
      this.stopTimer = null;
    }
    this.raw(pct);
    this.stopTimer = setTimeout(() => {
      this.toBaseline();
      this.stopTimer = null;
    }, durMs);
  }

  /** Climax : montée en pulsations jusqu'à 100% (gros événement gameplay). */
  climax() {
    if (this.stopTimer) {
      clearTimeout(this.stopTimer);
      this.stopTimer = null;
    }
    const seq: [number, number][] = [
      [100, 260],
      [60, 110],
      [100, 300],
      [70, 120],
      [100, 420],
    ];
    let t = 0;
    seq.forEach(([p, d]) => {
      setTimeout(() => this.raw(p), t);
      t += d;
    });
    this.stopTimer = setTimeout(() => {
      this.toBaseline();
      this.stopTimer = null;
    }, t);
  }

  /** Silence temporaire (pause / game over) — garde la config. */
  mute() {
    if (this.stopTimer) {
      clearTimeout(this.stopTimer);
      this.stopTimer = null;
    }
    if (!this.mock && this.connected) {
      this.sendFunction("Stop").catch(() => {});
    }
    this.emit(0);
  }
  unmute() {
    this.toBaseline();
  }

  /** STOP d'urgence — coupe tout + désarme le warm-up. */
  async stop() {
    if (this.stopTimer) {
      clearTimeout(this.stopTimer);
      this.stopTimer = null;
    }
    this.baseline = 0;
    this.warmup = false;
    if (!this.mock && this.connected) {
      try {
        await this.post({ command: "Function", action: "Stop", timeSec: 0, toy: "", apiVer: 1 });
      } catch {
        /* noop */
      }
    }
    this.emit(0);
  }

  /* ---- calibrage global ---- */
  setScale(pct: number) {
    this.scale = Math.max(0, Math.min(1, pct / 100));
    if (!this.stopTimer) this.toBaseline();
  }
  setWarmup(on: boolean) {
    this.warmup = on;
  }
  /** Recalcule le fond selon le niveau : 5% puis +3%/niveau, plafond 45%. */
  updateWarmup(lvl: number) {
    this.baseline = this.warmup ? Math.min(45, 5 + (lvl - 1) * 3) : 0;
    if (!this.stopTimer) this.toBaseline();
  }

  /** Test manuel depuis les réglages. */
  test() {
    this.pulse(40, 700);
  }
}

// Singleton partagé par le HUB et tous les jeux.
export const Lovense = new LovenseController();
