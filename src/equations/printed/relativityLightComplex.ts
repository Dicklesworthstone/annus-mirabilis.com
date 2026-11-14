/**
 * The finite light complex in section 8: its moving boundary, a simultaneous slice in k,
 * and the density-times-volume energy calculation. Each reading is tied to a physical source
 * occurrence; equal dimensions never license exchanging frames or vector components.
 */
import type { Expression } from "../ast.ts";
import type { OperationReading } from "./massEnergyOperations.ts";
import type { RelativityOperationGuide } from "./relativityOperations.ts";

type Primary = RelativityOperationGuide["primary"][string];
type Axis = "x" | "y" | "z";
const DIMENSIONLESS = ["0", "0", "0", "0", "0", "0"];
const SQUARED_LENGTH = ["2", "0", "0", "0", "0", "0"];
const SPEEDS = ["frameSpeed", "speedOfLight"];
const SPHERE = [
  "coordinatePositionStationary",
  "speedOfLight",
  "directionCosineStationary",
  "coordinateTimeStationary",
];
const ELLIPSOID = [
  "coordinatePositionMoving",
  "lorentzFactor",
  "directionCosineStationary",
  ...SPEEDS,
];
const RADIATION =
  "This is the plane wave of section 7 in vacuum, with positive light speed V and unit propagation direction (a, b, c) measured in K. The inertial system k moves at signed speed v along K's x axis, with parallel axes and |v| < V. Einstein's beta is the Lorentz factor now usually called gamma.";
const LIGHT_ROUTE = {
  href: "/papers/special-relativity/s8/#sr-light-complex-derivation",
  label: "Follow the boundary, volume, density and total-energy calculation",
};

function primary(
  kind: Expression["kind"],
  quantities: readonly string[],
  reading: OperationReading,
  literalNumbers: readonly string[] = [],
  constantNames: readonly string[] = [],
): Primary {
  return { kind, quantities, literalNumbers, constantNames, ...reading };
}

function symbol(quantityId: string, symbolIndex?: Axis): Primary {
  return {
    ...primary("symbol", [quantityId], {
      title: "Keep the quantity in its physical position",
      does: "Retain this occurrence's frame, role and vector component.",
      why: "Two quantities can have the same units while describing different frames or axes. The source's position in the expression fixes which one is meant.",
      foundation: "frames-events",
    }),
    ...(symbolIndex === undefined ? {} : { symbolIndex }),
  };
}

const radiusSquared = primary("power", ["lightSphereRadius"], {
  title: "Keep the boundary at its fixed radius",
  does: "Set the sum of the three squared offsets equal to R squared.",
  why: "R is the positive radius of the translating light boundary in K. It is not an expanding wavefront radius, a material sphere's rest radius, or the moving frame's ellipsoid semiaxis.",
  foundation: "frames-events",
});

const speedRatio = primary("quotient", SPEEDS, {
  title: "Compare the signed frame speed with the light speed",
  does: "Divide v by V, keeping the sign of the relative motion.",
  why: "The two speeds have the same units. Their ratio is dimensionless with magnitude below one; it is distinct from Einstein's beta.",
  foundation: "bridge-fractions-ratios",
});

/** Independent authoring by axis; these paths are not inferred from the source being checked. */
function sphereComponent(index: number, axis: Axis, direction: string): Record<string, Primary> {
  const squared = `row1.left.args.${index}`;
  const difference = squared + ".base.argument";
  const displacement = difference + ".args.1.argument";
  const travel = ["speedOfLight", "directionCosineStationary", "coordinateTimeStationary"];
  return {
    [squared]: primary("power", SPHERE, {
      title: `Square the ${axis} offset from the travelling centre`,
      does: `Square the whole difference ${axis} - V ${direction} t, including the centre's displacement.`,
      why: "A squared offset contributes to distance squared regardless of its sign. The three perpendicular offsets must be squared separately before they are added.",
      foundation: "frames-events",
    }),
    [difference]: primary("sum", SPHERE, {
      title: `Measure the ${axis} coordinate from the light's moving centre`,
      does: `Subtract V ${direction} t from ${axis}, using one K time t for the entire sphere.`,
      why: `The centre moves with component V ${direction} along this axis. The difference measures a point relative to that translating centre, not relative to the fixed origin.`,
      foundation: "frames-events",
    }),
    [difference + ".args.1"]: primary("negate", travel, {
      title: `Subtract the centre's complete ${axis} displacement`,
      does: `Subtract the whole product V ${direction} t.`,
      why: "A point travelling with the centre keeps the same offset as t changes. Reversing this sign would make the boundary move against the stated propagation direction.",
      foundation: "bridge-negative-numbers-direction",
    }),
    [displacement]: primary("product", travel, {
      title: `Let the boundary travel with the wave along ${axis}`,
      does: `Multiply the light speed V by direction cosine ${direction} and elapsed coordinate time t.`,
      why: "Speed times time is a length; the direction cosine selects its signed component. For this plane wave, a boundary translating with the radiation retains the same portion of light.",
      foundation: "fields-waves",
    }),
    [difference + ".args.0"]: symbol("coordinatePositionStationary", axis),
    [displacement + ".args.0"]: symbol("speedOfLight"),
    [displacement + ".args.1"]: symbol("directionCosineStationary", axis),
    [displacement + ".args.2"]: symbol("coordinateTimeStationary"),
  };
}

