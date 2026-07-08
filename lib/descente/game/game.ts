/* ============================================================
   DESCENTE — Boucle de jeu (rAF, dt en ms).
   Ne connaît JAMAIS l'intensité brute du toy : elle émet des événements
   sémantiques sur l'EventBus, le HapticDirector fait le reste.
   ============================================================ */
import type { Overlay } from "@/lib/engine-types";
import { HapticDirector, type HapticFrame } from "../engine/director";
import type { CurveKind } from "../engine/curves";
import { getRelic } from "../engine/relics";
import { EventBus } from "../events";
import type { LovenseToy } from "../lovense/controller";
import { render, type MinimapCell, type RenderState } from "../render/renderer";
import { generateDungeon, neighbors, type DoorDir, type Dungeon, type RoomSpec } from "./dungeon";
import {
  createPlayer,
  DOOR_W,
  ROOM_H,
  ROOM_W,
  spawnEnemies,
  spawnTraps,
  WALL,
  type Enemy,
  type Player,
  type Trap,
} from "./entities";

export interface DescenteStats {
  hp: number;
  maxHp: number;
  floor: number;
  cleared: number;
  total: number;
  relics: string[];
  haptic: HapticFrame;
}

export interface DescenteHooks {
  onStats: (s: DescenteStats) => void;
  onOverlay: (o: Overlay) => void;
  onToast?: (msg: string) => void;
}

type MoveDir = "up" | "down" | "left" | "right";

const DEATH_MS = 1700; // laisse la décharge (~1.5 s) se jouer avant l'écran de fin
const DESCEND_MS = 1100;

export class DescenteGame {
  readonly bus = new EventBus();
  readonly director: HapticDirector;

  private ctx: CanvasRenderingContext2D;
  private dungeon!: Dungeon;
  private room!: RoomSpec;
  private player: Player = createPlayer();
  private enemies: Enemy[] = [];
  private traps: Trap[] = [];
  private relics: string[] = [];
  private floor = 1;

  private running = false;
  private paused = false;
  private dying = false;
  private over = false;
  private deathMs = 0;
  private descendMs = 0;

  private move: Record<MoveDir, boolean> = { up: false, down: false, left: false, right: false };
  private raf = 0;
  private lastT = 0;
  private statsAcc = 999; // pousse les stats dès la première frame
  private lastFrame: HapticFrame = { heat: 0, state: "idle", intensity: 0, killed: false };

  constructor(
    private canvas: HTMLCanvasElement,
    private hooks: DescenteHooks,
    toy: LovenseToy,
  ) {
    this.ctx = canvas.getContext("2d")!;
    this.director = new HapticDirector(this.bus, toy);
    this.newFloor(1); // décor visible derrière l'overlay d'accueil
    this.raf = requestAnimationFrame(this.loop);
  }

  /* ---------- runs / étages ---------- */

  start() {
    this.relics = [];
    this.player = createPlayer();
    this.over = false;
    this.dying = false;
    this.paused = false;
    this.deathMs = 0;
    this.descendMs = 0;
    this.director.resetRun();
    this.newFloor(1);
    this.running = true;
    this.hooks.onOverlay({ show: false, title: "", sub: "", btn: "" });
  }

  private newFloor(floor: number) {
    this.floor = floor;
    this.dungeon = generateDungeon(floor, this.relics);
    this.enterRoom(this.dungeon.start, null);
  }

  private descend() {
    this.descendMs = 0;
    const next = this.floor + 1;
    this.bus.emit({ type: "floor_descend", floor: next });
    this.hooks.onToast?.(`ÉTAGE ${next} — la descente continue`);
    this.newFloor(next);
  }

  /* ---------- salles ---------- */

  private enterRoom(spec: RoomSpec, from: DoorDir | null) {
    this.room = spec;
    spec.visited = true;
    this.traps = [];
    this.enemies = [];

    const p = this.player;
    if (from === "n") { p.x = ROOM_W / 2; p.y = ROOM_H - WALL - p.r - 8; }
    else if (from === "s") { p.x = ROOM_W / 2; p.y = WALL + p.r + 8; }
    else if (from === "e") { p.x = WALL + p.r + 8; p.y = ROOM_H / 2; }
    else if (from === "w") { p.x = ROOM_W - WALL - p.r - 8; p.y = ROOM_H / 2; }
    else { p.x = ROOM_W / 2; p.y = ROOM_H * 0.7; }

    this.bus.emit({ type: "enter_room", safe: spec.cleared, danger: spec.danger });

    if (!spec.cleared && (spec.type === "normal" || spec.type === "boss")) {
      this.enemies = spawnEnemies(spec.type, spec.danger, this.floor, p);
      if (spec.type === "normal") this.traps = spawnTraps(spec.danger, p);
      this.bus.emit({ type: "combat_start", enemies: this.enemies.length, danger: spec.danger });
    }
  }

