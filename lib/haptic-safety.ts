export function isEmergencyStopKey(key: string) {
  return key === "Escape" || key === " " || key === "Spacebar";
}

export function shouldStopWhenDocumentHidden(visibilityState: DocumentVisibilityState) {
  return visibilityState === "hidden";
}
