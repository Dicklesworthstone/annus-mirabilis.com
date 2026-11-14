/**
 * A reconstruction from printed products, followed by a coefficient-only correction.
 * The source values are from page images, not a fitted modern target. Full provenance:
 * docs/provenance/datasets/dissertation-1906-1911.md. No human review is claimed.
 */
import {
  correctMolecularCoefficient,
  inferMolecularProducts,
} from "../../physics/reference/molecularProducts.ts";
import { type NumericExercisePart, referenceFromEvaluation } from "../exercises/numeric.ts";

export const DISSERTATION_SOURCES = Object.freeze({
  dissertation: Object.freeze({
    path: "public/papers/pdfs/ap-19-289.pdf",
    sha256: "41cc49db4c4e232dba7a3f3d2339f866c46652f34ace3f354e712b5e338a1cf3",
    mainHref: "/papers/pdfs/ap-19-289.pdf#page=17",
    supplementHref: "/papers/pdfs/ap-19-289.pdf#page=18",
    mainPage: 305,
    supplementPage: 306,
  }),
  correction: Object.freeze({
    path: "public/papers/pdfs/ap-34-591.pdf",
    sha256: "9fc1fa2fecc9ecab14204f1c1cd8bdb498c5d6041b083396a6a3eef602539798",
    href: "/papers/pdfs/ap-34-591.pdf#page=2",
    page: 592,
  }),
  checkedBy: "GPT-6 Astra Pro (AI agent), visual inspection of pinned page images",
  checkedAt: "2026-11-14",
  humanReviewed: false,
});

/** SI transport. The source's P is the modern radius a, not its diameter. */
export const DISSERTATION_PRINTED = Object.freeze({
  main: Object.freeze({
    products: Object.freeze({
      radiusTimesNumber: 2.08e14, // NP = 2.08 × 10^16 cm/mol on p. 305.
      viscosityProduct: 200e-6, // NP³ = 200 cm³/mol on p. 305, coefficient 1.
      viscosityCoefficient: 1 as const,
    }),
    radius: 9.9e-10, // P = 9.9 × 10^-8 cm.
    molecularNumber: 2.1e23,
  }),
  supplement: Object.freeze({
    radius: 0.78e-9, // P = 0.78 × 10^-6 mm on p. 306, NOT 4.9 × 10^-8 cm.
    molecularNumber: 4.15e23,
    viscosityCoefficient: 1 as const,
  }),
  correction: Object.freeze({
    molecularNumber: 6.56e23,
    viscosityCoefficient: 2.5 as const,
    // No corrected radius is printed in the correction note.
  }),
});

const main = inferMolecularProducts(DISSERTATION_PRINTED.main.products);
const correctedMain = inferMolecularProducts({
  ...DISSERTATION_PRINTED.main.products,
  viscosityCoefficient: DISSERTATION_PRINTED.correction.viscosityCoefficient,
});
const correctedSupplement = correctMolecularCoefficient({
  ...DISSERTATION_PRINTED.supplement,
  fromCoefficient: DISSERTATION_PRINTED.supplement.viscosityCoefficient,
  toCoefficient: DISSERTATION_PRINTED.correction.viscosityCoefficient,
});

const context = (exerciseId: string, owner: string) => ({
  constantSetId: "none: printed molecular products; no physical constants substituted",
  owner: `molecular-dimensions.${owner}`,
  exerciseId,
});

export const DISSERTATION_RECONSTRUCTION = Object.freeze({
  main: Object.freeze({
    radius: referenceFromEvaluation(
      main.radius,
      context("cross-journey-avogadro-dissertation-radius", "inferMolecularProducts"),
    ),
    molecularNumber: referenceFromEvaluation(
      main.molecularNumber,
      context("cross-journey-avogadro-dissertation-number", "inferMolecularProducts"),
    ),
  }),
  correctedMain: Object.freeze({
    molecularNumber: referenceFromEvaluation(
      correctedMain.molecularNumber,
      context("cross-journey-avogadro-dissertation-original-data", "inferMolecularProducts"),
    ),
  }),
  correctedSupplement: Object.freeze({
    radius: referenceFromEvaluation(
      correctedSupplement.radius,
      context("cross-journey-avogadro-dissertation-corrected-radius", "correctMolecularCoefficient"),
    ),
    molecularNumber: referenceFromEvaluation(
      correctedSupplement.molecularNumber,
      context("cross-journey-avogadro-dissertation-correction", "correctMolecularCoefficient"),
    ),
  }),
});

