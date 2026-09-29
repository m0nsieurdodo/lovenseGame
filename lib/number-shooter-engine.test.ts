import { describe, expect, it } from "vitest";
import { createGame, shootBlock, type NumberShooterState } from "./number-shooter-engine";

describe("Number Shooter engine", () => {
  it("fires upward and lands directly below the lowest block in the selected lane", () => {
    const state = createGame({ board: [[8, null, null, null, null]], maxRows: 7 });
    const result = shootBlock(state, 0, 2);

    expect(result.state.board[1][0]).toBe(2);
    expect(result.events).toEqual([{ type: "landed", column: 0, row: 1, value: 2 }]);
  });

  it("merges a matching horizontal neighbour at the impact row", () => {
    const state = createGame({ board: [[2, null, null, null, null]], maxRows: 7 });
    const result = shootBlock(state, 1, 2);

    expect(result.state.board[0].slice(0, 2)).toEqual([4, null]);
    expect(result.events).toEqual([
      { type: "landed", column: 1, row: 0, value: 2 },
      { type: "merged", column: 0, row: 0, value: 4 },
    ]);
  });

  it("resolves a cascade through adjacent equal values", () => {
    const state = createGame({ board: [[4, 2, null, null, null]], maxRows: 7 });
    const result = shootBlock(state, 2, 2);

    expect(result.state.board[0].slice(0, 3)).toEqual([8, null, null]);
    expect(result.state.score).toBe(12);
    expect(result.state.combo).toBe(2);
    expect(result.events).toEqual([
      { type: "landed", column: 2, row: 0, value: 2 },
      { type: "merged", column: 1, row: 0, value: 4 },
      { type: "merged", column: 0, row: 0, value: 8 },
    ]);
  });

  it("also resolves a vertical cascade toward the ceiling", () => {
    const state = createGame({ board: [[4, null, null, null, null], [2, null, null, null, null]], maxRows: 7 });
    const result = shootBlock(state, 0, 2);

    expect(result.state.board[0][0]).toBe(8);
    expect(result.state.score).toBe(12);
  });

  it("ends the game when a shot reaches the launcher row", () => {
    const state: NumberShooterState = createGame({ board: [[2], [4], [8], [16], [32], [64]], maxRows: 7 });
    const result = shootBlock(state, 0, 128);

    expect(result.state.board[6][0]).toBe(128);
    expect(result.state.gameOver).toBe(true);
    expect(result.events.at(-1)).toEqual({ type: "game_over" });
  });
});