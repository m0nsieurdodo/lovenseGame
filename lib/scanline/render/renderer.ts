/* ============================================================
   RENDERER — canvas : scanline, notes (tap/hold), anneaux
   d'approche, popups de jugement, combo. Aucune logique de jeu :
   il dessine l'état fourni (notes runtime + heure audio).
   ============================================================ */
import { beatDurMs } from "../engine/beatmap";
import type { NoteRuntime } from "../engine/game-engine";
import type { Judgement } from "../engine/judgement";
import { scanlineDir, scanlineY } from "../engine/scanline";

const COLORS = {
  cyan: "#00e5ff",
  violet: "#a78bfa",
  rose: "#ff2d95",
  amber: "#ffcc55",
  danger: "#ff4d6d",
  ink: "#eae6ff",
  muted: "#8b86ad",
};

const JUDGEMENT_STYLE: Record<Judgement, { label: string; color: string }> = {
  perfect: { label: "PERFECT", color: COLORS.cyan },
  great: { label: "GREAT", color: COLORS.violet },
  good: { label: "GOOD", color: COLORS.amber },
  miss: { label: "MISS", color: COLORS.danger },
};

const TOP_PAD = 64; // zone combo
const BOT_PAD = 26;
const NOTE_R = 22;
const POPUP_MS = 600;

export interface DrawState {
  tMs: number;
  beat: number;
  notes: readonly NoteRuntime[];
  combo: number;
  bpm: number;
  cycleBeats: number;
  countdownMs: number | null; // lead-in restant, null une fois la piste lancée
}

export class ScanlineRenderer {
  private ctx: CanvasRenderingContext2D;
  private w = 0;
  private h = 0;

  constructor(private canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D indisponible");
    this.ctx = ctx;
  }

  /** Adapte le buffer au conteneur (DPR-aware). */
  fit(): void {
    const parent = this.canvas.parentElement;
    if (!parent) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.w = parent.clientWidth;
    this.h = parent.clientHeight;
    this.canvas.width = Math.round(this.w * dpr);
    this.canvas.height = Math.round(this.h * dpr);
    this.canvas.style.width = `${this.w}px`;
    this.canvas.style.height = `${this.h}px`;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  /* ---- mapping coordonnées normalisées ↔ pixels ---- */
  private px(x: number): number {
    return x * this.w;
  }
  private py(y: number): number {
    return TOP_PAD + y * (this.h - TOP_PAD - BOT_PAD);
  }
  /** Pointeur → coordonnées normalisées du jeu (pour le matching des taps). */
  clientToNorm(clientX: number, clientY: number): { x: number; y: number } {
    const r = this.canvas.getBoundingClientRect();
    const x = (clientX - r.left) / r.width;
    const y = (clientY - r.top - TOP_PAD * (r.height / this.h)) / ((r.height / this.h) * (this.h - TOP_PAD - BOT_PAD));
    return { x, y };
  }

  draw(s: DrawState): void {
    const { ctx } = this;
    ctx.clearRect(0, 0, this.w, this.h);

    // Pulsation de fond sur le beat.
    const frac = ((s.beat % 1) + 1) % 1;
    ctx.fillStyle = `rgba(0,229,255,${Math.max(0, 0.045 * (1 - frac))})`;
    ctx.fillRect(0, 0, this.w, this.h);

    const beatMs = beatDurMs(s.bpm);
    const sweepMs = s.cycleBeats * beatMs;

    // Notes (les plus proches dans le temps par-dessus).
    const visible = s.notes.filter((n) => {
      const dt = n.note.timeMs - s.tMs;
      if (n.state === "idle") return dt < sweepMs * 2 && dt > -300;
      if (n.state === "holding") return true;
      return s.tMs - n.resolvedAtMs < POPUP_MS; // résolue : le temps du popup
    });
    for (const n of [...visible].reverse()) this.drawNote(n, s, sweepMs);

    // Scanline par-dessus les notes.
    this.drawScanline(s);

    // Combo centré en haut.
    if (s.combo >= 2) {
      ctx.textAlign = "center";
      ctx.fillStyle = COLORS.ink;
      ctx.shadowColor = COLORS.cyan;
      ctx.shadowBlur = 14;
      ctx.font = "800 26px ui-monospace, monospace";
      ctx.fillText(`${s.combo}`, this.w / 2, 34);
      ctx.shadowBlur = 0;
      ctx.fillStyle = COLORS.muted;
      ctx.font = "600 9px ui-monospace, monospace";
      ctx.fillText("C O M B O", this.w / 2, 48);
    }

    // Compte à rebours du lead-in.
    if (s.countdownMs !== null && s.countdownMs > 0) {
      ctx.textAlign = "center";
      ctx.fillStyle = COLORS.cyan;
      ctx.shadowColor = COLORS.cyan;
      ctx.shadowBlur = 20;
      ctx.font = "800 44px ui-monospace, monospace";
      ctx.fillText(`${Math.ceil(s.countdownMs / 1000)}`, this.w / 2, this.h / 2);
      ctx.shadowBlur = 0;
    }
  }

  private drawScanline(s: DrawState): void {
    const { ctx } = this;
    const y = this.py(scanlineY(s.beat, s.cycleBeats));
    const dir = scanlineDir(s.beat, s.cycleBeats);

    const grad = ctx.createLinearGradient(0, 0, this.w, 0);
    grad.addColorStop(0, "rgba(0,229,255,0)");
    grad.addColorStop(0.5, COLORS.cyan);
    grad.addColorStop(1, "rgba(255,45,149,0)");
    ctx.strokeStyle = grad;
    ctx.lineWidth = 2;
    ctx.shadowColor = COLORS.cyan;
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(this.w, y);
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Chevrons de direction aux bords.
    ctx.fillStyle = COLORS.cyan;
    for (const bx of [10, this.w - 10]) {
      ctx.beginPath();
      ctx.moveTo(bx - 4, y - 4 * dir);
      ctx.lineTo(bx + 4, y - 4 * dir);
      ctx.lineTo(bx, y + 5 * dir);
      ctx.closePath();
      ctx.fill();
    }
  }

  private drawNote(n: NoteRuntime, s: DrawState, sweepMs: number): void {
    const { ctx } = this;
    const x = this.px(n.note.x);
    const y = this.py(n.note.y);
    const dt = n.note.timeMs - s.tMs;

    // Popup de jugement pour les notes résolues.
    if (n.state === "hit" || n.state === "missed") {
      this.drawPopup(n, s.tMs, x, y);
      return;
    }

    // Fondu d'apparition : pleine opacité une demi-traversée avant la frappe.
    const alpha = n.state === "holding" ? 1 : Math.max(0.12, Math.min(1, 2 - dt / sweepMs));
    ctx.globalAlpha = alpha;

    // Corps de hold : capsule entre y(tête) et y(fin).
    if (n.note.type === "hold") {
      const y2 = this.py(n.note.yEnd);
      ctx.strokeStyle = "rgba(167,139,250,0.28)";
      ctx.lineWidth = NOTE_R * 1.7;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x, y2);
      ctx.stroke();
      if (n.state === "holding") {
        // Progression : remplit de la tête jusqu'à la scanline.
        const yNow = this.py(scanlineY(s.beat, s.cycleBeats));
        ctx.strokeStyle = "rgba(167,139,250,0.75)";
        ctx.lineWidth = NOTE_R * 1.1;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x, Math.max(Math.min(yNow, Math.max(y, y2)), Math.min(y, y2)));
        ctx.stroke();
      }
    }

