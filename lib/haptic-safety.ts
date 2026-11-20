export interface EmergencyKeyContext {
  /** Le jeu affiché utilise Espace comme commande (saut, hard drop, frappe…). */
  spaceIsGameKey?: boolean;
  /** Le focus est dans un champ ou sur un contrôle qu'Espace doit actionner. */
  targetIsInteractive?: boolean;
}

/** Échap coupe toujours. Espace coupe aussi, sauf quand il sert à jouer ou à
    actionner le contrôle qui a le focus : sinon chaque saut désarmerait le
    warm-up et un champ de saisie ne pourrait plus recevoir d'espace. */
export function isEmergencyStopKey(key: string, context: EmergencyKeyContext = {}) {
  if (key === "Escape") return true;
  if (key !== " " && key !== "Spacebar") return false;
  return !context.spaceIsGameKey && !context.targetIsInteractive;
}

const INTERACTIVE_TAGS = new Set(["INPUT", "TEXTAREA", "SELECT", "BUTTON", "A", "SUMMARY"]);

export function isInteractiveTarget(target: { tagName?: string; isContentEditable?: boolean } | null | undefined) {
  if (!target) return false;
  return Boolean(target.isContentEditable) || INTERACTIVE_TAGS.has((target.tagName ?? "").toUpperCase());
}

export function shouldStopWhenDocumentHidden(visibilityState: DocumentVisibilityState) {
  return visibilityState === "hidden";
}
