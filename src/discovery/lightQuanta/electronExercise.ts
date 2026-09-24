import type { ExpressionExercisePart } from "../exercises/answer.ts";

/**
 * The electron rule as an expression (am-disc-exercise-checker-i4h2): the greatest energy an
 * electron leaves with, written by the reader. P is the paper's own letter for the energy an
 * electron needs to escape (the notation concordance: paper 1's P is the work, paper 2's is a
 * radius). h is declared as a variable over a narrow range, because the checker's only built-in
 * constant is pi.
 */
export const GREATEST_ENERGY_EXERCISE: ExpressionExercisePart = {
  id: "lq-greatest-energy-formula",
  prompt:
    "Light of frequency ν falls on a surface from which an electron needs an energy P to escape; P is the paper’s own letter. Taking up one whole quantum hν, what is the greatest energy an electron can leave with? Write it using h, ν and P, typing ν as nu.",
  declaredNames: ["h", "nu", "P"],
  domains: {
    h: { min: 6.62e-34, max: 6.63e-34 },
    nu: { min: 5e14, max: 1.5e15, scale: "log" },
    P: { min: 1e-19, max: 3e-19, scale: "log" },
  },
  referenceSource: "h*nu-P",
  tolerance: { absolute: 1e-30, relative: 1e-9 },
  // Length, mass, time, temperature, current, amount: h in J·s, nu in 1/s, P in J.
  dimensions: {
    h: ["2", "1", "-1", "0", "0", "0"],
    nu: ["0", "0", "-1", "0", "0", "0"],
    P: ["2", "1", "-2", "0", "0", "0"],
  },
  workedExplanation:
    "One quantum of the light carries hν. An electron that takes up a whole quantum and escapes has spent P getting out, so it leaves with at most hν − P, written h*nu-P. If the quantum is smaller than P, hν − P is negative and no electron leaves at all: the rule sets a threshold at the frequency where hν = P. Brighter light brings more quanta, not larger ones, so it does not raise this greatest energy.",
};
