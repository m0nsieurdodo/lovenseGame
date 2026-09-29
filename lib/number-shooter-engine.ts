export type Cell = number | null;
export type Board = Cell[][];

export interface Position {
  row: number;
  column: number;
}

export interface NumberShooterState {
  board: Board;
  score: number;
  maxValue: number;
  combo: number;
  gameOver: boolean;
}

export type NumberShooterEvent =
  | { type: "placed"; at: Position; value: number }
  | { type: "merged"; at: Position; value: number }
  | { type: "game_over" };

export interface DropResult {
  state: NumberShooterState;
  events: NumberShooterEvent[];
}

const MATCH_DIRECTIONS: readonly Position[] = [
  { row: 0, column: -1 },
  { row: 1, column: 0 },
  { row: 0, column: 1 },
  { row: -1, column: 0 },
];

export function createGame(rows = 8, columns = 5): NumberShooterState {
  return {
    board: Array.from({ length: rows }, () => Array<Cell>(columns).fill(null)),
    score: 0,
    maxValue: 2,
    combo: 0,
    gameOver: false,
  };
}

export function setCell(state: NumberShooterState, row: number, column: number, value: Cell): NumberShooterState {
  const board = state.board.map((line) => [...line]);
  board[row][column] = value;
  return { ...state, board, maxValue: Math.max(state.maxValue, value ?? 0) };
}

export function canPlace(state: NumberShooterState, column: number): boolean {
  return !state.gameOver && column >= 0 && column < state.board[0].length && state.board[0][column] === null;
}

export function dropBlock(state: NumberShooterState, column: number, value: number): DropResult {
  if (!canPlace(state, column)) {
    return { state: { ...state, gameOver: true, combo: 0 }, events: [{ type: "game_over" }] };
  }

  const board = state.board.map((line) => [...line]);
  let row = board.length - 1;
  while (board[row][column] !== null) row -= 1;
  board[row][column] = value;

  const events: NumberShooterEvent[] = [{ type: "placed", at: { row, column }, value }];
  let score = state.score;
  let maxValue = Math.max(state.maxValue, value);
  let combo = 0;
  let current: Position = { row, column };

  while (true) {
    const currentValue = board[current.row][current.column];
    if (currentValue === null) break;
    const neighbour = MATCH_DIRECTIONS
      .map((direction) => ({ row: current.row + direction.row, column: current.column + direction.column }))
      .find(({ row: targetRow, column: targetColumn }) =>
        targetRow >= 0 &&
        targetRow < board.length &&
        targetColumn >= 0 &&
        targetColumn < board[0].length &&
        board[targetRow][targetColumn] === currentValue,
      );
    if (!neighbour) break;

    const mergedValue = currentValue * 2;
    board[current.row][current.column] = null;
    board[neighbour.row][neighbour.column] = mergedValue;
    current = neighbour;
    combo += 1;
    score += mergedValue;
    maxValue = Math.max(maxValue, mergedValue);
    events.push({ type: "merged", at: current, value: mergedValue });
  }

  const gameOver = board[0].every((cell) => cell !== null);
  if (gameOver) events.push({ type: "game_over" });

  return { state: { board, score, maxValue, combo, gameOver }, events };
}
