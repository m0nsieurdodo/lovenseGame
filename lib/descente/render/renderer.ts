/* ============================================================
   DESCENTE — Rendu canvas top-down néon (une salle visible à la fois).
   Purement passif : reçoit un RenderState assemblé par la boucle de jeu.
   ============================================================ */
import type { DoorDir, RoomType } from "../game/dungeon";
import { DOOR_W, ROOM_H, ROOM_W, WALL, type Enemy, type Player, type Trap } from "../game/entities";

export interface DoorView {
  dir: DoorDir;
  open: boolean;
}

export interface MinimapCell {
  x: number;
  y: number;
  type: RoomType;
  visited: boolean;
  cleared: boolean;
  current: boolean;
}

export interface RenderState {
  heat: number; // 0-100 → vignette rouge
  roomType: RoomType;
  doors: DoorView[];
  player: Player;
  dying: boolean;
  enemies: Enemy[];
  traps: Trap[];
  relic?: { icon: string; taken: boolean };
  minimap: MinimapCell[];
}

const DOOR_POS: Record<DoorDir, { x: number; y: number; w: number; h: number }> = {
  n: { x: ROOM_W / 2 - DOOR_W / 2, y: 0, w: DOOR_W, h: WALL },
  s: { x: ROOM_W / 2 - DOOR_W / 2, y: ROOM_H - WALL, w: DOOR_W, h: WALL },
  w: { x: 0, y: ROOM_H / 2 - DOOR_W / 2, w: WALL, h: DOOR_W },
  e: { x: ROOM_W - WALL, y: ROOM_H / 2 - DOOR_W / 2, w: WALL, h: DOOR_W },
};

