export type NumberLane = number[];

export interface NumberShooterState {
  columns: NumberLane[];
  score: number;
  maxValue: number;
  combo: number;
  gameOver: boolean;
  maxRows: number;
}

export type NumberShooterEvent =
  | { type: "landed"; column: number; row: number; value: number }
  | { type: "merged"; column: number; row: number; value: number }
  | { type: "game_over" };

export interface ShootResult {
  state: NumberShooterState;
  events: NumberShooterEvent[];
}

export interface GameSeed {
  columns?: NumberLane[];
  maxRows?: number;
  score?: number;
  maxValue?: number;
  combo?: number;
  gameOver?: boolean;
}

export function createGame(seed: GameSeed = {}): NumberShooterState {
  const columns = seed.columns?.map((column) => [...column]) ?? Array.from({ length: 5 }, () => []);
  return {
    columns,
    maxRows: seed.maxRows ?? 7,
    score: seed.score ?? 0,
    maxValue: seed.maxValue ?? Math.max(2, ...columns.flat(), 2),
    combo: seed.combo ?? 0,
    gameOver: seed.gameOver ?? false,
  };
}

/**
 * The launcher sends a block upward. Lanes are stored ceiling → launcher, so
 * a new block first attaches at the lane end, then may merge upward only.
 */
export function shootBlock(state: NumberShooterState, column: number, value: number): ShootResult {
  if (state.gameOver || column < 0 || column >= state.columns.length) return { state, events: [] };

  const columns = state.columns.map((lane) => [...lane]);
  const lane = columns[column];
  lane.push(value);
  const events: NumberShooterEvent[] = [{ type: "landed", column, row: lane.length - 1, value }];
  let score = state.score;
  let maxValue = Math.max(state.maxValue, value);
  let combo = 0;

  while (lane.length >= 2 && lane.at(-1) === lane.at(-2)) {
    const merged = (lane.pop() ?? 0) * 2;
    lane[lane.length - 1] = merged;
    score += merged;
    combo += 1;
    maxValue = Math.max(maxValue, merged);
    events.push({ type: "merged", column, row: lane.length - 1, value: merged });
  }

  const gameOver = columns.some((candidate) => candidate.length >= state.maxRows);
  if (gameOver) events.push({ type: "game_over" });
  return { state: { ...state, columns, score, maxValue, combo, gameOver }, events };
}