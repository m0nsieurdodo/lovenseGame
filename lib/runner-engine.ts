/* ============================================================
   ENDLESS RUNNER ENGINE — canvas + requestAnimationFrame.
   Mapping vibration (prompt/jeu2.md) :
     0-500        → 10% (ambiance)
     500-2000     → 30%
     2000-5000    → 60%
     5000+        → 100%
     saut réussi  → 10%
     collision    → forte vibration puis stop
   ============================================================ */
import { Lovense } from "./lovense";
import { saveBestScore } from "./settings";
import type { Overlay } from "./engine-types";

export interface Stats { distance: number }

export interface EngineHooks {
  onStats: (s: Stats) => void;
  onOverlay: (o: Overlay) => void;
}

interface Obstacle { x: number; w: number; h: number; dodged: boolean }

function tierPct(distance: number) {
  if (distance < 500) return 10;
  if (distance < 2000) return 30;
  if (distance < 5000) return 60;
  return 100;
}

export class RunnerEngine {
  private ctx: CanvasRenderingContext2D;
  readonly W = 300;
  readonly H = 500;
  private readonly groundY = this.H - 90;

  private readonly playerX = 56;
  private readonly playerSize = 26;
  private playerY = 0;
  private velY = 0;
  private readonly gravity = 0.85;
  private readonly jumpVel = -13;
  private onGround = true;

  private obstacles: Obstacle[] = [];
  private nextSpawnAt = 0;
  private speed = 4;
  private distance = 0;

  private running = false;
  private paused = false;
  private over = false;
  private rafId: number | null = null;
  private lastAmbientAt = 0;

  constructor(private canvas: HTMLCanvasElement, private hooks: EngineHooks) {
    this.ctx = canvas.getContext("2d")!;
    this.playerY = this.groundY - this.playerSize;
    this.rafId = requestAnimationFrame(this.loop);
  }

  private canPlay() {
    return this.running && !this.paused && !this.over;
  }

  jump() {
    if (!this.canPlay() || !this.onGround) return;
    this.velY = this.jumpVel;
    this.onGround = false;
  }

  private loop = (t: number) => {
    if (this.canPlay()) this.step(t);
    this.draw();
    this.rafId = requestAnimationFrame(this.loop);
  };

  private step(t: number) {
    // physique du saut
    this.velY += this.gravity;
    this.playerY += this.velY;
    const floorY = this.groundY - this.playerSize;
    if (this.playerY >= floorY) {
      this.playerY = floorY;
      this.velY = 0;
      this.onGround = true;
    }

    // avance / score
    this.distance += this.speed / 6;
    this.speed = 4 + Math.min(6, this.distance / 700);
    this.refresh();

    // ambiance par palier, une fois par seconde
    if (t - this.lastAmbientAt > 1000) {
      this.lastAmbientAt = t;
      Lovense.pulse(tierPct(this.distance), 200);
    }

    // spawn obstacles
    if (this.distance >= this.nextSpawnAt) {
      const h = 24 + Math.random() * 22;
      this.obstacles.push({ x: this.W + 10, w: 18 + Math.random() * 10, h, dodged: false });
      this.nextSpawnAt = this.distance + 90 + Math.random() * 70;
    }

    // avance des obstacles + collision + dodge
    const px1 = this.playerX, px2 = this.playerX + this.playerSize;
    const py1 = this.playerY, py2 = this.playerY + this.playerSize;
    for (const o of this.obstacles) {
      o.x -= this.speed;
      const ox1 = o.x, ox2 = o.x + o.w;
      const oy1 = this.groundY - o.h, oy2 = this.groundY;
      const overlap = px2 > ox1 && px1 < ox2 && py2 > oy1 && py1 < oy2;
      if (overlap) { this.gameOver(); return; }
      if (!o.dodged && ox2 < px1) {
        o.dodged = true;
        Lovense.pulse(10, 150); // saut réussi
      }
    }
    this.obstacles = this.obstacles.filter((o) => o.x + o.w > -10);
  }

