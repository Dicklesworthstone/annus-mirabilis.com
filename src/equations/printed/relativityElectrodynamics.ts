/**
 * Read the source's final field transformations and its magnetic-curvature prediction.
 * The display records own the printed bytes and scoped quantities. These guides keep the
 * Gaussian field convention and each component's identity; they never rewrite the source in SI.
 */
import type { Expression } from "../ast.ts";
import type { OperationReading } from "./massEnergyOperations.ts";
import type { RelativityOperationGuide } from "./relativityOperations.ts";

type Primary = RelativityOperationGuide["primary"][string];
type Axis = "x" | "y" | "z";
type Field = "electric" | "magnetic";
const FIELD = ["-1/2", "1/2", "-1", "0", "0", "0"];
const TIME = ["0", "0", "1", "0", "0", "0"];
const LENGTH = ["1", "0", "0", "0", "0", "0"];
const SPEEDS = ["frameSpeed", "speedOfLight"];
const FIELD_ROUTE = {
  href: "/papers/special-relativity/s6/#sr-field-derivation",
  label: "Follow the field-equation transformation and its normalization",
};
const ELECTRON_ROUTE = {
  href: "/lab/sr-13/",
  label: "Compare force conventions, electron energy and magnetic curvature",
};
const FIELD_PREMISE =
  "The inertial system k moves at signed speed v along K's x axis, with parallel axes and |v| < V. The same electromagnetic field is described in both systems, using the paper's Gaussian units: X, Y, Z are electric components and L, M, N are magnetic components. Primed components belong to k. Einstein's beta is the Lorentz factor, now written gamma. The common field scale has been fixed to one by the preceding reciprocity and symmetry argument; covariance alone did not fix it.";
const ELECTRON_PREMISE =
  "The system k is instantaneously comoving with the charged particle, which moves along K's x axis at speed v, with |v| < V. Both synchronized systems describe the same event. V is the light speed and Einstein's beta is the Lorentz factor. The fields use Gaussian units. The paper neglects radiation and self-force; using an instantaneous rest frame is not treating the accelerating particle's entire path as an inertial frame.";

function primary(
  kind: Expression["kind"],
  quantities: readonly string[],
  reading: OperationReading,
  literalNumbers: readonly string[] = [],
): Primary {
  return { kind, quantities, literalNumbers, constantNames: [], ...reading };
}

function component(quantityId: string, axis: Axis): Primary {
  return {
    ...primary("symbol", [quantityId], {
      title: "Keep the named component and frame",
      does: "Use the " + axis + " component of the quantity in the frame named by its symbol.",
      why: "Components can have the same dimensions and quantity owner without being interchangeable. The x, y and z axes remain distinct through this transformation.",
      foundation: "fields-waves",
    }),
    symbolIndex: axis,
  };
}

const speedRatio = primary("quotient", SPEEDS, {
  title: "Compare the frame speed with the light speed",
  does: "Divide the signed speed v by the positive light speed V.",
  why: "The ratio has no units. In Gaussian units it multiplies the other field directly; importing the SI magnetic-field rule without a unit conversion would introduce the wrong powers of V.",
  foundation: "unit-system-1905",
});

