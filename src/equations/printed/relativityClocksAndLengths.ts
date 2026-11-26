/** The simultaneous surface of a moving sphere and successive readings of one moving clock. */
import type { Expression } from "../ast.ts";
import type { RelativityOperationGuide } from "./relativityOperations.ts";

type Primary = RelativityOperationGuide["primary"][string];
const LENGTH = ["1", "0", "0", "0", "0", "0"];
const LENGTH_SQUARED = ["2", "0", "0", "0", "0", "0"];
const TIME = ["0", "0", "1", "0", "0", "0"];
const R = "sphereRadius";
const POSITION = "coordinatePositionStationary";
const MOVING_POSITION = "coordinatePositionMoving";
const T = "coordinateTimeStationary";
const TAU = "coordinateTimeMoving";
const V = "frameSpeed";
const C = "speedOfLight";
const GEOMETRY =
  "The sphere rests in k with radius R. Its center passes the origin of K at t = 0. The axes are parallel, k moves along K's x axis at constant signed speed v, and |v| < V. The K measurement records surface positions at the common K time t = 0.";
const CLOCK =
  "The origins and clock zeros coincide at t = 0. The moving origin travels at constant signed speed v along K's x axis, with |v| < V. The two systems use their own synchronized clocks.";
const MEASURE_LENGTH = {
  href: "/lab/sr-03/",
  label: "Choose simultaneous endpoint events to measure a moving rod",
};
const ONE_CLOCK = {
  href: "/lab/sr-05/",
  label: "Compare elapsed times on the moving light clock",
};
const DERIVATION = {
  href: "/papers/special-relativity/s4/#sr-clock-length-derivation",
  label: "Trace the event choices for length and elapsed time",
};

function reading(
  kind: Expression["kind"],
  quantities: readonly string[],
  title: string,
  does: string,
  why: string,
  literalNumbers: readonly string[] = [],
): Primary {
  return {
    kind,
    quantities,
    literalNumbers,
    constantNames: [],
    title,
    does,
    why,
    foundation: "frames-events",
  };
}

function axis(quantity: string, index: string): Primary {
  return {
    ...reading(
      "symbol",
      [quantity],
      "Keep the " + index + " component",
      "Use the position component along the " + index + " axis of this coordinate system.",
      "The velocity points along x. Exchanging longitudinal and transverse components would change the physical measurement while preserving its units.",
    ),
    symbolIndex: index,
  };
}

function coordinateTime(quantity: typeof T | typeof TAU): Primary {
  const frame = quantity === TAU ? "k" : "K";
  return reading(
    "symbol",
    [quantity],
    "Keep the time coordinate in " + frame,
    "Use the synchronized coordinate time assigned in " + frame + " to this event.",
    "The two frames' times have the same units but identify different clock readings. Exchanging them would reverse the time transformation.",
  );
}

/** Both measurements contain the same positive, dimensionless square root. */
function contraction(path: string): Record<string, Primary> {
  return {
    [path]: reading(
      "root",
      [V, C],
      "Take the positive square root",
      "Take the square root of one minus the squared speed ratio.",
      "The factor equals one at rest and falls towards zero as the speed magnitude approaches V. Reversing the motion leaves it unchanged.",
      ["1"],
    ),
    [path + ".radicand.args.1"]: reading(
      "negate",
      [V, C],
      "Subtract the square",
      "Apply the minus sign to the whole square of v/V.",
      "Adding the square would predict growth of this factor as the speed increases.",
    ),
    [path + ".radicand.args.1.argument.base.argument.numerator"]: reading(
      "symbol",
      [V],
      "Use the frame speed",
      "Place the signed speed of k in the numerator.",
      "The ratio goes to zero when the frames are at rest relative to each other.",
    ),
    [path + ".radicand.args.1.argument.base.argument.denominator"]: reading(
      "symbol",
      [C],
      "Use the light speed as the reference",
      "Divide by the positive vacuum light speed V.",
      "The reference speed stays finite when the frame speed is zero.",
    ),
  };
}

export const RELATIVITY_CLOCK_AND_LENGTH_GUIDES: Readonly<
  Record<string, RelativityOperationGuide>
