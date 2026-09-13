/* ============================================================
   TETRIS ENGINE — porté depuis le V1 (index.html) en classe TS.
   Rendu canvas impératif + pilotage du contrôleur Lovense partagé.
   La couche React (page) branche les callbacks et les inputs.
   ============================================================ */
import { Lovense } from "./lovense";
import { saveBestScore } from "./settings";
import { tetrisHapticPlan, type TetrisHapticPlan } from "./tetris-haptics";
import type { Overlay } from "./engine-types";

const COLS = 10;
const ROWS = 20;

const COLORS: Record<string, string> = {
  I: "#00e5ff", O: "#ffd23f", T: "#c56bff", S: "#00ff85",
  Z: "#ff3b3b", J: "#4b7bff", L: "#ff9f43",
};

const PIECES: Record<string, number[][]> = {
  I: [[0, 0, 0, 0], [1, 1, 1, 1], [0, 0, 0, 0], [0, 0, 0, 0]],
  O: [[1, 1], [1, 1]],
  T: [[0, 1, 0], [1, 1, 1], [0, 0, 0]],
  S: [[0, 1, 1], [1, 1, 0], [0, 0, 0]],
  Z: [[1, 1, 0], [0, 1, 1], [0, 0, 0]],
  J: [[1, 0, 0], [1, 1, 1], [0, 0, 0]],
  L: [[0, 0, 1], [1, 1, 1], [0, 0, 0]],
};
const TYPES = Object.keys(PIECES);

export interface Stats { score: number; lines: number; level: number }
export type { Overlay };

export interface EngineHooks {
  onStats: (s: Stats) => void;
  onOverlay: (o: Overlay) => void;
}

interface Piece { type: string; shape: number[][]; x: number; y: number }

export class TetrisEngine {
  private ctx: CanvasRenderingContext2D;
  private nctx: CanvasRenderingContext2D;
  private CELL = 30;
  private readonly NEXT_W = 60;
  private readonly NEXT_H = 42;

  private grid: (string | 0)[][] = [];
  private cur: Piece | null = null;
  private nextType: string | null = null;
  private bag: string[] = [];
  private score = 0;
  private lines = 0;
  private level = 1;
  private comboTetris = 0;

  private dropTimer: ReturnType<typeof setInterval> | null = null;
  private dropInterval = 800;
  private running = false;
  private paused = false;
  private over = false;
  private clearing = false;
  private clearRows: number[] | null = null;
  private clearK = 0;

  constructor(
    private board: HTMLCanvasElement,
    private nextCv: HTMLCanvasElement,
    private hooks: EngineHooks,
  ) {
    this.ctx = board.getContext("2d")!;
    this.nctx = nextCv.getContext("2d")!;
    this.reset();
  }

  /* ---------- bag / spawn ---------- */
  private newBag() {
    const t = [...TYPES];
    for (let i = t.length - 1; i > 0; i--) {
      const j = (Math.random() * (i + 1)) | 0;
      [t[i], t[j]] = [t[j], t[i]];
    }
    return t;
  }
  private nextFromBag() {
    if (this.bag.length === 0) this.bag = this.newBag();
    return this.bag.pop()!;
  }
  private getTop(shape: number[][]) {
    for (let y = 0; y < shape.length; y++) if (shape[y].some((v) => v)) return y;
    return 0;
  }
  private spawn() {
    const type = this.nextType || this.nextFromBag();
    this.nextType = this.nextFromBag();
    const shape = PIECES[type].map((r) => [...r]);
    this.cur = { type, shape, x: ((COLS - shape[0].length) / 2) | 0, y: -this.getTop(shape) };
    this.drawNext();
    if (this.collide(shape, this.cur.x, this.cur.y)) this.gameOver();
  }

  /* ---------- géométrie ---------- */
  private rotate(shape: number[][]) {
    const n = shape.length, m = shape[0].length;
    const r = Array.from({ length: m }, () => Array(n).fill(0));
    for (let y = 0; y < n; y++) for (let x = 0; x < m; x++) r[x][n - 1 - y] = shape[y][x];
    return r;
  }
  private collide(shape: number[][], px: number, py: number) {
    for (let y = 0; y < shape.length; y++)
      for (let x = 0; x < shape[y].length; x++) {
        if (!shape[y][x]) continue;
        const gx = px + x, gy = py + y;
        if (gx < 0 || gx >= COLS || gy >= ROWS) return true;
        if (gy >= 0 && this.grid[gy][gx]) return true;
      }
    return false;
  }
  private canPlay() {
    return this.running && !this.paused && !this.over && !this.clearing;
  }
  private playHaptic(plan: TetrisHapticPlan) {
    if (plan.kind === "climax") Lovense.climax();
    else Lovense.pulse(plan.intensity, plan.durationMs);
  }

