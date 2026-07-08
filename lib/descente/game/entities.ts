/* ============================================================
   DESCENTE — Entités : joueur, ennemis, pièges + fabriques de spawn.
   Coordonnées logiques : salle de ROOM_W × ROOM_H, murs de WALL px.
   ============================================================ */

export const ROOM_W = 480;
export const ROOM_H = 320;
export const WALL = 18;
export const DOOR_W = 64;

export interface Vec {
  x: number;
  y: number;
}

export interface Player {
  x: number;
  y: number;
  r: number;
  hp: number;
  maxHp: number;
  speed: number;
  face: Vec; // dernière direction de déplacement (attaque)
  iframesMs: number;
  attackCdMs: number;
  attackAnimMs: number;
  attackFace: Vec;
}

export function createPlayer(): Player {
  return {
    x: ROOM_W / 2,
    y: ROOM_H / 2,
    r: 10,
    hp: 6,
    maxHp: 6,
    speed: 170,
    face: { x: 1, y: 0 },
    iframesMs: 0,
    attackCdMs: 0,
    attackAnimMs: 0,
    attackFace: { x: 1, y: 0 },
  };
}

export type EnemyKind = "blob" | "rusher" | "boss";

export interface Enemy {
  kind: EnemyKind;
  x: number;
  y: number;
  r: number;
  hp: number;
  maxHp: number;
  speed: number;
  touchDamage: number;
  hitMs: number; // flash de dégât
  dashCdMs: number; // boss : compte à rebours avant charge
  dashMs: number; // boss : durée de charge restante
  dashDir: Vec;
}

const enemy = (kind: EnemyKind, x: number, y: number, hp: number, r: number, speed: number, touchDamage: number): Enemy => ({
  kind, x, y, r, hp, maxHp: hp, speed, touchDamage, hitMs: 0, dashCdMs: 2200, dashMs: 0, dashDir: { x: 0, y: 0 },
});

/** Position de spawn dans la salle, loin du joueur (il vient d'entrer). */
function spawnPos(player: Vec, rng: () => number): Vec {
  for (let i = 0; i < 30; i++) {
    const x = WALL + 50 + rng() * (ROOM_W - 2 * (WALL + 50));
    const y = WALL + 45 + rng() * (ROOM_H - 2 * (WALL + 45));
    if (Math.hypot(x - player.x, y - player.y) > 95) return { x, y };
  }
  return { x: ROOM_W / 2, y: ROOM_H / 2 };
}

export function spawnEnemies(
  type: "normal" | "boss",
  danger: number,
  floor: number,
  player: Vec,
  rng: () => number = Math.random,
): Enemy[] {
  if (type === "boss") {
    return [enemy("boss", ROOM_W / 2, ROOM_H / 3, 16 + 6 * (floor - 1), 26, 60, 2)];
  }
  const count = 1 + danger + Math.min(3, floor - 1);
  const out: Enemy[] = [];
  for (let i = 0; i < count; i++) {
    const p = spawnPos(player, rng);
    const rusher = danger >= 2 && rng() < 0.35;
    out.push(
      rusher
        ? enemy("rusher", p.x, p.y, 1, 9, 125 + 5 * floor, 1)
        : enemy("blob", p.x, p.y, 2 + Math.floor((floor - 1) / 2), 12, 65 + 8 * danger, 1),
    );
  }
  return out;
}

export interface Trap {
  x: number;
  y: number;
  r: number;
  cycleMs: number;
  onMs: number;
  phaseMs: number;
  active: boolean;
}

export function spawnTraps(danger: number, player: Vec, rng: () => number = Math.random): Trap[] {
  if (danger < 2) return [];
  const count = 1 + (rng() < 0.5 ? 1 : 0);
  const out: Trap[] = [];
  for (let i = 0; i < count; i++) {
    const p = spawnPos(player, rng);
    out.push({ x: p.x, y: p.y, r: 16, cycleMs: 1600, onMs: 620, phaseMs: rng() * 1600, active: false });
  }
  return out;
}
