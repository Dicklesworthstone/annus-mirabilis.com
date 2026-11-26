/** Einstein's printed arctg and Latin component subscripts in §5 (p. 905). */
import type { RelativityOperationGuide } from "./relativityOperations.ts";

const X = "velocityComponentXMoving";
const Y = "velocityComponentYMoving";
const angle = "velocityDirectionAngle";
const tangent = {
  title: "Recover the direction from its slope",
  does: "Apply inverse tangent to the transverse velocity divided by the longitudinal velocity.",
  why: "The principal arctangent lies between −π/2 and π/2. Opposite vectors have the same slope. Use the signs of both components to recover the physical quadrant when the longitudinal component is negative.",
  foundation: "functions-graphs",
} as const;

export const RELATIVITY_DIRECTION_ANGLE_GUIDE: RelativityOperationGuide = {
  context: "The paper introduces α before using its sine and cosine in the general composition law. It prints wᵧ and wₓ here for the moving-frame components called wη and wξ in the preceding display.",
  premise: "The positive longitudinal axis points along the boost. The direction requires a nonzero moving-frame velocity. The printed ratio requires wₓ ≠ 0. A purely transverse velocity has direction ±π/2 by continuity; a point at rest has no velocity direction.",
  next: { href: "/lab/sr-06/", label: "Vary the velocity direction in the composition lab" },
  expectedRowDimensions: [["0", "0", "0", "0", "0", "0"]],
  symbolIndices: {},
  functions: { atan: tangent },
  primary: {
    row1: {
      kind: "relation",
      quantities: [angle, Y, X],
      title: "Identify the moving-frame direction angle",
      does: "Read the printed arctg as inverse tangent. The longitudinal and transverse axes fix the direction in the plane.",
      why: "The next display needs the signed longitudinal and transverse projections of the same velocity.",
      foundation: "frames-events",
    },
    "row1.right": { ...tangent, kind: "function", functionName: "atan", quantities: [Y, X] },
    "row1.right.argument": {
      kind: "quotient",
      quantities: [Y, X],
      title: "Form the transverse-to-longitudinal slope",
      does: "Place wᵧ above the fraction bar and wₓ below it, as on the printed page.",
      why: "Both components are speeds in k, so the slope has no units. Interchanging them would instead measure the inclination from the transverse axis.",
      foundation: "bridge-fractions-ratios",
    },
    "row1.right.argument.numerator": {
      kind: "symbol",
      quantities: [Y],
      title: "Use the signed transverse component",
      does: "Read the printed y subscript as the component across the boost.",
      why: "Its sign fixes which side of the longitudinal axis the velocity points toward.",
      foundation: "frames-events",
    },
  },
};
