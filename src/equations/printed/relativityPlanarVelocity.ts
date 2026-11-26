/** Einstein's section 5 follows one uniformly moving point from k into K. */
import type { Expression } from "../ast.ts";
import type { RelativityOperationGuide } from "./relativityOperations.ts";

type Primary = RelativityOperationGuide["primary"][string];
const LENGTH = ["1", "0", "0", "0", "0", "0"];
const V = "frameSpeed";
const C = "speedOfLight";
const WX = "velocityComponentXMoving";
const WY = "velocityComponentYMoving";
const K = "coordinatePositionStationary";
const k = "coordinatePositionMoving";
const t = "coordinateTimeStationary";
const tau = "coordinateTimeMoving";
const premise =
  "The point passes the common origin when both clocks read zero. It moves uniformly in the ξ, η plane of k. Frame k moves at constant signed speed v along the parallel x axes of K and k, with |v| < V. Each frame uses its own synchronized clock readings.";
const next = {
  href: "/lab/sr-06/",
  label: "Compare parallel and transverse velocity components in the velocity-composition lab",
};

function read(
  kind: Expression["kind"],
  quantities: readonly string[],
  title: string,
  does: string,
  why: string,
  literalNumbers: readonly string[] = [],
): Primary {
  return { kind, quantities, title, does, why, literalNumbers, constantNames: [], foundation: "frames-events" };
}

function coordinate(owner: string, axis: string): Primary {
  return {
    ...read("symbol", [owner], "Keep the " + axis + " component",
      "Read the position on the " + axis + " axis in the frame named by the coordinate.",
      "The boost acts along x. Interchanging the coordinates would apply the longitudinal rule to the wrong direction."),
    symbolIndex: axis,
  };
}

const denominator = read(
  "sum", [V, WX, C], "Use the same clock conversion for both components",
  "Add one to the product of v and the moving-frame longitudinal velocity divided by V squared.",
  "In the inverse Lorentz transformation, the K time interval depends on the ξ displacement in k. Dividing either K displacement by that same interval gives this common denominator. The transverse velocity does not enter it.", ["1"],
);

function planarZero(owner: string): Primary {
  return read("relation", [owner], "Keep the motion in its plane",
    "Set the third position coordinate to zero length.",
    "The axes were chosen so that the motion lies in the first two directions. A boost along x preserves the vanishing transverse z coordinate.", ["0"]);
}

export const RELATIVITY_PLANAR_VELOCITY_GUIDES: Readonly<Record<string, RelativityOperationGuide>> = {
  "eq-s5-d1": {
    context: "Section 5 specifies the point's trajectory as measured in the moving system k.",
    premise,
    next,
    symbolIndices: { "\\xi": "x", "\\eta": "y", "\\zeta": "z" },
    expectedRowDimensions: [LENGTH, LENGTH, LENGTH],
    primary: {
      row1: read("relation", [k, WX, tau], "Locate the particle along the direction of the boost",
        "Multiply its signed longitudinal velocity in k by the elapsed k time τ.",
        "The zero initial displacement and constant velocity give a straight worldline. Here τ is the coordinate time of k."),
      "row1.left": coordinate(k, "x"),
      row2: read("relation", [k, WY, tau], "Locate the particle in the transverse direction",
        "Multiply its transverse velocity in k by the same elapsed time τ.",
        "Both positions refer to the same event. They therefore use one k time, even when both velocity components are nonzero."),
      "row2.left": coordinate(k, "y"),
      row3: planarZero(k),
      "row3.left": coordinate(k, "z"),
    },
  },
  "eq-s5-d2": {
    context: "The second display describes the same worldline using positions and time measured by K.",
    premise: premise + " For a material point or a light signal the magnitude of its velocity in k is at most V, so the common denominator is positive.",
    next,
    symbolIndices: { x: "x", y: "y", z: "z" },
    expectedRowDimensions: [LENGTH, LENGTH, LENGTH],
    primary: {
      row1: read("relation", [K, WX, V, C, t], "Locate the point along x in K",
        "Multiply the transformed longitudinal velocity by the elapsed K time t.",
        "Using t puts this position on the same K time scale as the transverse position.", ["1"]),
      "row1.left": coordinate(K, "x"),
      "row1.right.args.0": read("quotient", [WX, V, C], "Compose the longitudinal velocities",
        "Divide wξ + v by the clock-conversion denominator.",
        "The inverse coordinate transformation mixes the longitudinal displacement with elapsed time. The numerator alone would omit the change of time coordinate.", ["1"]),
      "row1.right.args.0.denominator": denominator,
      row2: read("relation", [K, V, C, WX, WY, t], "Locate the point along y in K",
        "Multiply the moving-frame transverse velocity by the transverse factor and by t.",
        "The y displacement is the same in the two frames. The times used to measure that displacement differ, so the two transverse velocities can differ.", ["1", "1"]),
      "row2.left": coordinate(K, "y"),
      "row2.right.args.0": read("quotient", [V, C, WX], "Convert the transverse rate",
        "Divide the positive square root by the same denominator used for the longitudinal rate.",
        "The square root is the inverse Lorentz factor. Even when wξ vanishes, this factor changes a nonzero transverse velocity for nonzero frame speed.", ["1", "1"]),
      "row2.right.args.0.numerator.radicand.args.1": read("negate", [V, C], "Subtract the squared frame-speed ratio",
        "Subtract the entire square of v/V from one before taking the positive root.",
        "The factor multiplying transverse motion is even in v and approaches one at rest."),
      "row2.right.args.0.denominator": denominator,
      "row2.right.args.1": read("symbol", [WY], "Scale the transverse component",
        "Use wη for the velocity multiplied by the transverse factor.",
        "When wη vanishes the trajectory stays on the x axis in both systems."),
      row3: planarZero(K),
      "row3.left": coordinate(K, "z"),
    },
  },
};
