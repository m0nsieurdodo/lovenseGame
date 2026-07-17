import { beatDurationMs, tileTrackDurationSec, type TileChart } from "./engine";

const SAMPLE_RATE = 44_100;
const ROOTS = [55, 43.65, 65.41, 49] as const; // Am / F / C / G
const ARPEGGIO = [4, 6, 8, 12] as const;

/**
 * Musique de démonstration originale, rendue localement via Web Audio.
 * Une future piste MP3 pourra être chargée par la même AudioClock.
 */
export async function renderTileTrack(chart: TileChart): Promise<AudioBuffer> {
  const beatSec = beatDurationMs(chart.bpm) / 1_000;
  const ctx = new OfflineAudioContext(2, Math.ceil(tileTrackDurationSec(chart) * SAMPLE_RATE), SAMPLE_RATE);
  const master = ctx.createGain();
  master.gain.value = 0.62;
  master.connect(ctx.destination);

  const noise = noiseBuffer(ctx);
  const at = (beat: number) => chart.offsetMs / 1_000 + beat * beatSec;
  const rootAt = (beat: number) => ROOTS[Math.floor(beat / 4) % ROOTS.length];

  for (let beat = 0; beat < chart.durationBeats; beat++) {
    kick(ctx, master, at(beat));
    hat(ctx, master, noise, at(beat + 0.5), 0.12);
    if (beat % 4 === 1 || beat % 4 === 3) clap(ctx, master, noise, at(beat));
  }
  for (let step = 0; step < chart.durationBeats * 2; step++) {
    const beat = step / 2;
    bass(ctx, master, at(beat), beatSec * 0.4, rootAt(beat));
    if (step >= 8) pluck(ctx, master, at(beat), beatSec * 0.34, rootAt(beat) * ARPEGGIO[step % ARPEGGIO.length]);
  }

  return ctx.startRendering();
}

function noiseBuffer(ctx: OfflineAudioContext): AudioBuffer {
  const buffer = ctx.createBuffer(1, SAMPLE_RATE, SAMPLE_RATE);
  const data = buffer.getChannelData(0);
  for (let index = 0; index < data.length; index++) data[index] = Math.random() * 2 - 1;
  return buffer;
}

function envelope(ctx: OfflineAudioContext, at: number, peak: number, release: number): GainNode {
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(peak, at);
  gain.gain.exponentialRampToValueAtTime(0.001, at + release);
  return gain;
}

function kick(ctx: OfflineAudioContext, out: AudioNode, at: number): void {
  const oscillator = ctx.createOscillator();
  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(150, at);
  oscillator.frequency.exponentialRampToValueAtTime(48, at + 0.12);
  oscillator.connect(envelope(ctx, at, 0.75, 0.28)).connect(out);
  oscillator.start(at);
  oscillator.stop(at + 0.3);
}

function hat(ctx: OfflineAudioContext, out: AudioNode, noise: AudioBuffer, at: number, peak: number): void {
  const source = ctx.createBufferSource();
  source.buffer = noise;
  const filter = ctx.createBiquadFilter();
  filter.type = "highpass";
  filter.frequency.value = 7_000;
  source.connect(filter).connect(envelope(ctx, at, peak, 0.05)).connect(out);
  source.start(at);
  source.stop(at + 0.06);
}

function clap(ctx: OfflineAudioContext, out: AudioNode, noise: AudioBuffer, at: number): void {
  const source = ctx.createBufferSource();
  source.buffer = noise;
  const filter = ctx.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = 1_800;
  filter.Q.value = 0.8;
  source.connect(filter).connect(envelope(ctx, at, 0.28, 0.14)).connect(out);
  source.start(at);
  source.stop(at + 0.16);
}

function bass(ctx: OfflineAudioContext, out: AudioNode, at: number, duration: number, frequency: number): void {
  const oscillator = ctx.createOscillator();
  oscillator.type = "sawtooth";
  oscillator.frequency.value = frequency;
  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 380;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(0.14, at + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.001, at + duration);
  oscillator.connect(filter).connect(gain).connect(out);
  oscillator.start(at);
  oscillator.stop(at + duration + 0.05);
}

function pluck(ctx: OfflineAudioContext, out: AudioNode, at: number, duration: number, frequency: number): void {
  const oscillator = ctx.createOscillator();
  oscillator.type = "triangle";
  oscillator.frequency.value = frequency;
  oscillator.connect(envelope(ctx, at, 0.09, Math.max(0.18, duration))).connect(out);
  oscillator.start(at);
  oscillator.stop(at + duration + 0.2);
}
