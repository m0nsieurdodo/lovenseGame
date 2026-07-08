/* ============================================================
   DESCENTE — MockLovense : log console + listeners pour jauge visuelle.
   Sert aux tests et au dev sans matériel (aucune dépendance réseau/DOM).
   ============================================================ */
import { clamp } from "../engine/curves";
import type { LovenseToy } from "./controller";

export class MockLovense implements LovenseToy {
  level = 0;
  private listeners = new Set<(level: number) => void>();

  onLevel(fn: (level: number) => void): () => void {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }

  async connect() {
    console.info("[MockLovense] connecté (aucun matériel)");
    return true;
  }

  setIntensity(level: number) {
    const l = clamp(Math.round(level), 0, 20);
    if (l === this.level) return;
    this.level = l;
    console.debug(`[MockLovense] Vibrate:${l}`);
    this.listeners.forEach((fn) => fn(l));
  }

  stop() {
    this.setIntensity(0);
  }
}