  /* ---------- actions (appelées par l'UI) ---------- */
  move(dx: number) {
    if (!this.canPlay() || !this.cur) return;
    if (!this.collide(this.cur.shape, this.cur.x + dx, this.cur.y)) {
      this.cur.x += dx;
      this.draw();
    }
  }
  softDrop() {
    if (!this.canPlay() || !this.cur) return;
    if (!this.collide(this.cur.shape, this.cur.x, this.cur.y + 1)) {
      this.cur.y++;
      this.score += 1;
      this.draw();
      this.refresh();
    } else this.lock();
  }
  hardDrop() {
    if (!this.canPlay() || !this.cur) return;
    let d = 0;
    while (!this.collide(this.cur.shape, this.cur.x, this.cur.y + 1)) {
      this.cur.y++;
      d++;
    }
    this.score += d * 2;
    this.draw();
    if (d > 0) this.playHaptic(tetrisHapticPlan({ kind: "hard_drop" }));
    this.lock();
  }
  tryRotate() {
    if (!this.canPlay() || !this.cur) return;
    const r = this.rotate(this.cur.shape);
    for (const k of [0, -1, 1, -2, 2]) {
      if (!this.collide(r, this.cur.x + k, this.cur.y)) {
        this.cur.shape = r;
        this.cur.x += k;
        this.playHaptic(tetrisHapticPlan({ kind: "rotate" }));
        this.draw();
        return;
      }
    }
  }

  /* ---------- verrouillage + lignes ---------- */
  private lock() {
    if (!this.cur) return;
    for (let y = 0; y < this.cur.shape.length; y++)
      for (let x = 0; x < this.cur.shape[y].length; x++) {
        if (this.cur.shape[y][x]) {
          const gy = this.cur.y + y, gx = this.cur.x + x;
          if (gy < 0) {
            this.gameOver();
            return;
          }
          this.grid[gy][gx] = this.cur.type;
        }
      }
    this.playHaptic(tetrisHapticPlan({ kind: "lock" }));

    const full: number[] = [];
    for (let y = 0; y < ROWS; y++) if (this.grid[y].every((c) => c)) full.push(y);

    if (full.length) {
      this.cur = null;
      this.clearing = true;
      if (this.dropTimer) clearInterval(this.dropTimer);
      this.animateClear(full, () => {
        this.removeRows(full);
        this.resolveClear(full.length);
        this.clearing = false;
        this.spawn();
        this.draw();
        if (this.running && !this.paused && !this.over) this.startTimer();
      });
    } else {
      this.spawn();
      this.draw();
    }
  }
  private removeRows(rows: number[]) {
    const set = new Set(rows);
    const kept = this.grid.filter((_, y) => !set.has(y));
    while (kept.length < ROWS) kept.unshift(Array(COLS).fill(0));
    this.grid = kept;
  }
  private resolveClear(cleared: number) {
    this.lines += cleared;
    this.score += [0, 100, 300, 500, 800][cleared] * this.level;

    if (cleared === 4) this.comboTetris++;
    else this.comboTetris = 0;
    this.playHaptic(tetrisHapticPlan({
      kind: "clear",
      lines: cleared as 1 | 2 | 3 | 4,
      backToBackTetris: cleared === 4 && this.comboTetris >= 2,
    }));

    const nl = 1 + Math.floor(this.lines / 10);
    if (nl !== this.level) {
      this.level = nl;
      this.setSpeed();
      Lovense.updateWarmup(this.level);
    }
    this.refresh();
  }
  private setSpeed() {
    this.dropInterval = Math.max(90, 800 - (this.level - 1) * 70);
    if (this.running && !this.paused && !this.clearing) this.startTimer();
  }
  private tick = () => {
    if (!this.cur) return;
    if (!this.collide(this.cur.shape, this.cur.x, this.cur.y + 1)) {
      this.cur.y++;
      this.draw();
    } else this.lock();
  };
  private startTimer() {
    if (this.dropTimer) clearInterval(this.dropTimer);
    this.dropTimer = setInterval(this.tick, this.dropInterval);
  }

