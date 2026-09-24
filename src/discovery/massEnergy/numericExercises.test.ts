import { describe, expect, test } from "bun:test";
import { C_SI } from "../../physics/reference/massEnergy.ts";
import { withinTolerance } from "../../units/tolerance.ts";
import { checkNumericAnswer, ExerciseReferenceError } from "../exercises/numeric.ts";
import {
  BOX_INPUTS,
  BOX_RECOIL,
  LAMP_INPUTS,
  lampYearPart,
  PROXY_AT_SIX_TENTHS,
  PROXY_INPUTS,
  SEALED_LAMP_YEAR,
} from "./numericExercises.ts";

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

/**
 * Journey IV's exercises 3 and 4 (am-disc-journey-iv-chain-wwrz), with the real owners: "photonInBox
 * with E = 1 J, ℓ = 1 m, M = 1 kg gives 1.11265 × 10⁻¹⁷ m", and "the proxy at 0.6c is 1.388889".
 */
describe("the 1906 box's recoil", () => {
  test("the reference is the owner's signed displacement, 1.11265 × 10⁻¹⁷ m back", () => {
    expect(withinTolerance(BOX_RECOIL.reference.value, -1.11265e-17, { relative: 1e-5 }).ok).toBe(
      true,
    );
    expect(BOX_RECOIL.reference.owner).toBe("massEnergy.box");
    expect(BOX_RECOIL.reference.quantityId).toBe("boxDisplacement");
  });

  test("the displacement agrees in m and nm, and its size with the wrong sign is told so", () => {
    expect(checkNumericAnswer(BOX_RECOIL, "-1.11e-17", "m").kind).toBe("agrees");
    expect(checkNumericAnswer(BOX_RECOIL, "-1.11e-8", "nm").kind).toBe("agrees");
    const flipped = checkNumericAnswer(BOX_RECOIL, "1.11e-17", "m");
    expect(flipped.kind).toBe("differs");
    expect(flipped.message).toContain("opposite sign");
  });

  test("dividing by c once is the slip it names", () => {
    const once = -(BOX_INPUTS.energy * BOX_INPUTS.length) / (BOX_INPUTS.mass * C_SI);
    const verdict = checkNumericAnswer(BOX_RECOIL, once.toPrecision(4), "m");
    expect(verdict.kind).toBe("slip");
    expect(verdict.message).toContain("divides by the speed of light once");
  });
});

describe("the finite-speed quotient at 0.6c", () => {
  const limit = PROXY_INPUTS.energy / C_SI ** 2;

  test("the reference is 1.388889 times L/c², from the owner", () => {
    const reference = PROXY_AT_SIX_TENTHS.reference;
    expect(withinTolerance(reference.value / limit, 1.388889, { relative: 1e-6 }).ok).toBe(true);
    expect(reference.owner).toBe("massEnergy.finiteSpeedProxy");
  });

  test("the limit itself is the slip that says it is the limit", () => {
    const verdict = checkNumericAnswer(PROXY_AT_SIX_TENTHS, limit.toPrecision(4), "kg");
    expect(verdict.kind).toBe("slip");
    expect(verdict.message).toContain("the limit the quotient approaches");
  });

  test("the drop over v², without the factor two, is the other", () => {
    const half = 0.25 / (PROXY_INPUTS.beta * C_SI) ** 2;
    const verdict = checkNumericAnswer(PROXY_AT_SIX_TENTHS, half.toPrecision(4), "kg");
    expect(verdict.kind).toBe("slip");
    expect(verdict.message).toContain("twice the drop");
  });

  test("the answer agrees in kg and in g", () => {
    expect(checkNumericAnswer(PROXY_AT_SIX_TENTHS, "1.545e-17", "kg").kind).toBe("agrees");
    expect(checkNumericAnswer(PROXY_AT_SIX_TENTHS, "1.545e-14", "g").kind).toBe("agrees");
  });
});
