/* ============================================================
   PONG ENGINE — canvas + requestAnimationFrame.
   Orientation adaptée au format téléphone portrait : raquette joueur
   en bas (drag / clavier ← →), IA en haut, balle rebondit verticalement.
   Mapping vibration (prompt/jeu1.md) :
     échange (paddle touchée) → 5-10%
     combo 5 échanges         → +10% intensité (boost cumulatif, plafonné)
     point marqué             → 80% pendant 0.5s
     perte (point adverse)    → stop
   ============================================================ */
import { Lovense } from "./lovense";
import { saveBestScore } from "./settings";
import type { Overlay } from "./engine-types";

const WIN_SCORE = 7;

export interface Stats { player: number; ai: number; combo: number }

export interface EngineHooks {
  onStats: (s: Stats) => void;
  onOverlay: (o: Overlay) => void;
}

export class PongEngine {
  private ctx: CanvasRenderingContext2D;
  readonly W = 300;
  readonly H = 500;

  private readonly paddleW = 64;
  private readonly paddleH = 10;
  private playerX = 0;
  private aiX = 0;

  private ballX = 0;
  private ballY = 0;
  private ballVX = 0;
  private ballVY = 0;
  private readonly ballR = 6;
  private baseSpeed = 3.6;
  private rallyGlow = 0; // 0..1, glow croissant sur la balle avec le combo

  private player = 0;
  private ai = 0;
  private combo = 0;
  private intensityBoost = 0; // cumul +10% tous les 5 échanges, plafonné

  private running = false;
  private paused = false;
  private over = false;
  private rafId: number | null = null;
  private moveDir = 0; // -1 / 0 / 1 (clavier)
  private pointerX: number | null = null;

  constructor(private canvas: HTMLCanvasElement, private hooks: EngineHooks) {
    this.ctx = canvas.getContext("2d")!;
    this.playerX = (this.W - this.paddleW) / 2;
    this.aiX = (this.W - this.paddleW) / 2;
    this.centerBall();
    this.rafId = requestAnimationFrame(this.loop);
  }

  private centerBall() {
    this.ballX = this.W / 2;
    this.ballY = this.H / 2;
    this.ballVX = 0;
    this.ballVY = 0;
  }
  private serve(towardPlayer: boolean) {
    const speed = this.baseSpeed;
    const angle = Math.random() * 0.8 - 0.4; // léger angle aléatoire
    this.ballX = this.W / 2;
    this.ballY = this.H / 2;
    this.ballVX = Math.sin(angle) * speed;
    this.ballVY = Math.cos(angle) * speed * (towardPlayer ? 1 : -1);
  }

  private canPlay() {
    return this.running && !this.paused && !this.over;
  }

  setMoveDir(dir: -1 | 0 | 1) {
    this.moveDir = dir;
  }
  setPointerX(x: number | null) {
    this.pointerX = x;
  }

  private loop = () => {
    if (this.canPlay()) this.step();
    this.draw();
    this.rafId = requestAnimationFrame(this.loop);
  };

  private step() {
    // raquette joueur
    if (this.pointerX !== null) {
      this.playerX = Math.max(0, Math.min(this.W - this.paddleW, this.pointerX - this.paddleW / 2));
    } else if (this.moveDir !== 0) {
      this.playerX = Math.max(0, Math.min(this.W - this.paddleW, this.playerX + this.moveDir * 6));
    }

    // IA : suit la balle avec vitesse plafonnée + imprécision
    const aiCenter = this.aiX + this.paddleW / 2;
    const targetX = this.ballX + Math.sin(performance.now() / 300) * 6; // léger tremblement = imprécision
    const aiSpeed = 3.4 + this.ai * 0.05;
    if (targetX > aiCenter + 4) this.aiX = Math.min(this.W - this.paddleW, this.aiX + aiSpeed);
    else if (targetX < aiCenter - 4) this.aiX = Math.max(0, this.aiX - aiSpeed);

    this.ballX += this.ballVX;
    this.ballY += this.ballVY;

    // murs latéraux
    if (this.ballX - this.ballR < 0) { this.ballX = this.ballR; this.ballVX *= -1; }
    if (this.ballX + this.ballR > this.W) { this.ballX = this.W - this.ballR; this.ballVX *= -1; }

    // raquette joueur (bas)
    const playerY = this.H - 22;
    if (
      this.ballVY > 0 &&
      this.ballY + this.ballR >= playerY &&
      this.ballY + this.ballR <= playerY + this.paddleH + 8 &&
      this.ballX >= this.playerX - 2 &&
      this.ballX <= this.playerX + this.paddleW + 2
    ) {
      this.bounce(this.playerX, true);
    }
    // raquette IA (haut)
    const aiY = 22;
    if (
      this.ballVY < 0 &&
      this.ballY - this.ballR <= aiY + this.paddleH &&
      this.ballY - this.ballR >= aiY - 8 &&
      this.ballX >= this.aiX - 2 &&
      this.ballX <= this.aiX + this.paddleW + 2
    ) {
      this.bounce(this.aiX, false);
    }

    // point marqué
    if (this.ballY - this.ballR > this.H) {
      this.onPoint("ai");
    } else if (this.ballY + this.ballR < 0) {
      this.onPoint("player");
    }
  }

