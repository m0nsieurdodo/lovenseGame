/* Pas de simulation fixe pour les jeux en requestAnimationFrame.

   rAF suit la fréquence de l'écran : sans ça, un moteur qui avance « d'un cran
   par image » tourne 2× plus vite sur un écran 120 Hz et 2,4× sur du 144 Hz.
   On accumule le temps réel écoulé et on rend au moteur le nombre de pas de
   1/60 s à simuler, quelle que soit la cadence d'affichage. */
export class FixedStep {
  private last: number | null = null;
  private accumulator = 0;

  constructor(
    readonly stepMs = 1000 / 60,
    /** Plafond par image : après un gel (onglet figé), on ne rattrape pas tout d'un coup. */
    private readonly maxSteps = 5,
  ) {}

  /** Nombre de pas à simuler pour cette image. `active` à false (pause, menu) gèle l'horloge. */
  advance(nowMs: number, active = true): number {
    if (!active || this.last === null) {
      this.last = active ? nowMs : null;
      this.accumulator = 0;
      return 0;
    }
    let elapsed = nowMs - this.last;
    this.last = nowMs;
    if (elapsed <= 0) return 0;
    // À ~60 Hz l'intervalle oscille autour d'un pas : on l'arrondit pour éviter
    // les images à 0 ou 2 pas qui donneraient une saccade visible.
    if (Math.abs(elapsed - this.stepMs) < 2.5) elapsed = this.stepMs;
    this.accumulator += elapsed;
    let steps = Math.floor(this.accumulator / this.stepMs + 1e-9);
    if (steps > this.maxSteps) {
      steps = this.maxSteps;
      this.accumulator = 0;
    } else {
      this.accumulator -= steps * this.stepMs;
    }
    return steps;
  }

  reset() {
    this.last = null;
    this.accumulator = 0;
  }
}