  /* ---------- rendu ---------- */
  private roundRect(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
    r = Math.min(r, w / 2, h / 2);
    c.beginPath();
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
  }
  private cell(c: CanvasRenderingContext2D, x: number, y: number, color: string, size = this.CELL) {
    const px = x * size, py = y * size, p = 2;
    c.fillStyle = color;
    this.roundRect(c, px + p, py + p, size - 2 * p, size - 2 * p, 6);
    c.fill();
    c.fillStyle = "#ffffff22";
    this.roundRect(c, px + p, py + p, size - 2 * p, (size - 2 * p) * 0.4, 6);
    c.fill();
  }
  private cellClearing(x: number, y: number, color: string, k: number) {
    const size = this.CELL, p = 2, px = x * size, py = y * size;
    const s = 1 - k;
    const cx = px + size / 2, cy = py + size / 2;
    const w = (size - 2 * p) * s, h = (size - 2 * p) * s;
    if (w <= 0.5 || h <= 0.5) return;
    const ctx = this.ctx;
    ctx.save();
    ctx.shadowColor = "#ffffff";
    ctx.shadowBlur = 18 * (1 - k);
    ctx.globalAlpha = 1;
    ctx.fillStyle = color;
    this.roundRect(ctx, cx - w / 2, cy - h / 2, w, h, 6 * s);
    ctx.fill();
    ctx.globalAlpha = Math.max(0, 1 - k);
    ctx.fillStyle = "#ffffff";
    this.roundRect(ctx, cx - w / 2, cy - h / 2, w, h, 6 * s);
    ctx.fill();
    ctx.restore();
  }
  private draw() {
    const ctx = this.ctx, CELL = this.CELL;
    ctx.clearRect(0, 0, COLS * CELL, ROWS * CELL);
    ctx.strokeStyle = "#ffffff08";
    ctx.lineWidth = 1;
    for (let x = 0; x <= COLS; x++) {
      ctx.beginPath();
      ctx.moveTo(x * CELL, 0);
      ctx.lineTo(x * CELL, ROWS * CELL);
      ctx.stroke();
    }
    for (let y = 0; y <= ROWS; y++) {
      ctx.beginPath();
      ctx.moveTo(0, y * CELL);
      ctx.lineTo(COLS * CELL, y * CELL);
      ctx.stroke();
    }

    if (this.clearRows) {
      const a = Math.max(0, 1 - this.clearK) * 0.5;
      ctx.fillStyle = `rgba(255,255,255,${a})`;
      this.clearRows.forEach((ry) => ctx.fillRect(0, ry * CELL, COLS * CELL, CELL));
    }

    for (let y = 0; y < ROWS; y++)
      for (let x = 0; x < COLS; x++) {
        const g = this.grid[y][x];
        if (!g) continue;
        if (this.clearRows && this.clearRows.includes(y)) this.cellClearing(x, y, COLORS[g], this.clearK);
        else this.cell(ctx, x, y, COLORS[g]);
      }

    if (!this.cur || this.clearRows) return;
    let gy = this.cur.y;
    while (!this.collide(this.cur.shape, this.cur.x, gy + 1)) gy++;
    ctx.globalAlpha = 0.18;
    for (let y = 0; y < this.cur.shape.length; y++)
      for (let x = 0; x < this.cur.shape[y].length; x++)
        if (this.cur.shape[y][x]) this.cell(ctx, this.cur.x + x, gy + y, COLORS[this.cur.type]);
    ctx.globalAlpha = 1;
    for (let y = 0; y < this.cur.shape.length; y++)
      for (let x = 0; x < this.cur.shape[y].length; x++)
        if (this.cur.shape[y][x] && this.cur.y + y >= 0) this.cell(ctx, this.cur.x + x, this.cur.y + y, COLORS[this.cur.type]);
  }
  private animateClear(rows: number[], done: () => void) {
    this.clearRows = rows.slice();
    this.clearK = 0;
    const dur = 300, start = performance.now();
    const frame = (now: number) => {
      this.clearK = Math.min(1, (now - start) / dur);
      this.draw();
      if (this.clearK < 1) requestAnimationFrame(frame);
      else {
        this.clearRows = null;
        this.clearK = 0;
        done();
      }
    };
    requestAnimationFrame(frame);
  }
  private drawNext() {
    const nctx = this.nctx;
    nctx.clearRect(0, 0, this.NEXT_W, this.NEXT_H);
    if (!this.nextType) return;
    const s = PIECES[this.nextType], cols = s[0].length, rows = s.length;
    const size = Math.min((this.NEXT_W - 6) / cols, (this.NEXT_H - 6) / rows, 14);
    const w = cols * size, h = rows * size, ox = (this.NEXT_W - w) / 2, oy = (this.NEXT_H - h) / 2;
    for (let y = 0; y < rows; y++)
      for (let x = 0; x < cols; x++)
        if (s[y][x]) {
          nctx.fillStyle = COLORS[this.nextType];
          this.roundRect(nctx, ox + x * size + 1.5, oy + y * size + 1.5, size - 3, size - 3, 4);
          nctx.fill();
        }
  }
  private refresh() {
    this.hooks.onStats({ score: this.score, lines: this.lines, level: this.level });
  }