function ellipsoidComponent(
  index: number,
  axis: Axis,
  coordinate: string,
  direction: string,
): Record<string, Primary> {
  const squared = `row1.left.args.${index}`;
  const difference = squared + ".base.argument";
  const displacement = difference + ".args.1.argument";
  const first = axis === "x" ? "beta xi" : coordinate;
  return {
    [squared]: primary("power", ELLIPSOID, {
      title: `Square the transformed ${axis} offset`,
      does: `Square the entire difference ${first} - ${direction} beta (v/V) xi.`,
      why: "This is one of the original sphere's squared offsets, evaluated at events simultaneous in k. The sum of all three defines the transformed boundary.",
      foundation: "frames-events",
    }),
    [difference]: primary("sum", ELLIPSOID, {
      title: `Include the centre's travel on the k-time slice for ${axis}`,
      does: `Subtract ${direction} beta (v/V) xi from ${first}. The final xi is the longitudinal coordinate even in a transverse row.`,
      why: "At tau = 0 the inverse time transformation gives t = beta v xi / V². Different xi positions therefore sample different K times, so the travelling centre contributes to all three offsets.",
      foundation: "frames-events",
    }),
    [difference + ".args.1"]: primary("negate", ELLIPSOID, {
      title: `Subtract the ${axis} travel evaluated at that event's K time`,
      does: `Subtract the full product ${direction} beta (v/V) xi.`,
      why: "The minus sign comes from subtracting the centre's position in the original sphere equation. It is not an independent contraction factor for this axis.",
      foundation: "bridge-negative-numbers-direction",
    }),
    [displacement]: primary("product", ELLIPSOID, {
      title: `Express the centre's ${axis} displacement on tau = 0`,
      does: `Combine ${direction}, beta, v/V and the same longitudinal xi to obtain a length.`,
      why: "Substituting the inverse time relation into V times the direction cosine times t cancels one power of V. The direction cosine still belongs to K; it is not the aberrated direction in k.",
      foundation: "frames-events",
    }),
    [displacement + ".args.2"]: speedRatio,
    [displacement + ".args.0"]: symbol("directionCosineStationary", axis),
    [displacement + ".args.1"]: symbol("lorentzFactor"),
    [displacement + ".args.2.numerator"]: symbol("frameSpeed"),
    [displacement + ".args.2.denominator"]: symbol("speedOfLight"),
    [displacement + ".args.3"]: symbol("coordinatePositionMoving", "x"),
    ...(axis === "x"
      ? {
          [difference + ".args.0"]: primary(
            "product",
            ["lorentzFactor", "coordinatePositionMoving"],
            {
              title: "Use the inverse longitudinal coordinate transformation",
              does: "At tau = 0, substitute x = beta xi into the sphere's x offset.",
              why: "This reconstructs each boundary event's K coordinate from its k coordinate. Beta multiplies xi here; it is not the material-length-contraction rule applied to the light packet.",
              foundation: "frames-events",
            },
          ),
          [difference + ".args.0.args.0"]: symbol("lorentzFactor"),
          [difference + ".args.0.args.1"]: symbol("coordinatePositionMoving", "x"),
        }
      : { [difference + ".args.0"]: symbol("coordinatePositionMoving", axis) }),
  };
}

