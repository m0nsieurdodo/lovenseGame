export class AudioRenderTimeoutError extends Error {
  constructor(timeoutMs: number) {
    super(`La génération audio a dépassé ${timeoutMs / 1_000} secondes.`);
    this.name = "AudioRenderTimeoutError";
  }
}

/** Empêche une implémentation Web Audio défaillante de bloquer indéfiniment le jeu. */
export function renderWithin<T>(render: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new AudioRenderTimeoutError(timeoutMs)), timeoutMs);
    render.then(
      (result) => {
        clearTimeout(timer);
        resolve(result);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}
