/* ============================================================
   SNAKE ENGINE — grille 20x20, boucle setInterval (comme Tetris).
   Mapping vibration (prompt/jeu4.md) :
     nourriture       → 10-20%
     tous les 5 fruits→ +10% permanent (cumulatif)
     collision        → 100% puis stop (décroissance naturelle du pulse)
   ============================================================ */
import { Lovense } from "./lovense";
import { saveBestScore } from "./settings";
import type { Overlay } from "./engine-types";

const GRID = 20;
const TICK_MS = 130;

export interface Stats { score: number; length: number }
type Dir = "up" | "down" | "left" | "right";
interface Pt { x: number; y: number }

const VECT: Record<Dir, Pt> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};
const OPPOSITE: Record<Dir, Dir> = { up: "down", down: "up", left: "right", right: "left" };

export interface EngineHooks {
  onStats: (s: Stats) => void;
  onOverlay: (o: Overlay) => void;
}

export class SnakeEngine {
  private ctx: CanvasRenderingContext2D;
  private CELL = 20;

  private snake: Pt[] = [];
  private dir: Dir = "right";
  private queuedDir: Dir = "right";
  private food: Pt = { x: 0, y: 0 };
  private score = 0;
  private foodEaten = 0;
  private permanentBoost = 0;

  private timer: ReturnType<typeof setInterval> | null = null;
  private running = false;
  private paused = false;
  private over = false;

  constructor(private canvas: HTMLCanvasElement, private hooks: EngineHooks) {
    this.ctx = canvas.getContext("2d")!;
    this.resetState();
  }

  private resetState() {
    const mid = Math.floor(GRID / 2);
    this.snake = [{ x: mid - 1, y: mid }, { x: mid - 2, y: mid }, { x: mid - 3, y: mid }];
    this.dir = "right";
    this.queuedDir = "right";
    this.score = 0;
    this.foodEaten = 0;
    this.permanentBoost = 0;
    this.over = false;
    this.paused = false;
    this.placeFood();
  }
  private placeFood() {
    let p: Pt;
    do {
      p = { x: (Math.random() * GRID) | 0, y: (Math.random() * GRID) | 0 };
    } while (this.snake.some((s) => s.x === p.x && s.y === p.y));
    this.food = p;
  }

  private canPlay() {
    return this.running && !this.paused && !this.over;
  }

  setDirection(d: Dir) {
    if (!this.canPlay()) return;
    if (OPPOSITE[d] === this.dir) return; // ne peut pas faire demi-tour sur lui-même
    this.queuedDir = d;
  }

  private tick = () => {
    this.dir = this.queuedDir;
    const v = VECT[this.dir];
    const head = this.snake[0];
    const next: Pt = { x: head.x + v.x, y: head.y + v.y };

    if (next.x < 0 || next.x >= GRID || next.y < 0 || next.y >= GRID || this.snake.some((s) => s.x === next.x && s.y === next.y)) {
      this.gameOver();
      return;
    }

    this.snake.unshift(next);
    if (next.x === this.food.x && next.y === this.food.y) {
      this.onFood();
      this.placeFood();
    } else {
      this.snake.pop();
    }

    this.draw();
    this.refresh();
  };

  private onFood() {
    this.score += 10;
    this.foodEaten++;
    if (this.foodEaten % 5 === 0) this.permanentBoost = Math.min(50, this.permanentBoost + 10);
    const pct = Math.min(100, 10 + Math.random() * 10 + this.permanentBoost);
    Lovense.pulse(pct, 200);
  }

  private refresh() {
    this.hooks.onStats({ score: this.score, length: this.snake.length });
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
    const c = this.ctx, CELL = this.CELL;
    c.clearRect(0, 0, GRID * CELL, GRID * CELL);

    // grille discrète
    c.strokeStyle = "#ffffff08";
    c.lineWidth = 1;
    for (let i = 0; i <= GRID; i++) {
      c.beginPath(); c.moveTo(i * CELL, 0); c.lineTo(i * CELL, GRID * CELL); c.stroke();
      c.beginPath(); c.moveTo(0, i * CELL); c.lineTo(GRID * CELL, i * CELL); c.stroke();
    }

    // nourriture
    c.fillStyle = "#ff3df2";
    c.shadowColor = "#ff3df2";
    c.shadowBlur = 12;
    const fp = 3;
    this.roundRect(this.food.x * CELL + fp, this.food.y * CELL + fp, CELL - fp * 2, CELL - fp * 2, 5);
    c.fill();
    c.shadowBlur = 0;

    // serpent — tête plus lumineuse, dégradé cyan → violet vers la queue
    this.snake.forEach((s, i) => {
      const t = i / Math.max(1, this.snake.length - 1);
      c.fillStyle = i === 0 ? "#00e5ff" : `color-mix(in srgb, #00e5ff ${Math.round((1 - t) * 100)}%, #8a2be2)`;
      c.shadowColor = "#00e5ff";
      c.shadowBlur = i === 0 ? 14 : 6;
      const p = 2;
      this.roundRect(s.x * CELL + p, s.y * CELL + p, CELL - p * 2, CELL - p * 2, 5);
      c.fill();
    });
    c.shadowBlur = 0;
  }

  /* ---------- dimensionnement responsive (carré) ---------- */
  fit() {
    const stage = this.canvas.parentElement;
    if (!stage) return;
    const availW = stage.clientWidth, availH = stage.clientHeight;
    if (availW < 20 || availH < 20) return;
    const side = Math.floor(Math.min(availW, availH));
    this.CELL = Math.max(6, Math.floor(side / GRID));
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const px = GRID * this.CELL;
    this.canvas.style.width = px + "px";
    this.canvas.style.height = px + "px";
    this.canvas.width = Math.round(px * dpr);
    this.canvas.height = Math.round(px * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.draw();
  }

  /* ---------- flow ---------- */
  start() {
    this.resetState();
    this.refresh();
    this.running = true;
    this.hooks.onOverlay({ show: false, title: "", sub: "", btn: "" });
    if (this.timer) clearInterval(this.timer);
    this.timer = setInterval(this.tick, TICK_MS);
    this.draw();
  }
  private gameOver() {
    this.over = true;
    this.running = false;
    if (this.timer) clearInterval(this.timer);
    Lovense.pulse(100, 500); // gros hit puis retombe naturellement
    const best = saveBestScore("snake", this.score);
    this.hooks.onOverlay({
      show: true,
      title: "GAME OVER",
      sub: `Score : ${this.score} · Longueur : ${this.snake.length}${best > this.score ? ` · Record : ${best}` : " · Nouveau record !"}`,
      btn: "↻ Rejouer",
    });
  }
  togglePause() {
    if (!this.running || this.over) return;
    this.paused = !this.paused;
    if (this.paused) {
      if (this.timer) clearInterval(this.timer);
      Lovense.mute();
      this.hooks.onOverlay({ show: true, title: "PAUSE", sub: "Reprends quand tu veux.", btn: "▶ Reprendre" });
    } else {
      this.hooks.onOverlay({ show: false, title: "", sub: "", btn: "" });
      Lovense.unmute();
      this.timer = setInterval(this.tick, TICK_MS);
    }
  }
  isPaused() { return this.paused; }
  isRunning() { return this.running && !this.over; }

  destroy() {
    if (this.timer) clearInterval(this.timer);
    Lovense.mute();
  }
}