> = {
  "eq-s4-d1": {
    context: "Section 4 starts with the sphere measured in its own rest system k.",
    premise: GEOMETRY,
    next: MEASURE_LENGTH,
    symbolIndices: { "\\xi": "x", "\\eta": "y", "\\zeta": "z" },
    expectedRowDimensions: [LENGTH_SQUARED],
    primary: {
      row1: reading(
        "relation",
        [MOVING_POSITION, R],
        "Locate points on the sphere at rest",
        "Set the squared distance from its center equal to the squared radius R.",
        "Every surface point lies the same distance from the center in k. This supplies the shape to be measured by K.",
      ),
      "row1.left": reading(
        "sum",
        [MOVING_POSITION],
        "Add the three squared components",
        "Add the squares of the mutually perpendicular coordinates ξ, η and ζ in k.",
        "Each coordinate measures a different projection of the same radius vector. Counting any one twice would give the wrong surface.",
      ),
      "row1.left.args.0.base": axis(MOVING_POSITION, "x"),
      "row1.left.args.1.base": axis(MOVING_POSITION, "y"),
      "row1.left.args.2.base": axis(MOVING_POSITION, "z"),
    },
  },
  "eq-s4-d2": {
    context: "Section 4 takes a simultaneous slice of the moving surface in the resting system K.",
    premise: GEOMETRY,
    next: MEASURE_LENGTH,
    symbolIndices: { x: "x", y: "y", z: "z" },
    expectedRowDimensions: [LENGTH_SQUARED],
    primary: {
      row1: reading(
        "relation",
        [POSITION, V, C, R],
        "Locate the same surface at one K time",
        "Set the rescaled longitudinal square plus the two transverse squares equal to R squared.",
        "The simultaneity condition selects the surface events used in this measurement. A photograph gathers light arriving together and generally selects different events.",
        ["1"],
      ),
      "row1.left.args.0": reading(
        "quotient",
        [POSITION, V, C],
        "Rescale only the longitudinal coordinate",
        "Divide x squared by the square of the contraction factor. The y and z terms retain unit coefficients.",
        "At t = 0 the longitudinal coordinate in k is the Lorentz factor times x. Substitution into the rest sphere equation gives the shorter longitudinal semiaxis.",
        ["1"],
      ),
      "row1.left.args.0.numerator.base": axis(POSITION, "x"),
      "row1.left.args.1.base": axis(POSITION, "y"),
      "row1.left.args.2.base": axis(POSITION, "z"),
      ...contraction("row1.left.args.0.denominator.base.argument"),
    },
  },
  "eq-s4-d3": {
    context: "The three entries are the ellipsoid's semiaxes along x, y and z in that order.",
    premise: GEOMETRY,
    next: DERIVATION,
    symbolIndices: {},
    expectedRowDimensions: [LENGTH, LENGTH, LENGTH],
    allowExpressionList: true,
    primary: {
      row1: reading(
        "product",
        [R, V, C],
        "Read the longitudinal semiaxis",
        "Multiply the rest radius R by the positive contraction factor. The next two entries are each R.",
        "Setting the other two coordinates to zero in turn gives the three intercept lengths. Only the axis parallel to the motion shortens.",
        ["1"],
      ),
      ...contraction("row1.args.1"),
      row2: reading(
        "symbol",
        [R],
        "Read the transverse y semiaxis",
        "Use the rest radius R.",
        "At x = z = 0 the surface equation reduces to y squared equals R squared.",
      ),
      row3: reading(
        "symbol",
        [R],
        "Read the transverse z semiaxis",
        "Use the rest radius R.",
        "At x = y = 0 the surface equation reduces to z squared equals R squared.",
      ),
    },
  },
  "eq-s4-d4": {
    context:
      "Section 4 begins the moving-clock argument with the time transformation for any event.",
    premise: CLOCK,
    next: DERIVATION,
    symbolIndices: { x: "x" },
    expectedRowDimensions: [TIME],
    primary: {
      row1: reading(
        "relation",
        [TAU, T, POSITION, V, C],
        "Assign the moving-frame time to the event",
        "Use both t and x to find the reading τ of the synchronized k clock at the event.",
        "Events at different places can require different clocks in k. To find the elapsed time of one moving clock, the paper next restricts the event to that clock's path.",
        ["1", "1"],
      ),
      "row1.left": coordinateTime(TAU),
      "row1.right.args.1.argument.args.0": coordinateTime(T),
      "row1.right.args.1.argument.args.1": reading(
        "negate",
        [V, C, POSITION],
        "Subtract the position-dependent time",
        "Subtract v x / V squared from the K time before multiplying by the Lorentz factor.",
        "The time assignment depends on how distant clocks are synchronized. Setting x to zero here would select the K origin, a different clock path.",
      ),
      "row1.right.args.1.argument.args.1.argument.args.0.numerator": reading(
        "symbol",
        [V],
        "Use the signed frame speed in the offset",
        "Multiply the position-dependent correction by v.",
        "This correction must vanish when the two frames are at rest relative to one another.",
      ),
      "row1.right.args.1.argument.args.1.argument.args.0.denominator.base": reading(
        "symbol",
        [C],
        "Use the squared light speed in the offset",
        "Divide the correction by V squared.",
        "V stays finite at rest. Replacing it with v would make the offset singular for coincident frames.",
      ),
      ...contraction("row1.right.args.0.denominator"),
    },
  },
  "eq-s4-d5": {
    context: "The clock at the moving origin is selected by its path through K.",
    premise: CLOCK,
    next: ONE_CLOCK,
    symbolIndices: { x: "x" },
    expectedRowDimensions: [LENGTH],
    primary: {
      row1: reading(
        "relation",
        [POSITION, V, T],
        "Select events on this clock's worldline",
        "Choose the event at position x = v t for each K time t.",
        "In k all these events occur at the origin. Differences of τ along this path therefore compare successive readings on one clock.",
      ),
      "row1.right": reading(
        "product",
        [V, T],
        "Locate the moving origin",
        "Multiply the signed constant velocity v by the elapsed K time t.",
        "Uniform motion and the coincident starting origins fix the position without an additive offset.",
      ),
    },
  },
  "eq-s4-d6": {
    context:
      "Substituting the clock's path isolates the elapsed time and the accumulated clock lag.",
    premise:
      CLOCK +
      " Both readings refer back to the coincident zero event. The clock stays at the moving origin throughout this inertial calculation.",
    next: ONE_CLOCK,
    symbolIndices: {},
    expectedRowDimensions: [TIME, TIME],
    allowChainedRelations: true,
    primary: {
      row1: reading(
        "relation",
        [TAU, T, V, C],
        "Find the moving clock's elapsed time",
        "Multiply the elapsed K time by the positive square root.",
        "The location condition x = v t has already been used. Along this particular path the difference of τ is the elapsed time on a single clock.",
        ["1"],
      ),
      "row1.left": coordinateTime(TAU),
      "row1.right.args.0": coordinateTime(T),
      ...contraction("row1.right.args.1"),
      row2: reading(
        "relation",
        [TAU, T, V, C],
        "Read the same time as a lag behind K",
        "Start with t and subtract the time lost by the transported clock.",
        "This second equality rearranges the first. The two expressions describe the same clock and the same pair of events.",
        ["1", "1"],
      ),
      "row2.right.args.0": coordinateTime(T),
      "row2.right.args.1.argument.args.1": coordinateTime(T),
      "row2.right.args.1": reading(
        "negate",
        [T, V, C],
        "Subtract the accumulated lag",
        "Subtract the entire product of the fractional lag and the elapsed K time.",
        "For positive elapsed time the moving clock's reading is smaller at nonzero speed. At rest the fractional lag vanishes.",
        ["1", "1"],
      ),
      "row2.right.args.1.argument.args.0.argument": reading(
        "sum",
        [V, C],
        "Find the fractional lag per unit K time",
        "Subtract the positive square root from one.",
        "This difference has no units. Multiplying by t turns it into a time that can be subtracted from t.",
        ["1", "1"],
      ),
      ...contraction("row2.right.args.1.argument.args.0.argument.args.1.argument"),
    },
  },
};
