import { describe, expect, test } from "bun:test";
import { withinTolerance } from "../../units/tolerance.ts";
import { checkNumericAnswer, ExerciseReferenceError } from "../exercises/numeric.ts";
import { MOVING_ROD, movingRodPart, ROD_INPUTS } from "./numericExercises.ts";

/** The moving rod (am-disc-exercise-checker-i4h2), with the real kinematics owner. */

describe("the reference is the owner's contracted length", () => {
  test("0.8 m for a 1 m rod at 0.6 c", () => {
    expect(withinTolerance(MOVING_ROD.reference.value, 0.8, { relative: 1e-12 }).ok).toBe(true);
    expect(MOVING_ROD.reference.owner).toBe("kinematics.contractedLength");
  });

  test("0.8 m and 80 cm agree", () => {
    expect(checkNumericAnswer(MOVING_ROD, "0.8", "m").kind).toBe("agrees");
    expect(checkNumericAnswer(MOVING_ROD, "80", "cm").kind).toBe("agrees");
  });
});

describe("each declared slip is what the slip actually computes", () => {
  const cases = [
    ["1.25", "lengthens the rod"],
    ["0.632", "√(1 − v/c)"],
    ["0.64", "without its square root"],
  ] as const;
  for (const [answer, hint] of cases)
    test(`${answer} m`, () => {
      const verdict = checkNumericAnswer(MOVING_ROD, answer, "m");
      expect(verdict.kind).toBe("slip");
      expect(verdict.message).toContain(hint);
    });

  test("the two near slips, 0.632 and 0.64, are told apart", () => {
    expect(checkNumericAnswer(MOVING_ROD, "0.632", "m").message).not.toContain("without its");
    expect(checkNumericAnswer(MOVING_ROD, "0.64", "m").message).not.toContain("√(1 − v/c)");
  });
});

describe("a reference that cannot be computed fails the build instead of shipping", () => {
  test("a rod at the speed of light: the owner refuses, and building the part throws", () => {
    let code = "no refusal";
    try {
      movingRodPart({ ...ROD_INPUTS, beta: 1 });
    } catch (error) {
      code = error instanceof ExerciseReferenceError ? error.code : "another error";
    }
    expect(code).toBe("exercise-reference-not-a-value");
  });
});