function fieldRow(
  row: string,
  field: Field,
  axis: Axis,
  otherAxis?: "y" | "z",
  subtract = false,
): Readonly<Record<string, Primary>> {
  const own = field + "FieldStationary";
  const moving = field + "FieldMoving";
  if (!otherAxis)
    return {
      [row]: primary("relation", [own, moving], {
        title: "Keep the longitudinal " + field + " field",
        does: "The " + field + " component parallel to the boost has the same value in K and k.",
        why: "This is the normalized transformation for a boost along x. It does not say that the transverse components or the complete field vector are unchanged.",
        foundation: "fields-waves",
      }),
      [row + ".left"]: component(moving, axis),
      [row + ".right"]: component(own, axis),
    };
  const other = (field === "electric" ? "magnetic" : "electric") + "FieldStationary";
  const combined = [own, other, ...SPEEDS];
  const sumPath = row + ".right.args.1.argument";
  const crossPath = sumPath + ".args.1" + (subtract ? ".argument" : "");
  const sign = subtract ? "Subtract" : "Add";
  return {
    [row]: primary("relation", [moving, "lorentzFactor", ...combined], {
      title: "Transform the " + axis + " component of the " + field + " field",
      does:
        sign +
        " the signed boost contribution from the other field, then multiply the entire combination by beta.",
      why: "An observer change mixes transverse electric and magnetic fields. The signs follow the chosen x-directed boost and the named axes; changing the observer is not changing the physical field.",
      foundation: "fields-waves",
    }),
    [row + ".left"]: component(moving, axis),
    [row + ".right"]: primary("product", ["lorentzFactor", ...combined], {
      title: "Apply beta to both field contributions",
      does: "Multiply the complete parenthesized field by the same Lorentz factor.",
      why: "Beta is dimensionless, so the product keeps the dimension of a field. Applying it to only the first contribution would not be the printed transformation.",
      foundation: "bridge-fractions-ratios",
    }),
    [sumPath]: primary("sum", combined, {
      title: sign + " the transverse boost contribution",
      does:
        sign +
        " (v/V) times the other field's " +
        otherAxis +
        (subtract ? " component from the stationary " : " component to the stationary ") +
        axis +
        " component.",
      why: "Electric and magnetic fields have the same dimensions in Gaussian units. Their equal dimensions permit this sum, but do not justify exchanging their component labels or changing its sign.",
      foundation: "unit-system-1905",
    }),
    [sumPath + ".args.0"]: component(own, axis),
    [sumPath + ".args.1"]: primary(subtract ? "negate" : "product", [other, ...SPEEDS], {
      title: "Preserve the " + (subtract ? "negative" : "positive") + " cross-field term",
      does: sign + " the entire product of v/V and the indicated transverse field.",
      why: "Reversing v reverses this contribution while leaving beta unchanged. The sign is fixed by the frame direction and field component, not by their common dimensions.",
      foundation: "bridge-negative-numbers-direction",
    }),
    [crossPath + ".args.0"]: speedRatio,
    [crossPath + ".args.1"]: component(other, otherAxis),
  };
}

const ALL_FIELD_COMPONENTS = {
  X: "x",
  Y: "y",
  Z: "z",
  L: "x",
  M: "y",
  N: "z",
  "X'": "x",
  "Y'": "y",
  "Z'": "z",
  "L'": "x",
  "M'": "y",
  "N'": "z",
};

/** Each independent equality is one semantic row, in the source's row-major order. */
const finalFields: RelativityOperationGuide = {
  allowAlignedColumns: true,
  expectedRowDimensions: [FIELD, FIELD, FIELD, FIELD, FIELD, FIELD],
  symbolIndices: ALL_FIELD_COMPONENTS,
  context:
    "Section 6: six normalized field-component transformations, printed in three rows of two equalities. X, Y, Z and L, M, N belong to different fields even though their Gaussian dimensions match.",
  premise: FIELD_PREMISE,
  next: FIELD_ROUTE,
  primary: {
    ...fieldRow("row1", "electric", "x"),
    ...fieldRow("row2", "magnetic", "x"),
    ...fieldRow("row3", "electric", "y", "z", true),
    ...fieldRow("row4", "magnetic", "y", "z"),
    ...fieldRow("row5", "electric", "z", "y"),
    ...fieldRow("row6", "magnetic", "z", "y", true),
  },
};

function transverseCoordinate(row: string, axis: "y" | "z"): Readonly<Record<string, Primary>> {
  return {
    [row]: primary("relation", ["coordinatePositionMoving", "coordinatePositionStationary"], {
      title: "Keep the transverse " + axis + " coordinate",
      does: "The event has the same " + axis + " coordinate in the two normalized systems.",
      why: "The boost is along x. Its transverse coordinate equation does not say that transverse velocities, accelerations or fields are unchanged, since their times and force conventions also matter.",
      foundation: "frames-events",
    }),
    [row + ".left"]: component("coordinatePositionMoving", axis),
    [row + ".right"]: component("coordinatePositionStationary", axis),
  };
}

