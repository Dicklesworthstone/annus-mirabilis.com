/**
 * The mass-energy encounter's numeric exercise (am-disc-exercise-checker-i4h2): the paper's result
 * put to a number a reader can picture, computed at build time by the host reference owner. Pages
 * may not import physics owners (noPhysicsInComponents), so the page receives a number from here.
 *
 * The owner reports the mass coefficient as an analytic limit, the coefficient identified at
 * vanishing speed, which is the paper's own identification; the part accepts it explicitly
 * (limitCoefficient). Any other status throws when this module loads and fails the page's build.
 */
import {
  C_SI,
  evaluatePhotonBox,
  finiteSpeedProxy,
  limitingCoefficient,
} from "../../physics/reference/massEnergy.ts";
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

/** The 1906 box (am-disc-journey-iv-chain-wwrz exercise 3): mass kg, length m, pulse energy J. */
export type BoxInputs = Readonly<{ mass: number; length: number; energy: number }>;

export const BOX_INPUTS: BoxInputs = Object.freeze({ mass: 1, length: 1, energy: 1 });

/** The box's displacement from the owner's photon-in-a-box evaluation, signed along the light. */
export function boxRecoilPart(inputs: BoxInputs): NumericExercisePart {
  const id = "me-box-recoil";
  const box = evaluatePhotonBox({
    M: inputs.mass,
    ell: inputs.length,
    E: inputs.energy,
    assignLightMass: true,
  });
  return Object.freeze({
    id,
    prompt:
      "Einstein’s argument of 1906: a closed box of mass 1 kg and length 1 m, floating free, sends a pulse of 1 J of light from one end to the other. The light carries momentum, so the box recoils until the light arrives. How far has the box moved? Give its displacement along the direction the light travels, negative if it moves back.",
    workedExplanation:
      "The pulse carries momentum E/c, so the box recoils at E/(Mc) = 1/(1 × 2.998 × 10⁸), about 3.34 × 10⁻⁹ m/s. It moves for as long as the light takes to cross, ℓ/c, also about 3.34 × 10⁻⁹ s. The displacement is the product, Eℓ/(Mc²) = 1.11 × 10⁻¹⁷ m, backwards, so −1.11 × 10⁻¹⁷ m along the light. A closed box’s centre of mass cannot move on its own, so the light must have carried a mass E/c² from one end to the other. The argument credits Poincaré’s fluid of 1900, and it treats the box as rigid, its recoil as slow and the crossing time as ℓ/c.",
    family: "length",
    units: ["m", "nm"],
    reference: referenceFromEvaluation(box.boxDisplacement, {
      constantSetId: "modern-si-2019",
      owner: "massEnergy.box",
      exerciseId: id,
    }),
    tolerance: { absolute: 0, relative: 0.01 },
    toleranceReason:
      "The inputs are round numbers and the speed of light is exact, so an answer within 1 percent is the same answer.",
    // A positive answer of the right size is met by the checker's own sentence: "Your value has
    // the opposite sign to the reference." Slip factors are positive by the checker's rule.
    commonSlips: [
      {
        factor: C_SI,
        message:
          "That divides by the speed of light once. The recoil speed carries one factor of it and the crossing time another.",
      },
    ],
  });
}

export const BOX_RECOIL = boxRecoilPart(BOX_INPUTS);

/** The finite-speed quotient (exercise 4): energy given off, J, and speed as a fraction of c. */
export type ProxyInputs = Readonly<{ energy: number; beta: number }>;

export const PROXY_INPUTS: ProxyInputs = Object.freeze({ energy: 1, beta: 0.6 });

/**
 * Twice the drop in energy of motion divided by v², from the owner, beside the limit the paper
 * reads. The slip "gave the limit" is the owner's own ratio of the two, not a typed 0.72.
 */
export function proxyPart(inputs: ProxyInputs): NumericExercisePart {
  const id = "me-finite-speed-proxy";
  const reference = referenceFromEvaluation(finiteSpeedProxy(inputs.energy, inputs.beta), {
    constantSetId: "modern-si-2019",
    owner: "massEnergy.finiteSpeedProxy",
    exerciseId: id,
  });
  const limit = referenceFromEvaluation(
    limitingCoefficient(inputs.energy),
    { constantSetId: "modern-si-2019", owner: "massEnergy.limitingCoefficient", exerciseId: id },
    { limitCoefficient: true },
  );
  return Object.freeze({
    id,
    prompt:
      "At 0.6 of the speed of light, γ = 1.25, so a body that gives off L = 1 J of light loses exactly 0.25 J of energy of motion. Read a mass off that drop as you would off one half of mass times speed squared: take twice the drop and divide by v². What do you get, in kilograms?",
    workedExplanation:
      "Twice the drop is 0.5 J, and v² = (0.6 × 2.998 × 10⁸ m/s)² = 3.236 × 10¹⁶ m²/s², so the quotient is 0.5 / (3.236 × 10¹⁶), about 1.545 × 10⁻¹⁷ kg. That is 1.389 times L/c², which is 1.113 × 10⁻¹⁷ kg. The quotient still depends on the speed you chose: as the speed goes to zero it comes down to L/c², and only there does one half of mass times speed squared describe the energy of motion. The paper reads the mass off that limit, not off this quotient at any finite speed.",
    family: "mass",
    units: ["kg", "g"],
    reference,
    tolerance: { absolute: 0, relative: 0.005 },
    toleranceReason:
      "0.6 and 0.25 are exact and the speed of light is exact, so an answer within half a percent is the same answer.",
    commonSlips: [
      {
        factor: limit.value / reference.value,
        message:
          "That is L/c², the limit the quotient approaches as the speed goes to zero. At 0.6 of the speed of light the quotient is larger, and the difference is the point of the exercise.",
      },
      {
        factor: 0.5,
        message:
          "That is the drop divided by v². Reading a mass off one half of mass times speed squared means taking twice the drop.",
      },
    ],
  });
}

export const PROXY_AT_SIX_TENTHS = proxyPart(PROXY_INPUTS);
