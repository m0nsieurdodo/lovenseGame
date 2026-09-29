export function laneForLauncherPress({ pressedLane, laneCount }: { pressedLane: number; selectedLane: number; laneCount: number }): number | null {
  return Number.isInteger(pressedLane) && pressedLane >= 0 && pressedLane < laneCount ? pressedLane : null;
}
