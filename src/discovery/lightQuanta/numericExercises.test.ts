import { describe, expect, test } from "bun:test";
import { withinTolerance } from "../../units/tolerance.ts";
import { checkNumericAnswer, ExerciseReferenceError } from "../exercises/numeric.ts";
import {
  GREATEST_ELECTRON_ENERGY,
  greatestEnergyPart,
  SURFACE_INPUTS,
} from "./numericExercises.ts";

/**
 * The made-up surface (am-disc-exercise-checker-i4h2), with the real owner and the 2019 SI set:
 * "hν − Φ at 600 THz is 0.4814 eV."
 */

const EV = 1.602176634e-19;

describe("the reference is the owner's greatest energy", () => {
  test("0.4814 eV under the modern SI set, from photoelectric.kMax", () => {
    const reference = GREATEST_ELECTRON_ENERGY.reference;
    expect(withinTolerance(reference.value / EV, 0.4814, { relative: 1e-4 }).ok).toBe(true);
    expect(reference.constantSetId).toBe("modern-si-2019");
    expect(reference.owner).toBe("photoelectric.kMax");
    expect(reference.quantityId).toBe("maxKineticEnergy");
  });

  test("0.48 eV, 0.4814 eV and 7.71e-20 J agree", () => {
    expect(checkNumericAnswer(GREATEST_ELECTRON_ENERGY, "0.48", "eV").kind).toBe("agrees");
    expect(checkNumericAnswer(GREATEST_ELECTRON_ENERGY, "0.4814", "eV").kind).toBe("agrees");
    expect(checkNumericAnswer(GREATEST_ELECTRON_ENERGY, "7.71e-20", "J").kind).toBe("agrees");
  });
});

describe("each declared slip is what the slip actually computes", () => {
  test("the whole quantum, hν = 2.481 eV", () => {
    const verdict = checkNumericAnswer(GREATEST_ELECTRON_ENERGY, "2.481", "eV");
    expect(verdict.kind).toBe("slip");
    expect(verdict.message).toContain("That is the whole quantum, hν.");
  });

  test("the work function added, 4.481 eV", () => {
    const verdict = checkNumericAnswer(GREATEST_ELECTRON_ENERGY, "4.481", "eV");
    expect(verdict.kind).toBe("slip");
    expect(verdict.message).toContain("That adds the 2");
  });
});

describe("a reference that cannot be computed fails the build instead of shipping", () => {
  test("a frequency too low to free an electron: not-applicable, and building the part throws", () => {
    let code = "no refusal";
    try {
      greatestEnergyPart({ ...SURFACE_INPUTS, frequency: 1e14 });
    } catch (error) {
      code = error instanceof ExerciseReferenceError ? error.code : "another error";
    }
    expect(code).toBe("exercise-reference-not-a-value");
  });
});
