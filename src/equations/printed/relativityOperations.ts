/**
 * The final coordinate transformation and its printed Lorentz factor in paper 3, §3.
 * These readings explain the checked source expression, not a new numerical implementation.
 * Einstein's beta is the modern gamma; tau belongs to the moving system's synchronized clocks.
 */
import type { Expression } from "../ast.ts";
import type { MassEnergyOperationGuide, OperationReading } from "./massEnergyOperations.ts";

export type RelativityOperationGuide = MassEnergyOperationGuide &
  Readonly<{
    /** Each source row has its own authored expectation: time, then three lengths. */
    expectedRowDimensions: readonly (readonly string[])[];
    /** Vector components share a quantity owner without sharing a printed glyph. */
    symbolIndices: Readonly<Record<string, string>>;
  }>;
type PrimaryReading = MassEnergyOperationGuide["primary"][string];

const TIME = ["0", "0", "1", "0", "0", "0"];
const LENGTH = ["1", "0", "0", "0", "0", "0"];
const DIMENSIONLESS = ["0", "0", "0", "0", "0", "0"];
const COORDINATE_ROUTE = {
  href: "/papers/special-relativity/s3/#sr-coordinate-derivation",
  label: "Follow the synchronization argument and the normalization of the transformation",
};
const FRAME_PREMISE =
  "The inertial system k moves with constant signed speed v along K's x axis. The axes are parallel, their origins share the event t = tau = 0, and each system synchronizes its own clocks by the light-signal convention. V is the positive speed of light and |v| < V. Both systems describe the same event; tau is a coordinate time, not an elapsed proper time.";
const NORMALIZATION_PREMISE =
  " The final equations use phi(v) = 1. The preceding argument fixes this scale using reciprocity, spatial isotropy, identical rods and clocks, and the positive branch continuous from rest. Preserving the speed of light alone leaves the scale undetermined.";

/** Arithmetic stays local to the coordinate transformation and the dimensionless factor. */
export const RELATIVITY_ARITHMETIC: Readonly<
  Partial<Record<Expression["kind"], OperationReading>>
> = {
  relation: {
    title: "Read the equality",
    does: "The complete expressions on both sides have the same value under the stated frame and speed conditions.",
    why: "The equality expresses a coordinate assignment or a definition. A dimensional check tests compatible units; it does not establish the light postulate or the synchronization convention.",
    foundation: "bridge-equals-sign-relationship",
  },
  sum: {
    title: "Combine terms with the same dimension",
    does: "Add the terms, including the sign carried by each complete contribution.",
    why: "Only quantities with the same dimensions can be added. Their physical meanings and the chosen direction of the frame transformation determine which combination is appropriate.",
    foundation: "bridge-negative-numbers-direction",
  },
  negate: {
    title: "Subtract the complete contribution",
    does: "The minus sign applies to the entire following product or squared ratio.",
    why: "The sign is part of the printed transformation. Reversing the frame speed changes the terms linear in v; the square of v/V stays unchanged.",
    foundation: "bridge-negative-numbers-direction",
  },
  product: {
    title: "Multiply the factors",
    does: "Multiply the adjacent factors, preserving the contents of each group and fraction.",
    why: "The product carries the dimensions of all its factors. The Lorentz factor is dimensionless, so multiplying by it preserves a time or length dimension.",
    foundation: "bridge-fractions-ratios",
  },
  quotient: {
    title: "Divide by the complete denominator",
    does: "Divide everything above the fraction bar by everything below it.",
    why: "V is positive and the square-root denominator is positive for |v| < V. These conditions keep the printed divisions defined.",
    foundation: "bridge-fractions-ratios",
  },
  group: {
    title: "Keep the complete group together",
    does: "Treat the enclosed expression as one input to the surrounding multiplication or power.",
    why: "Beta multiplies the whole time or position difference. In the factor definition, the square applies to the whole ratio v/V.",
    foundation: "bridge-fractions-ratios",
  },
  power: {
    title: "Square the complete base",
    does: "Multiply the base by itself, including its denominator when the base is a ratio.",
    why: "The square of v/V is dimensionless and unchanged by reversing v. V squared instead carries speed-squared dimensions.",
    foundation: "bridge-fractions-ratios",
  },
  root: {
    title: "Take the positive square root",
    does: "Take the positive square root of the entire radicand.",
    why: "For |v| < V the radicand is positive. The positive branch gives beta = 1 at rest and keeps the time orientation continuous from that case.",
    foundation: "frames-events",
  },
};

