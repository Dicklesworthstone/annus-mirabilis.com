/** The light-speed substitution and interchange of collinear velocities at the end of §5. */
import type { RelativityOperationGuide } from "./relativityOperations.ts";

const SPEED = ["1", "0", "-1", "0", "0", "0"];
const C = "speedOfLight";
const W = "velocityInMovingFrame";
const V = "frameSpeed";
const U = "velocityComposed";
const lab = { href: "/lab/sr-06/", label: "Try collinear velocities in the composition lab" };

const DEFICIT = "speedDeficitFromLight";
type Primary = RelativityOperationGuide["primary"][string];

function deficit(index: "k" | "l"): Primary {
  return {
    kind: "symbol",
    quantities: [DEFICIT],
    symbolIndex: index,
    title: index === "k" ? "Read the first shortfall" : "Read the second shortfall",
    does: index === "k" ? "Use κ = V − v." : "Use λ = V − w.",
    why: "Each positive shortfall belongs to one input velocity. The two inputs may approach V by different amounts.",
    foundation: "frames-events",
  };
}

function commonNumerator(path: string): Record<string, Primary> {
  const subtract: Primary = {
    kind: "negate",
    quantities: [DEFICIT],
    title: "Subtract the input's shortfall",
    does: "Subtract the whole positive shortfall from the two light-speed contributions.",
    why: "Writing each input as V minus its shortfall gives v + w = 2V − κ − λ.",
    foundation: "bridge-negative-numbers-direction",
  };
  return {
    [path + ".args.1"]: subtract,
    [path + ".args.1.argument"]: deficit("k"),
    [path + ".args.2"]: subtract,
    [path + ".args.2.argument"]: deficit("l"),
  };
}