  private refresh() {
    this.hooks.onStats({ distance: Math.floor(this.distance) });
  }

  /* ---------- rendu ---------- */
  private roundRect(x: number, y: number, w: number, h: number, r: number) {
    const c = this.ctx;
    r = Math.min(r, w / 2, h / 2);
    c.beginPath();
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
  }
  private draw() {
    const c = this.ctx;
    c.clearRect(0, 0, this.W, this.H);

    // parallax léger : lignes horizontales défilantes discrètes
    c.strokeStyle = "#ffffff08";
    for (let i = 0; i < 4; i++) {
      const y = 40 + i * 60;
      const offset = (this.distance * 0.6 + i * 40) % 40;
      c.beginPath();
      c.moveTo(-offset, y);
      c.lineTo(this.W, y);
      c.stroke();
    }

    // sol
    c.strokeStyle = "#241f45";
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(0, this.groundY);
    c.lineTo(this.W, this.groundY);
    c.stroke();

    // obstacles
    for (const o of this.obstacles) {
      c.fillStyle = "#ff3df2";
      c.shadowColor = "#ff3df2";
      c.shadowBlur = 10;
      this.roundRect(o.x, this.groundY - o.h, o.w, o.h, 4);
      c.fill();
    }
    c.shadowBlur = 0;

    // joueur
    c.fillStyle = "#00e5ff";
    c.shadowColor = "#00e5ff";
    c.shadowBlur = 14;
    this.roundRect(this.playerX, this.playerY, this.playerSize, this.playerSize, 7);
    c.fill();
    c.shadowBlur = 0;
  }

  /* ---------- dimensionnement responsive ---------- */
  fit() {
    const stage = this.canvas.parentElement;
    if (!stage) return;
    const availW = stage.clientWidth, availH = stage.clientHeight;
    if (availW < 20 || availH < 20) return;
    const ratio = this.W / this.H;
    let w = availW, h = w / ratio;
    if (h > availH) { h = availH; w = h * ratio; }
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.style.width = w + "px";
    this.canvas.style.height = h + "px";
    this.canvas.width = Math.round(this.W * dpr);
    this.canvas.height = Math.round(this.H * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.draw();
  }

  /* ---------- flow ---------- */
  start() {
    this.distance = 0;
    this.speed = 4;
    this.obstacles = [];
    this.nextSpawnAt = 120;
    this.playerY = this.groundY - this.playerSize;
    this.velY = 0;
    this.onGround = true;
    this.over = false;
    this.paused = false;
    this.lastAmbientAt = 0;
    this.refresh();
    this.running = true;
    this.hooks.onOverlay({ show: false, title: "", sub: "", btn: "" });
  }
  private gameOver() {
    this.over = true;
    this.running = false;
    Lovense.pulse(90, 500); // forte vibration puis stop (retombe naturellement)
    const score = Math.floor(this.distance);
    const best = saveBestScore("runner", score);
    this.hooks.onOverlay({
      show: true,
      title: "GAME OVER",
      sub: `Distance : ${score}m${best > score ? ` · Record : ${best}m` : " · Nouveau record !"}`,
      btn: "↻ Rejouer",
    });
  }
  togglePause() {
    if (!this.running || this.over) return;
    this.paused = !this.paused;
    if (this.paused) {
      Lovense.mute();
      this.hooks.onOverlay({ show: true, title: "PAUSE", sub: "Reprends quand tu veux.", btn: "▶ Reprendre" });
    } else {
      this.hooks.onOverlay({ show: false, title: "", sub: "", btn: "" });
      Lovense.unmute();
    }
  }
  isPaused() { return this.paused; }
  isRunning() { return this.running && !this.over; }

  destroy() {
    if (this.rafId !== null) cancelAnimationFrame(this.rafId);
    Lovense.mute();
  }
}
