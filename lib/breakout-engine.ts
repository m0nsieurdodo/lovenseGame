/* ============================================================
   BREAKOUT ENGINE — canvas + requestAnimationFrame.
   Paddle en bas, briques en haut, balle rebondit.
   Mapping vibration (prompt/jeu6.md) :
     brique cassée   → 10-20% (0.2s), monte avec le combo
     combo 10        → vibration continue ~50%
     combo 20        → vibration continue ~80%
     game over       → stop
   ============================================================ */
import { Lovense } from "./lovense";
import { saveBestScore } from "./settings";
import type { Overlay } from "./engine-types";

const ROW_COLORS = ["#00e5ff", "#8a2be2", "#ff3df2", "#00ff85", "#ff9f43", "#4b7bff"];

export interface Stats { score: number; lives: number; level: number; combo: number }

export interface EngineHooks {
  onStats: (s: Stats) => void;
  onOverlay: (o: Overlay) => void;
}

interface Brick { x: number; y: number; alive: boolean; color: string }

export class BreakoutEngine {
  private ctx: CanvasRenderingContext2D;
  private W = 300;
  private H = 500;

  private readonly BRICK_COLS = 8;
  private brickRows = 4;
  private brickW = 0;
  private brickH = 16;
  private bricks: Brick[] = [];

  private paddleW = 70;
  private readonly paddleH = 12;
  private paddleX = 0;

  private ballX = 0;
  private ballY = 0;
  private ballVX = 0;
  private ballVY = 0;
  private readonly ballR = 6;
  private baseSpeed = 4.2;

  private score = 0;
  private lives = 3;
  private level = 1;
  private combo = 0;

  private running = false;
  private paused = false;
  private over = false;
  private rafId: number | null = null;
  private moveDir = 0; // -1 / 0 / 1 (clavier)
  private pointerX: number | null = null;

  constructor(private canvas: HTMLCanvasElement, private hooks: EngineHooks) {
    this.ctx = canvas.getContext("2d")!;
    this.buildLevel();
    this.paddleX = (this.W - this.paddleW) / 2;
    this.ballX = this.W / 2;
    this.ballY = this.H - 60;
    this.rafId = requestAnimationFrame(this.loop);
  }

  /* ---------- niveau / briques ---------- */
  private buildLevel() {
    this.brickRows = Math.min(4 + Math.floor((this.level - 1) / 2), 6);
    this.brickW = (this.W - 16) / this.BRICK_COLS;
    this.bricks = [];
    for (let r = 0; r < this.brickRows; r++) {
      for (let c = 0; c < this.BRICK_COLS; c++) {
        this.bricks.push({
          x: 8 + c * this.brickW,
          y: 40 + r * (this.brickH + 6),
          alive: true,
          color: ROW_COLORS[r % ROW_COLORS.length],
        });
      }
    }
  }
  private resetBall(serveUp = true) {
    this.paddleX = (this.W - this.paddleW) / 2;
    this.ballX = this.W / 2;
    this.ballY = this.H - 60;
    const speed = this.baseSpeed + (this.level - 1) * 0.5;
    const angle = (Math.random() * 0.6 - 0.3) - Math.PI / 2; // vers le haut, léger angle aléatoire
    this.ballVX = Math.cos(angle) * speed;
    this.ballVY = serveUp ? Math.sin(angle) * speed : speed;
  }

  private canPlay() {
    return this.running && !this.paused && !this.over;
  }

  /* ---------- inputs ---------- */
  setMoveDir(dir: -1 | 0 | 1) {
    this.moveDir = dir;
  }
  setPointerX(x: number | null) {
    this.pointerX = x;
  }

