/* ============================================================
   SORTIE HAPTIQUE — abstraction demandée par le moteur haptique.
   setIntensity() reçoit l'échelle Lovense native 0..20.

   - ArcadeLovenseOutput : branche le hub existant (lib/lovense.ts),
     qui gère déjà connect(), multi-toys, HTTPS Game Mode et bascule
     mock automatique. Throttle réseau intégré (l'API locale Lovense
     n'aime pas être spammée).
   - MockLovenseOutput : mock autonome (log + callback jauge) pour
     les tests et le dev hors hub.

   TODO API réelle hors hub : implémenter un HapticOutput parlant
   directement à https://{ip-tirets}.lovense.club:30010/command avec
   { command:"Function", action:"Vibrate:N", timeSec:0, toy:"", apiVer:1 }.
   ============================================================ */
import { Lovense } from "@/lib/lovense";

export interface HapticOutput {
  /** Intensité Lovense 0..20 — appelée à chaque tick du moteur haptique. */
  setIntensity(level: number): void;
  /** Arrêt immédiat (pause / kill switch). */
  stop(): void;
}

const clamp20 = (level: number) => Math.max(0, Math.min(20, Math.round(level)));

export class ArcadeLovenseOutput implements HapticOutput {
  private lastLevel = -1;
  private lastSentAt = 0;
  /** Intervalle mini entre deux commandes réseau (le tick suivant rattrape). */
  private static MIN_SEND_INTERVAL_MS = 90;

  setIntensity(level: number): void {
    const lv = clamp20(level);
    if (lv === this.lastLevel) return;
    const now = performance.now();
    // Les retours à 0 passent toujours (sécurité) ; le reste est throttlé.
    if (lv !== 0 && now - this.lastSentAt < ArcadeLovenseOutput.MIN_SEND_INTERVAL_MS) return;
    this.lastLevel = lv;
    this.lastSentAt = now;
    Lovense.setContinuous(lv * 5); // 0..20 → 0..100 % (le contrôleur re-mappe et applique le calibrage)
  }

  stop(): void {
    this.lastLevel = 0;
    Lovense.mute();
  }
}

/** Mock autonome : log console + callback pour une jauge visuelle. */
export class MockLovenseOutput implements HapticOutput {
  private last = -1;

  constructor(private onChange?: (level: number) => void) {}

  setIntensity(level: number): void {
    const lv = clamp20(level);
    if (lv === this.last) return;
    this.last = lv;
    console.debug(`[MockLovense] setIntensity(${lv}/20)`);
    this.onChange?.(lv);
  }

  stop(): void {
    this.last = 0;
    console.debug("[MockLovense] stop()");
    this.onChange?.(0);
  }
}