const coordinateAndField: RelativityOperationGuide = {
  allowAlignedColumns: true,
  expectedRowDimensions: [TIME, LENGTH, FIELD, LENGTH, FIELD, LENGTH, FIELD],
  symbolIndices: {
    x: "x",
    y: "y",
    z: "z",
    "\\xi": "x",
    "\\eta": "y",
    "\\zeta": "z",
    X: "x",
    Y: "y",
    Z: "z",
    M: "y",
    N: "z",
    "X'": "x",
    "Y'": "y",
    "Z'": "z",
  },
  context:
    "Section 10 places the coordinate transformation beside the electric-field transformation before transforming the particle's equation of motion. Position, time and field rows retain their own dimensions.",
  premise: ELECTRON_PREMISE,
  next: {
    href: "/papers/special-relativity/s10/#sr-electron-conventions-derivation",
    label: "Follow the force convention and acceleration transformation",
  },
  primary: {
    row1: primary(
      "relation",
      [
        "coordinateTimeMoving",
        "coordinateTimeStationary",
        "coordinatePositionStationary",
        "lorentzFactor",
        ...SPEEDS,
      ],
      {
        title: "Assign the comoving system's coordinate time",
        does: "Multiply t minus v x/V squared by the Lorentz factor beta.",
        why: "Tau is the synchronized time coordinate of the instantaneous inertial system k. The position-dependent offset is essential when transforming derivatives; this is not the rule that every moving clock reads beta times t.",
        foundation: "frames-events",
      },
    ),
    "row1.right.args.1.argument": primary(
      "sum",
      ["coordinateTimeStationary", "coordinatePositionStationary", ...SPEEDS],
      {
        title: "Retain the position-dependent time offset",
        does: "Subtract the complete product (v/V squared) x from t.",
        why: "The coefficient has time per length dimensions. Multiplying by x makes a time contribution, and reversing v reverses its sign.",
        foundation: "frames-events",
      },
    ),
    "row1.right.args.1.argument.args.1": primary(
      "negate",
      ["coordinatePositionStationary", ...SPEEDS],
      {
        title: "Subtract the longitudinal time contribution",
        does: "Subtract the whole position contribution before applying beta.",
        why: "The negative sign belongs to the K-to-k transformation. It encodes the different simultaneity assignments in the two systems.",
        foundation: "bridge-negative-numbers-direction",
      },
    ),
    "row1.right.args.1.argument.args.1.argument.args.1": component(
      "coordinatePositionStationary",
      "x",
    ),
    row2: primary(
      "relation",
      [
        "coordinatePositionMoving",
        "coordinatePositionStationary",
        "coordinateTimeStationary",
        "frameSpeed",
        "lorentzFactor",
      ],
      {
        title: "Assign the comoving system's longitudinal position",
        does: "Subtract v t from x and multiply the complete difference by beta.",
        why: "The origins move relative to each other while both systems describe the same event. The offset v t has length dimensions; retaining beta distinguishes this transformation from a Galilean coordinate shift.",
        foundation: "frames-events",
      },
    ),
    "row2.left": component("coordinatePositionMoving", "x"),
    "row2.right.args.1.argument.args.0": component("coordinatePositionStationary", "x"),
    "row2.right.args.1.argument.args.1": primary(
      "negate",
      ["frameSpeed", "coordinateTimeStationary"],
      {
        title: "Subtract the moving origin's displacement",
        does: "Subtract the whole product v t from the event's x coordinate.",
        why: "For the event on k's origin x = v t, this difference vanishes and xi is zero. Adding v t would describe the opposite transformation.",
        foundation: "frames-events",
      },
    ),
    ...fieldRow("row3", "electric", "x"),
    ...transverseCoordinate("row4", "y"),
    ...fieldRow("row5", "electric", "y", "z", true),
    ...transverseCoordinate("row6", "z"),
    ...fieldRow("row7", "electric", "z", "y"),
  },
};

