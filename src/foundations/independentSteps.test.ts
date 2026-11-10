import { describe, expect, test } from "bun:test";
import {
  enumerateBiasedTwoSteps,
  enumerateSignedSteps,
  StepChanceError,
} from "../physics/reference/stepEnumeration.ts";
import {
  compareSteps,
  independentSteps,
  STEP_DEPENDENCE_CHOICES,
  signedStepNumber,
  stepNumber,
} from "./independentSteps.ts";

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

describe("bias changes centring without replacing the reference enumeration", () => {
  test("a fresh biased coin retains the product of the nonzero means", () => {
    const state = independentSteps("independent", 75);
    expect(state.rows.map((row) => row.probability)).toEqual([0.0625, 0.1875, 0.1875, 0.5625]);
    expect(state).toMatchObject({
      firstMean: 0.5,
      secondMean: 0.5,
      meanProduct: 0.25,
      meanCrossTerm: 0.5,
      mean: 1,
      meanSquare: 2.5,
      variance: 1.5,
      covariance: 0,
      independent: true,
      chanceRightAfterRight: 75,
      secondRightPercent: 75,
    });
  });

  test("all 303 admitted settings conserve exact weights and match closed-form moments", () => {
    for (let percent = 0; percent <= 100; percent++) {
      const mean = (2 * percent) / 100 - 1;
      for (const { id } of STEP_DEPENDENCE_CHOICES) {
        const state = independentSteps(id, percent);
        const reference = enumerateSignedSteps(2, id);
        expect(state.rows.map((row) => row.steps)).toEqual(reference.rows.map((row) => row.steps));
        expect(state.rows.reduce((sum, row) => sum + row.weight, 0)).toBe(state.denominator);
        expect(state.rows.reduce((sum, row) => sum + row.probability, 0)).toBeCloseTo(1, 14);
        expect(state.meanSquare).toBeCloseTo(2 + state.meanCrossTerm, 14);
        expect(state.meanSquare).toBeCloseTo(state.variance + state.mean ** 2, 14);
        expect(state.variance).toBeGreaterThanOrEqual(0);
        expect(state.firstMean).toBeCloseTo(mean, 14);
        if (id === "independent") {
          expect(state.meanProduct).toBeCloseTo(mean ** 2, 14);
          expect(state.variance).toBeCloseTo(2 * (1 - mean ** 2), 14);
          expect(state.covariance).toBe(0);
        } else if (id === "same-direction") {
          expect(state.meanSquare).toBe(4);
          expect(state.variance).toBeCloseTo(4 * (1 - mean ** 2), 14);
          expect(state.covariance).toBeCloseTo(1 - mean ** 2, 14);
        } else {
          expect(state.meanSquare).toBe(0);
          expect(state.mean).toBe(0);
          expect(state.variance).toBe(0);
          expect(state.covariance).toBeCloseTo(mean ** 2 - 1, 14);
        }
      }
    }
  });

  test("certain steps are independent and an impossible conditioning event has no chance", () => {
    for (const percent of [0, 100]) {
      for (const { id } of STEP_DEPENDENCE_CHOICES) {
        const state = independentSteps(id, percent);
        expect(state.independent).toBe(true);
        expect(state.covariance).toBe(0);
        expect(state.rows.filter((row) => row.probability > 0)).toHaveLength(1);
        if (percent === 0) expect(state.chanceRightAfterRight).toBeNull();
      }
    }
  });

  test("invalid-step-chance refuses invalid percentages without changing the fair comparison", () => {
    for (const input of ["", " ", "1.5", "-1", "101", "NaN", "Infinity", "1e309"])
      expect(compareSteps(input, "same-direction")).toMatchObject({ kind: "invalid" });
    for (const percent of [NaN, Infinity, -1, 101, 25.5]) {
      expect(() => independentSteps("independent", percent)).toThrow(StepChanceError);
      try {
        enumerateBiasedTwoSteps(percent);
      } catch (error) {
        expect(error).toMatchObject({ code: "invalid-step-chance" });
      }
    }
    expect(enumerateBiasedTwoSteps(50).meanSquare).toBe(2);
    expect(compareSteps("75", "independent").kind).toBe("accepted");
    expect(independentSteps("independent").meanSquare).toBe(2);
    expect(stepNumber(-0)).toBe("0");
    expect(stepNumber(-0.0004)).toBe("−0.0004");
  });
});