    // Anneau d'approche (se resserre jusqu'à l'instant de frappe).
    if (n.state === "idle" && dt > 0 && dt < sweepMs) {
      const k = 1 + 1.3 * (dt / sweepMs);
      ctx.strokeStyle = n.note.type === "hold" ? COLORS.violet : COLORS.cyan;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(x, y, NOTE_R * k, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Pastille.
    const main = n.note.type === "hold" ? COLORS.violet : COLORS.cyan;
    const glow = n.state === "holding" ? 22 : 10;
    ctx.shadowColor = main;
    ctx.shadowBlur = glow;
    const g = ctx.createRadialGradient(x, y, 2, x, y, NOTE_R);
    g.addColorStop(0, "#ffffff");
    g.addColorStop(0.35, main);
    g.addColorStop(1, "rgba(6,4,15,0.9)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, NOTE_R, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = main;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, NOTE_R, 0, Math.PI * 2);
    ctx.stroke();

    ctx.globalAlpha = 1;
  }

  private drawPopup(n: NoteRuntime, tMs: number, x: number, y: number): void {
    const { ctx } = this;
    const j = n.displayJudgement;
    if (!j) return;
    const age = tMs - n.resolvedAtMs;
    if (age < 0 || age > POPUP_MS) return;
    const k = age / POPUP_MS;
    const style = JUDGEMENT_STYLE[j];

    // Onde de choc sur les frappes réussies.
    if (j !== "miss") {
      ctx.globalAlpha = (1 - k) * 0.6;
      ctx.strokeStyle = style.color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, NOTE_R * (1 + k * 1.6), 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.globalAlpha = 1 - k;
    ctx.textAlign = "center";
    ctx.fillStyle = style.color;
    ctx.shadowColor = style.color;
    ctx.shadowBlur = 10;
    ctx.font = "800 15px ui-monospace, monospace";
    ctx.fillText(style.label, x, y - NOTE_R - 8 - k * 18);
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
  }
}
