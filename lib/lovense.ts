/* ============================================================
   LOVENSE CONTROLLER — Game Mode Local API
   Porté depuis le V1 (index.html) en TypeScript, partagé par tous les jeux.

   POST {base}/command
   GetToys : { command:"GetToys" }
   Vibrate : { command:"Function", action:"Vibrate:N" (0-20), timeSec, toy:"<id>", apiVer:1 }
   Stop    : { command:"Function", action:"Stop", timeSec:0, toy:"", apiVer:1 }

   Garanties du transport :
   - une seule commande de niveau en vol à la fois, la plus récente gagne
     (un Vibrate ne peut plus arriver après un Stop à cause du réseau) ;
   - aucune vibration de durée infinie : chaque Vibrate porte un timeSec fini,
     rafraîchi tant que le niveau est maintenu. Si l'onglet plante ou perd le
     réseau, l'appareil s'arrête seul au bout de HOLD_SEC ;
   - chaque requête a un délai maximal.

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
  supportsVibrate: boolean;
}

export type ConnectFailure = "invalid-ip" | "mixed-content" | "timeout" | "unreachable" | "refused";

export interface ConnectResult {
  ok: boolean;
  reason?: ConnectFailure;
  names?: string;
  toys?: ToyInfo[];
  raw?: unknown;
}

/** Durée de vie d'une commande Vibrate côté appareil (homme-mort). */
export const HOLD_SEC = 4;
/** Rafraîchissement d'un niveau maintenu, avant l'expiration de HOLD_SEC. */
export const KEEPALIVE_MS = 2500;
const REQUEST_TIMEOUT_MS = 4000;

/** IPv4 stricte : la valeur est interpolée dans une URL, rien d'autre ne doit passer. */
export function parseIPv4(value: string): string | null {
  const parts = value.trim().split(".");
  if (parts.length !== 4) return null;
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part) || Number(part) > 255) return null;
  }
  return parts.map(Number).join(".");
}

class LovenseController {
  private connected = false;
  private base = "";
  private scheduledTimers = new Set<ReturnType<typeof setTimeout>>();
  private baseline = 0; // fond warm-up (pct 0-100)
  private scale = 1; // intensité max (0..1)
  private warmup = false;
  private mock = true; // true tant qu'aucun toy réel n'est connecté
  private toys: ToyInfo[] = [];
  private active = new Set<string>(); // ids des toys qui reçoivent les commandes
  private listeners = new Set<VibeListener>();

