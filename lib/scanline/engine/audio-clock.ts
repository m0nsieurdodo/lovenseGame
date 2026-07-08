/* ============================================================
   AUDIO CLOCK — source de vérité temporelle du jeu.

   TOUT le timing (jugement, scanline, haptique) dérive de
   audioContext.currentTime, jamais de setTimeout/rAF :
     songMs = (ctx.currentTime - startAt) × 1000
   La pause utilise ctx.suspend() : currentTime gèle, donc l'horloge
   du jeu gèle avec — aucune dérive à la reprise.
   ============================================================ */

export class AudioClock {
  private ctx: AudioContext | null = null;
  private source: AudioBufferSourceNode | null = null;
  private startAt = 0; // ctx.currentTime correspondant à songMs = 0
  private playing = false;

  /** Crée/déverrouille le contexte — à appeler depuis un geste utilisateur. */
  async unlock(): Promise<AudioContext> {
    if (!this.ctx) this.ctx = new AudioContext();
    if (this.ctx.state === "suspended") await this.ctx.resume();
    return this.ctx;
  }

  get context(): AudioContext | null {
    return this.ctx;
  }

  /**
   * Lance la piste avec un lead-in (compte à rebours) : songMs démarre
   * négatif et atteint 0 au premier échantillon audio.
   */
  play(buffer: AudioBuffer, leadInMs = 800): void {
    if (!this.ctx) throw new Error("AudioClock : unlock() d'abord (geste utilisateur requis)");
    this.stopSource();
    const t0 = this.ctx.currentTime + leadInMs / 1000;
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    src.connect(this.ctx.destination);
    src.start(t0);
    this.source = src;
    this.startAt = t0;
    this.playing = true;
  }

  /** Temps de chanson en ms (négatif pendant le lead-in). */
  nowMs(): number {
    if (!this.ctx || !this.playing) return Number.NEGATIVE_INFINITY;
    return (this.ctx.currentTime - this.startAt) * 1000;
  }

  isPlaying(): boolean {
    return this.playing;
  }

  async pause(): Promise<void> {
    if (this.ctx && this.ctx.state === "running") await this.ctx.suspend();
  }

  async resume(): Promise<void> {
    if (this.ctx && this.ctx.state === "suspended") await this.ctx.resume();
  }

  private stopSource(): void {
    if (this.source) {
      try {
        this.source.stop();
      } catch {
        /* déjà stoppée */
      }
      this.source.disconnect();
      this.source = null;
    }
  }

  stop(): void {
    this.stopSource();
    this.playing = false;
  }

  destroy(): void {
    this.stop();
    this.ctx?.close().catch(() => {});
    this.ctx = null;
  }
}
