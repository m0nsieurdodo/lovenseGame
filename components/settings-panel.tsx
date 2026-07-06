"use client";

import { useLovense } from "./lovense-provider";
import { Button, Card, CardTitle, GlowBar, StatusDot } from "./ui";

/* Panneau de réglages Lovense, réutilisé par le HUB et chaque jeu. */
export function SettingsPanel() {
  const { settings, update, status, statusText, vibe, connect, test, stop } = useLovense();

  return (
    <div className="flex flex-col gap-3">
      <Card>
        <CardTitle>Lovense — Game Mode</CardTitle>

        <label className="mb-1 block text-xs text-muted">IP locale</label>
        <input
          value={settings.ip}
          onChange={(e) => update({ ip: e.target.value })}
          inputMode="decimal"
          className="mb-3 w-full rounded-lg border border-line-soft bg-[#0d0b20] px-3 py-2.5 text-base text-ink outline-none focus:border-cyan"
        />

        <label className="mb-1 block text-xs text-muted">Transport</label>
        <select
          value={settings.transport}
          onChange={(e) => update({ transport: e.target.value as "https" | "http" })}
          className="mb-3 w-full rounded-lg border border-line-soft bg-[#0d0b20] px-3 py-2.5 text-base text-ink outline-none focus:border-cyan"
        >
          <option value="https">HTTPS · lovense.club:30010</option>
          <option value="http">HTTP direct · :20010</option>
        </select>

        <div className="mb-2 flex gap-2">
          <Button variant="primary" className="flex-1" onClick={connect} disabled={status === "connecting"}>
            {status === "connecting" ? "Connexion…" : "Connecter"}
          </Button>
          <Button onClick={test}>Test</Button>
        </div>
        <Button variant="danger" className="w-full" onClick={stop}>
          ■ STOP d'urgence
        </Button>

        <div className="mt-3 flex items-center gap-2 text-xs">
          <StatusDot state={status} />
          <span>{statusText}</span>
        </div>
      </Card>

      <Card>
        <CardTitle>Calibrage</CardTitle>

        <label className="mb-1 flex items-center justify-between text-xs text-muted">
          <span>Intensité max</span>
          <span className="font-mono text-ink">{settings.maxIntensity}%</span>
        </label>
        <input
          type="range"
          min={0}
          max={100}
          value={settings.maxIntensity}
          onChange={(e) => update({ maxIntensity: Number(e.target.value) })}
          className="mb-3 w-full accent-rose"
        />

        <label className="flex cursor-pointer items-center gap-2 text-xs text-ink">
          <input
            type="checkbox"
            checked={settings.warmup}
            onChange={(e) => update({ warmup: e.target.checked })}
            className="accent-rose"
          />
          Warm-up — fond léger qui monte avec le niveau
        </label>

        <div className="mt-3">
          <div className="mb-1 text-[10px] uppercase tracking-widest text-muted">Vibration en direct</div>
          <GlowBar value={vibe} />
        </div>
      </Card>
    </div>
  );
}
