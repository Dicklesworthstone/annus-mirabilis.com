import { describe, expect, test } from "bun:test";
import { independentSteps, STEP_DEPENDENCE_CHOICES, signedStepNumber } from "./independentSteps.ts";

describe("the probability lesson's exact two-step comparison", () => {
  test("fresh coins show all four equiprobable walks and cancellation of the products", () => {
    const state = independentSteps("independent");
    expect(state.rows.map((row) => [row.first, row.second, row.product, row.square])).toEqual([
      [-1, -1, 1, 4],
      [1, -1, -1, 0],
      [-1, 1, -1, 0],
      [1, 1, 1, 4],
    ]);
    expect(state.denominator).toBe(4);
    expect(state.mean).toBe(0);
    expect(state.meanSquare).toBe(2);
    expect(state.meanProduct).toBe(0);
    expect([state.followsRight, state.startsRight]).toEqual([1, 2]);
  });

  test("copying the first step preserves zero individual means but doubles the mean square", () => {
    const state = independentSteps("same-direction");
    expect(state.rows.map((row) => [row.first, row.second])).toEqual([
      [-1, -1],
      [1, 1],
    ]);
    expect(state.denominator).toBe(2);
    expect(state.mean).toBe(0);
    expect(state.meanProduct).toBe(1);
    expect(state.meanCrossTerm).toBe(2);
    expect(state.meanSquare).toBe(4);
    expect([state.followsRight, state.startsRight]).toEqual([1, 1]);
  });

  test("reversing the first step cancels displacement, not the product", () => {
    const state = independentSteps("opposite-direction");
    expect(state.rows.map((row) => [row.first, row.second])).toEqual([
      [-1, 1],
      [1, -1],
    ]);
    expect(state.denominator).toBe(2);
    expect(state.meanProduct).toBe(-1);
    expect(state.meanCrossTerm).toBe(-2);
    expect(state.meanSquare).toBe(0);
    expect([state.followsRight, state.startsRight]).toEqual([0, 1]);
  });

  test("all displayed models conserve probability and retain identical one-step chances", () => {
    for (const { id } of STEP_DEPENDENCE_CHOICES) {
      const state = independentSteps(id);
      expect(state.rows.reduce((weight) => weight + 1 / state.denominator, 0)).toBe(1);
      expect(state.rows.reduce((sum, row) => sum + row.first, 0)).toBe(0);
      expect(state.rows.reduce((sum, row) => sum + row.second, 0)).toBe(0);
      expect(new Set(state.rows.map((row) => row.id)).size).toBe(state.rows.length);
      for (const row of state.rows) {
        expect(row.square).toBe(row.sumSquares + 2 * row.product);
        expect(row.product).toBe(row.first * row.second);
      }
      expect(Object.isFrozen(state)).toBe(true);
      expect(Object.isFrozen(state.rows)).toBe(true);
      expect(state.rows.every(Object.isFrozen)).toBe(true);
    }
  });

  test("signed labels keep direction explicit and do not print a negative zero", () => {
    expect([-2, -1, -0, 0, 1, 2].map(signedStepNumber)).toEqual(["−2", "−1", "0", "0", "+1", "+2"]);
  });
});