  /* ---- file d'envoi « le plus récent gagne » ---- */
  private desiredLevel = 0; // niveau 0-20 voulu sur l'appareil
  private sentLevel = 0; // dernier niveau envoyé
  private resend = false; // forcer un renvoi (nouvelle cible, keep-alive)
  private inFlight: Promise<void> | null = null;
  private keepAlive: ReturnType<typeof setTimeout> | null = null;

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
    const dashed = ip.replace(/\./g, "-"); // IP en tirets → cert lovense.club valide
    return `https://${dashed}.lovense.club:30010`;
  }

  private async post(body: Record<string, unknown>) {
    const res = await fetch(`${this.base}/command`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-platform": "Lovense Arcade" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!res.ok) throw new Error(`Lovense Remote a répondu HTTP ${res.status}`);
    return res.json();
  }

  async connect(ip: string, transport: Transport): Promise<ConnectResult> {
    const host = parseIPv4(ip);
    if (!host) {
      this.connected = false;
      return { ok: false, reason: "invalid-ip" };
    }
    // Une page servie en HTTPS ne peut pas appeler une API HTTP : le navigateur bloque.
    if (transport === "http" && typeof location !== "undefined" && location.protocol === "https:") {
      this.connected = false;
      return { ok: false, reason: "mixed-content" };
    }
    this.base = this.buildBase(host, transport);
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
            supportsVibrate: Array.isArray(t.fullFunctionNames) && t.fullFunctionNames.includes("Vibrate"),
          }));
        } catch {
          /* noop */
        }
        // La découverte ne vaut jamais consentement : sélection explicite requise.
        this.active.clear();
        const names = this.toys.map((t) => t.nickName || t.name).join(" + ");
        return { ok: true, names, toys: this.toys };
      }
      this.connected = false;
      return { ok: false, reason: "refused", raw: data };
    } catch (err) {
      this.connected = false;
      const timedOut = err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError");
      return { ok: false, reason: timedOut ? "timeout" : "unreachable", raw: err };
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
      if (!this.toys.some((toy) => toy.id === id && toy.supportsVibrate)) return;
      this.active.add(id);
      this.resend = true; // la nouvelle cible doit recevoir le niveau courant
      if (this.scheduledTimers.size === 0) this.toBaseline();
      else this.flush();
    } else {
      this.active.delete(id);
      if (!this.mock && this.connected) {
        this.post({ command: "Function", action: "Stop", timeSec: 0, toy: id, apiVer: 1 }).catch(() => {});
      }
    }
  }

  /** Cibles des commandes ordinaires : uniquement les ids activés explicitement. */
  private targets(): string[] {
    return this.toys.filter((t) => t.supportsVibrate && this.active.has(t.id)).map((t) => t.id);
  }

  private async sendLevel(lv: number) {
    const tg = this.targets();
    if (tg.length === 0) return; // aucun toy actif → rien à envoyer
    const command =
      lv <= 0
        ? { command: "Function", action: "Stop", timeSec: 0, apiVer: 1 }
        : { command: "Function", action: `Vibrate:${lv}`, timeSec: HOLD_SEC, apiVer: 1 };
    await Promise.all(tg.map((toy) => this.post({ ...command, toy })));
  }

  private clearKeepAlive() {
    if (this.keepAlive !== null) clearTimeout(this.keepAlive);
    this.keepAlive = null;
  }

  /** Vide la file : une commande à la fois, en sautant directement au dernier niveau voulu. */
  private flush() {
    if (this.inFlight || this.mock || !this.connected) return;
    if (this.desiredLevel === this.sentLevel && !this.resend) return;
    this.inFlight = this.drain().finally(() => {
      this.inFlight = null;
      // Un ordre arrivé entre la fin de la boucle et ce point ne doit pas rester en attente.
      this.flush();
    });
  }

  private async drain() {
    while (!this.mock && this.connected && (this.desiredLevel !== this.sentLevel || this.resend)) {
      const lv = this.desiredLevel;
      this.resend = false;
      this.clearKeepAlive();
      try {
        await this.sendLevel(lv);
      } catch {
        /* Réseau instable → on ignore : la prochaine impulsion corrigera, et le
           timeSec fini empêche l'appareil de rester bloqué en vibration. */
      }
      this.sentLevel = lv;
      if (lv > 0 && this.desiredLevel === lv && !this.resend) {
        this.keepAlive = setTimeout(() => {
          this.keepAlive = null;
          this.resend = true;
          this.flush();
        }, KEEPALIVE_MS);
      }
    }
  }

  /** Bascule volontairement en mode démo (sans matériel). */
  useMock() {
    this.mock = true;
    this.connected = false;
    this.clearKeepAlive();
    this.desiredLevel = 0;
    this.sentLevel = 0;
  }

  private level(pct: number) {
    return Math.max(0, Math.min(20, Math.round(pct / 5))); // 0-100% → 0-20
  }

  /** Niveau demandé, intensité max appliquée. L'envoi réseau passe par la file. */
  private raw(pct: number) {
    const scaled = pct * this.scale;
    this.emit(scaled);
    if (this.mock) {
      if (scaled > 0) console.debug(`[Lovense mock] Vibrate ${Math.round(scaled)}%`);
      return;
    }
    if (!this.connected) return;
    this.desiredLevel = this.level(scaled);
    this.flush();
  }

  private toBaseline() {
    this.raw(this.baseline);
  }

  /** Toute séquence différée doit passer ici afin qu'un STOP puisse l'annuler. */
  private schedule(callback: () => void, delayMs: number) {
    const timer = setTimeout(() => {
      this.scheduledTimers.delete(timer);
      callback();
    }, delayMs);
    this.scheduledTimers.add(timer);
    return timer;
  }

  private cancelScheduled() {
    this.scheduledTimers.forEach((timer) => clearTimeout(timer));
    this.scheduledTimers.clear();
  }

  /** Pilotage continu (0-100 %) sans retombée automatique — utilisé par les
      moteurs haptiques qui recalculent le niveau à chaque tick (Descente, Scanline). */
  setContinuous(pct: number) {
    this.cancelScheduled();
    this.raw(pct);
  }

  /** Impulsion : vibre à pct pendant durMs puis retombe sur le fond warm-up. */
  pulse(pct: number, durMs: number) {
    this.cancelScheduled();
    this.raw(pct);
    this.schedule(() => this.toBaseline(), durMs);
  }

  /** Séquence d'impulsions [pct, durée ms] puis retour au fond. Contrairement à
      des setTimeout posés par un jeu, un STOP ou une pause l'annule entièrement. */
  sequence(steps: ReadonlyArray<readonly [number, number]>) {
    this.cancelScheduled();
    let t = 0;
    for (const [pct, durMs] of steps.slice(0, 50)) {
      if (t === 0) this.raw(pct);
      else this.schedule(() => this.raw(pct), t);
      t += Math.max(1, durMs);
    }
    this.schedule(() => this.toBaseline(), t);
  }

  /** Motif borné pour les jeux à événements. Il réutilise l'adresse, les toys
      actifs et le plafond d'intensité déjà configurés dans le Hub. */
  async playPattern(strengths: number[], intervalMs = 200) {
    if (this.mock || !this.connected) throw new Error("Lovense Remote n'est pas connecté dans le Hub.");
    const strength = strengths
      .slice(0, 50)
      .map((value) => Math.max(0, Math.min(20, Math.round(value * this.scale))))
      .join(";");
    const responses = await Promise.all(this.targets().map((toy) => this.post({
      command: "Pattern",
      rule: `V:1;F:v;S:${Math.max(101, intervalMs)}#`,
      strength,
      timeSec: 2,
      toy,
      apiVer: 2,
    })));
    const failed = responses.find((response: { code?: number; message?: string }) => response?.code !== 200);
    if (failed) throw new Error(failed.message || `Lovense Remote a refusé le motif (${failed.code ?? "inconnu"})`);
  }

  /** Climax : montée en pulsations jusqu'à 100% (gros événement gameplay). */
  climax() {
    this.sequence([
      [100, 260],
      [60, 110],
      [100, 300],
      [70, 120],
      [100, 420],
    ]);
  }

  /** Silence temporaire (pause / game over) — garde la config. */
  mute() {
    this.cancelScheduled();
    this.desiredLevel = 0;
    this.flush();
    this.emit(0);
  }
  unmute() {
    this.toBaseline();
  }

  /** STOP d'urgence — coupe tout + désarme le warm-up. */
  async stop() {
    this.cancelScheduled();
    this.baseline = 0;
    this.warmup = false;
    this.clearKeepAlive();
    this.desiredLevel = 0;
    this.sentLevel = 0;
    this.resend = false;
    this.emit(0);
    if (this.mock || !this.connected) return;
    const stopAll = () =>
      this.post({ command: "Function", action: "Stop", timeSec: 0, toy: "", apiVer: 1 }).catch(() => {});
    // Le Stop part tout de suite, sans attendre la file.
    const pending = this.inFlight;
    await stopAll();
    // Une commande déjà en vol a pu atterrir après ce Stop : on recoupe derrière elle.
    if (pending) {
      await pending;
      await stopAll();
    }
  }

  /* ---- calibrage global ---- */
  setScale(pct: number) {
    this.scale = Math.max(0, Math.min(1, pct / 100));
    if (this.scheduledTimers.size === 0) this.toBaseline();
  }
  setWarmup(on: boolean) {
    this.warmup = on;
  }
  /** Recalcule le fond selon le niveau : 5% puis +3%/niveau, plafond 45%. */
  updateWarmup(lvl: number) {
    this.baseline = this.warmup ? Math.min(45, 5 + (lvl - 1) * 3) : 0;
    if (this.scheduledTimers.size === 0) this.toBaseline();
  }

  /** Test manuel depuis les réglages. */
  test() {
    this.pulse(40, 700);
  }
}

// Singleton partagé par le HUB et tous les jeux.
export const Lovense = new LovenseController();