export const RELATIVITY_COLLINEAR_LIMIT_GUIDES: Readonly<Record<string, RelativityOperationGuide>> = {
  "eq-s5-d7": {
    context: "Section 5 compares the sum of two forward subluminal velocities with the speed of light.",
    premise:
      "V is positive. Write the two forward velocities as v = V − κ and w = V − λ, with 0 < κ, λ ≤ V. Both shortfalls are measured in speed units. The numerator 2V − κ − λ is v + w and is nonnegative.",
    next: lab,
    symbolIndices: { "\\varkappa": "k", "\\lambda": "l" },
    expectedRowDimensions: [SPEED, SPEED],
    allowTerminalStrictBound: true,
    primary: {
      row1: {
        kind: "relation",
        quantities: [U, C, DEFICIT],
        literalNumbers: ["2", "2"],
        title: "Express the result using the two shortfalls",
        does: "Multiply V by the fraction whose numerator is v + w and whose denominator adds κλ/V to that same sum.",
        why: "The fraction compares two speeds. Its size determines the composed speed as a fraction of V.",
        foundation: "frames-events",
      },
      "row1.right.args.1": {
        kind: "quotient",
        quantities: [C, DEFICIT],
        literalNumbers: ["2", "2"],
        title: "Compare the numerator with the larger denominator",
        does: "Divide 2V − κ − λ by itself plus κλ/V.",
        why: "The extra term is positive for two subluminal inputs. The denominator is therefore positive and strictly larger than the nonnegative numerator, including when both inputs are zero.",
        foundation: "bridge-fractions-ratios",
      },
      ...commonNumerator("row1.right.args.1.numerator"),
      ...commonNumerator("row1.right.args.1.denominator"),
      "row1.right.args.1.denominator.args.3": {
        kind: "quotient",
        quantities: [DEFICIT, C],
        title: "Find the positive excess in the denominator",
        does: "Multiply the two shortfalls and divide by V.",
        why: "This term vanishes if either shortfall is zero. That boundary case belongs to the next display and explains why the present conclusion is strict.",
        foundation: "bridge-fractions-ratios",
      },
      "row1.right.args.1.denominator.args.3.numerator.args.0": deficit("k"),
      "row1.right.args.1.denominator.args.3.numerator.args.1": deficit("l"),
      row2: {
        kind: "relation",
        quantities: [U, C],
        literalNumbers: [],
        title: "Read the strict upper bound",
        does: "The final sign says U is strictly less than V.",
        why: "Multiplication of a fraction below one by the positive speed V leaves a speed below V. Arbitrarily small positive shortfalls can bring U close to V, while equality remains excluded under the stated conditions.",
        foundation: "frames-events",
      },
    },
  },
  "eq-s5-d8": {
    context: "Section 5 puts the light speed V into one slot of the collinear composition law.",
    premise:
      "V is positive and the other signed speed w satisfies |w| < V. The printed substitution v = V evaluates the algebraic boundary of the addition law. A physical inertial frame must move below V. Interchanging the two collinear inputs gives the physical reading of a light signal moving at V as measured from another inertial frame.",
    next: lab,
    symbolIndices: {},
    expectedRowDimensions: [SPEED, SPEED],
    allowChainedRelations: true,
    primary: {
      row1: {
        kind: "relation",
        quantities: [U, C, W],
        literalNumbers: ["1"],
        title: "Insert the light speed into the collinear law",
        does: "Divide V + w by one plus w/V.",
        why: "The expression has a finite value at this boundary for every subluminal w. The substitution alone does not define the coordinates of an observer traveling with light.",
        foundation: "frames-events",
      },
      "row1.right": {
        kind: "quotient",
        quantities: [C, W],
        literalNumbers: ["1"],
        title: "Cancel the common factor",
        does: "Rewrite the numerator V + w as V times (1 + w/V), then cancel the factor in the denominator.",
        why: "Because |w| < V, the factor is strictly positive. At w = −V the printed ratio would be zero divided by zero, so the cancellation would be invalid.",
        foundation: "bridge-fractions-ratios",
      },
      "row1.right.denominator.args.1.numerator": {
        kind: "symbol",
        quantities: [W],
        title: "Keep the remaining signed velocity in the numerator",
        does: "Divide w by the light speed V.",
        why: "At w = 0 the denominator becomes one. Reversing the ratio would make the expression undefined at rest.",
        foundation: "bridge-fractions-ratios",
      },
      row2: {
        kind: "relation",
        quantities: [U, C],
        literalNumbers: [],
        title: "Recover the same light speed",
        does: "Read the final equality as U = V for every allowed w.",
        why: "The signed input w changes both numerator and denominator by the same factor. Light moving along the positive axis retains speed V.",
        foundation: "frames-events",
      },
    },
  },
  "eq-s5-d9": {
    context: "Section 5 prints the composition expression alone to compare the order of two collinear boosts.",
    premise:
      "The signed velocities v and w lie on one common axis, with |v| and |w| below the positive light speed V. In the original reading v relates k to K and w is measured in k. The comparison reverses their roles in a second composition.",
    next: lab,
    symbolIndices: {},
    standaloneExpression: true,
    expectedRowDimensions: [SPEED],
    primary: {
      row1: {
        kind: "quotient",
        quantities: [V, W, C],
        literalNumbers: ["1"],
        title: "Interchange the two velocities",
        does: "Exchange v and w in both the numerator and the denominator of the fraction.",
        why: "The numerator contains their sum and the denominator their product. Both are symmetric, so the two orders give the same composed velocity along this axis. Boosts in different directions require a separate calculation.",
        foundation: "frames-events",
      },
      "row1.denominator": {
        kind: "sum",
        quantities: [V, W, C],
        literalNumbers: ["1"],
        title: "Keep the common time correction",
        does: "Add v w / V squared to one.",
        why: "The correction has no units. It is negative for opposite signed inputs, but greater than minus one under the stated speed bounds, so division is defined.",
        foundation: "bridge-fractions-ratios",
      },
      "row1.denominator.args.1.denominator.base": {
        kind: "symbol",
        quantities: [C],
        title: "Use the fixed light-speed scale",
        does: "Square the light speed in the denominator of the correction term.",
        why: "V is the shared reference speed. Interchanging the two collinear inputs leaves this scale fixed.",
        foundation: "bridge-fractions-ratios",
      },
    },
  },
};
