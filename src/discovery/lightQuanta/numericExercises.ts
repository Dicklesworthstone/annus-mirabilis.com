/**
 * The light-quanta encounter's numeric exercise (am-disc-exercise-checker-i4h2): the photoelectric
 * rule tried on numbers, computed at build time by the host reference owner with the 2019 SI
 * constants. Pages may not import physics owners (noPhysicsInComponents), so the page receives a
 * number from here.
 *
 * The surface is made up, not a named metal, and the constant is today's h: this is the rule's
 * arithmetic under a modern lens, not a claim about any 1905 measurement. Einstein's own §8
 * estimate is not used here, because the paper-1 ledger it would rest on is not yet reviewed.
 */
import { getConstantSet } from "../../physics/reference/constants.ts";
import { kMax } from "../../physics/reference/photoelectric.ts";
import { convertValue } from "../../units/adapters.ts";
import { type NumericExercisePart, referenceFromEvaluation } from "../exercises/numeric.ts";

const SET_ID = "modern-si-2019";

/** Frequency Hz, and the energy an electron needs to escape, eV. */
export type SurfaceInputs = Readonly<{ frequency: number; workFunctionEv: number }>;

export const SURFACE_INPUTS: SurfaceInputs = Object.freeze({ frequency: 6e14, workFunctionEv: 2 });

/** Builds the part from inputs, so a test can show that a bad input fails instead of shipping. */
export function greatestEnergyPart(inputs: SurfaceInputs): NumericExercisePart {
  const id = "lq-greatest-electron-energy";
  const set = getConstantSet(SET_ID);
  const workFunction = convertValue(inputs.workFunctionEv, "eV", "J");
  const quantum = kMax(inputs.frequency, 0, set);
  const reference = referenceFromEvaluation(kMax(inputs.frequency, workFunction, set), {
    constantSetId: SET_ID,
    owner: "photoelectric.kMax",
    exerciseId: id,
  });
  const whole = referenceFromEvaluation(quantum, {
    constantSetId: SET_ID,
    owner: "photoelectric.kMax",
    exerciseId: id,
  }).value;
  return Object.freeze({
    id,
    prompt:
      "Try the rule on numbers, with today’s value of the constant in it, Planck’s h = 6.62607015 × 10⁻³⁴ J·s, and 1 eV = 1.602176634 × 10⁻¹⁹ J. Light of frequency 600 THz falls on a surface from which an electron needs 2 eV to escape; the surface is made up, not a named metal. What is the greatest energy an electron can leave with? Give it in electron volts or joules.",
    workedExplanation:
      "Each quantum of this light carries hν = 6.62607015 × 10⁻³⁴ J·s × 6 × 10¹⁴ s⁻¹, about 3.976 × 10⁻¹⁹ J, which is 2.481 eV. An electron that takes up one whole quantum and escapes has paid 2 eV to get out, so it leaves with at most 2.481 − 2 = 0.481 eV, or 7.71 × 10⁻²⁰ J. Making the light brighter does not raise this number; in this picture only the frequency does.",
    family: "energy",
    units: ["eV", "J"],
    reference,
    tolerance: { absolute: 0, relative: 0.01 },
    toleranceReason:
      "An answer within 1 percent is the same answer, so 0.48 eV and 0.481 eV both agree.",
    commonSlips: [
      {
        factor: whole / reference.value,
        message:
          "That is the whole quantum, hν. An electron that escapes has already paid the 2 eV it needs to get out.",
      },
      {
        factor: (whole + workFunction) / reference.value,
        message:
          "That adds the 2 eV. The electron spends it to escape, so it comes off the quantum’s energy.",
      },
    ],
  });
}

export const GREATEST_ELECTRON_ENERGY = greatestEnergyPart(SURFACE_INPUTS);
