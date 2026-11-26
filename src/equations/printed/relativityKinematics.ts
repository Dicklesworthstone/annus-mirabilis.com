/**
 * Source operations for the spherical light fronts in the two inertial frames.
 * The edition owns the glyph bindings and source bytes; these guides explain the frame-specific
 * distance and time operations without calculating another version of the physics.
 */
import type { Expression } from "../ast.ts";
import type { OperationReading } from "./massEnergyOperations.ts";
import type { RelativityOperationGuide } from "./relativityOperations.ts";

type Primary = RelativityOperationGuide["primary"][string];
const AREA = ["2", "0", "0", "0", "0", "0"];
const POSITION_K = "coordinatePositionStationary";
const POSITION_k = "coordinatePositionMoving";
const TIME_K = "coordinateTimeStationary";
const TIME_k = "coordinateTimeMoving";
const K_AXES = { x: "x", y: "y", z: "z" };
const k_AXES = { "\\xi": "x", "\\eta": "y", "\\zeta": "z" };
const FRAME_PREMISE =
  "The inertial system k moves at constant signed speed v along K's x axis. The axes are parallel, their origins coincide at t = tau = 0, and each system uses its own light-synchronized clocks. V is the positive light speed and |v| < V.";
const COORDINATES = {
  href: "/papers/special-relativity/s3/#sr-coordinate-derivation",
  label: "Follow the coordinate transformation and its remaining scale",
};

function primary(
  kind: Expression["kind"],
  quantities: readonly string[],
  reading: OperationReading,
  literalNumbers: readonly string[] = [],
): Primary {
  return { kind, quantities, literalNumbers, constantNames: [], ...reading };
}

function symbol(quantityId: string, symbolIndex?: string): Primary {
  return {
    ...primary("symbol", [quantityId], {
      title: "Keep the quantity in its stated frame and position",
      does: "Use this occurrence for the coordinate, clock reading or scale named by the source.",
      why: "Equal units do not make the two frames, the spatial axes or the two speeds interchangeable. Their positions in the expression carry physical meaning.",
      foundation: "frames-events",
    }),
    ...(symbolIndex ? { symbolIndex } : {}),
  };
}

/** Each axis is an independent occurrence, even though all three share a quantity owner. */
function squaredDistance(path: string, quantity: string): Readonly<Record<string, Primary>> {
  return {
    [path]: primary("sum", [quantity], {
      title: "Add the three squared coordinate components",
      does: "Add the squares of the x, y and z components in the one stated frame.",
      why: "The axes are orthogonal, so this sum is the squared spatial distance from that frame's origin at its chosen coordinate time. It is not a sum of positions taken in different frames.",
      foundation: "frames-events",
    }),
    ...Object.fromEntries(
      ["x", "y", "z"].flatMap((axis, index) => [
        [
          path + ".args." + index,
          primary("power", [quantity], {
            title: "Square the " + axis + " component",
            does: "Multiply this one coordinate component by itself.",
            why: "Its contribution has length-squared dimensions and is nonnegative. Changing its sign in the sum would change the spatial surface being described.",
            foundation: "frames-events",
          }),
        ],
        [path + ".args." + index + ".base", symbol(quantity, axis)],
      ]),
    ),
  };
}

function lightFront(moving: boolean): RelativityOperationGuide {
  const position = moving ? POSITION_k : POSITION_K;
  const time = moving ? TIME_k : TIME_K;
  const frame = moving ? "k" : "K";
  return {
    expectedRowDimensions: [AREA],
    symbolIndices: moving ? k_AXES : K_AXES,
    context: "Section 3 describes the spherical light front using " + frame + "'s coordinates.",
    premise:
      FRAME_PREMISE +
      " Light leaves the shared origin at the shared zero event. This is the outgoing front at nonnegative coordinate time, described by simultaneous positions in the frame named by the equation. The same light events satisfy both frame equations. Preserving this light-front equation alone does not fix the still-undetermined common scale phi(v).",
    next: COORDINATES,
    primary: {
      row1: primary("relation", [position, time, "speedOfLight"], {
        title: "Describe the outgoing light front in " + frame,
        does: "Equate the sum of squared spatial coordinates to light speed squared times coordinate time squared.",
        why: "In this frame the front's radius is V times its elapsed coordinate time. The equation expresses light propagation under the stated assumptions; dimensional consistency alone does not establish that light obeys them.",
        foundation: "frames-events",
      }),
      ...squaredDistance("row1.left", position),
      "row1.right": primary("product", ["speedOfLight", time], {
        title: "Square the light front's radius",
        does: "Multiply V squared by this frame's coordinate time squared.",
        why: "Speed times time is a distance. Both squares are needed for comparison with the squared spatial distance on the left.",
        foundation: "frames-events",
      }),
      "row1.right.args.0.base": symbol("speedOfLight"),
      "row1.right.args.1.base": symbol(time),
    },
  };
}

export const RELATIVITY_KINEMATICS_GUIDES: Readonly<Record<string, RelativityOperationGuide>> = {
  "eq-s3-d17": lightFront(false),
  "eq-s3-d18": lightFront(true),
};