  private transition(dir: DoorDir) {
    const nb = neighbors(this.dungeon, this.room)[dir];
    if (!nb) return;
    // le joueur entre par la porte opposée
    const opposite: Record<DoorDir, DoorDir> = { n: "s", s: "n", e: "w", w: "e" };
    this.enterRoom(nb, opposite[dir]);
  }

  /* ---------- boucle ---------- */

  private canPlay() {
    return this.running && !this.paused && !this.dying && !this.over;
  }

  /** Exposé au risque = salle non nettoyée (le heat monte). Salle sûre = decay. */
  private exposed() {
    return this.canPlay() && !this.room.cleared;
  }

  private loop = (t: number) => {
    this.raf = requestAnimationFrame(this.loop);
    const dt = Math.min(50, this.lastT ? t - this.lastT : 16);
    this.lastT = t;
    this.tick(dt);
  };

  /** Avance la simulation de dtMs. Public : permet de piloter/déboguer sans rAF. */
  tick(dt: number) {
    if (!this.paused) {
      if (this.canPlay()) this.updateGame(dt);
      if (this.dying) {
        this.deathMs -= dt;
        if (this.deathMs <= 0) this.finishDeath();
      }
      if (this.descendMs > 0) {
        this.descendMs -= dt;
        if (this.descendMs <= 0) this.descend();
      }
      // Le directeur tourne aussi pendant la mort (décharge) et les menus (decay).
      this.lastFrame = this.director.update(dt, this.exposed());
    }

    this.draw();
    this.statsAcc += dt;
    if (this.statsAcc >= 100) {
      this.statsAcc = 0;
      this.pushStats();
    }
  }

  private updateGame(dt: number) {
    this.updatePlayer(dt);
    this.updateEnemies(dt);
    this.updateTraps(dt);

    // Ramassage de relique (salle trésor)
    const r = this.room;
    if (r.type === "treasure" && r.relicId && !r.relicTaken) {
      if (Math.hypot(this.player.x - ROOM_W / 2, this.player.y - ROOM_H / 2) < 26) {
        r.relicTaken = true;
        this.relics.push(r.relicId);
        this.bus.emit({ type: "relic_pickup", relicId: r.relicId });
        this.hooks.onToast?.(`Relique : ${getRelic(r.relicId)?.name ?? r.relicId}`);
      }
    }

    // Fin de combat
    if (!r.cleared && this.enemies.length === 0 && (r.type === "normal" || r.type === "boss")) {
      r.cleared = true;
      this.bus.emit({ type: "room_cleared" });
      if (r.type === "boss") this.descendMs = DESCEND_MS;
    }
  }

  private updatePlayer(dt: number) {
    const p = this.player;
    p.iframesMs = Math.max(0, p.iframesMs - dt);
    p.attackCdMs = Math.max(0, p.attackCdMs - dt);
    p.attackAnimMs = Math.max(0, p.attackAnimMs - dt);

    let vx = (this.move.right ? 1 : 0) - (this.move.left ? 1 : 0);
    let vy = (this.move.down ? 1 : 0) - (this.move.up ? 1 : 0);
    if (vx !== 0 || vy !== 0) {
      const n = Math.hypot(vx, vy);
      vx /= n; vy /= n;
      p.face = { x: vx, y: vy };
      p.x += vx * p.speed * (dt / 1000);
      p.y += vy * p.speed * (dt / 1000);
    }

    // Murs + franchissement de portes (uniquement salle nettoyée = portes ouvertes)
    const open = this.room.cleared;
    const nbs = neighbors(this.dungeon, this.room);
    const inBandX = Math.abs(p.x - ROOM_W / 2) < DOOR_W / 2 - 8;
    const inBandY = Math.abs(p.y - ROOM_H / 2) < DOOR_W / 2 - 8;

    if (p.y < WALL + p.r) {
      if (open && nbs.n && inBandX) { if (p.y < p.r) return this.transition("n"); }
      else p.y = WALL + p.r;
    }
    if (p.y > ROOM_H - WALL - p.r) {
      if (open && nbs.s && inBandX) { if (p.y > ROOM_H - p.r) return this.transition("s"); }
      else p.y = ROOM_H - WALL - p.r;
    }
    if (p.x < WALL + p.r) {
      if (open && nbs.w && inBandY) { if (p.x < p.r) return this.transition("w"); }
      else p.x = WALL + p.r;
    }
    if (p.x > ROOM_W - WALL - p.r) {
      if (open && nbs.e && inBandY) { if (p.x > ROOM_W - p.r) return this.transition("e"); }
      else p.x = ROOM_W - WALL - p.r;
    }
  }

