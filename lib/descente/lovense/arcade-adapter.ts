/* ============================================================
   DESCENTE — Adaptateur vers le contrôleur Lovense partagé du HUB.
   Réel si le HUB est connecté (Game Mode, API locale) ; sinon le mock intégré
   du contrôleur (console + GlowBar) prend le relais automatiquement.
   Respecte le calibrage global (intensité max, multi-toys, STOP d'urgence).

   TODO : implémentation Bluetooth Web API directe (sans l'app Lovense
   Remote) — créer une classe WebBluetoothLovense implements LovenseToy.
   ============================================================ */
import { Lovense } from "@/lib/lovense";
import { clamp } from "../engine/curves";
import type { LovenseToy } from "./controller";

export class ArcadeLovense implements LovenseToy {
  private last = -1;

  async connect() {
    // La connexion se fait dans les Réglages du HUB (IP + transport).
    return Lovense.isConnected();
  }

  setIntensity(level: number) {
    const l = clamp(Math.round(level), 0, 20);
    if (l === this.last) return; // n'envoie au réseau que les changements de palier
    this.last = l;
    Lovense.setContinuous(l * 5); // niveau 0-20 → pct 0-100 attendu par le contrôleur
  }

  stop() {
    this.last = 0;
    Lovense.stop();
  }
}
