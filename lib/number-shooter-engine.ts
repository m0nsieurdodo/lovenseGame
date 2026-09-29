export type BoardCell = number | null;
export type NumberBoard = BoardCell[][];

export interface NumberShooterState {
  board: NumberBoard;
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

export interface ShootResult { state: NumberShooterState; events: NumberShooterEvent[]; }
export interface GameSeed { board?: NumberBoard; maxRows?: number; score?: number; maxValue?: number; combo?: number; gameOver?: boolean; }

const LANE_COUNT = 5;
const NEIGHBOURS = [[-1, 0], [0, -1], [0, 1], [1, 0]] as const;

export function createGame(seed: GameSeed = {}): NumberShooterState {
  const maxRows = seed.maxRows ?? 7;
  const board = Array.from({ length: maxRows }, (_, row) =>
    Array.from({ length: LANE_COUNT }, (_, column) => seed.board?.[row]?.[column] ?? null),
  );
  return { board, maxRows, score: seed.score ?? 0, maxValue: seed.maxValue ?? Math.max(2, ...board.flat().filter((value): value is number => value !== null)), combo: seed.combo ?? 0, gameOver: seed.gameOver ?? false };
}

/** The block rises from the launcher, collides with the lowest cell in its lane,
 * then follows equal-value cardinal neighbours one fusion at a time. */
export function shootBlock(state: NumberShooterState, column: number, value: number): ShootResult {
  if (state.gameOver || column < 0 || column >= LANE_COUNT) return { state, events: [] };
  const board = state.board.map((row) => [...row]);
  const lowestOccupied = board.reduce((lowest, row, index) => row[column] === null ? lowest : index, -1);
  const landingRow = lowestOccupied + 1;
  if (landingRow >= state.maxRows) return { state: { ...state, gameOver: true, combo: 0 }, events: [{ type: "game_over" }] };

  board[landingRow][column] = value;
  const events: NumberShooterEvent[] = [{ type: "landed", column, row: landingRow, value }];
  let current = { row: landingRow, column };
  let score = state.score;
  let combo = 0;
  let maxValue = Math.max(state.maxValue, value);

  while (true) {
    const currentValue = board[current.row][current.column];
    if (currentValue === null) break;
    const neighbour = NEIGHBOURS
      .map(([rowDelta, columnDelta]) => ({ row: current.row + rowDelta, column: current.column + columnDelta }))
      .find(({ row, column: targetColumn }) => row >= 0 && row < state.maxRows && targetColumn >= 0 && targetColumn < LANE_COUNT && board[row][targetColumn] === currentValue);
    if (!neighbour) break;

    const merged = currentValue * 2;
    board[current.row][current.column] = null;
    board[neighbour.row][neighbour.column] = merged;
    current = settleAgainstCeiling(board, neighbour);
    score += merged;
    combo += 1;
    maxValue = Math.max(maxValue, merged);
    events.push({ type: "merged", column: current.column, row: current.row, value: merged });
  }

  const gameOver = board[state.maxRows - 1].some((cell) => cell !== null);
  if (gameOver) events.push({ type: "game_over" });
  return { state: { board, score, maxValue, combo, gameOver, maxRows: state.maxRows }, events };
}

/** Blocks are suspended from the ceiling. Removing one during a merge leaves no
 * holes: every affected lane, and any pre-existing loose lane, compacts upward. */
function settleAgainstCeiling(board: NumberBoard, tracked: { row: number; column: number }) {
  let trackedRow = tracked.row;
  for (let column = 0; column < LANE_COUNT; column += 1) {
    if (column === tracked.column) {
      trackedRow = board.slice(0, tracked.row + 1).filter((row) => row[column] !== null).length - 1;
    }
    const values = board.map((row) => row[column]).filter((value): value is number => value !== null);
    board.forEach((row, rowIndex) => { row[column] = values[rowIndex] ?? null; });
  }
  return { row: trackedRow, column: tracked.column };
}