function densityTimesVolume(
  path: string,
  frame: "Moving" | "Stationary",
  system: "k" | "K",
): Record<string, Primary> {
  const amplitude = "lightAmplitude" + frame;
  const volume = "lightComplexVolume" + frame;
  return {
    [path]: primary(
      "product",
      [amplitude, volume],
      {
        title: `Multiply energy density by the packet's volume in ${system}`,
        does: `Multiply the squared-amplitude energy density by the bounding volume measured on one simultaneous slice of ${system}.`,
        why: "Energy per unit volume times volume gives total energy. Both factors must describe the same frame and the same enclosed radiation; mixing a primed factor with an unprimed one changes the question.",
        foundation: "work-energy",
      },
      ["8"],
      ["pi"],
    ),
    [path + ".args.0"]: primary(
      "quotient",
      [amplitude],
      {
        title: `Use the paper's energy-density convention in ${system}`,
        does: "Divide the squared light amplitude by the complete factor 8 pi.",
        why: "This is the Gaussian convention used in the source. Squared amplitude has energy-density dimensions in that convention; the division does not yet give the total energy of the finite packet.",
        foundation: "unit-system-1905",
      },
      ["8"],
      ["pi"],
    ),
    [path + ".args.0.numerator"]: primary("power", [amplitude], {
      title: `Square the light amplitude in ${system}`,
      does: "Multiply the amplitude by itself before forming the energy density.",
      why: "The field amplitude changes by one Doppler factor, so its square and the energy density change by two factors. A squared amplitude is not itself a finite packet energy.",
      foundation: "fields-waves",
    }),
    [path + ".args.0.denominator"]: primary(
      "product",
      [],
      {
        title: "Keep the Gaussian normalization together",
        does: "Multiply 8 by pi in the denominator of the energy density.",
        why: "The same numerical normalization occurs in both frames and cancels in the ratio. Its appearance is a unit convention, not a light-quantum hypothesis.",
        foundation: "unit-system-1905",
      },
      ["8"],
      ["pi"],
    ),
    [path + ".args.0.numerator.base"]: symbol(amplitude),
    [path + ".args.1"]: symbol(volume),
  };
}

const cosine: OperationReading = {
  title: "Project the K-frame propagation direction onto the motion axis",
  does: "Take the cosine of phi, the wave's propagation angle in K.",
  why: "Cosine is the signed longitudinal direction cosine a. The angle points along the light's travel, not back toward its source, and it is not the moving frame's aberrated angle.",
  foundation: "fields-waves",
};