  /* ---------- boucle ---------- */
  private loop = () => {
    if (this.canPlay()) this.step();
    this.draw();
    this.rafId = requestAnimationFrame(this.loop);
  };
  private step() {
    // paddle
    if (this.pointerX !== null) {
      this.paddleX = Math.max(0, Math.min(this.W - this.paddleW, this.pointerX - this.paddleW / 2));
    } else if (this.moveDir !== 0) {
      this.paddleX = Math.max(0, Math.min(this.W - this.paddleW, this.paddleX + this.moveDir * 6));
    }

    this.ballX += this.ballVX;
    this.ballY += this.ballVY;

    // murs
    if (this.ballX - this.ballR < 0) { this.ballX = this.ballR; this.ballVX *= -1; }
    if (this.ballX + this.ballR > this.W) { this.ballX = this.W - this.ballR; this.ballVX *= -1; }
    if (this.ballY - this.ballR < 0) { this.ballY = this.ballR; this.ballVY *= -1; }

    // paddle
    const paddleY = this.H - 24;
    if (
      this.ballVY > 0 &&
      this.ballY + this.ballR >= paddleY &&
      this.ballY + this.ballR <= paddleY + this.paddleH + 6 &&
      this.ballX >= this.paddleX &&
      this.ballX <= this.paddleX + this.paddleW
    ) {
      const hit = (this.ballX - (this.paddleX + this.paddleW / 2)) / (this.paddleW / 2); // -1..1
      const speed = Math.hypot(this.ballVX, this.ballVY);
      const angle = hit * (Math.PI / 3) - Math.PI / 2; // ±60°
      this.ballVX = Math.cos(angle) * speed;
      this.ballVY = Math.sin(angle) * speed;
      this.ballY = paddleY - this.ballR;
    }

    // briques
    for (const b of this.bricks) {
      if (!b.alive) continue;
      if (
        this.ballX + this.ballR > b.x &&
        this.ballX - this.ballR < b.x + this.brickW &&
        this.ballY + this.ballR > b.y &&
        this.ballY - this.ballR < b.y + this.brickH
      ) {
        b.alive = false;
        this.ballVY *= -1;
        this.onBrickBreak();
        break;
      }
    }

    // vie perdue
    if (this.ballY - this.ballR > this.H) {
      this.combo = 0;
      this.lives--;
      this.refresh();
      if (this.lives <= 0) { this.gameOver(); return; }
      this.resetBall();
    }

    // niveau terminé
    if (this.bricks.every((b) => !b.alive)) {
      this.level++;
      this.buildLevel();
      this.resetBall();
      this.refresh();
    }
  }

  private onBrickBreak() {
    this.combo++;
    this.score += 10 * this.level;
    this.refresh();

    if (this.combo >= 20) Lovense.pulse(80, 500);
    else if (this.combo >= 10) Lovense.pulse(50, 400);
    else Lovense.pulse(10 + Math.min(10, this.combo), 200);
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

    // briques
    for (const b of this.bricks) {
      if (!b.alive) continue;
      c.fillStyle = b.color;
      c.shadowColor = b.color;
      c.shadowBlur = 8;
      this.roundRect(b.x + 1.5, b.y, this.brickW - 3, this.brickH, 4);
      c.fill();
      c.shadowBlur = 0;
    }

    // paddle
    c.fillStyle = "#e8e6ff";
    c.shadowColor = "#00e5ff";
    c.shadowBlur = 12;
    this.roundRect(this.paddleX, this.H - 24, this.paddleW, this.paddleH, 6);
    c.fill();
    c.shadowBlur = 0;

    // balle
    c.beginPath();
    c.fillStyle = "#ffd23f";
    c.shadowColor = "#ffd23f";
    c.shadowBlur = 14;
    c.arc(this.ballX, this.ballY, this.ballR, 0, Math.PI * 2);
    c.fill();
    c.shadowBlur = 0;
  }

  private refresh() {
    this.hooks.onStats({ score: this.score, lives: this.lives, level: this.level, combo: this.combo });
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
    this.score = 0;
    this.lives = 3;
    this.level = 1;
    this.combo = 0;
    this.over = false;
    this.paused = false;
    this.buildLevel();
    this.resetBall();
    this.refresh();
    this.running = true;
    this.hooks.onOverlay({ show: false, title: "", sub: "", btn: "" });
    if (this.rafId === null) this.rafId = requestAnimationFrame(this.loop);
  }
  private gameOver() {
    this.over = true;
    this.running = false;
    Lovense.mute();
    const best = saveBestScore("breakout", this.score);
    this.hooks.onOverlay({
      show: true,
      title: "GAME OVER",
      sub: `Score : ${this.score} · Niveau : ${this.level}${best > this.score ? ` · Record : ${best}` : " · Nouveau record !"}`,
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
