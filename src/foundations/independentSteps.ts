/**
 * The probability lesson's two-step comparison, projected from the same exact enumeration as
 * the variance missing-step explorer. These are all possible coin walks, not sampled data.
 * One signed step is one metre; products and squared displacements are square metres.
 */
import { enumerateSignedSteps, type StepDependence } from "../physics/reference/stepEnumeration.ts";

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
export function independentSteps(dependence: StepDependence) {
  const enumeration = enumerateSignedSteps(2, dependence);
  const rows = enumeration.rows.map((row) => {
    // enumerateSignedSteps(2, ...) guarantees exactly two entries.
    const [first, second] = row.steps as readonly [number, number];
    return Object.freeze({
      ...row,
      id: `${first}:${second}`,
      first,
      second,
      label: `${first < 0 ? "Left" : "Right"}, then ${second < 0 ? "left" : "right"}`,
      product: row.crossTerm / 2,
    });
  });
  const startsRight = rows.filter((row) => row.first === 1);
  return Object.freeze({
    ...enumeration,
    rows: Object.freeze(rows),
    meanProduct: enumeration.meanCrossTerm / 2,
    startsRight: startsRight.length,
    followsRight: startsRight.filter((row) => row.second === 1).length,
  });
}

/** The same signed label in the drawing, table and summary, including a typographic minus. */
export function signedStepNumber(value: number): string {
  return value > 0 ? `+${value}` : String(value).replace("-", "−");
}