export const RELATIVITY_LIGHT_COMPLEX_GUIDES: Readonly<Record<string, RelativityOperationGuide>> = {
  "eq-s8-d1": {
    expectedRowDimensions: [SQUARED_LENGTH],
    symbolIndices: { x: "x", y: "y", z: "z", a: "x", b: "y", c: "z" },
    context:
      "Section 8 first identifies the same finite portion of light before comparing its energy in two frames.",
    premise:
      RADIATION +
      " A sphere of fixed positive radius R translates with the radiation at velocity V(a, b, c), starting with its centre at the origin at t = 0. No radiation crosses this co-moving mathematical boundary. It is not a material object or an observer at light speed.",
    next: LIGHT_ROUTE,
    primary: {
      row1: primary("relation", [...SPHERE, "lightSphereRadius"], {
        title: "Define a boundary that contains the same light",
        does: "Select the points at distance R from the centre (V a t, V b t, V c t), at a single K time t.",
        why: "The entire boundary travels with this plane wave, retaining the same radiation. That identifies what must be compared in both frames before any energy ratio is calculated.",
        foundation: "fields-waves",
      }),
      "row1.left": primary("sum", SPHERE, {
        title: "Add the three squared offsets",
        does: "Add the separate x, y and z squared distances from the travelling centre.",
        why: "The three axes are perpendicular, so their squared offsets add to distance squared. Squaring the sum of offsets instead would introduce cross terms and define a different surface.",
        foundation: "frames-events",
      }),
      ...sphereComponent(0, "x", "a"),
      ...sphereComponent(1, "y", "b"),
      ...sphereComponent(2, "z", "c"),
      "row1.right": radiusSquared,
      "row1.right.base": symbol("lightSphereRadius"),
    },
  },
  "eq-s8-d2": {
    expectedRowDimensions: [SQUARED_LENGTH],
    symbolIndices: { "\\xi": "x", "\\eta": "y", "\\zeta": "z", a: "x", b: "y", c: "z" },
    context:
      "Section 8 describes the light boundary on the moving system's simultaneous slice tau = 0.",
    premise:
      RADIATION +
      " The same travelling sphere is now intersected with tau = 0, not with t = 0. The inverse coordinate transformation gives x = beta xi, t = beta v xi / V², y = eta and z = zeta on this slice. R remains the sphere's K-frame radius; a, b and c remain its K-frame propagation direction.",
    next: LIGHT_ROUTE,
    primary: {
      row1: primary("relation", [...ELLIPSOID, "lightSphereRadius"], {
        title: "Find the same light boundary at one moving-frame time",
        does: "Substitute the coordinates of events with tau = 0 into the travelling sphere equation, giving this ellipsoid in xi, eta and zeta.",
        why: "Simultaneous events in k generally have different K times. Accounting for the boundary's motion at those times changes its volume. The displayed surface is neither a photograph nor a material sphere contracted by a fixed factor.",
        foundation: "frames-events",
      }),
      "row1.left": primary("sum", ELLIPSOID, {
        title: "Combine all three transformed offsets",
        does: "Add the three squared offsets evaluated on the same tau = 0 slice.",
        why: "Each term descends from one perpendicular K-frame offset. For an oblique ray the longitudinal coordinate enters transverse offsets too, producing a tilted ellipsoid rather than three independent axis contractions.",
        foundation: "frames-events",
      }),
      ...ellipsoidComponent(0, "x", "xi", "a"),
      ...ellipsoidComponent(1, "y", "eta", "b"),
      ...ellipsoidComponent(2, "z", "zeta", "c"),
      "row1.right": radiusSquared,
      "row1.right.base": symbol("lightSphereRadius"),
    },
  },
  "eq-s8-d4": {
    expectedRowDimensions: [DIMENSIONLESS, DIMENSIONLESS],
    symbolIndices: {},
    allowChainedRelations: true,
    functions: { cos: cosine },
    context:
      "Section 8 combines the wave-amplitude change with the volume of the same finite light complex.",
    premise:
      RADIATION +
      " The packet has nonzero radiation energy and positive volume. In each frame the paper uses the Gaussian energy-density convention A squared/(8 pi) and measures the bounded volume on that frame's simultaneous slice. The density ratio is q squared and the volume ratio is 1/q, where q = (1 - (v/V) cos(phi))/sqrt(1 - (v/V) squared). No body rest-energy formula or light-quantum assumption enters.",
    next: {
      href: "/papers/mass-energy/#arg-me-import",
      label: "See how the mass-energy note imports this light-energy result",
    },
    primary: {
      row1: primary(
        "relation",
        [
          "lightComplexEnergyMoving",
          "lightComplexEnergyStationary",
          "lightAmplitudeMoving",
          "lightAmplitudeStationary",
          "lightComplexVolumeMoving",
          "lightComplexVolumeStationary",
        ],
        {
          title: "Write each total energy as density times volume",
          does: "Replace E prime and E by their own frame's energy density multiplied by its volume, then compare the two complete energies.",
          why: "This is the step that turns a field-amplitude law into a law for a finite portion of light. The same radiation is enclosed in both descriptions, even though its density and bounding volume both change.",
          foundation: "work-energy",
        },
        ["8", "8"],
        ["pi", "pi"],
      ),
      "row1.left": primary(
        "quotient",
        ["lightComplexEnergyMoving", "lightComplexEnergyStationary"],
        {
          title: "Compare the same light's two total energies",
          does: "Divide the energy assigned in k by the energy assigned in K.",
          why: "The two positive energies describe one enclosed portion of radiation. Their dimensionless ratio can differ from one without creating or removing radiation.",
          foundation: "work-energy",
        },
      ),
      "row1.left.numerator": symbol("lightComplexEnergyMoving"),
      "row1.left.denominator": symbol("lightComplexEnergyStationary"),
      "row1.right": primary(
        "quotient",
        [
          "lightAmplitudeMoving",
          "lightAmplitudeStationary",
          "lightComplexVolumeMoving",
          "lightComplexVolumeStationary",
        ],
        {
          title: "Divide the moving density-volume product by the stationary product",
          does: "Keep both factors in each frame together: (A prime squared/(8 pi)) S prime divided by (A squared/(8 pi)) S.",
          why: "A density ratio alone would give q squared. The volume ratio contributes 1/q, leaving one factor q for the total energy. A material-volume contraction generally gives the wrong result for this travelling light boundary.",
          foundation: "work-energy",
        },
        ["8", "8"],
        ["pi", "pi"],
      ),
      ...densityTimesVolume("row1.right.numerator", "Moving", "k"),
      ...densityTimesVolume("row1.right.denominator", "Stationary", "K"),
      row2: primary(
        "relation",
        [
          "lightComplexEnergyMoving",
          "lightComplexEnergyStationary",
          "propagationAngleStationary",
          ...SPEEDS,
        ],
        {
          title: "Continue the equality to the total-energy Doppler factor",
          does: "The second equals sign gives the value of the same E prime/E ratio after the amplitude and volume transformations are combined.",
          why: "The density contributes q squared and the bounded volume contributes 1/q, so their product is q. The chain is two compatible equalities about the same ratio, not an additional independent physical assumption.",
          foundation: "bridge-equals-sign-relationship",
        },
        ["1", "1"],
      ),
      "row2.right": primary(
        "quotient",
        ["propagationAngleStationary", ...SPEEDS],
        {
          title: "Obtain one Doppler factor for total light energy",
          does: "Divide 1 - (v/V) cos(phi) by the positive square root of 1 - (v/V) squared.",
          why: "This is the same factor that transforms the wave frequency in section 7. Its appearance here follows from classical wave energy and the finite boundary, without assuming quantized light or a body's energy-mass relation.",
          foundation: "fields-waves",
        },
        ["1", "1"],
      ),
      "row2.right.numerator": primary(
        "sum",
        ["propagationAngleStationary", ...SPEEDS],
        {
          title: "Retain the wave's propagation direction",
          does: "Subtract (v/V) cos(phi) from one before applying the Lorentz factor.",
          why: "The factor is positive because |v/V| < 1 and |cos(phi)| is at most one. Following or opposing the light gives different energy shifts; the Lorentz factor alone cannot express that distinction.",
          foundation: "fields-waves",
        },
        ["1"],
      ),
      "row2.right.numerator.args.1": primary("negate", ["propagationAngleStationary", ...SPEEDS], {
        title: "Subtract the full directional speed contribution",
        does: "Apply the minus sign to the product (v/V) cos(phi).",
        why: "Reversing v or reversing propagation changes this contribution's sign. The square in the Lorentz factor stays unchanged.",
        foundation: "bridge-negative-numbers-direction",
      }),
      "row2.right.numerator.args.1.argument.args.0": speedRatio,
      "row2.right.numerator.args.1.argument.args.0.numerator": symbol("frameSpeed"),
      "row2.right.numerator.args.1.argument.args.0.denominator": symbol("speedOfLight"),
      "row2.right.numerator.args.1.argument.args.1.argument": symbol("propagationAngleStationary"),
      "row2.right.denominator": primary(
        "root",
        SPEEDS,
        {
          title: "Use the positive Lorentz normalization",
          does: "Take the positive square root of 1 - (v/V) squared as the denominator.",
          why: "The stated subluminal domain keeps the root positive. It equals one at rest and never changes sign when the frame direction is reversed.",
          foundation: "frames-events",
        },
        ["1"],
      ),
      "row2.right.denominator.radicand": primary(
        "sum",
        SPEEDS,
        {
          title: "Subtract the squared speed ratio from one",
          does: "Form the full radicand 1 - (v/V) squared.",
          why: "The square makes this part independent of the sign of v. Replacing the subtraction by addition would change the Lorentz normalization.",
          foundation: "frames-events",
        },
        ["1"],
      ),
      "row2.right.denominator.radicand.args.1": primary("negate", SPEEDS, {
        title: "Subtract the complete squared ratio",
        does: "The minus sign applies to all of (v/V) squared.",
        why: "The entire dimensionless square belongs inside the subtraction and the surrounding root.",
        foundation: "bridge-negative-numbers-direction",
      }),
      "row2.right.denominator.radicand.args.1.argument.base.argument": speedRatio,
      "row2.right.denominator.radicand.args.1.argument.base.argument.numerator":
        symbol("frameSpeed"),
      "row2.right.denominator.radicand.args.1.argument.base.argument.denominator":
        symbol("speedOfLight"),
    },
  },
};
