import type { ExpressionExercisePart } from "../exercises/answer.ts";

/**
 * The paper's result as an expression (am-disc-exercise-checker-i4h2), in the paper's own letters:
 * L for the energy given off and V for the speed of light, as step 05 of the mass-energy page
 * introduces them. The declared dimensions make the likeliest slips, L/V and L·V², answer with
 * their dimension (a momentum; a quantity in kg·m⁴·s⁻⁴) before any numbers are compared.
 */
export const MASS_GIVEN_UP_EXERCISE: ExpressionExercisePart = {
  id: "me-mass-given-up-formula",
  prompt:
    "A body gives off an energy L as light. By how much does its mass fall? Write it using L and V, the paper’s letters for the energy given off and the speed of light.",
  declaredNames: ["L", "V"],
  domains: {
    L: { min: 1, max: 1e10, scale: "log" },
    V: { min: 2.99e8, max: 3e8 },
  },
  referenceSource: "L/V^2",
  tolerance: { absolute: 1e-40, relative: 1e-9 },
  // Length, mass, time, temperature, current, amount: L in J, V in m/s.
  dimensions: {
    L: ["2", "1", "-2", "0", "0", "0"],
    V: ["1", "0", "-1", "0", "0", "0"],
  },
  workedExplanation:
    "The paper's last page reads the coefficient off the comparison with the energy of motion: the mass falls by L/V², the energy given off divided by the square of the speed of light, which is written c today. With L in joules and V in metres per second, L/V² comes out in kilograms. L/V is not a mass but a momentum, and L·V² is not a mass either; the square of the speed goes underneath.",
};