const shown = (value: number) => Number(value.toPrecision(5)).toString();
const count = (value: number) => `${shown(value / 1e23)} × 10²³`;

export const DISSERTATION_NUMERIC_PARTS: readonly NumericExercisePart[] = Object.freeze([
  Object.freeze({
    id: "cross-journey-avogadro-dissertation-radius",
    prompt:
      "The main text prints NP = 2.08 × 10¹⁶ cm/mol and NP³ = 200 cm³/mol. Divide the second relation by the first to find P². What radius P follows? Choose the unit for your answer.",
    workedExplanation: `Dividing cancels N: P² = 200/(2.08 × 10¹⁶) cm². Taking the positive square root gives P ≈ ${shown(DISSERTATION_RECONSTRUCTION.main.radius.value * 1e9)} nm. The printed final radius is 0.99 nm. This reconstruction uses the two rounded products exactly as printed; their approximately one-percent discrepancy with the printed final values is kept visible. Neither a modern molecular number nor a Boltzmann constant enters.`,
    family: "length",
    units: Object.freeze(["nm", "cm", "m"]),
    reference: DISSERTATION_RECONSTRUCTION.main.radius,
    tolerance: Object.freeze({ absolute: 0, relative: 0.015 }),
    toleranceReason:
      "One and a half percent admits the printed final rounding as well as the value reconstructed from the two printed products. This is a numerical allowance, not measurement uncertainty.",
  }),
  Object.freeze({
    id: "cross-journey-avogadro-dissertation-number",
    prompt:
      "Use the same two printed products to find N. First obtain P from P² = (NP³)/(NP), then divide NP by that radius. What molecular number follows, per mole?",
    workedExplanation: `With P ≈ ${shown(DISSERTATION_RECONSTRUCTION.main.radius.value * 100)} cm, N = (2.08 × 10¹⁶ cm/mol)/P ≈ ${count(DISSERTATION_RECONSTRUCTION.main.molecularNumber.value)} mol⁻¹. The main text prints 2.1 × 10²³. Diffusion supplies NP; viscosity supplies NP³. Their different powers of P separate the radius from the number, whereas diffusion alone identifies only their product.`,
    family: "inverseAmount",
    units: Object.freeze(["1/mol"]),
    reference: DISSERTATION_RECONSTRUCTION.main.molecularNumber,
    tolerance: Object.freeze({ absolute: 0, relative: 0.015 }),
    toleranceReason:
      "One and a half percent covers the difference between the rounded printed products and the printed final number; it is not a confidence interval.",
  }),
  Object.freeze({
    id: "cross-journey-avogadro-dissertation-correction",
    prompt:
      "The January 1906 supplement replaces the observations and prints N = 4.15 × 10²³ mol⁻¹. In 1911 the viscosity coefficient changes from 1 to 2.5, with those observations held fixed. NP stays fixed and NP³ is divided by 2.5. What corrected N follows?",
    workedExplanation: `Since P² = (NP³)/(NP), correcting the coefficient divides P by √2.5 and multiplies N by √2.5. Starting from the supplement's 4.15 × 10²³ gives N ≈ ${count(DISSERTATION_RECONSTRUCTION.correctedSupplement.molecularNumber.value)} mol⁻¹, compared with the correction's printed 6.56 × 10²³. This is a coefficient correction of a published result, not a new determination from raw measurements. Applying the same correction to the original printed products instead gives about ${count(DISSERTATION_RECONSTRUCTION.correctedMain.molecularNumber.value)} mol⁻¹: the intervening change in observations matters.`,
    family: "inverseAmount",
    units: Object.freeze(["1/mol"]),
    reference: DISSERTATION_RECONSTRUCTION.correctedSupplement.molecularNumber,
    tolerance: Object.freeze({ absolute: 0, relative: 0.001 }),
    toleranceReason:
      "One part in a thousand admits rounding to the correction's printed 6.56 × 10²³. No historical uncertainty interval is asserted.",
    commonSlips: Object.freeze([
      Object.freeze({
        factor:
          DISSERTATION_RECONSTRUCTION.correctedSupplement.molecularNumber.value /
          DISSERTATION_PRINTED.supplement.molecularNumber,
        message:
          "Multiplying N by 2.5 misses the change in radius. The two fixed observations give P² proportional to 1/2.5, so N grows by the square root of 2.5.",
      }),
    ]),
  }),
]);
