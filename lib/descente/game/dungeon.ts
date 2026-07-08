/* ============================================================
   DESCENTE — Génération procédurale d'un étage.
   Grille de salles connectées (style Binding of Isaac) : marche aléatoire
   depuis la salle de départ, boss greffé sur la salle la plus lointaine,
   une salle trésor avec une relique non possédée.
   ============================================================ */
import { clamp } from "../engine/curves";
import { RELICS } from "../engine/relics";

export type RoomType = "start" | "normal" | "treasure" | "boss";
export type DoorDir = "n" | "s" | "e" | "w";

export interface RoomSpec {
  key: string;
  x: number;
  y: number;
  type: RoomType;
  danger: number; // 1-3 : dimensionne ennemis, pièges et spikes de heat
  cleared: boolean;
  visited: boolean;
  relicId?: string;
  relicTaken?: boolean;
}

export interface Dungeon {
  rooms: Map<string, RoomSpec>;
  start: RoomSpec;
}

export const roomKey = (x: number, y: number) => `${x},${y}`;

const DIRS: Record<DoorDir, [number, number]> = { n: [0, -1], s: [0, 1], e: [1, 0], w: [-1, 0] };

export function neighbors(d: Dungeon, room: RoomSpec): Partial<Record<DoorDir, RoomSpec>> {
  const out: Partial<Record<DoorDir, RoomSpec>> = {};
  (Object.keys(DIRS) as DoorDir[]).forEach((dir) => {
    const [dx, dy] = DIRS[dir];
    const nb = d.rooms.get(roomKey(room.x + dx, room.y + dy));
    if (nb) out[dir] = nb;
  });
  return out;
}

export function generateDungeon(floor: number, ownedRelics: string[], rng: () => number = Math.random): Dungeon {
  const rooms = new Map<string, RoomSpec>();
  const add = (x: number, y: number, type: RoomType): RoomSpec => {
    const room: RoomSpec = {
      key: roomKey(x, y),
      x,
      y,
      type,
      danger: 1,
      cleared: type === "start" || type === "treasure",
      visited: type === "start",
    };
    rooms.set(room.key, room);
    return room;
  };

  const start = add(0, 0, "start");

  // 5-8 salles (départ inclus) par marche aléatoire sur la grille.
  const targetCount = 5 + Math.floor(rng() * 4);
  let guard = 0;
  while (rooms.size < targetCount && guard++ < 500) {
    const list = [...rooms.values()];
    const from = list[Math.floor(rng() * list.length)];
    const dir = (Object.values(DIRS) as [number, number][])[Math.floor(rng() * 4)];
    const [x, y] = [from.x + dir[0], from.y + dir[1]];
    if (!rooms.has(roomKey(x, y))) add(x, y, "normal");
  }

  // Boss : greffé sur une case vide adjacente à la salle la plus lointaine possible.
  const byDistance = [...rooms.values()].sort(
    (a, b) => Math.abs(b.x) + Math.abs(b.y) - (Math.abs(a.x) + Math.abs(a.y)),
  );
  outer: for (const from of byDistance) {
    for (const [dx, dy] of Object.values(DIRS)) {
      const [x, y] = [from.x + dx, from.y + dy];
      if (!rooms.has(roomKey(x, y))) {
        const boss = add(x, y, "boss");
        boss.cleared = false;
        boss.danger = 3;
        break outer;
      }
    }
  }

  // Salle trésor : une salle normale devient sûre et abrite une relique non possédée.
  const pool = RELICS.filter((r) => !ownedRelics.includes(r.id));
  const normals = [...rooms.values()].filter((r) => r.type === "normal");
  if (pool.length > 0 && normals.length > 1) {
    const room = normals[Math.floor(rng() * normals.length)];
    room.type = "treasure";
    room.cleared = true;
    room.relicId = pool[Math.floor(rng() * pool.length)].id;
  }

  // Danger croissant avec la distance au départ (les meilleurs loots sont loin).
  rooms.forEach((r) => {
    if (r.type === "normal") r.danger = clamp(1 + Math.floor((Math.abs(r.x) + Math.abs(r.y)) / 2), 1, 3);
  });

  return { rooms, start };
}