  /* ---------- dimensionnement responsive ---------- */
  fit() {
    const stage = this.board.parentElement?.parentElement;
    if (!stage) return;
    const availW = stage.clientWidth, availH = stage.clientHeight;
    if (availW < 20 || availH < 20) return;
    let cell = Math.floor(Math.min(availW / COLS, availH / ROWS));
    cell = Math.max(8, cell);
    this.CELL = cell;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = COLS * cell, h = ROWS * cell;
    this.board.style.width = w + "px";
    this.board.style.height = h + "px";
    this.board.width = Math.round(w * dpr);
    this.board.height = Math.round(h * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    this.nextCv.style.width = this.NEXT_W + "px";
    this.nextCv.style.height = this.NEXT_H + "px";
    this.nextCv.width = Math.round(this.NEXT_W * dpr);
    this.nextCv.height = Math.round(this.NEXT_H * dpr);
    this.nctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    this.draw();
    if (this.nextType) this.drawNext();
  }

  /* ---------- flow ---------- */
  private reset() {
    this.grid = Array.from({ length: ROWS }, () => Array(COLS).fill(0));
    this.score = 0;
    this.lines = 0;
    this.level = 1;
    this.comboTetris = 0;
    this.bag = [];
    this.nextType = null;
    this.dropInterval = 800;
    this.over = false;
    this.paused = false;
    this.clearing = false;
    this.clearRows = null;
    this.refresh();
  }
  start() {
    this.reset();
    this.spawn();
    this.fit();
    this.draw();
    this.running = true;
    Lovense.updateWarmup(1);
    this.hooks.onOverlay({ show: false, title: "", sub: "", btn: "▶ Jouer" });
    this.startTimer();
  }
  private gameOver() {
    this.over = true;
    this.running = false;
    this.clearing = false;
    this.clearRows = null;
    if (this.dropTimer) clearInterval(this.dropTimer);
    Lovense.mute();
    const best = saveBestScore("tetris", this.score);
    this.hooks.onOverlay({
      show: true,
      title: "GAME OVER",
      sub: `Score : ${this.score} · Lignes : ${this.lines}${best > this.score ? ` · Record : ${best}` : " · Nouveau record !"}`,
      btn: "↻ Rejouer",
    });
  }
  togglePause() {
    if (!this.running || this.over) return;
    this.paused = !this.paused;
    if (this.paused) {
      if (this.dropTimer) clearInterval(this.dropTimer);
      Lovense.mute();
      this.hooks.onOverlay({ show: true, title: "PAUSE", sub: "Reprends quand tu veux.", btn: "▶ Reprendre" });
    } else {
      this.hooks.onOverlay({ show: false, title: "", sub: "", btn: "" });
      Lovense.unmute();
      if (!this.clearing) this.startTimer();
    }
  }
  isPaused() {
    return this.paused;
  }
  isRunning() {
    return this.running && !this.over;
  }

  /** À appeler au démontage du composant React. */
  destroy() {
    if (this.dropTimer) clearInterval(this.dropTimer);
    Lovense.mute();
  }
}