  private updateEnemies(dt: number) {
    const p = this.player;
    for (const e of this.enemies) {
      e.hitMs = Math.max(0, e.hitMs - dt);
      const dx = p.x - e.x, dy = p.y - e.y;
      const d = Math.hypot(dx, dy) || 1;

      if (e.kind === "boss") {
        e.dashCdMs -= dt;
        if (e.dashMs > 0) {
          e.dashMs -= dt;
          e.x += e.dashDir.x * 270 * (dt / 1000);
          e.y += e.dashDir.y * 270 * (dt / 1000);
        } else {
          if (e.dashCdMs <= 0) {
            e.dashMs = 420;
            e.dashCdMs = 2400;
            e.dashDir = { x: dx / d, y: dy / d };
          }
          e.x += (dx / d) * e.speed * (dt / 1000);
          e.y += (dy / d) * e.speed * (dt / 1000);
        }
      } else {
        e.x += (dx / d) * e.speed * (dt / 1000);
        e.y += (dy / d) * e.speed * (dt / 1000);
      }

      e.x = Math.max(WALL + e.r, Math.min(ROOM_W - WALL - e.r, e.x));
      e.y = Math.max(WALL + e.r, Math.min(ROOM_H - WALL - e.r, e.y));

      // Contact → dégâts au joueur
      if (p.iframesMs <= 0 && Math.hypot(p.x - e.x, p.y - e.y) < p.r + e.r) {
        this.damagePlayer(e.touchDamage, "enemy", e);
      }
    }

    // Séparation naïve entre ennemis
    for (let i = 0; i < this.enemies.length; i++) {
      for (let j = i + 1; j < this.enemies.length; j++) {
        const a = this.enemies[i], b = this.enemies[j];
        const dx = b.x - a.x, dy = b.y - a.y;
        const d = Math.hypot(dx, dy) || 1;
        const overlap = a.r + b.r - d;
        if (overlap > 0) {
          const push = overlap / 2;
          a.x -= (dx / d) * push; a.y -= (dy / d) * push;
          b.x += (dx / d) * push; b.y += (dy / d) * push;
        }
      }
    }
  }

  private updateTraps(dt: number) {
    const p = this.player;
    for (const t of this.traps) {
      t.phaseMs = (t.phaseMs + dt) % t.cycleMs;
      t.active = t.phaseMs < t.onMs;
      if (t.active && p.iframesMs <= 0 && Math.hypot(p.x - t.x, p.y - t.y) < p.r + t.r - 5) {
        this.damagePlayer(1, "trap");
      }
    }
  }

  private damagePlayer(amount: number, source: "enemy" | "trap", from?: Enemy) {
    const p = this.player;
    p.hp -= amount;
    p.iframesMs = 900;
    if (source === "trap") this.bus.emit({ type: "trap_triggered", damage: amount });
    else this.bus.emit({ type: "took_damage", amount });

    if (from) {
      // recul à l'opposé de l'ennemi
      const dx = p.x - from.x, dy = p.y - from.y;
      const d = Math.hypot(dx, dy) || 1;
      p.x = Math.max(WALL + p.r, Math.min(ROOM_W - WALL - p.r, p.x + (dx / d) * 30));
      p.y = Math.max(WALL + p.r, Math.min(ROOM_H - WALL - p.r, p.y + (dy / d) * 30));
    }

    if (p.hp <= 0) {
      p.hp = 0;
      this.dying = true;
      this.deathMs = DEATH_MS;
      this.bus.emit({ type: "player_death" }); // → décharge puis coupure
    }
  }

  private finishDeath() {
    this.dying = false;
    this.over = true;
    this.running = false;
    this.hooks.onOverlay({
      show: true,
      title: "TU AS SUCCOMBÉ",
      sub: `L'étage ${this.floor} t'a eu. Reliques : ${this.relics.length ? this.relics.map((id) => getRelic(id)?.icon ?? "?").join(" ") : "aucune"}`,
      btn: "↻ Nouvelle descente",
    });
  }

