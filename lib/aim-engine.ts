/* ============================================================
   AIM TRAINER ENGINE — cibles positionnées en % (pas de canvas).
   Mapping vibration (prompt/jeu3.md) :
     hit        → 0.2s (10-20%)
     combo x10  → vibration continue légère
     combo x25  → vibration forte pulsée
     miss       → baisse légère intensité
   ============================================================ */
import { Lovense } from "./lovense";
import { saveBestScore } from "./settings";
import type { Overlay } from "./engine-types";

const DURATION_MS = 60_000;
const BASE_LIFESPAN = 950; // durée d'affichage d'une cible (ms), rétrécit un peu avec le combo
const MIN_LIFESPAN = 500;
const MARGIN = 9; // % de marge pour que la cible reste entièrement visible

export interface Stats { score: number; combo: number; timeLeft: number; misses: number }
export interface Target { x: number; y: number; key: number }

export interface EngineHooks {
  onStats: (s: Stats) => void;
  onTarget: (t: Target | null) => void;
  onOverlay: (o: Overlay) => void;
}

export class AimEngine {
  private score = 0;
  private combo = 0;
  private misses = 0;
  private timeLeft = DURATION_MS;
  private target: Target | null = null;
  private targetSeq = 0;

  private countdownTimer: ReturnType<typeof setInterval> | null = null;
  private expiryTimer: ReturnType<typeof setTimeout> | null = null;
  private running = false;
  private paused = false;
  private over = false;

  constructor(private hooks: EngineHooks) {}

  private canPlay() {
    return this.running && !this.paused && !this.over;
  }

  private lifespan() {
    return Math.max(MIN_LIFESPAN, BASE_LIFESPAN - this.combo * 12);
  }

  private spawnTarget() {
    if (!this.canPlay()) return;
    this.targetSeq++;
    this.target = {
      x: MARGIN + Math.random() * (100 - MARGIN * 2),
      y: MARGIN + Math.random() * (100 - MARGIN * 2),
      key: this.targetSeq,
    };
    this.hooks.onTarget(this.target);
    if (this.expiryTimer) clearTimeout(this.expiryTimer);
    this.expiryTimer = setTimeout(() => this.onMiss(), this.lifespan());
  }

  /** Appelé quand le joueur clique précisément sur la cible affichée. */
  hitTarget(key: number) {
    if (!this.canPlay() || !this.target || this.target.key !== key) return;
    if (this.expiryTimer) clearTimeout(this.expiryTimer);
    this.score++;
    this.combo++;
    this.refresh();

    if (this.combo >= 25) Lovense.pulse(70, 500); // combo x25 → forte pulsée
    else if (this.combo >= 10) Lovense.pulse(30, 400); // combo x10 → continue légère
    else Lovense.pulse(10 + Math.random() * 10, 200); // hit normal → 0.2s, 10-20%

    this.spawnTarget();
  }

  /** Appelé sur un clic à côté de la cible (raté volontaire). */
  missClick() {
    if (!this.canPlay()) return;
    this.onMiss();
  }

  private onMiss() {
    if (!this.canPlay()) return;
    this.combo = 0;
    this.misses++;
    this.refresh();
    Lovense.pulse(5, 150); // baisse légère
    this.spawnTarget();
  }

  private refresh() {
    this.hooks.onStats({ score: this.score, combo: this.combo, timeLeft: this.timeLeft, misses: this.misses });
  }

  /* ---------- flow ---------- */
  start() {
    this.score = 0;
    this.combo = 0;
    this.misses = 0;
    this.timeLeft = DURATION_MS;
    this.over = false;
    this.paused = false;
    this.running = true;
    this.hooks.onOverlay({ show: false, title: "", sub: "", btn: "" });
    this.refresh();
    if (this.countdownTimer) clearInterval(this.countdownTimer);
    this.countdownTimer = setInterval(() => {
      if (!this.canPlay()) return;
      this.timeLeft = Math.max(0, this.timeLeft - 1000);
      this.refresh();
      if (this.timeLeft <= 0) this.finish();
    }, 1000);
    this.spawnTarget();
  }
  private finish() {
    this.over = true;
    this.running = false;
    if (this.countdownTimer) clearInterval(this.countdownTimer);
    if (this.expiryTimer) clearTimeout(this.expiryTimer);
    this.target = null;
    this.hooks.onTarget(null);
    Lovense.mute();
    const best = saveBestScore("aim", this.score);
    this.hooks.onOverlay({
      show: true,
      title: "TEMPS ÉCOULÉ",
      sub: `Hits : ${this.score} · Ratés : ${this.misses}${best > this.score ? ` · Record : ${best}` : " · Nouveau record !"}`,
      btn: "↻ Rejouer",
    });
  }
  togglePause() {
    if (!this.running || this.over) return;
    this.paused = !this.paused;
    if (this.paused) {
      if (this.expiryTimer) clearTimeout(this.expiryTimer);
      Lovense.mute();
      this.hooks.onOverlay({ show: true, title: "PAUSE", sub: "Reprends quand tu veux.", btn: "▶ Reprendre" });
    } else {
      this.hooks.onOverlay({ show: false, title: "", sub: "", btn: "" });
      Lovense.unmute();
      this.spawnTarget();
    }
  }
  isPaused() { return this.paused; }
  isRunning() { return this.running && !this.over; }

  destroy() {
    if (this.countdownTimer) clearInterval(this.countdownTimer);
    if (this.expiryTimer) clearTimeout(this.expiryTimer);
    Lovense.mute();
  }
}
