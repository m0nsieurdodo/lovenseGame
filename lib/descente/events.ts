/* ============================================================
   DESCENTE — Event bus sémantique.
   Découplage strict : la boucle de jeu émet ces événements et ne connaît
   JAMAIS l'intensité brute ; le HapticDirector les traduit en heat/spikes.
   ============================================================ */

export type GameEvent =
  | { type: "enter_room"; safe: boolean; danger: number }
  | { type: "combat_start"; enemies: number; danger: number }
  | { type: "took_damage"; amount: number }
  | { type: "trap_triggered"; damage: number }
  | { type: "room_cleared" }
  | { type: "relic_pickup"; relicId: string }
  | { type: "floor_descend"; floor: number }
  | { type: "player_death" };

export type EventHandler = (e: GameEvent) => void;

export class EventBus {
  private handlers = new Set<EventHandler>();

  on(fn: EventHandler): () => void {
    this.handlers.add(fn);
    return () => {
      this.handlers.delete(fn);
    };
  }

  emit(e: GameEvent) {
    this.handlers.forEach((fn) => fn(e));
  }
}