  /* ---------- entrées ---------- */

  setMove(dir: MoveDir, down: boolean) {
    this.move[dir] = down;
  }

  attack() {
    const p = this.player;
    if (!this.canPlay() || p.attackCdMs > 0) return;
    p.attackCdMs = 380;
    p.attackAnimMs = 140;
    p.attackFace = { ...p.face };

    const dead: Enemy[] = [];
    for (const e of this.enemies) {
      const dx = e.x - p.x, dy = e.y - p.y;
      const d = Math.hypot(dx, dy) || 1;
      if (d > 46 + e.r) continue;
      const dot = (dx / d) * p.attackFace.x + (dy / d) * p.attackFace.y;
      if (dot < 0.35) continue;
      e.hp -= 1;
      e.hitMs = 120;
      const kb = e.kind === "boss" ? 8 : 24;
      e.x += (dx / d) * kb;
      e.y += (dy / d) * kb;
      if (e.hp <= 0) dead.push(e);
    }
    if (dead.length) this.enemies = this.enemies.filter((e) => !dead.includes(e));
  }

  togglePause() {
    if (!this.running || this.over || this.dying) return;
    this.paused = !this.paused;
    if (this.paused) {
      this.director.mute();
      this.hooks.onOverlay({ show: true, title: "PAUSE", sub: "Le heat est gelé. Reprends quand tu veux.", btn: "▶ Reprendre" });
    } else {
      this.hooks.onOverlay({ show: false, title: "", sub: "", btn: "" });
    }
  }
  isPaused() {
    return this.paused;
  }
  isRunning() {
    return this.running && !this.over;
  }

  /* ---------- haptique (contrôles UI) ---------- */

  killSwitch() {
    this.director.killSwitch();
    this.pushStats();
  }
  rearm() {
    this.director.rearm();
    this.pushStats();
  }
  setCurve(curve: CurveKind) {
    this.director.engine.curve = curve;
  }

  /* ---------- sorties ---------- */

  private pushStats() {
    const combatRooms = [...this.dungeon.rooms.values()].filter((r) => r.type === "normal" || r.type === "boss");
    this.hooks.onStats({
      hp: this.player.hp,
      maxHp: this.player.maxHp,
      floor: this.floor,
      cleared: combatRooms.filter((r) => r.cleared).length,
      total: combatRooms.length,
      relics: [...this.relics],
      haptic: this.lastFrame,
    });
  }

  private draw() {
    const nbs = neighbors(this.dungeon, this.room);
    const minimap: MinimapCell[] = [];
    const seen = new Set<string>();
    for (const r of this.dungeon.rooms.values()) {
      const nb = neighbors(this.dungeon, r);
      const revealed = r.visited || Object.values(nb).some((n) => n?.visited);
      if (!revealed || seen.has(r.key)) continue;
      seen.add(r.key);
      minimap.push({ x: r.x, y: r.y, type: r.type, visited: r.visited, cleared: r.cleared, current: r === this.room });
    }

    const state: RenderState = {
      heat: this.lastFrame.heat,
      roomType: this.room.type,
      doors: (Object.keys(nbs) as DoorDir[]).map((dir) => ({ dir, open: this.room.cleared })),
      player: this.player,
      dying: this.dying || this.over,
      enemies: this.enemies,
      traps: this.traps,
      relic:
        this.room.type === "treasure" && this.room.relicId
          ? { icon: getRelic(this.room.relicId)?.icon ?? "◆", taken: !!this.room.relicTaken }
          : undefined,
      minimap,
    };
    render(this.ctx, state);
  }

  /* ---------- dimensionnement responsive (ratio 3:2) ---------- */

  fit() {
    const stage = this.canvas.parentElement;
    if (!stage) return;
    const availW = stage.clientWidth, availH = stage.clientHeight;
    if (availW < 20 || availH < 20) return;
    const w = Math.min(availW, availH * (ROOM_W / ROOM_H));
    const scale = w / ROOM_W;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.style.width = `${Math.floor(w)}px`;
    this.canvas.style.height = `${Math.floor(w / (ROOM_W / ROOM_H))}px`;
    this.canvas.width = Math.round(ROOM_W * scale * dpr);
    this.canvas.height = Math.round(ROOM_H * scale * dpr);
    this.ctx.setTransform(dpr * scale, 0, 0, dpr * scale, 0, 0);
    this.draw();
  }

  destroy() {
    cancelAnimationFrame(this.raf);
    this.director.destroy();
  }
}
