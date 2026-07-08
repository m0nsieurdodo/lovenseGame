/* ============================================================
   DESCENTE — Abstraction toy.
   Le moteur haptique ne connaît que cette interface ; les implémentations :
   - MockLovense (mock.ts)          : console + jauge visuelle, dev sans matériel
   - ArcadeLovense (arcade-adapter) : vrai toy via le contrôleur partagé du HUB
   ============================================================ */

export interface LovenseToy {
  connect(): Promise<boolean>;
  /** Intensité continue 0-20 (0 = stop). L'implémentation throttle si besoin. */
  setIntensity(level: number): void;
  stop(): void;
}
