import { describe, expect, test } from "bun:test";
import { C_SI } from "../../physics/reference/massEnergy.ts";
import { withinTolerance } from "../../units/tolerance.ts";
import { checkNumericAnswer, ExerciseReferenceError } from "../exercises/numeric.ts";
import { LAMP_INPUTS, lampYearPart, SEALED_LAMP_YEAR } from "./numericExercises.ts";

/**
 * The sealed lamp (am-disc-exercise-checker-i4h2), with the real owner: "Pt/c² for 100 W over
 * 3.156 × 10⁷ s is 3.5115 × 10⁻⁸ kg."
 */

const emitted = LAMP_INPUTS.power * LAMP_INPUTS.seconds;

describe("the reference is the owner's limit coefficient", () => {
  test("3.5115 × 10⁻⁸ kg, recorded as a coefficient identified in a limit", () => {
    const reference = SEALED_LAMP_YEAR.reference;
    expect(withinTolerance(reference.value, 3.5115e-8, { relative: 1e-4 }).ok).toBe(true);
    expect(reference.resultStatus).toBe("analytic-limit");
    expect(reference.owner).toBe("massEnergy.limitingCoefficient");
    expect(reference.quantityId).toBe("inertialMassDecrease");
  });

  test("3.51e-8 kg, 3.5e-5 g and 35.1e-6 g all agree", () => {
    expect(checkNumericAnswer(SEALED_LAMP_YEAR, "3.51e-8", "kg").kind).toBe("agrees");
    expect(checkNumericAnswer(SEALED_LAMP_YEAR, "3.5e-5", "g").kind).toBe("agrees");
    expect(checkNumericAnswer(SEALED_LAMP_YEAR, "35.1e-6", "g").kind).toBe("agrees");
  });
});

describe("each declared slip is what the slip actually computes", () => {
  const cases = [
    ["dividing by c once", emitted / C_SI, "divided by the speed of light once"],
    ["one second's worth", LAMP_INPUTS.power / C_SI ** 2, "one second’s worth"],
    ["multiplying by c²", emitted * C_SI ** 2, "multiplied by the square of the speed of light"],
  ] as const;
  for (const [name, answer, hint] of cases)
    test(name, () => {
      const verdict = checkNumericAnswer(SEALED_LAMP_YEAR, answer.toPrecision(4), "kg");
      expect(verdict.kind).toBe("slip");
      expect(verdict.message).toContain(hint);
    });
});

describe("a reference that cannot be computed fails the build instead of shipping", () => {
  test("a negative power: the owner refuses, and building the part throws with a code", () => {
    let code = "no refusal";
    try {
      lampYearPart({ ...LAMP_INPUTS, power: -100 });
    } catch (error) {
      code = error instanceof ExerciseReferenceError ? error.code : "another error";
    }
    expect(code).toBe("exercise-reference-not-a-value");
  });
});
