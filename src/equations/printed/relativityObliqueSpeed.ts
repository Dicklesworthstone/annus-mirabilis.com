/** The magnitude of a velocity with both longitudinal and transverse motion in §5. */
import type { RelativityOperationGuide } from "./relativityOperations.ts";

const U = "velocityComposed";
const V = "frameSpeed";
const W = "velocityInMovingFrame";
const A = "velocityDirectionAngle";
const C = "speedOfLight";

const cosine = {
  title: "Project the incoming velocity along the boost",
  does: "Use w cos α for the signed longitudinal component in k.",
  why: "The component can add to or oppose the frame motion. It also enters the transformation of the elapsed time.",
  foundation: "frames-events",
} as const;
const sine = {
  title: "Project the incoming velocity across the boost",
  does: "Use w sin α for the transverse component in k.",
  why: "Reversing the transverse direction leaves the speed unchanged because the complete transverse correction is squared.",
  foundation: "frames-events",
} as const;
const cosOperation = {
  ...cosine, kind: "function", functionName: "cos", quantities: [A],
} as const;
const correction = "row1.right.numerator.radicand.args.1";

export const RELATIVITY_OBLIQUE_SPEED_GUIDE: RelativityOperationGuide = {
  context: "Section 5 combines the transformed x and y velocity components into the speed U measured in K.",
  premise: "Choose the common longitudinal axis along the boost. In Einstein's angle convention α is the angle between the two velocity directions. Equivalently, with a fixed positive x direction, use signed v and measure α from that axis. The magnitude of the frame speed is below the positive light speed V and the particle or signal has speed 0 ≤ w ≤ V in k. A zero input speed is obtained by continuity.",
  next: { href: "/lab/sr-06/", label: "Compare the speed with its transformed components in the velocity-composition lab" },
  symbolIndices: {},
  expectedRowDimensions: [["1", "0", "-1", "0", "0", "0"]],
  functions: { sin: sine, cos: cosine },
  primary: {
    row1: {
      kind: "relation", quantities: [U, V, W, A, C], literalNumbers: ["2", "1"],
      title: "Find the speed in the stationary frame",
      does: "Take the length of the transformed planar velocity vector.",
      why: "U is a nonnegative magnitude. Opposite velocity components can cancel even when both input speeds are nonzero.",
      foundation: "frames-events",
    },
    "row1.right.numerator": {
      kind: "root", quantities: [V, W, A, C], literalNumbers: ["2"],
      title: "Take the nonnegative square root",
      does: "Combine the two squared component numerators and take their square root.",
      why: "Before expansion, the radicand is (v + w cos α)² + (1 − v²/V²)(w sin α)². It is nonnegative and vanishes when the particle is at rest in K.",
      foundation: "frames-events",
    },
    [correction]: {
      kind: "negate", quantities: [V, W, A, C], literalNumbers: [],
      title: "Subtract the transverse correction",
      does: "Subtract the square of v w sin α divided by V, with the entire quotient inside the square.",
      why: "The squared transverse component carries the factor 1 − v²/V². Expanding it gives this subtraction from the ordinary squared vector sum. Collinear motion has no such term.",
      foundation: "frames-events",
    },
    "row1.right.numerator.radicand.args.0.argument.args.2.args.3": cosOperation,
    [correction + ".argument.base.argument.numerator.args.2"]: {
      ...sine, kind: "function", functionName: "sin", quantities: [A],
    },
    "row1.right.denominator": {
      kind: "sum", quantities: [V, W, A, C], literalNumbers: ["1"],
      title: "Convert both components to the same K time",
      does: "Divide the numerator by one plus v w cos α divided by V².",
      why: "The Lorentz transformation of time uses the displacement parallel to the boost. Since |v| < V and w ≤ V, the denominator stays positive even for opposing motion.",
      foundation: "frames-events",
    },
    "row1.right.denominator.args.1.numerator.args.2": cosOperation,
  },
};
