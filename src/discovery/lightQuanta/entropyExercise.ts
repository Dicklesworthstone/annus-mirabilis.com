import type { ExpressionExercisePart } from "../exercises/answer.ts";

/** The §6 correspondence in the paper's constants, before its modern h notation is introduced. */
export const ENTROPY_COUNT_EXERCISE: ExpressionExercisePart = {
  id: "lq-count-from-entropy",
  prompt:
    "Compare two constrained states with the same total radiation energy E and narrow frequency band ν, both in the dilute Wien regime. Write f = V/V0, with f positive and different from 1. The gas entropy change is (R/N)*n*ln(f); the radiation entropy change is (E/(beta*nu))*ln(f). Which expression plays the part of n when the coefficients match? Use E, R, N, beta and nu. R is the molar gas constant, N the number per mole and beta Wien's constant, in SI units. Do not round the result to an integer.",
  declaredNames: ["E", "R", "N", "beta", "nu"],
  domains: {
    E: { min: 1e-20, max: 1e-16, scale: "log" },
    R: { min: 8.3, max: 8.32 },
    N: { min: 5e23, max: 7e23 },
    beta: { min: 4.5e-11, max: 5e-11 },
    nu: { min: 5e14, max: 1.5e15, scale: "log" },
  },
  referenceSource: "N*E/(R*beta*nu)",
  tolerance: { absolute: 0, relative: 1e-9 },
  // Length, mass, time, temperature, current, amount. beta has units K·s; n is dimensionless.
  dimensions: {
    E: ["2", "1", "-2", "0", "0", "0"],
    R: ["2", "1", "-2", "-1", "0", "-1"],
    N: ["0", "0", "0", "0", "0", "-1"],
    beta: ["0", "0", "1", "1", "0", "0"],
    nu: ["0", "0", "-1", "0", "0", "0"],
  },
  conditionNote:
    "The coefficient comparison holds at fixed energy and frequency band when both states remain in the Wien regime; matching the entropy laws is a heuristic, not proof of a particle mechanism.",
  workedExplanation:
    "Because f differs from 1, ln(f) is not zero and can be removed from both sides. What remains is (R/N)*n = E/(beta*nu), so n = N*E/(R*beta*nu). E/(beta*nu) alone is an entropy coefficient, with units J/K, not a count. The ratio R/N removes those units. Only now, writing h = R*beta/N, does the result become E/(h*nu). This effective count need not be an integer, and rounding it would change the entropy law. The shared volume dependence suggests independent energy elements within the stated approximation; it does not establish a microscopic mechanism or erase the successes of waves. At f = 1 both entropy changes vanish, so that single unchanged-volume comparison determines no coefficient; the inference uses the dependence on other admissible volumes.",
};
