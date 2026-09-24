import type { ExpressionExercisePart } from "../exercises/answer.ts";

/**
 * The moving clock as an expression (am-disc-exercise-checker-i4h2). v and c are separate
 * variables with ranges that keep v below c. The paper's β is today's γ, so v/c is never called
 * β here.
 */
export const MOVING_CLOCK_EXERCISE: ExpressionExercisePart = {
  id: "sr-moving-clock-reading",
  prompt:
    "Your clocks advance by t while a clock moving past you at speed v runs between two of its own ticks. What does the moving clock read? Write it using t, v and c, the speed of light.",
  declaredNames: ["t", "v", "c"],
  domains: {
    t: { min: 1, max: 100, scale: "log" },
    v: { min: 1e7, max: 2.9e8, scale: "log" },
    c: { min: 2.99e8, max: 3e8 },
  },
  referenceSource: "t*sqrt(1-v^2/c^2)",
  tolerance: { absolute: 1e-9, relative: 1e-9 },
  // Length, mass, time, temperature, current, amount: t in s, v and c in m/s, so an answer that
  // subtracts a speed from a pure number is told so before any numbers are compared.
  dimensions: {
    t: ["0", "0", "1", "0", "0", "0"],
    v: ["1", "0", "-1", "0", "0", "0"],
    c: ["1", "0", "-1", "0", "0", "0"],
  },
  workedExplanation:
    "The moving clock reads less than yours by the factor √(1 − v²/c²), so it reads t·√(1 − v²/c²), which you can write t*sqrt(1-v^2/c^2) or t*sqrt(1-(v/c)^2). At v = 0.6c the factor is √0.64 = 0.8: the moving clock reads 8 seconds while yours read 10. The paper writes V for the speed of light, so its form is t·√(1 − (v/V)²). Dividing by the factor instead, t/√(1 − v²/c²), gives the time your clocks show while the moving clock reads t, which is the same fact seen from the other side.",
};
