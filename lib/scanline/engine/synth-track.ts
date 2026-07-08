/* ============================================================
   SYNTH TRACK — piste musicale générée hors-ligne (OfflineAudioContext).
   Zéro asset audio : kick / hi-hat / snare / basse / arpège, calés sur
   le BPM de la beatmap. Sert de piste par défaut ; une beatmap pourra
   plus tard référencer un fichier audio réel à la place (même horloge).
   ============================================================ */
import { beatDurMs, type Beatmap } from "./beatmap";

const SR = 44100;
const ROOTS = [55.0, 43.65, 65.41, 49.0]; // Am / F / C / G (fondamentales, Hz)
const ARP_RATIOS = [4, 6, 8, 12]; // fondamentale ×4 (2 octaves), quinte, octave…

export async function renderTrack(map: Beatmap): Promise<AudioBuffer> {
  const beatSec = beatDurMs(map.bpm) / 1000;
  const totalSec = map.offsetMs / 1000 + map.durationBeats * beatSec + 1.5;
  const ctx = new OfflineAudioContext(2, Math.ceil(totalSec * SR), SR);

  const master = ctx.createGain();
  master.gain.value = 0.75;
  const comp = ctx.createDynamicsCompressor();
  master.connect(comp);
  comp.connect(ctx.destination);

  const noise = makeNoiseBuffer(ctx);
  const at = (b: number) => map.offsetMs / 1000 + b * beatSec;
  const rootAt = (b: number) => ROOTS[Math.floor(b / 4) % ROOTS.length];

  for (let b = 0; b < map.durationBeats; b++) {
    kick(ctx, master, at(b));
    if (b >= 8) hat(ctx, master, noise, at(b + 0.5), 0.16);
    if (b >= 16) {
      hat(ctx, master, noise, at(b), 0.07);
      if (b % 4 === 1 || b % 4 === 3) snare(ctx, master, noise, at(b));
    }
  }
  // Basse en croches à partir du beat 16.
  for (let e = 32; e < map.durationBeats * 2; e++) {
    const b = e / 2;
    bassNote(ctx, master, at(b), beatSec * 0.42, rootAt(b));
  }
  // Arpège à partir du beat 48 (double-time de la beatmap).
  for (let e = 96; e < map.durationBeats * 2; e++) {
    const b = e / 2;
    arpNote(ctx, master, at(b), beatSec * 0.4, rootAt(b) * ARP_RATIOS[e % 4]);
  }

  return ctx.startRendering();
}

/* ---- instruments ---- */

function makeNoiseBuffer(ctx: OfflineAudioContext): AudioBuffer {
  const buf = ctx.createBuffer(1, SR, SR);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return buf;
}

function env(ctx: OfflineAudioContext, t: number, peak: number, decay: number): GainNode {
  const g = ctx.createGain();
  g.gain.setValueAtTime(peak, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + decay);
  return g;
}

function kick(ctx: OfflineAudioContext, out: AudioNode, t: number): void {
  const o = ctx.createOscillator();
  o.type = "sine";
  o.frequency.setValueAtTime(150, t);
  o.frequency.exponentialRampToValueAtTime(46, t + 0.11);
  const g = env(ctx, t, 0.95, 0.28);
  o.connect(g).connect(out);
  o.start(t);
  o.stop(t + 0.3);
}

function hat(ctx: OfflineAudioContext, out: AudioNode, noise: AudioBuffer, t: number, gain: number): void {
  const s = ctx.createBufferSource();
  s.buffer = noise;
  const f = ctx.createBiquadFilter();
  f.type = "highpass";
  f.frequency.value = 7500;
  const g = env(ctx, t, gain, 0.05);
  s.connect(f).connect(g).connect(out);
  s.start(t);
  s.stop(t + 0.06);
}

function snare(ctx: OfflineAudioContext, out: AudioNode, noise: AudioBuffer, t: number): void {
  const s = ctx.createBufferSource();
  s.buffer = noise;
  const f = ctx.createBiquadFilter();
  f.type = "bandpass";
  f.frequency.value = 1800;
  f.Q.value = 0.8;
  const g = env(ctx, t, 0.5, 0.15);
  s.connect(f).connect(g).connect(out);
  s.start(t);
  s.stop(t + 0.16);
  const o = ctx.createOscillator();
  o.type = "triangle";
  o.frequency.value = 185;
  const g2 = env(ctx, t, 0.3, 0.08);
  o.connect(g2).connect(out);
  o.start(t);
  o.stop(t + 0.1);
}

function bassNote(ctx: OfflineAudioContext, out: AudioNode, t: number, dur: number, freq: number): void {
  const o = ctx.createOscillator();
  o.type = "sawtooth";
  o.frequency.value = freq;
  const f = ctx.createBiquadFilter();
  f.type = "lowpass";
  f.frequency.value = 420;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.22, t + 0.015);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(f).connect(g).connect(out);
  o.start(t);
  o.stop(t + dur + 0.05);
}

function arpNote(ctx: OfflineAudioContext, out: AudioNode, t: number, dur: number, freq: number): void {
  const o = ctx.createOscillator();
  o.type = "triangle";
  o.frequency.value = freq;
  const g = env(ctx, t, 0.11, Math.max(dur, 0.18));
  o.connect(g).connect(out);
  o.start(t);
  o.stop(t + dur + 0.2);
}
