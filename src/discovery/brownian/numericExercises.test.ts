import { describe, expect, test } from "bun:test";
import { getConstantSet } from "../../physics/reference/constants.ts";
import { withinTolerance } from "../../units/tolerance.ts";
import { checkNumericAnswer, ExerciseReferenceError } from "../exercises/numeric.ts";
import {
  EINSTEIN_INPUTS,
  EINSTEIN_ONE_SECOND,
  oneSecondPart,
  PRINTED_SET_ID,
} from "./numericExercises.ts";

/**
 * Einstein's one-second displacement as an exercise (am-disc-exercise-checker-i4h2), with the real
 * evaluators and the real printed constant set: "Einstein preset at 1 s: reference 0.7948 μm;
 * '0.79 μm' accepted; '794.8 nm' accepted after conversion. Diameter slip: a reference built with
 * a = 1 μm differs by 1/√2 (0.5620 μm on the printed set) and triggers the declared hint."
 */

const entry = (quantityId: string) => {
  const found = getConstantSet(PRINTED_SET_ID).entries.find((e) => e.quantityId === quantityId);
  if (!found) throw new TypeError(`the printed set has no ${quantityId}`);
  return found.value;
};

describe("the reference is Einstein's printed calculation", () => {
  test("the inputs are the printed set's own entries, not retyped values", () => {
    expect(EINSTEIN_INPUTS.T).toBe(entry("temperature"));
    expect(EINSTEIN_INPUTS.eta).toBe(entry("viscosity"));
    expect(EINSTEIN_INPUTS.a).toBe(entry("particleRadius"));
  });

  test("0.7948 μm, matching the set's recorded one-second displacement", () => {
    const reference = EINSTEIN_ONE_SECOND.reference;
    expect(reference.quantityId).toBe("rmsDisplacement1d");
    expect(reference.constantSetId).toBe(PRINTED_SET_ID);
    expect(reference.owner).toBe("diffusion.rmsDisplacement");
    expect(withinTolerance(reference.value, 0.7947833e-6, { relative: 1e-6 }).ok).toBe(true);
    expect(
      withinTolerance(reference.value, entry("rmsDisplacement1d"), { relative: 1e-6 }).ok,
    ).toBe(true);
  });

  test("0.79 μm, 0.8 μm and 794.8 nm are accepted", () => {
    expect(checkNumericAnswer(EINSTEIN_ONE_SECOND, "0.79", "um").kind).toBe("agrees");
    expect(checkNumericAnswer(EINSTEIN_ONE_SECOND, "0.8", "um").kind).toBe("agrees");
    expect(checkNumericAnswer(EINSTEIN_ONE_SECOND, "794.8", "nm").kind).toBe("agrees");
  });
});

describe("the diameter slip, computed rather than assumed", () => {
  test("a = 1 μm gives 0.5620 μm, and that answer triggers the diameter hint", () => {
    const withDiameter = oneSecondPart({ ...EINSTEIN_INPUTS, a: 1e-6 }).reference.value;
    expect(withinTolerance(withDiameter, 0.562e-6, { relative: 1e-3 }).ok).toBe(true);
    const verdict = checkNumericAnswer(EINSTEIN_ONE_SECOND, String(withDiameter * 1e6), "um");
    expect(verdict.kind).toBe("slip");
    expect(verdict.message).toContain(
      "using the diameter, 0.001 mm, where the formula needs the radius",
    );
  });

  test("√(4Dt), the plane distance, triggers the one-axis hint", () => {
    const plane = Math.SQRT2 * EINSTEIN_ONE_SECOND.reference.value * 1e6;
    expect(checkNumericAnswer(EINSTEIN_ONE_SECOND, plane.toFixed(3), "um").message).toContain(
      "distance in the plane",
    );
  });
});

describe("a reference that cannot be computed fails the build instead of shipping", () => {
  test("a negative radius: the evaluator refuses, and building the part throws with a code", () => {
    let code = "no refusal";
    try {
      oneSecondPart({ ...EINSTEIN_INPUTS, a: -1 });
    } catch (error) {
      code = error instanceof ExerciseReferenceError ? error.code : "another error";
    }
    expect(code).toBe("exercise-reference-not-a-value");
  });
});
