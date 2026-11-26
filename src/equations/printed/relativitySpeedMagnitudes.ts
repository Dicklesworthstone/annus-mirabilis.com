/** The two printed definitions of squared planar speed in §5, p. 905. */
import type { RelativityOperationGuide } from "./relativityOperations.ts";

type Primary = RelativityOperationGuide["primary"][string];
const U = "velocityComposed";
const W = "velocityInMovingFrame";
const X = "coordinatePositionStationary";
const T = "coordinateTimeStationary";
const WX = "velocityComponentXMoving";
const WY = "velocityComponentYMoving";
const squaredSpeed = ["2", "0", "-2", "0", "0", "0"];

function positionRate(axis: "x" | "y", path: string): Record<string, Primary> {
  return {
    [path]: {
      kind: "derivative",
      quantities: [X, T],
      title: "Read the " + axis + " velocity measured in K",
      does: "Differentiate the particle’s " + axis + " coordinate along its trajectory with respect to the stationary system’s time t.",
      why: "This is an ordinary rate of change along one worldline. The preceding trajectory is linear in t, so the rate is the coefficient multiplying t.",
      foundation: "frames-events",
    },
    [path + ".expression"]: {
      kind: "symbol",
      quantities: [X],
      symbolIndex: axis,
      title: "Use the " + axis + " coordinate in K",
      does: "Follow the " + axis + " displacement of the same moving point.",
      why: "The perpendicular components contribute separate squares to the speed.",
      foundation: "frames-events",
    },
    [path + ".variable"]: {
      kind: "symbol",
      quantities: [T],
      title: "Measure the rate against K time",
      does: "Use synchronized stationary-frame time readings for the two particle positions.",
      why: "Using moving-frame time here would mix the coordinates of different frames.",
      foundation: "frames-events",
    },
  };
}

export const RELATIVITY_SPEED_MAGNITUDES_GUIDE: RelativityOperationGuide = {
  context: "Section 5 defines U and w from the components of the same particle’s motion as measured by K and k.",
  premise: "The axes in each frame are orthogonal, and the trajectory is confined to their first two directions. U and w are nonnegative speeds; individual components retain their signs.",
  next: { href: "/lab/sr-06/", label: "Compare planar velocity components and magnitudes in the lab" },
  expectedRowDimensions: [squaredSpeed, squaredSpeed],
  allowTrajectoryDerivatives: true,
  symbolIndices: { x: "x", y: "y" },
  primary: {
    row1: {
      kind: "relation",
      quantities: [U, X, T],
      title: "Find the squared speed in K",
      does: "Add the squares of dx/dt and dy/dt, with both derivatives measured in K.",
      why: "Orthogonal components combine by the Pythagorean theorem. Opposite signs change the direction of motion while leaving each squared contribution unchanged.",
      foundation: "frames-events",
    },
    ...positionRate("x", "row1.right.args.0.base.argument"),
    ...positionRate("y", "row1.right.args.1.base.argument"),
    row2: {
      kind: "relation",
      quantities: [W, WX, WY],
      title: "Find the squared speed in k",
      does: "Add the squares of wξ and wη, the signed components already specified in the moving system.",
      why: "The same geometric definition of speed applies in both frames. The components marked ξ and η belong to k; U uses the components measured in K.",
      foundation: "frames-events",
    },
    "row2.right.args.0.base": {
      kind: "symbol", quantities: [WX],
      title: "Use the longitudinal moving-frame velocity",
      does: "Take wξ along the direction of the boost.", why: "It enters the transformation of time as well as the transformed longitudinal velocity.",
      foundation: "frames-events",
    },
    "row2.right.args.1.base": {
      kind: "symbol", quantities: [WY],
      title: "Use the transverse moving-frame velocity",
      does: "Take wη across the direction of the boost.", why: "It contributes to the moving-frame speed even when wξ is zero.",
      foundation: "frames-events",
    },
  },
};
