/**
 * The mass-energy encounter's numeric exercise (am-disc-exercise-checker-i4h2): the paper's result
 * put to a number a reader can picture, computed at build time by the host reference owner. Pages
 * may not import physics owners (noPhysicsInComponents), so the page receives a number from here.
 *
 * The owner reports the mass coefficient as an analytic limit, the coefficient identified at
 * vanishing speed, which is the paper's own identification; the part accepts it explicitly
 * (limitCoefficient). Any other status throws when this module loads and fails the page's build.
 */
import { C_SI, limitingCoefficient } from "../../physics/reference/massEnergy.ts";
import { type NumericExercisePart, referenceFromEvaluation } from "../exercises/numeric.ts";

/** Radiated power W, and how long it is given off, s. */
export type LampInputs = Readonly<{ power: number; seconds: number }>;

/** 100 watts for a year of 365.25 days, 3.156 × 10⁷ s to four figures. */
export const LAMP_INPUTS: LampInputs = Object.freeze({ power: 100, seconds: 3.156e7 });

/** Builds the part from inputs, so a test can show that a bad input fails instead of shipping. */
export function lampYearPart(inputs: LampInputs): NumericExercisePart {
  const id = "me-sealed-lamp-year";
  const emitted = inputs.power * inputs.seconds;
  return Object.freeze({
    id,
    prompt:
      "A sealed box holds a lamp and the battery that powers it. For a year, about 3.156 × 10⁷ seconds, it gives off 100 watts as light and heat. By how much has the box’s mass fallen? Give it in kilograms or grams.",
    workedExplanation:
      "The energy given off is the power times the time: 100 W × 3.156 × 10⁷ s = 3.156 × 10⁹ J. The paper’s result says the mass falls by that energy divided by the square of the speed of light. With the speed of light as the SI defines it, 299 792 458 m/s, its square is about 8.988 × 10¹⁶ m²/s², so the mass falls by 3.156 × 10⁹ / 8.988 × 10¹⁶, about 3.51 × 10⁻⁸ kg: some 35 micrograms. For comparison, the paper’s closing paragraph suggests that the theory might be tested on bodies whose energy content varies a great deal, such as radium salts.",
    family: "mass",
    units: ["kg", "g"],
    reference: referenceFromEvaluation(
      limitingCoefficient(emitted),
      { constantSetId: "modern-si-2019", owner: "massEnergy.limitingCoefficient", exerciseId: id },
      { limitCoefficient: true },
    ),
    tolerance: { absolute: 0, relative: 0.01 },
    toleranceReason:
      "The year is given to four figures, so an answer within 1 percent is the same answer.",
    commonSlips: [
      {
        factor: C_SI,
        message:
          "That is the energy divided by the speed of light once. The mass falls by the energy divided by its square.",
      },
      {
        factor: 1 / inputs.seconds,
        message:
          "That is one second’s worth. The energy given off is the power times the whole time.",
      },
      {
        factor: C_SI ** 4,
        message:
          "That is the energy multiplied by the square of the speed of light. The mass falls by the energy divided by it.",
      },
    ],
  });
}

export const SEALED_LAMP_YEAR = lampYearPart(LAMP_INPUTS);
