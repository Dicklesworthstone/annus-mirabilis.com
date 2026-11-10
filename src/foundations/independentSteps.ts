/**
 * The probability lesson's two-step comparison, projected from the same exact enumeration as
 * the variance missing-step explorer. These are all possible coin walks, not sampled data.
 * One signed step is one metre; products and squared displacements are square metres.
 */
import {
  enumerateBiasedTwoSteps,
  type StepDependence,
} from "../physics/reference/stepEnumeration.ts";

export const STEP_DEPENDENCE_CHOICES = [
  {
    id: "independent",
    label: "A fresh fair coin",
    title: "Independent steps",
    explanation:
      "Learning the first step changes nothing about the second: left and right still have equal chances. The positive and negative products cancel.",
  },
  {
    id: "same-direction",
    label: "Copy the first step",
    title: "Matching steps",
    explanation:
      "Learning the first step tells you the second. Both steps still average zero, but their product is positive every time. The extra contribution stays.",
  },
  {
    id: "opposite-direction",
    label: "Reverse the first step",
    title: "Opposite steps",
    explanation:
      "Learning the first step tells you the second. Their product is negative every time, and the second step always brings you back to the start.",
  },
] as const satisfies readonly Readonly<{
  id: StepDependence;
  label: string;
  title: string;
  explanation: string;
}>[];

export type IndependentStepChoice = (typeof STEP_DEPENDENCE_CHOICES)[number]["id"];

/** Only the two-step display changes; the owner still supplies every walk and every moment. */
export function independentSteps(dependence: StepDependence, rightPercent = 50) {
  const enumeration = enumerateBiasedTwoSteps(rightPercent, dependence);
  const rows = enumeration.rows.map((row) => {
    // enumerateSignedSteps(2, ...) guarantees exactly two entries.
    const [first, second] = row.steps as readonly [number, number];
    return Object.freeze({
      ...row,
      weight: rightPercent === 50 ? 1 : row.weight,
      id: `${first}:${second}`,
      first,
      second,
      label: `${first < 0 ? "Left" : "Right"}, then ${second < 0 ? "left" : "right"}`,
      product: row.crossTerm / 2,
    });
  });
  const startsRight = rows.filter((row) => row.first === 1);
  const rightWeight = startsRight.reduce((sum, row) => sum + row.weight, 0);
  const rightThenRightWeight = startsRight
    .filter((row) => row.second === 1)
    .reduce((sum, row) => sum + row.weight, 0);
  return Object.freeze({
    ...enumeration,
    // Preserve the fair-coin comparison's one-in-two / one-in-four display and public API.
    denominator: rightPercent === 50 ? enumeration.rows.length : enumeration.denominator,
    rows: Object.freeze(rows),
    meanProduct: enumeration.meanCrossTerm / 2,
    startsRight: startsRight.length,
    followsRight: startsRight.filter((row) => row.second === 1).length,
    chanceRightAfterRight: rightWeight === 0 ? null : (100 * rightThenRightWeight) / rightWeight,
    secondRightPercent:
      100 * rows.filter((row) => row.second === 1).reduce((sum, row) => sum + row.probability, 0),
  });
}

/** Invalid drafts leave the construction's last accepted chance untouched. */
export function compareSteps(input: string, dependence: StepDependence) {
  const percent = Number(input);
  if (input.trim() === "" || !Number.isInteger(percent) || percent < 0 || percent > 100)
    return {
      kind: "invalid" as const,
      reason:
        "Enter a whole percentage from 0 to 100. The comparison keeps the last applied chance.",
    };
  return { kind: "accepted" as const, comparison: independentSteps(dependence, percent) };
}

/** Whole-percent inputs make every displayed moment exact to at most four decimal places. */
export function stepNumber(value: number): string {
  return String(Number(value.toFixed(4))).replace(/^-/, "−");
}

/** The same signed label in the drawing, table and summary, including a typographic minus. */
export function signedStepNumber(value: number): string {
  return value > 0 ? `+${value}` : String(value).replace("-", "−");
}
