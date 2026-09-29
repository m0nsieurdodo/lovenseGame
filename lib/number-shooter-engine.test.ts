import { describe, expect, it } from "vitest";
import { createGame, shootBlock, type NumberShooterState } from "./number-shooter-engine";

describe("Number Shooter engine", () => {
  it("fires from the launcher and attaches the block below the ceiling stack", () => {
    const state = createGame({ columns: [[8], [], [], [], []], maxRows: 7 });
    const result = shootBlock(state, 0, 2);

    expect(result.state.columns[0]).toEqual([8, 2]);
    expect(result.events).toEqual([{ type: "landed", column: 0, row: 1, value: 2 }]);
  });

  it("resolves a vertical impact chain from the collision point upward", () => {
    const state = createGame({ columns: [[4, 2], [], [], [], []], maxRows: 7 });
    const result = shootBlock(state, 0, 2);

    expect(result.state.columns[0]).toEqual([8]);
    expect(result.state.score).toBe(12);
    expect(result.state.combo).toBe(2);
    expect(result.events).toEqual([
      { type: "landed", column: 0, row: 2, value: 2 },
      { type: "merged", column: 0, row: 1, value: 4 },
      { type: "merged", column: 0, row: 0, value: 8 },
    ]);
  });

  it("does not merge across neighbouring lanes", () => {
    const state = createGame({ columns: [[2], [], [2], [], []], maxRows: 7 });
    const result = shootBlock(state, 1, 2);

    expect(result.state.columns).toEqual([[2], [2], [2], [], []]);
    expect(result.state.combo).toBe(0);
  });

  it("ends the game when a fired block reaches the launcher depth", () => {
    const fullLane = [2, 4, 8, 16, 32, 64];
    const state: NumberShooterState = createGame({ columns: [fullLane, [], [], [], []], maxRows: 7 });
    const result = shootBlock(state, 0, 128);

    expect(result.state.columns[0]).toHaveLength(7);
    expect(result.state.gameOver).toBe(true);
    expect(result.events.at(-1)).toEqual({ type: "game_over" });
  });

  it("rejects a shot after the launcher has been reached", () => {
    const state = createGame({ columns: [[2, 4, 8, 16, 32, 64, 128], [], [], [], []], maxRows: 7, gameOver: true });
    expect(shootBlock(state, 0, 2).events).toEqual([]);
  });
});