  private bounce(paddleX: number, fromPlayer: boolean) {
    const hit = (this.ballX - (paddleX + this.paddleW / 2)) / (this.paddleW / 2); // -1..1
    const speed = Math.min(9, Math.hypot(this.ballVX, this.ballVY) * 1.04); // accélère à chaque échange
    const angle = hit * (Math.PI / 3);
    this.ballVX = Math.sin(angle) * speed;
    this.ballVY = Math.cos(angle) * speed * (fromPlayer ? -1 : 1);
    this.ballY = fromPlayer ? this.H - 22 - this.ballR : 22 + this.paddleH + this.ballR;

    this.combo++;
    this.rallyGlow = Math.min(1, this.combo / 12);
    if (this.combo % 5 === 0) this.intensityBoost = Math.min(50, this.intensityBoost + 10);
    const pct = Math.min(100, 5 + Math.random() * 5 + this.intensityBoost);
    Lovense.pulse(pct, 150);
    this.refresh();
  }

  private onPoint(who: "player" | "ai") {
    this.combo = 0;
    this.intensityBoost = 0;
    this.rallyGlow = 0;
    if (who === "player") {
      this.player++;
      Lovense.pulse(80, 500);
    } else {
      this.ai++;
      Lovense.mute();
    }
    this.refresh();

    if (this.player >= WIN_SCORE || this.ai >= WIN_SCORE) {
      this.matchOver(who === "player");
      return;
    }
    this.centerBall();
    setTimeout(() => { if (this.canPlay()) this.serve(who === "ai"); }, 500);
  }

  private refresh() {
    this.hooks.onStats({ player: this.player, ai: this.ai, combo: this.combo });
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

    // ligne médiane pointillée
    c.strokeStyle = "#241f45";
    c.lineWidth = 2;
    c.setLineDash([6, 8]);
    c.beginPath();
    c.moveTo(0, this.H / 2);
    c.lineTo(this.W, this.H / 2);
    c.stroke();
    c.setLineDash([]);

    // raquette IA (haut, violet)
    c.fillStyle = "#8a2be2";
    c.shadowColor = "#8a2be2";
    c.shadowBlur = 10;
    this.roundRect(this.aiX, 22, this.paddleW, this.paddleH, 5);
    c.fill();

    // raquette joueur (bas, cyan)
    c.fillStyle = "#00e5ff";
    c.shadowColor = "#00e5ff";
    c.shadowBlur = 10;
    this.roundRect(this.playerX, this.H - 22, this.paddleW, this.paddleH, 5);
    c.fill();

    // balle — glow croissant avec le combo
    c.beginPath();
    c.fillStyle = "#ffd23f";
    c.shadowColor = this.rallyGlow > 0.5 ? "#ff3df2" : "#ffd23f";
    c.shadowBlur = 10 + this.rallyGlow * 20;
    c.arc(this.ballX, this.ballY, this.ballR, 0, Math.PI * 2);
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
    this.player = 0;
    this.ai = 0;
    this.combo = 0;
    this.intensityBoost = 0;
    this.over = false;
    this.paused = false;
    this.playerX = (this.W - this.paddleW) / 2;
    this.aiX = (this.W - this.paddleW) / 2;
    this.refresh();
    this.running = true;
    this.hooks.onOverlay({ show: false, title: "", sub: "", btn: "" });
    this.serve(Math.random() > 0.5);
  }
  private matchOver(won: boolean) {
    this.over = true;
    this.running = false;
    Lovense.mute();
    const best = saveBestScore("pong", this.player);
    this.hooks.onOverlay({
      show: true,
      title: won ? "VICTOIRE" : "DÉFAITE",
      sub: `${this.player} - ${this.ai}${best > this.player ? ` · Record : ${best}` : " · Nouveau record !"}`,
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