export function render(c: CanvasRenderingContext2D, s: RenderState) {
  c.clearRect(0, 0, ROOM_W, ROOM_H);

  // Sol : grille discrète
  c.strokeStyle = "#ffffff07";
  c.lineWidth = 1;
  for (let x = WALL; x <= ROOM_W - WALL; x += 32) {
    c.beginPath(); c.moveTo(x, WALL); c.lineTo(x, ROOM_H - WALL); c.stroke();
  }
  for (let y = WALL; y <= ROOM_H - WALL; y += 32) {
    c.beginPath(); c.moveTo(WALL, y); c.lineTo(ROOM_W - WALL, y); c.stroke();
  }

  // Murs
  c.fillStyle = s.roomType === "boss" ? "#3a1230" : "#221e3f";
  c.fillRect(0, 0, ROOM_W, WALL);
  c.fillRect(0, ROOM_H - WALL, ROOM_W, WALL);
  c.fillRect(0, 0, WALL, ROOM_H);
  c.fillRect(ROOM_W - WALL, 0, WALL, ROOM_H);

  // Portes : ouvertes = passage cyan lumineux, verrouillées = barreaux roses
  for (const d of s.doors) {
    const p = DOOR_POS[d.dir];
    c.fillStyle = "#0a0818";
    c.fillRect(p.x, p.y, p.w, p.h);
    if (d.open) {
      c.fillStyle = "#00e5ff";
      c.shadowColor = "#00e5ff";
      c.shadowBlur = 12;
      const horizontal = d.dir === "n" || d.dir === "s";
      if (horizontal) c.fillRect(p.x + 4, p.y + p.h / 2 - 2, p.w - 8, 4);
      else c.fillRect(p.x + p.w / 2 - 2, p.y + 4, 4, p.h - 8);
      c.shadowBlur = 0;
    } else {
      c.strokeStyle = "#ff3d7a";
      c.shadowColor = "#ff3d7a";
      c.shadowBlur = 8;
      c.lineWidth = 3;
      const horizontal = d.dir === "n" || d.dir === "s";
      for (let i = 1; i <= 3; i++) {
        c.beginPath();
        if (horizontal) {
          const x = p.x + (p.w / 4) * i;
          c.moveTo(x, p.y + 2); c.lineTo(x, p.y + p.h - 2);
        } else {
          const y = p.y + (p.h / 4) * i;
          c.moveTo(p.x + 2, y); c.lineTo(p.x + p.w - 2, y);
        }
        c.stroke();
      }
      c.shadowBlur = 0;
    }
  }

  // Pièges : pointes actives = triangles roses, inactives = pastilles sombres
  for (const t of s.traps) {
    c.beginPath();
    c.arc(t.x, t.y, t.r, 0, Math.PI * 2);
    c.fillStyle = "#14112a";
    c.fill();
    if (t.active) {
      c.fillStyle = "#ff3d7a";
      c.shadowColor = "#ff3d7a";
      c.shadowBlur = 10;
      for (let i = 0; i < 6; i++) {
        const a = (Math.PI * 2 * i) / 6;
        const cx = t.x + Math.cos(a) * t.r * 0.5;
        const cy = t.y + Math.sin(a) * t.r * 0.5;
        c.beginPath();
        c.moveTo(cx, cy - 5);
        c.lineTo(cx - 4, cy + 4);
        c.lineTo(cx + 4, cy + 4);
        c.closePath();
        c.fill();
      }
      c.shadowBlur = 0;
    } else {
      c.fillStyle = "#3a3670";
      for (let i = 0; i < 6; i++) {
        const a = (Math.PI * 2 * i) / 6;
        c.beginPath();
        c.arc(t.x + Math.cos(a) * t.r * 0.5, t.y + Math.sin(a) * t.r * 0.5, 1.6, 0, Math.PI * 2);
        c.fill();
      }
    }
  }

  // Piédestal de relique
  if (s.relic && !s.relic.taken) {
    const x = ROOM_W / 2, y = ROOM_H / 2;
    c.save();
    c.translate(x, y);
    c.rotate(Math.PI / 4);
    c.fillStyle = "#8a2be2";
    c.shadowColor = "#8a2be2";
    c.shadowBlur = 18;
    c.fillRect(-11, -11, 22, 22);
    c.restore();
    c.shadowBlur = 0;
    c.font = "16px sans-serif";
    c.textAlign = "center";
    c.fillText(s.relic.icon, x, y - 18);
  }

  // Ennemis
  for (const e of s.enemies) {
    const color = e.kind === "boss" ? "#ff2d55" : e.kind === "rusher" ? "#ff3df2" : "#8a2be2";
    c.beginPath();
    c.arc(e.x, e.y, e.r, 0, Math.PI * 2);
    c.fillStyle = e.hitMs > 0 ? "#ffffff" : color;
    c.shadowColor = color;
    c.shadowBlur = e.kind === "boss" ? 22 : 10;
    c.fill();
    c.shadowBlur = 0;
    if (e.kind === "boss") {
      // barre de vie du boss
      const w = 90;
      c.fillStyle = "#00000088";
      c.fillRect(e.x - w / 2, e.y - e.r - 14, w, 6);
      c.fillStyle = "#ff2d55";
      c.fillRect(e.x - w / 2, e.y - e.r - 14, (w * e.hp) / e.maxHp, 6);
    }
  }

  // Joueur (clignote pendant les i-frames, s'estompe pendant la mort)
  const p = s.player;
  const blink = p.iframesMs > 0 && Math.floor(p.iframesMs / 90) % 2 === 0;
  c.globalAlpha = s.dying ? 0.35 : blink ? 0.35 : 1;
  c.beginPath();
  c.arc(p.x, p.y, p.r, 0, Math.PI * 2);
  c.fillStyle = "#00e5ff";
  c.shadowColor = "#00e5ff";
  c.shadowBlur = 16;
  c.fill();
  c.shadowBlur = 0;
  // encoche de direction
  c.strokeStyle = "#06040f";
  c.lineWidth = 3;
  c.beginPath();
  c.moveTo(p.x, p.y);
  c.lineTo(p.x + p.face.x * p.r * 0.9, p.y + p.face.y * p.r * 0.9);
  c.stroke();
  c.globalAlpha = 1;

  // Arc d'attaque
  if (p.attackAnimMs > 0) {
    const a = Math.atan2(p.attackFace.y, p.attackFace.x);
    c.strokeStyle = "#eafcff";
    c.shadowColor = "#00e5ff";
    c.shadowBlur = 14;
    c.lineWidth = 5;
    c.globalAlpha = p.attackAnimMs / 140;
    c.beginPath();
    c.arc(p.x, p.y, 42, a - Math.PI / 3, a + Math.PI / 3);
    c.stroke();
    c.globalAlpha = 1;
    c.shadowBlur = 0;
  }

  // Vignette de heat : la salle "chauffe" visuellement avec l'exposition
  if (s.heat > 2) {
    const alpha = (s.heat / 100) * 0.5;
    c.strokeStyle = `rgba(255, 45, 85, ${alpha})`;
    c.shadowColor = "#ff2d55";
    c.shadowBlur = 26 * (s.heat / 100);
    c.lineWidth = 6;
    c.strokeRect(3, 3, ROOM_W - 6, ROOM_H - 6);
    c.shadowBlur = 0;
  }

  drawMinimap(c, s.minimap);
}

function drawMinimap(c: CanvasRenderingContext2D, cells: MinimapCell[]) {
  if (cells.length === 0) return;
  const CELL = 11, GAP = 2;
  const minX = Math.min(...cells.map((r) => r.x));
  const minY = Math.min(...cells.map((r) => r.y));
  const maxX = Math.max(...cells.map((r) => r.x));
  const maxY = Math.max(...cells.map((r) => r.y));
  const w = (maxX - minX + 1) * (CELL + GAP);
  const h = (maxY - minY + 1) * (CELL + GAP);
  const ox = ROOM_W - w - 12, oy = 12;

  c.fillStyle = "#05040cbb";
  c.fillRect(ox - 4, oy - 4, w + 8, h + 8);

  for (const r of cells) {
    const x = ox + (r.x - minX) * (CELL + GAP);
    const y = oy + (r.y - minY) * (CELL + GAP);
    if (!r.visited) {
      c.strokeStyle = "#3a3670";
      c.lineWidth = 1;
      c.strokeRect(x, y, CELL, CELL);
      continue;
    }
    c.fillStyle = r.current
      ? "#00e5ff"
      : r.type === "boss"
        ? "#ff2d55"
        : r.type === "treasure"
          ? "#ffc94d"
          : r.cleared
            ? "#3a3670"
            : "#8a2be2";
    c.fillRect(x, y, CELL, CELL);
  }
}