const factorPrimary: Readonly<Record<string, PrimaryReading>> = {
  row1: {
    kind: "relation",
    quantities: ["lorentzFactor", "frameSpeed", "speedOfLight"],
    literalNumbers: ["1", "1"],
    constantNames: [],
    title: "Einstein's beta is the Lorentz factor",
    does: "Define the printed beta as 1/sqrt(1 - (v/V)^2), the quantity now usually written gamma.",
    why: "Here beta is not the speed ratio v/V. It is dimensionless, equals one at rest, and exceeds one at nonzero subluminal speed.",
    foundation: "frames-events",
  },
  "row1.right": {
    kind: "quotient",
    quantities: ["frameSpeed", "speedOfLight"],
    literalNumbers: ["1", "1"],
    title: "Invert the positive square root",
    does: "Divide one by sqrt(1 - (v/V)^2) to obtain the common longitudinal and time factor.",
    why: "For |v| < V the denominator lies between zero and one, including one at rest. Beta grows without bound as |v| approaches V; the formula does not assign a finite value at light speed.",
    foundation: "bridge-fractions-ratios",
  },
  "row1.right.denominator.radicand": {
    kind: "sum",
    quantities: ["frameSpeed", "speedOfLight"],
    literalNumbers: ["1"],
    title: "Subtract the squared speed ratio from one",
    does: "Form the dimensionless number 1 - (v/V)^2 before taking its square root.",
    why: "The subluminal condition makes this difference positive. A negative radicand outside that domain is not a coordinate transformation between the inertial systems described here.",
    foundation: "frames-events",
  },
  "row1.right.denominator.radicand.args.1": {
    kind: "negate",
    quantities: ["frameSpeed", "speedOfLight"],
    title: "Subtract, rather than add, the squared ratio",
    does: "The minus sign subtracts the complete square (v/V)^2 from one.",
    why: "This sign belongs to the transformation derived from the light conditions. Because the ratio is squared, changing the direction of v leaves beta unchanged.",
    foundation: "bridge-negative-numbers-direction",
  },
  "row1.right.denominator.radicand.args.1.argument.base.argument": {
    kind: "quotient",
    quantities: ["frameSpeed", "speedOfLight"],
    title: "Compare the frame speed with the light speed",
    does: "Divide the signed frame speed v by the positive light speed V.",
    why: "The two speeds have the same dimensions, so their ratio has no units and lies between -1 and 1. This ratio is distinct from Einstein's printed beta.",
    foundation: "bridge-fractions-ratios",
  },
};

const factorGuide: RelativityOperationGuide = {
  expectedRowDimensions: [DIMENSIONLESS],
  symbolIndices: {},
  context: "Section 3 defines the factor shared by the time and longitudinal coordinate equations.",
  premise: FRAME_PREMISE,
  next: COORDINATE_ROUTE,
  primary: factorPrimary,
};

