/**
 * The Brownian encounter's numeric exercise (am-disc-exercise-checker-i4h2): Einstein's own
 * one-second displacement, from §5 of the paper, computed at build time by the host reference
 * evaluators with the printed constant set. Pages may not import the physics owners
 * (noPhysicsInComponents), so the reference is computed here and the page receives a number.
 *
 * If the evaluators ever return anything but a value for these inputs, referenceFromEvaluation
 * throws when this module loads, and the page that imports it fails to build.
 */
import { getConstantSet } from "../../physics/reference/constants.ts";
import { rmsDisplacement, stokesEinsteinD } from "../../physics/reference/diffusion.ts";
import { type NumericExercisePart, referenceFromEvaluation } from "../exercises/numeric.ts";

export const PRINTED_SET_ID = "einstein-1905-brownian-printed";

/** Temperature K, viscosity Pa·s, particle radius m, elapsed time s. */
export type OneSecondInputs = Readonly<{ T: number; eta: number; a: number; t: number }>;

/** Einstein's inputs in SI: 17 °C, k = 1,35 · 10⁻² in CGS, particles 0,001 mm across. */
export const EINSTEIN_INPUTS: OneSecondInputs = Object.freeze({
  T: 290.15,
  eta: 1.35e-3,
  a: 0.5e-6,
  t: 1,
});

/** Builds the part from inputs, so a test can show that a bad input fails instead of shipping. */
export function oneSecondPart(inputs: OneSecondInputs): NumericExercisePart {
  const id = "bm-einstein-one-second";
  const set = getConstantSet(PRINTED_SET_ID);
  const context = { constantSetId: set.id, exerciseId: id };
  const diffusion = stokesEinsteinD({ T: inputs.T, eta: inputs.eta, a: inputs.a }, set).result;
  const D = referenceFromEvaluation(diffusion, { ...context, owner: "diffusion.stokesEinsteinD" });
  const lambda = rmsDisplacement(D.value, inputs.t).result;
  return Object.freeze({
    id,
    prompt:
      "Einstein put in numbers of his own. Water at 17 °C, whose viscosity he took as 1.35 × 10⁻³ Pa·s; particles 0.001 mm across; R = 8.31 J/(mol·K) and N = 6 × 10²³ per mole. How far does such a particle typically move along one axis in one second?",
    workedExplanation:
      "First the diffusion coefficient, D = RT/(N · 6πηa). The formula needs the radius, and 0.001 mm across is a radius of 0.5 μm, which is 5 × 10⁻⁷ m. With T = 290.15 K, D = (8.31 × 290.15)/(6 × 10²³ × 6π × 1.35 × 10⁻³ × 5 × 10⁻⁷), about 3.16 × 10⁻¹³ m²/s. Along one axis the mean square displacement is 2·D·t, so after one second the typical distance is √(2 × 3.16 × 10⁻¹³ × 1) m, about 7.95 × 10⁻⁷ m, or 0.795 μm. Einstein printed it as 0.8 micron.",
    family: "length",
    units: ["um", "nm", "m"],
    reference: referenceFromEvaluation(lambda, { ...context, owner: "diffusion.rmsDisplacement" }),
    tolerance: { absolute: 0, relative: 0.01 },
    toleranceReason:
      "The inputs carry two or three significant figures, so an answer within 1 percent is the same answer; Einstein's own 0.8 micron is accepted.",
    commonSlips: [
      {
        factor: Math.SQRT1_2,
        message:
          "Two slips give exactly this. One is using the diameter, 0.001 mm, where the formula needs the radius. The other is taking √(D·t) where one axis needs √(2·D·t).",
      },
      {
        factor: Math.SQRT2,
        message:
          "That is the distance in the plane, √(4·D·t). The question asks along one axis, where the mean square is 2·D·t.",
      },
    ],
  });
}

export const EINSTEIN_ONE_SECOND = oneSecondPart(EINSTEIN_INPUTS);
