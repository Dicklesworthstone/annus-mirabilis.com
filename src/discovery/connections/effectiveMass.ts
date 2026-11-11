import { constantValue, getConstantSet } from "../../physics/reference/constants.ts";
import { limitingCoefficient } from "../../physics/reference/massEnergy.ts";
import { quantumEnergy } from "../../physics/reference/photoelectric.ts";
import type { ExplanationExercisePart } from "../exercises/explanation.ts";
import { type NumericExercisePart, referenceFromEvaluation } from "../exercises/numeric.ts";
import { CONNECTION_EXERCISE_LINKS } from "./links.ts";
import type { ConnectionExercise } from "./types.ts";

const SET_ID = "modern-si-2019";
const id = CONNECTION_EXERCISE_LINKS[2].id;

/**
 * Compose the light-quantum energy owner with the mass-energy owner's limiting coefficient.
 * This is a modern energy-equivalent comparison, not an invariant-mass calculation for a ray.
 */
export function quantumEnergyEquivalent(wavelengthMetres: number) {
  const set = getConstantSet(SET_ID);
  const c = constantValue(set, "speedOfLight").value;
  const quantum = referenceFromEvaluation(quantumEnergy(c / wavelengthMetres, set), {
    constantSetId: SET_ID,
    owner: "photoelectric.quantumEnergy",
    exerciseId: id,
  });
  return referenceFromEvaluation(
    limitingCoefficient(quantum.value, c),
    {
      constantSetId: SET_ID,
      owner: "photoelectric.quantumEnergy → massEnergy.limitingCoefficient",
      exerciseId: id,
    },
    { limitCoefficient: true },
  );
}

export const ENERGY_EQUIVALENT: NumericExercisePart = {
  id: `${id}-energy-equivalent`,
  prompt:
    "For light of wavelength 500 nm in vacuum, calculate hν/c² = h/(λc). Use the modern SI definitions h = 6.62607015 × 10⁻³⁴ J·s and c = 299 792 458 m/s. Give the energy equivalent in kilograms or grams.",
  workedExplanation:
    "500 nm is 5 × 10⁻⁷ m, so ν = c/λ = 5.99584916 × 10¹⁴ Hz. One quantum has energy hν ≈ 3.9729 × 10⁻¹⁹ J. Dividing by c² gives about 4.4204 × 10⁻³⁶ kg. This is an energy divided by c². It is not the invariant mass of an isolated photon, which is zero. Keeping the denominator as λc after cancelling one c is equivalent to dividing hν by c²; dividing the energy by c only would give momentum instead.",
  family: "mass",
  units: ["kg", "g"],
  reference: quantumEnergyEquivalent(500e-9),
  tolerance: { absolute: 0, relative: 0.001 },
  toleranceReason:
    "Agreement to one part in a thousand allows a rounded intermediate frequency and still distinguishes a missing power of the speed of light.",
};

export const ENERGY_EQUIVALENT_EXPLANATION: ExplanationExercisePart = {
  id: `${id}-explanation`,
  prompt:
    "A nonzero energy divided by c² and a zero invariant mass appear in the same example. Explain why they are different statements, and say which connection belongs to a modern comparison rather than to the September argument.",
  criteria: [
    "An isolated photon has zero invariant mass even though its energy and momentum are nonzero.",
    "The quotient hν/c² is an energy equivalent; a system’s invariant-mass change also depends on its momentum balance and boundary.",
    "The September paper compares a body before and after balanced emission, using the relativity paper’s radiation-energy transformation without assuming quanta.",
    "The light-quanta paper’s heuristic entropy argument does not establish special relativity.",
  ],
  workedExplanation:
    "For a photon the energy and momentum obey E = pc, so the invariant relation E² − p²c² = m²c⁴ gives m = 0. The positive number E/c² is instead an energy equivalent. A body that emits two equal, opposite pulses without recoil loses rest energy and invariant mass; a box that contains radiation must be treated together with its walls and momentum balance. An arbitrary absorbing body may recoil, so its invariant-mass increase is not obtained by ignoring momentum and writing E/c². The September paper needs the June paper’s light-energy transformation, not a quantum hypothesis. Combining hν with that argument is a later modern synthesis, not evidence that either 1905 paper proves the other.",
};

export const EFFECTIVE_MASS_EXERCISE: ConnectionExercise = {
  id,
  title: CONNECTION_EXERCISE_LINKS[2].title,
  historicalStatus: "later-development",
  introduction: [
    "Calling hν/c² an “effective mass” can hide the distinction this exercise asks you to preserve. Calculate the energy equivalent, then distinguish it from the invariant mass of an isolated photon.",
    "This is a modern lens. The light paper speaks of energy quanta; the September paper speaks of radiation energy and does not need the quantum hypothesis. Today’s exact constants are used here as definitions, not as 1905 measurements.",
  ],
  sections: [
    {
      id: `${id}-calculation`,
      title: "Calculate the energy equivalent",
      paragraphs: [],
      parts: [{ kind: "numeric", part: ENERGY_EQUIVALENT }],
    },
    {
      id: `${id}-boundary`,
      title: "Keep the system boundary in the explanation",
      paragraphs: [],
      parts: [{ kind: "explanation", part: ENERGY_EQUIVALENT_EXPLANATION }],
    },
  ],
  links: [
    {
      href: "/discover/light-quanta/#step-06",
      label: "Journey I: the heuristic entropy comparison",
    },
    { href: "/discover/mass-energy/#step-03", label: "Journey IV: the two energy ledgers" },
    {
      href: "/papers/special-relativity/#s8",
      label: "The §8 radiation-energy transformation imported by September",
    },
    { href: "/lab/light-thread/", label: "Compare the same light pulse across the three papers" },
    { href: "/lab/me-03/", label: "Change the system boundary" },
  ],
};
