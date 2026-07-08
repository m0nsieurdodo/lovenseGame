import { describe, expect, it } from "vitest";
import { DISCHARGE_MS, HapticEngine } from "../haptic-engine";
import { RELICS } from "../relics";

const relicHook = (id: string) => {
  const r = RELICS.find((x) => x.id === id);
  if (!r?.hook) throw new Error(`relique ${id} sans hook`);
  return r.hook;
};

describe("HapticEngine — baseline", () => {
  it("suit le heat via heatToIntensity", () => {
    const e = new HapticEngine();
    expect(e.update(16, 0)).toBe(0);
    expect(e.update(16, 50)).toBe(10);
    expect(e.update(16, 100)).toBe(20);
  });

  it("respecte la courbe easeIn", () => {
    const e = new HapticEngine();
    e.curve = "easeIn";
    expect(e.update(16, 50)).toBe(5);
  });
});

describe("HapticEngine — couches événementielles", () => {
  it("somme baseline + spike, clampée à 20", () => {
    const e = new HapticEngine();
    e.spike({ peak: 10, env: { attackMs: 100, holdMs: 200, releaseMs: 100 } });
    // t = 100 ms : fin d'attaque → pleine crête ; baseline (heat 50) = 10.
    expect(e.update(100, 50)).toBe(20 /* 10 + 10 */);
    e.spike({ peak: 15, env: { attackMs: 0, holdMs: 500, releaseMs: 0 } });
    expect(e.update(50, 50)).toBe(20); // 10 + ~10 + 15 → clamp
  });

  it("respecte le clamp de sécurité safetyMax", () => {
    const e = new HapticEngine();
    e.safetyMax = 12;
    e.spike({ peak: 20, env: { attackMs: 0, holdMs: 1000, releaseMs: 0 } });
    expect(e.update(16, 100)).toBe(12);
  });

  it("la couche disparaît à la fin de son enveloppe", () => {
    const e = new HapticEngine();
    e.spike({ peak: 10, env: { attackMs: 0, holdMs: 100, releaseMs: 100 } });
    e.update(50, 0);
    expect(e.update(500, 0)).toBe(0);
  });
});

describe("HapticEngine — kill switch", () => {
  it("coupe tout immédiatement et ignore les spikes jusqu'au réarmement", () => {
    const e = new HapticEngine();
    e.spike({ peak: 20, env: { attackMs: 0, holdMs: 5000, releaseMs: 0 } });
    e.kill();
    expect(e.update(16, 100)).toBe(0);
    e.spike({ peak: 20, env: { attackMs: 0, holdMs: 5000, releaseMs: 0 } });
    expect(e.update(16, 100)).toBe(0);
    e.rearm();
    expect(e.update(16, 50)).toBe(10); // la baseline revient, les couches ont été purgées
  });
});

describe("HapticEngine — décharge de mort", () => {
  it("monte au max sur ~1.5 s puis coupe sec", () => {
    const e = new HapticEngine();
    e.discharge();
    expect(e.update(DISCHARGE_MS / 2, 100)).toBe(10); // mi-montée, ignore le heat
    expect(e.update(DISCHARGE_MS / 2, 100)).toBe(0); // coupure
    expect(e.update(16, 0)).toBe(0); // retour au régime normal (heat 0)
  });
});

describe("HapticEngine — reliques (decorators)", () => {
  it("Sang-froid inversé : la baseline se calme quand le heat monte", () => {
    const e = new HapticEngine();
    e.addRelic(relicHook("sangfroid"));
    expect(e.update(16, 100)).toBe(0);
    expect(e.update(16, 0)).toBe(20);
    expect(e.update(16, 75)).toBe(5);
  });

  it("Écho : chaque spike se répète atténué 2 s plus tard", () => {
    const e = new HapticEngine();
    e.addRelic(relicHook("echo"));
    e.spike({ peak: 10, env: { attackMs: 0, holdMs: 200, releaseMs: 0 } });
    expect(e.update(100, 0)).toBe(10); // spike original
    expect(e.update(500, 0)).toBe(0); // éteint, écho pas encore là
    expect(e.update(1500, 0)).toBe(5); // t = 2100 → écho à mi-crête (peak 5, en hold)
    expect(e.update(500, 0)).toBe(0); // écho terminé, pas de ré-écho infini
  });
});
