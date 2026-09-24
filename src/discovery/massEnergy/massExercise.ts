import type { ExpressionExercisePart } from "../exercises/answer.ts";
import type { ExplanationExercisePart } from "../exercises/explanation.ts";

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

/**
 * The angle drops out (am-disc-journey-iv-chain-wwrz exercise 2). φ is left undeclared on purpose:
 * a total that still contains the angle is refused by name, so pasting the unsimplified sum back
 * is not accepted as having shown the cancellation.
 */
export const PULSE_SUM_EXERCISE: ExpressionExercisePart = {
  id: "me-pulse-sum",
  prompt:
    "In the moving frame one pulse carries (L/2)(1 − (v/V)cos φ)/√(1 − (v/V)²) and the other (L/2)(1 + (v/V)cos φ)/√(1 − (v/V)²). Add them. Write the total using only L, v and V.",
  declaredNames: ["L", "v", "V"],
  domains: {
    L: { min: 1, max: 1e10, scale: "log" },
    v: { min: 0, max: 2.8e8 },
    V: { min: 2.99e8, max: 3e8 },
  },
  referenceSource: "L/sqrt(1-(v/V)^2)",
  tolerance: { absolute: 1e-30, relative: 1e-9 },
  // Length, mass, time, temperature, current, amount: L in J, v and V in m/s.
  dimensions: {
    L: ["2", "1", "-2", "0", "0", "0"],
    v: ["1", "0", "-1", "0", "0", "0"],
    V: ["1", "0", "-1", "0", "0", "0"],
  },
  workedExplanation:
    "Both pulses share the factor (L/2)/√(1 − (v/V)²). Inside the brackets −(v/V)cos φ and +(v/V)cos φ cancel, and 1 + 1 leaves 2, so the total is L/√(1 − (v/V)²) whatever the angle φ. One pulse gains what the other loses to the angle, and only the speed remains. At v = 0.6V the square root is 0.8, so the pair carries 1.25 L, against the L the body gave off in its own frame.",
};

/** Why two equal, opposite pulses (exercise 5). Nothing reads the answer; the reader judges it. */
export const EQUAL_AND_OPPOSITE_EXPLANATION: ExplanationExercisePart = {
  id: "me-equal-and-opposite",
  prompt:
    "Why does the argument have the body give off two equal pulses in opposite directions, rather than one?",
  criteria: [
    "With two equal pulses in opposite directions the body does not recoil, so its speed is the same before and after.",
    "With the speed unchanged, a change in its energy of motion can only come from a change in its mass.",
    "Seen from the moving frame the two pulses carry different energies, but their total does not depend on the direction they leave in.",
    "The symmetry is a choice made to isolate one unknown, not a claim about how bodies give off light.",
  ],
  workedExplanation:
    "One pulse would push the body the other way, and afterwards some of the change in its energy of motion would be a change of speed. Two equal pulses in opposite directions push equally both ways, so the body stays at rest in its own frame and keeps the same speed in the moving one. Then the only thing left that can account for the drop in its energy of motion is its mass. The moving observer measures one pulse with more energy than the other, but the sum does not depend on the direction of emission, so the argument need not say which way the light went.",
};
