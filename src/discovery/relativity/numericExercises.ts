/**
 * The relativity encounter's numeric exercise (am-disc-exercise-checker-i4h2): a moving rod's
 * measured length, computed at build time by the host kinematics owner. Pages may not import
 * physics owners (noPhysicsInComponents), so the page receives a number from here.
 *
 * The answer depends only on the ratio v/c, so no constant set is involved. If the owner returns
 * anything but a value for these inputs, building the part throws and the page fails to build.
 */
import { contractedLength } from "../../physics/reference/kinematics.ts";
import { type NumericExercisePart, referenceFromEvaluation } from "../exercises/numeric.ts";

/** The rod's length at rest, m, and its speed as a fraction of the speed of light. */
export type RodInputs = Readonly<{ restLength: number; beta: number }>;

export const ROD_INPUTS: RodInputs = Object.freeze({ restLength: 1, beta: 0.6 });

/** Builds the part from inputs, so a test can show that a bad input fails instead of shipping. */
export function movingRodPart(inputs: RodInputs): NumericExercisePart {
  const id = "sr-moving-rod-length";
  const { restLength: L, beta } = inputs;
  const reference = referenceFromEvaluation(contractedLength(L, beta), {
    constantSetId: "none: a ratio of speeds",
    owner: "kinematics.contractedLength",
    exerciseId: id,
  });
  const at = (length: number) => length / reference.value;
  return Object.freeze({
    id,
    prompt:
      "Measured this way, a moving rod is shorter along its direction of travel by the factor √(1 − v²/c²), where v is its speed and c the speed of light, which the paper writes V. A rod 1\u00a0m long when it is at rest moves past you along its own length at 0.6 of the speed of light. You mark where its two ends are at the same moment, by your own clocks, and measure the distance between the marks. How long is it? Give it in metres or centimetres.",
    workedExplanation:
      "With v/c = 0.6, v²/c² = 0.36, and √(1 − 0.36) = √0.64 = 0.8. The rod you measure is 0.8 × 1 m = 0.8 m, or 80 cm. Across its direction of travel nothing changes, and a ruler riding with the rod still reads 1 m: the 0.8 m belongs to your way of marking both ends at once.",
    family: "length",
    units: ["m", "cm"],
    reference,
    tolerance: { absolute: 0, relative: 0.01 },
    toleranceReason: "An answer within 1 percent is the same answer, so 0.8 m and 80 cm agree.",
    commonSlips: [
      {
        // L·γ, from the owner's own L/γ: the law is computed once, by the owner.
        factor: at((L * L) / reference.value),
        message:
          "That is the rest length divided by the factor, which lengthens the rod. A moving rod measures shorter: multiply by √(1 − v²/c²).",
      },
      {
        factor: at(L * Math.sqrt(1 - beta)),
        message: "That takes √(1 − v/c). The speed is squared inside the root: √(1 − v²/c²).",
      },
      {
        factor: at(L * (1 - beta * beta)),
        message: "That is 1 − v²/c² without its square root.",
      },
    ],
  });
}

export const MOVING_ROD = movingRodPart(ROD_INPUTS);