/** Only these source displays opt in; the earlier undetermined phi(v) is not guessed. */
export const RELATIVITY_OPERATION_GUIDES: Readonly<Record<string, RelativityOperationGuide>> = {
  "eq-s3-d16": factorGuide,
  "eq-s3-d25": {
    expectedRowDimensions: [TIME, LENGTH, LENGTH, LENGTH],
    symbolIndices: { x: "x", y: "y", z: "z", "\\xi": "x", "\\eta": "y", "\\zeta": "z" },
    context:
      "Section 3 gives the same event's coordinates in K and k: t, x, y, z become tau, xi, eta, zeta. The printed beta is the Lorentz factor now written gamma, and V is the speed of light.",
    premise: FRAME_PREMISE + NORMALIZATION_PREMISE,
    next: COORDINATE_ROUTE,
    primary: {
      row1: {
        kind: "relation",
        literalNumbers: [],
        constantNames: [],
        quantities: [
          "coordinateTimeMoving",
          "coordinateTimeStationary",
          "coordinatePositionStationary",
          "lorentzFactor",
          "frameSpeed",
          "speedOfLight",
        ],
        title: "Assign the moving system's time coordinate tau",
        does: "Use the event's K coordinates t and x to calculate its time coordinate tau in k.",
        why: "The synchronized clocks in the two systems assign time differently at separated positions. Tau is k's coordinate time; the equation by itself is not a comparison of elapsed proper times along a clock's path.",
        foundation: "frames-events",
      },
      "row1.right": {
        kind: "product",
        quantities: [
          "coordinateTimeStationary",
          "coordinatePositionStationary",
          "lorentzFactor",
          "frameSpeed",
          "speedOfLight",
        ],
        title: "Multiply the whole time combination by beta",
        does: "Multiply both contributions inside t - (v/V^2)x by the same dimensionless Lorentz factor.",
        why: "The factor applies to the complete group. Both contributions have time dimensions, so the result remains a time; this is the full time-coordinate transformation, including its position dependence.",
        foundation: "frames-events",
      },
      "row1.right.args.1.argument": {
        kind: "sum",
        quantities: [
          "coordinateTimeStationary",
          "coordinatePositionStationary",
          "frameSpeed",
          "speedOfLight",
        ],
        title: "Include the position-dependent time offset",
        does: "Subtract (v/V^2)x from t before applying beta.",
        why: "For fixed K time, different x positions generally receive different k times. The offset records the relativity of simultaneity and has the same time dimension as t.",
        foundation: "frames-events",
      },
      "row1.right.args.1.argument.args.1": {
        kind: "negate",
        quantities: ["coordinatePositionStationary", "frameSpeed", "speedOfLight"],
        title: "Keep the time offset's sign tied to the frame direction",
        does: "Subtract the complete position contribution (v/V^2)x.",
        why: "With k moving in the positive x direction, increasing x at a fixed t decreases tau. Reversing v reverses this offset while leaving beta unchanged.",
        foundation: "bridge-negative-numbers-direction",
      },
      "row1.right.args.1.argument.args.1.argument.args.0": {
        kind: "quotient",
        quantities: ["frameSpeed", "speedOfLight"],
        title: "Convert a position into a time contribution",
        does: "Form v/V^2, then multiply this coefficient by the event's x coordinate.",
        why: "A speed divided by a squared speed has dimensions of time per length. Multiplication by x therefore supplies a time that can be subtracted from t.",
        foundation: "bridge-fractions-ratios",
      },
      row2: {
        kind: "relation",
        literalNumbers: [],
        constantNames: [],
        quantities: [
          "coordinatePositionMoving",
          "coordinatePositionStationary",
          "coordinateTimeStationary",
          "lorentzFactor",
          "frameSpeed",
        ],
        title: "Assign the moving longitudinal coordinate xi",
        does: "Calculate xi by multiplying x - vt by beta.",
        why: "The moving origin has K position vt. Subtracting that origin and applying the Lorentz factor gives the event's longitudinal coordinate in k.",
        foundation: "frames-events",
      },
      "row2.right": {
        kind: "product",
        quantities: [
          "coordinatePositionStationary",
          "coordinateTimeStationary",
          "lorentzFactor",
          "frameSpeed",
        ],
        title: "Scale the longitudinal difference by beta",
        does: "Multiply the whole length x - vt by the same Lorentz factor used in the time equation.",
        why: "The intermediate difference x - vt is the Galilean auxiliary used earlier in the source. It is not yet the moving coordinate xi; beta supplies the remaining scale.",
        foundation: "frames-events",
      },
      "row2.right.args.1.argument": {
        kind: "sum",
        quantities: ["coordinatePositionStationary", "coordinateTimeStationary", "frameSpeed"],
        title: "Measure from the moving origin at K time t",
        does: "Subtract the moving origin's position vt from the event's K position x.",
        why: "Both x and vt are lengths described using the same K time. This subtraction shifts the origin; the surrounding beta factor completes the longitudinal transformation.",
        foundation: "frames-events",
      },
      "row2.right.args.1.argument.args.1": {
        kind: "negate",
        quantities: ["coordinateTimeStationary", "frameSpeed"],
        title: "Subtract the moving origin's displacement",
        does: "The minus sign applies to the complete product vt.",
        why: "At the moving origin x = vt the difference is zero, so xi is zero as required. Reversing v changes the direction of the origin's displacement.",
        foundation: "bridge-negative-numbers-direction",
      },
      "row2.right.args.1.argument.args.1.argument": {
        kind: "product",
        quantities: ["coordinateTimeStationary", "frameSpeed"],
        title: "Locate the moving origin in K",
        does: "Multiply the constant signed frame speed v by K's coordinate time t.",
        why: "The origins coincided at t = 0. Uniform motion therefore puts k's origin at x = vt in K, with speed times time giving a length.",
        foundation: "frames-events",
      },
      row3: {
        kind: "relation",
        literalNumbers: [],
        constantNames: [],
        quantities: ["coordinatePositionMoving", "coordinatePositionStationary"],
        title: "Keep the transverse y coordinate: eta = y",
        does: "Assign the same transverse coordinate value to eta in k and y in K.",
        why: "For these parallel axes and motion along x, the normalized transverse scale is one. The earlier phi(v) argument is needed to reach this final equality.",
        foundation: "frames-events",
      },
      row4: {
        kind: "relation",
        literalNumbers: [],
        constantNames: [],
        quantities: ["coordinatePositionMoving", "coordinatePositionStationary"],
        title: "Keep the transverse z coordinate: zeta = z",
        does: "Assign the same transverse coordinate value to zeta in k and z in K.",
        why: "The z direction is also perpendicular to the frame motion. The same normalized scale applies separately to this coordinate; eta and zeta remain distinct components.",
        foundation: "frames-events",
      },
    },
  },
  "eq-s3-d26": factorGuide,
};
