import { describe, expect, it } from "vitest";
import {
  createGame,
  dropBlock,
  setCell,
  type NumberShooterState,
} from "./number-shooter-engine";

describe("Number Shooter engine", () => {
  it("places a block in the lowest free cell of the selected column", () => {
    const state = createGame(4, 4);
    const result = dropBlock(state, 2, 2);

    expect(result.state.board[3][2]).toBe(2);
    expect(result.state.board[0][2]).toBeNull();
    expect(result.events).toEqual([{ type: "placed", at: { row: 3, column: 2 }, value: 2 }]);
  });

  it("resolves a vertical chain one fusion at a time and scores every produced value", () => {
    let state = createGame(4, 4);
    state = setCell(state, 3, 1, 8);
    state = setCell(state, 2, 1, 4);

    const result = dropBlock(state, 1, 4);

    expect(result.events).toEqual([
      { type: "placed", at: { row: 1, column: 1 }, value: 4 },
      { type: "merged", at: { row: 2, column: 1 }, value: 8 },
      { type: "merged", at: { row: 3, column: 1 }, value: 16 },
    ]);
    expect(result.state.board[3][1]).toBe(16);
    expect(result.state.score).toBe(24);
    expect(result.state.combo).toBe(2);
    expect(result.state.maxValue).toBe(16);
  });

  it("uses a deterministic direction priority for multiple equal neighbours", () => {
    let state = createGame(3, 3);
    state = setCell(state, 2, 0, 2);
    state = setCell(state, 2, 2, 2);

    const result = dropBlock(state, 1, 2);

    expect(result.events[1]).toEqual({ type: "merged", at: { row: 2, column: 0 }, value: 4 });
    expect(result.state.board[2]).toEqual([4, null, 2]);
  });

  it("marks the game over when no column can receive the next block", () => {
    let state: NumberShooterState = createGame(2, 2);
    for (let row = 0; row < 2; row += 1) {
      for (let column = 0; column < 2; column += 1) state = setCell(state, row, column, 16 + row + column);
    }

    expect(dropBlock(state, 0, 2).state.gameOver).toBe(true);
    expect(dropBlock(state, 0, 2).events).toEqual([{ type: "game_over" }]);
  });
});