const magneticRadius: RelativityOperationGuide = {
  expectedRowDimensions: [LENGTH],
  symbolIndices: { N: "z" },
  context:
    "Section 10 predicts the curvature radius when the transverse magnetic field is the only deflecting field. R here is the particle's path radius; N is the stationary magnetic z component, not a molecular count.",
  premise:
    "The particle has positive rest mass mu, nonzero charge epsilon, and nonzero speed below V. Only a magnetic field transverse to its instantaneous x-directed velocity bends the path. The paper uses Gaussian units and neglects radiation and self-force. The printed signed relation uses the chosen orientation of epsilon and N; a geometric radius uses charge and field magnitudes. At zero field there is no finite curvature radius, and at zero speed a path curvature is not determined by this division.",
  next: ELECTRON_ROUTE,
  primary: {
    row1: primary(
      "relation",
      [
        "radiusCurvatureMagnetic",
        "electronMass",
        "electronCharge",
        "frameSpeed",
        "speedOfLight",
        "magneticFieldStationary",
      ],
      {
        title: "Relate the path radius to the magnetic bending force",
        does: "Multiply V squared, the mass-to-charge ratio, the relativistic speed factor, and the reciprocal magnetic field.",
        why: "In Gaussian units this is R = beta mu v V/(epsilon N). A modern SI expression uses a different magnetic-field unit and does not carry this extra V. Neither expression is the electric-field curvature formula.",
        foundation: "unit-system-1905",
      },
      ["1", "1"],
    ),
    "row1.right.args.0": primary("power", ["speedOfLight"], {
      title: "Keep the squared light-speed conversion factor",
      does: "Square V before multiplying by the mass-to-charge ratio.",
      why: "One power combines with v/V to supply v; the remaining V belongs to the Gaussian magnetic-force convention. Dropping it without converting the field changes both the dimensions and the predicted radius.",
      foundation: "unit-system-1905",
    }),
    "row1.right.args.1": primary("quotient", ["electronMass", "electronCharge"], {
      title: "Use the rest mass per unit charge",
      does: "Divide the particle's rest mass mu by its nonzero charge epsilon.",
      why: "At fixed velocity and magnetic field, a larger mass-to-charge magnitude gives a larger bending radius. The Lorentz factor enters separately and is not already part of mu.",
      foundation: "bridge-fractions-ratios",
    }),
    "row1.right.args.2": primary(
      "quotient",
      SPEEDS,
      {
        title: "Retain the relativistic speed factor",
        does: "Divide v/V by the positive square root of one minus (v/V) squared.",
        why: "This factor equals beta times v/V. It reduces to v/V at low speed and grows as the speed approaches V. Using only v/V would give the nonrelativistic bending radius.",
        foundation: "frames-events",
      },
      ["1"],
    ),
    "row1.right.args.2.numerator": speedRatio,
    "row1.right.args.2.denominator.radicand": primary(
      "sum",
      SPEEDS,
      {
        title: "Keep the subluminal normalization",
        does: "Subtract the complete square of v/V from one before taking the root.",
        why: "The radicand is positive below light speed. The light-speed limit is not a finite-radius state for a massive particle in this model.",
        foundation: "frames-events",
      },
      ["1"],
    ),
    "row1.right.args.2.denominator.radicand.args.1": primary("negate", SPEEDS, {
      title: "Subtract the squared speed ratio",
      does: "Apply the minus sign to the complete squared ratio.",
      why: "A plus sign would produce a different velocity dependence and would not be the Lorentz normalization.",
      foundation: "bridge-negative-numbers-direction",
    }),
    "row1.right.args.3": primary(
      "quotient",
      ["magneticFieldStationary"],
      {
        title: "Divide by the transverse magnetic field",
        does: "Multiply by one over N, the field component bending the path.",
        why: "Doubling the field magnitude at fixed particle speed halves the radius. N = 0 is excluded from this expression; the straight-path limit has no finite radius.",
        foundation: "bridge-fractions-ratios",
      },
      ["1"],
    ),
    "row1.right.args.3.denominator": component("magneticFieldStationary", "z"),
  },
};

export const RELATIVITY_ELECTRODYNAMICS_GUIDES: Readonly<
  Record<string, RelativityOperationGuide>
> = {
  "eq-s6-d9": finalFields,
  "eq-s10-d3": coordinateAndField,
  "eq-s10-d12": magneticRadius,
};
