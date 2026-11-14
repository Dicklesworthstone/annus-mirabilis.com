/**
 * Authored operation readings for the printed velocity, wave and light-complex transformations.
 * The source display bindings remain the owner of every glyph and byte. These guides describe
 * selected parsed operations; they neither replace the source nor calculate laboratory values.
 */
import type { Expression } from "../ast.ts";
import type { MassEnergyOperationGuide, OperationReading } from "./massEnergyOperations.ts";
import type { RelativityOperationGuide } from "./relativityOperations.ts";

type Primary = MassEnergyOperationGuide["primary"][string];
const DIMENSIONLESS = ["0", "0", "0", "0", "0", "0"];
const SPEED = ["1", "0", "-1", "0", "0", "0"];
const FREQUENCY = ["0", "0", "-1", "0", "0", "0"];
const SQUARED_AMPLITUDE = ["-1", "1", "-2", "0", "0", "0"];
const SPEEDS = ["frameSpeed", "speedOfLight"];
const DIRECTION = ["directionCosineStationary", ...SPEEDS];
const ANGLE = ["propagationAngleStationary", ...SPEEDS];

const FRAME_PREMISE =
  "The inertial system k moves at constant signed speed v along K's x axis, with parallel axes and the synchronized coordinates of section 3. V is the positive light speed, |v| < V, and Einstein's beta is the Lorentz factor, now usually written gamma.";
const WAVE_PREMISE =
  FRAME_PREMISE +
  " Both systems describe the same plane wave in vacuum. Its direction is the direction of propagation, not the opposite direction toward the source. The angle phi and direction cosines a, b, c are measured in K; primed quantities belong to k. The three direction cosines form a unit vector.";
const LONGITUDINAL_PREMISE =
  WAVE_PREMISE +
  " This displayed special case has phi = 0: the wave propagates along +x in K. Positive v means k follows the light; negative v means it moves toward the oncoming light.";
const LIGHT_COMPLEX_PREMISE =
  WAVE_PREMISE +
  " The bounded light complex contains the same radiation in both descriptions, measured on each system's simultaneous slice. Its volume is not the volume of a material body at rest in either frame.";
const WAVE_ROUTE = {
  href: "/lab/sr-09/",
  label: "Compare frequency and direction for the same wave",
};
const LIGHT_ROUTE = {
  href: "/papers/special-relativity/s8/#sr-light-complex-derivation",
  label: "Follow the amplitude, volume and total-energy factors together",
};

function primary(
  kind: Expression["kind"],
  quantities: readonly string[],
  reading: OperationReading,
  literalNumbers: readonly string[] = [],
): Primary {
  return { kind, quantities, literalNumbers, constantNames: [], ...reading };
}

const speedRatio = primary("quotient", SPEEDS, {
  title: "Compare the signed frame speed with the light speed",
  does: "Divide v by V, keeping the sign of the frame's motion.",
  why: "Both quantities have speed dimensions, so v/V has no units and lies strictly between -1 and 1. This ratio is not Einstein's printed beta, which is the Lorentz factor.",
  foundation: "bridge-fractions-ratios",
});
const subtractRatio = primary("negate", SPEEDS, {
  title: "Subtract the whole signed speed ratio",
  does: "Apply the minus sign to the complete ratio v/V.",
  why: "Changing v to -v changes this contribution's sign. It changes which frame transformation and propagation direction the expression describes.",
  foundation: "bridge-negative-numbers-direction",
});
const cosine: OperationReading = {
  title: "Project the wave direction onto the motion axis",
  does: "Take the cosine of the propagation angle in the frame named by that angle.",
  why: "Cosine gives the signed x component of a unit direction. The angle is dimensionless but has a different meaning from a frequency or an energy ratio; the primed and unprimed angles belong to different frames.",
  foundation: "fields-waves",
};
const COSINE_FUNCTIONS = { cos: cosine } as const;

function speedRadicand(path: string): Readonly<Record<string, Primary>> {
  return {
    [path]: primary(
      "sum",
      SPEEDS,
      {
        title: "Subtract the squared speed ratio from one",
        does: "Form 1 - (v/V)^2 before applying the surrounding square root or division.",
        why: "The difference is positive for |v| < V. The inertial-observer formula has no finite light-speed endpoint, and reversing v leaves this squared factor unchanged.",
        foundation: "frames-events",
      },
      ["1"],
    ),
    [path + ".args.1"]: primary("negate", SPEEDS, {
      title: "Subtract the complete square",
      does: "The minus sign subtracts all of (v/V)^2.",
      why: "Adding the square would give a different normalization and would not reproduce the Lorentz transformation.",
      foundation: "bridge-negative-numbers-direction",
    }),
    [path + ".args.1.argument.base.argument"]: speedRatio,
  };
}

function directionFactor(
  path: string,
  quantities: readonly string[],
): Readonly<Record<string, Primary>> {
  return {
    [path]: primary(
      "sum",
      quantities,
      {
        title: "Keep the directional Doppler factor together",
        does: "Form one minus the signed speed ratio times the wave's x-direction component in K.",
        why: "The direction component is a or cos(phi), according to the printed notation. Since its magnitude is at most one and |v/V| < 1, this factor stays positive. Reversing propagation changes it; the Lorentz factor alone cannot capture that dependence.",
        foundation: "fields-waves",
      },
      ["1"],
    ),
    [path + ".args.1"]: primary("negate", quantities, {
      title: "Subtract the full directional contribution",
      does: "Subtract the whole product of v/V and the K-frame direction cosine.",
      why: "The sign links the frequency shift to the propagation direction. The light arriving from a source has the opposite direction to a line drawn toward that source.",
      foundation: "bridge-negative-numbers-direction",
    }),
  };
}

function longitudinalRatio(path: string): Readonly<Record<string, Primary>> {
  return {
    [path]: primary(
      "quotient",
      SPEEDS,
      {
        title: "Compare the two longitudinal factors",
        does: "Divide 1 - v/V by 1 + v/V, preserving both signs and the complete denominator.",
        why: "The ratio is positive in the stated domain. It is the squared longitudinal Doppler factor: a squared field amplitude uses this ratio, while frequency and total light energy use its positive square root.",
        foundation: "bridge-fractions-ratios",
      },
      ["1", "1"],
    ),
    [path + ".numerator.args.1"]: subtractRatio,
    [path + ".numerator.args.1.argument"]: speedRatio,
    [path + ".denominator.args.1"]: speedRatio,
  };
}

function transverseDirection(axis: "y" | "z", glyph: "b" | "c"): RelativityOperationGuide {
  return {
    expectedRowDimensions: [DIMENSIONLESS],
    symbolIndices: { a: "x", [glyph]: axis, [glyph + "'"]: axis },
    context: "Section 7: the " + axis + " component of the wave's direction in the moving frame.",
    premise: WAVE_PREMISE,
    next: WAVE_ROUTE,
    primary: {
      row1: primary(
        "relation",
        ["directionCosineMoving", "directionCosineStationary", "lorentzFactor", ...SPEEDS],
        {
          title: "Normalize the transverse wave component",
          does: "Divide the K-frame transverse direction cosine by beta times (1 - a v/V).",
          why: "The transverse spatial coefficient of the wave phase stays unchanged, but the time coefficient and frequency change. Their ratio defines the new direction cosine. Leaving this component unchanged would fail to preserve a unit wave direction.",
          foundation: "fields-waves",
        },
        ["1"],
      ),
      "row1.right": primary(
        "quotient",
        ["directionCosineStationary", "lorentzFactor", ...SPEEDS],
        {
          title: "Divide by the whole frequency factor",
          does: "Apply both the Lorentz factor and the directional factor in the denominator.",
          why: "The same Doppler factor that transforms frequency rescales this transverse direction component. Together with the transformed longitudinal component, it preserves the direction vector's unit length.",
          foundation: "bridge-fractions-ratios",
        },
        ["1"],
      ),
      ...directionFactor("row1.right.denominator.args.1.argument", DIRECTION),
    },
  };
}

const CONSEQUENCE_OPERATIONS: Readonly<Record<string, RelativityOperationGuide>> = {
  "eq-s5-d6": {
    expectedRowDimensions: [SPEED],
    symbolIndices: {},
    context: "Section 5: compose velocities along the common x axis.",
    premise:
      FRAME_PREMISE +
      " The moving system measures the object's signed velocity w, with |w| < V. U is the velocity of that same object in K. This is the inverse direction of the coordinate transformation: from k to K, hence the plus signs involving v.",
    next: { href: "/lab/sr-06/", label: "Compare Galilean and relativistic velocity composition" },
    primary: {
      row1: primary(
        "relation",
        ["velocityComposed", "velocityInMovingFrame", ...SPEEDS],
        {
          title: "Compose velocities through transformed distance and time",
          does: "Set U equal to (v + w)/(1 + v w/V^2), for the same object's motion in the two frames.",
          why: "Velocity is a ratio of a displacement to a time interval. Transforming both gives the denominator that ordinary addition omits. The result stays subluminal for subluminal inputs and approaches v + w when their product is small compared with V^2.",
          foundation: "frames-events",
        },
        ["1"],
      ),
      "row1.right.denominator": primary(
        "sum",
        ["velocityInMovingFrame", ...SPEEDS],
        {
          title: "Retain the transformed-time denominator",
          does: "Add the dimensionless correction v w/V^2 to one.",
          why: "The correction comes from transforming the time interval. Dropping it produces Galilean addition; reversing only one velocity can reduce the denominator below one, but it stays positive for the stated subluminal inputs.",
          foundation: "frames-events",
        },
        ["1"],
      ),
      "row1.right.denominator.args.1": primary("quotient", ["velocityInMovingFrame", ...SPEEDS], {
        title: "Compare the product of velocities with V squared",
        does: "Divide the signed product v w by V^2.",
        why: "The numerator and denominator have speed-squared dimensions. Their ratio is dimensionless, and its sign depends on whether the two velocities have the same or opposite directions.",
        foundation: "bridge-fractions-ratios",
      }),
    },
  },
  "eq-s7-d3": {
    expectedRowDimensions: [FREQUENCY],
    symbolIndices: { a: "x" },
    context: "Section 7: read the transformed time coefficient of the same wave phase.",
    premise: WAVE_PREMISE,
    next: WAVE_ROUTE,
    primary: {
      row1: primary(
        "relation",
        [
          "waveAngularFrequencyMoving",
          "waveAngularFrequencyStationary",
          "lorentzFactor",
          ...DIRECTION,
        ],
        {
          title: "Transform angular frequency",
          does: "Multiply omega by beta times (1 - a v/V) to obtain omega prime.",
          why: "Omega is angular frequency, the time coefficient in the wave phase. Nu later counts cycles; omega = 2 pi nu. Both transform by the same dimensionless factor, but equal dimensions do not make their numerical values interchangeable.",
          foundation: "fields-waves",
        },
        ["1"],
      ),
      ...directionFactor("row1.right.args.2.argument", DIRECTION),
    },
  },
  "eq-s7-d4": {
    expectedRowDimensions: [DIMENSIONLESS],
    symbolIndices: { a: "x", "a'": "x" },
    context: "Section 7: the longitudinal component of the wave direction.",
    premise: WAVE_PREMISE,
    next: WAVE_ROUTE,
    primary: {
      row1: primary(
        "relation",
        ["directionCosineMoving", ...DIRECTION],
        {
          title: "Transform the longitudinal direction cosine",
          does: "Divide a - v/V by 1 - a v/V to obtain a prime.",
          why: "Both the longitudinal spatial coefficient and the time coefficient of the phase change. Their ratio gives a direction cosine in k, not a velocity in units of length per time.",
          foundation: "fields-waves",
        },
        ["1"],
      ),
      "row1.right.numerator.args.1": subtractRatio,
      ...directionFactor("row1.right.denominator", DIRECTION),
    },
  },
  "eq-s7-d5": transverseDirection("y", "b"),
  "eq-s7-d6": transverseDirection("z", "c"),
  "eq-s7-d7": {
    expectedRowDimensions: [FREQUENCY],
    symbolIndices: {},
    functions: COSINE_FUNCTIONS,
    context: "Section 7: the Doppler formula for cyclic frequency and propagation angle.",
    premise: WAVE_PREMISE,
    next: WAVE_ROUTE,
    primary: {
      row1: primary(
        "relation",
        ["waveFrequencyMoving", "waveFrequencyStationary", ...ANGLE],
        {
          title: "Transform cycles per unit time",
          does: "Multiply nu by (1 - (v/V) cos(phi))/sqrt(1 - (v/V)^2) to obtain nu prime.",
          why: "The wave phase identifies the same oscillation in both frames. Its time coefficient changes, so the frequency changes. Phi belongs to K; using the primed angle in this formula would mix frame assignments.",
          foundation: "fields-waves",
        },
        ["1", "1"],
      ),
      "row1.right.args.1": primary(
        "quotient",
        ANGLE,
        {
          title: "Combine direction and the Lorentz normalization",
          does: "Divide the directional factor by the positive square root, giving the full Doppler factor.",
          why: "At v = 0 this factor is one. Even when the wave is transverse in K and cos(phi) = 0, the square-root denominator remains: retaining only the first-order directional numerator would lose the transverse frequency change.",
          foundation: "frames-events",
        },
        ["1", "1"],
      ),
      ...directionFactor("row1.right.args.1.numerator", ANGLE),
      ...speedRadicand("row1.right.args.1.denominator.radicand"),
    },
  },
  "eq-s7-d8": {
    expectedRowDimensions: [FREQUENCY],
    symbolIndices: {},
    context: "Section 7: the longitudinal Doppler special case.",
    premise: LONGITUDINAL_PREMISE,
    next: WAVE_ROUTE,
    primary: {
      row1: primary(
        "relation",
        ["waveFrequencyMoving", "waveFrequencyStationary", ...SPEEDS],
        {
          title: "Read the longitudinal frequency shift",
          does: "Multiply nu by the positive square root of (1 - v/V)/(1 + v/V).",
          why: "Following the light with positive v lowers the measured frequency; negative v raises it. The factor tends without bound as v approaches -V, but the limiting expression does not define an observer moving at light speed.",
          foundation: "fields-waves",
        },
        ["1", "1"],
      ),
      ...longitudinalRatio("row1.right.args.1.radicand"),
    },
  },
  "eq-s7-d9": {
    expectedRowDimensions: [DIMENSIONLESS],
    symbolIndices: {},
    functions: COSINE_FUNCTIONS,
    context: "Section 7: express aberration using the two propagation angles.",
    premise: WAVE_PREMISE,
    next: WAVE_ROUTE,
    primary: {
      row1: primary(
        "relation",
        ["propagationAngleMoving", ...ANGLE],
        {
          title: "Relate two directions of the same ray",
          does: "Set cos(phi prime) equal to (cos(phi) - v/V)/(1 - (v/V) cos(phi)).",
          why: "Aberration changes the propagation angle assigned by the two inertial systems. Both angles describe the same ray; the formula does not bend the ray within either inertial system.",
          foundation: "fields-waves",
        },
        ["1"],
      ),
      "row1.left": primary("function", ["propagationAngleMoving"], cosine),
      "row1.right.numerator.args.0": primary("function", ["propagationAngleStationary"], cosine),
      "row1.right.numerator.args.1": subtractRatio,
      ...directionFactor("row1.right.denominator", ANGLE),
    },
  },
  "eq-s7-d10": {
    expectedRowDimensions: [DIMENSIONLESS],
    symbolIndices: {},
    functions: COSINE_FUNCTIONS,
    context: "Section 7: a wave transverse in K is oblique in k.",
    premise: WAVE_PREMISE + " Here phi = pi/2 in K, so its longitudinal direction cosine is zero.",
    next: WAVE_ROUTE,
    primary: {
      row1: primary("relation", ["propagationAngleMoving", ...SPEEDS], {
        title: "Resolve the transverse aberration sign",
        does: "For a ray transverse in K, set its moving-frame direction cosine to -v/V.",
        why: "Positive v produces a negative longitudinal propagation component in k. A direction drawn toward the source points the other way, which explains why changing that convention can appear to reverse the sign.",
        foundation: "fields-waves",
      }),
      "row1.left": primary("function", ["propagationAngleMoving"], cosine),
      "row1.right": subtractRatio,
      "row1.right.argument": speedRatio,
    },
  },
  "eq-s7-d11": {
    expectedRowDimensions: [SQUARED_AMPLITUDE],
    symbolIndices: {},
    functions: COSINE_FUNCTIONS,
    context: "Section 7: the squared amplitude of the same plane wave.",
    premise: WAVE_PREMISE + " A is the wave's field amplitude in the paper's Gaussian units.",
    next: LIGHT_ROUTE,
    primary: {
      row1: primary(
        "relation",
        ["lightAmplitudeMoving", "lightAmplitudeStationary", ...ANGLE],
        {
          title: "Transform squared amplitude by the squared Doppler factor",
          does: "Multiply A squared by (1 - (v/V) cos(phi)) squared divided by 1 - (v/V) squared.",
          why: "For this plane wave the squared field amplitude follows the square of the frequency factor. In Gaussian units A squared has energy-density dimensions. Total energy also depends on the volume occupied by the same light complex.",
          foundation: "fields-waves",
        },
        ["1", "1"],
      ),
      "row1.left": primary("power", ["lightAmplitudeMoving"], {
        title: "Keep squared amplitude distinct from total energy",
        does: "Square the moving-frame field amplitude.",
        why: "The result is proportional to the wave's energy density, A prime squared divided by 8 pi in this account. Multiplying by the light-complex volume is still required to obtain its total energy.",
        foundation: "work-energy",
      }),
      "row1.right.args.1": primary(
        "quotient",
        ANGLE,
        {
          title: "Square the whole frequency factor",
          does: "Square the directional numerator and divide by the complete speed radicand.",
          why: "This is the square of the Doppler factor. Applying only one power would incorrectly assign the transformation of total light energy to a local squared field amplitude.",
          foundation: "bridge-fractions-ratios",
        },
        ["1", "1"],
      ),
      ...directionFactor("row1.right.args.1.numerator.base.argument", ANGLE),
      ...speedRadicand("row1.right.args.1.denominator"),
    },
  },
  "eq-s7-d12": {
    expectedRowDimensions: [SQUARED_AMPLITUDE],
    symbolIndices: {},
    context: "Section 7: the longitudinal squared-amplitude special case.",
    premise: LONGITUDINAL_PREMISE + " A is the field amplitude in Gaussian units.",
    next: LIGHT_ROUTE,
    primary: {
      row1: primary(
        "relation",
        ["lightAmplitudeMoving", "lightAmplitudeStationary", ...SPEEDS],
        {
          title: "Use the squared factor for squared amplitude",
          does: "Multiply A squared by (1 - v/V)/(1 + v/V) to obtain A prime squared.",
          why: "This expression contains no outer square root because the amplitude is already squared. Frequency and total light energy instead use the positive square root of this same ratio.",
          foundation: "fields-waves",
        },
        ["1", "1"],
      ),
      ...longitudinalRatio("row1.right.args.1"),
    },
  },
  "eq-s8-d3": {
    expectedRowDimensions: [DIMENSIONLESS],
    symbolIndices: {},
    functions: COSINE_FUNCTIONS,
    context: "Section 8: the volume occupied by the same bounded light complex in each system.",
    premise: LIGHT_COMPLEX_PREMISE,
    next: LIGHT_ROUTE,
    primary: {
      row1: primary(
        "relation",
        ["lightComplexVolumeMoving", "lightComplexVolumeStationary", ...ANGLE],
        {
          title: "Transform the volume of the same radiation",
          does: "Set S prime/S to sqrt(1 - (v/V)^2)/(1 - (v/V) cos(phi)), the inverse Doppler factor.",
          why: "Each volume is bounded by surfaces that follow the same radiation, evaluated on that frame's simultaneous slice. Together with the squared-amplitude factor, this inverse factor leaves one Doppler factor for total energy.",
          foundation: "frames-events",
        },
        ["1", "1"],
      ),
      "row1.left": primary(
        "quotient",
        ["lightComplexVolumeMoving", "lightComplexVolumeStationary"],
        {
          title: "Compare volumes on their own simultaneous slices",
          does: "Divide the moving-frame light-complex volume S prime by its K-frame volume S.",
          why: "Both volumes have length-cubed dimensions, so their ratio has no units. They describe the same radiation even though simultaneity selects different boundary events.",
          foundation: "frames-events",
        },
      ),
      "row1.right": primary(
        "quotient",
        ANGLE,
        {
          title: "Retain the direction-dependent volume factor",
          does: "Divide the Lorentz square root by the complete directional factor.",
          why: "The material-body factor 1/gamma omits this directional denominator. It happens to agree for a ray transverse in K, so an oblique or longitudinal ray is needed to distinguish the two formulas.",
          foundation: "bridge-fractions-ratios",
        },
        ["1", "1"],
      ),
      ...speedRadicand("row1.right.numerator.radicand"),
      ...directionFactor("row1.right.denominator", ANGLE),
    },
  },
  "eq-s8-d5": {
    expectedRowDimensions: [DIMENSIONLESS],
    symbolIndices: {},
    context: "Section 8: the total-energy ratio for a longitudinal light complex.",
    premise:
      LIGHT_COMPLEX_PREMISE +
      " Here phi = 0, the wave propagates along +x in K, and the original light-complex energy E is positive.",
    next: {
      href: "/papers/mass-energy/#eq-s0-d1",
      label: "See the light-energy transformation imported into the mass-energy note",
    },
    primary: {
      row1: primary(
        "relation",
        ["lightComplexEnergyMoving", "lightComplexEnergyStationary", ...SPEEDS],
        {
          title: "Transform total light energy by one Doppler factor",
          does: "Set E prime/E to the positive square root of (1 - v/V)/(1 + v/V).",
          why: "The squared-amplitude factor multiplies the inverse volume factor, leaving the same factor as frequency. This is a statement about a light complex; using it in the later body-energy ledger is a further argument, not an assumption that the body's energy is already M V squared.",
          foundation: "work-energy",
        },
        ["1", "1"],
      ),
      "row1.left": primary(
        "quotient",
        ["lightComplexEnergyMoving", "lightComplexEnergyStationary"],
        {
          title: "Compare the total energies of the same light complex",
          does: "Divide its total energy in k by its total energy in K.",
          why: "This is neither a local energy-density ratio nor a body's before-and-after energy difference. Equal energy dimensions do not permit exchanging these distinct quantities.",
          foundation: "work-energy",
        },
      ),
      ...longitudinalRatio("row1.right.radicand"),
    },
  },
};

/**
 * Expected owners at individual mathematical positions. A subtree's set of quantities alone
 * cannot distinguish v/V from V/v, or swapping both primed and unprimed frequency bindings.
 * These explicit source positions also keep energy, volume and field-amplitude ratios oriented.
 * Symbols retain their existing quantity inspector; these assertions add no operation markers.
 */
const SOURCE_QUANTITY_PATHS: Readonly<Record<string, Readonly<Record<string, readonly string[]>>>> =
  {
    "eq-s5-d6": {
      velocityComposed: ["row1.left"],
      frameSpeed: ["row1.right.numerator.args.0", "row1.right.denominator.args.1.numerator.args.0"],
      velocityInMovingFrame: [
        "row1.right.numerator.args.1",
        "row1.right.denominator.args.1.numerator.args.1",
      ],
      speedOfLight: ["row1.right.denominator.args.1.denominator.base"],
    },
    "eq-s7-d3": {
      waveAngularFrequencyMoving: ["row1.left"],
      waveAngularFrequencyStationary: ["row1.right.args.0"],
      lorentzFactor: ["row1.right.args.1"],
      directionCosineStationary: ["row1.right.args.2.argument.args.1.argument.args.0"],
      frameSpeed: ["row1.right.args.2.argument.args.1.argument.args.1.numerator"],
      speedOfLight: ["row1.right.args.2.argument.args.1.argument.args.1.denominator"],
    },
    "eq-s7-d4": {
      directionCosineMoving: ["row1.left"],
      directionCosineStationary: [
        "row1.right.numerator.args.0",
        "row1.right.denominator.args.1.argument.args.0",
      ],
      frameSpeed: [
        "row1.right.numerator.args.1.argument.numerator",
        "row1.right.denominator.args.1.argument.args.1.numerator",
      ],
      speedOfLight: [
        "row1.right.numerator.args.1.argument.denominator",
        "row1.right.denominator.args.1.argument.args.1.denominator",
      ],
    },
    "eq-s7-d5": {
      directionCosineMoving: ["row1.left"],
      directionCosineStationary: [
        "row1.right.numerator",
        "row1.right.denominator.args.1.argument.args.1.argument.args.0",
      ],
      lorentzFactor: ["row1.right.denominator.args.0"],
      frameSpeed: ["row1.right.denominator.args.1.argument.args.1.argument.args.1.numerator"],
      speedOfLight: ["row1.right.denominator.args.1.argument.args.1.argument.args.1.denominator"],
    },
    "eq-s7-d6": {
      directionCosineMoving: ["row1.left"],
      directionCosineStationary: [
        "row1.right.numerator",
        "row1.right.denominator.args.1.argument.args.1.argument.args.0",
      ],
      lorentzFactor: ["row1.right.denominator.args.0"],
      frameSpeed: ["row1.right.denominator.args.1.argument.args.1.argument.args.1.numerator"],
      speedOfLight: ["row1.right.denominator.args.1.argument.args.1.argument.args.1.denominator"],
    },
    "eq-s7-d7": {
      waveFrequencyMoving: ["row1.left"],
      waveFrequencyStationary: ["row1.right.args.0"],
      propagationAngleStationary: ["row1.right.args.1.numerator.args.1.argument.args.0.argument"],
      frameSpeed: [
        "row1.right.args.1.numerator.args.1.argument.args.1.numerator",
        "row1.right.args.1.denominator.radicand.args.1.argument.base.argument.numerator",
      ],
      speedOfLight: [
        "row1.right.args.1.numerator.args.1.argument.args.1.denominator",
        "row1.right.args.1.denominator.radicand.args.1.argument.base.argument.denominator",
      ],
    },
    "eq-s7-d8": {
      waveFrequencyMoving: ["row1.left"],
      waveFrequencyStationary: ["row1.right.args.0"],
      frameSpeed: [
        "row1.right.args.1.radicand.numerator.args.1.argument.numerator",
        "row1.right.args.1.radicand.denominator.args.1.numerator",
      ],
      speedOfLight: [
        "row1.right.args.1.radicand.numerator.args.1.argument.denominator",
        "row1.right.args.1.radicand.denominator.args.1.denominator",
      ],
    },
    "eq-s7-d9": {
      propagationAngleMoving: ["row1.left.argument"],
      propagationAngleStationary: [
        "row1.right.numerator.args.0.argument",
        "row1.right.denominator.args.1.argument.args.1.argument",
      ],
      frameSpeed: [
        "row1.right.numerator.args.1.argument.numerator",
        "row1.right.denominator.args.1.argument.args.0.numerator",
      ],
      speedOfLight: [
        "row1.right.numerator.args.1.argument.denominator",
        "row1.right.denominator.args.1.argument.args.0.denominator",
      ],
    },
    "eq-s7-d10": {
      propagationAngleMoving: ["row1.left.argument"],
      frameSpeed: ["row1.right.argument.numerator"],
      speedOfLight: ["row1.right.argument.denominator"],
    },
    "eq-s7-d11": {
      lightAmplitudeMoving: ["row1.left.base"],
      lightAmplitudeStationary: ["row1.right.args.0.base"],
      frameSpeed: [
        "row1.right.args.1.numerator.base.argument.args.1.argument.args.0.numerator",
        "row1.right.args.1.denominator.args.1.argument.base.argument.numerator",
      ],
      speedOfLight: [
        "row1.right.args.1.numerator.base.argument.args.1.argument.args.0.denominator",
        "row1.right.args.1.denominator.args.1.argument.base.argument.denominator",
      ],
      propagationAngleStationary: [
        "row1.right.args.1.numerator.base.argument.args.1.argument.args.1.argument",
      ],
    },
    "eq-s7-d12": {
      lightAmplitudeMoving: ["row1.left.base"],
      lightAmplitudeStationary: ["row1.right.args.0.base"],
      frameSpeed: [
        "row1.right.args.1.numerator.args.1.argument.numerator",
        "row1.right.args.1.denominator.args.1.numerator",
      ],
      speedOfLight: [
        "row1.right.args.1.numerator.args.1.argument.denominator",
        "row1.right.args.1.denominator.args.1.denominator",
      ],
    },
    "eq-s8-d3": {
      lightComplexVolumeMoving: ["row1.left.numerator"],
      lightComplexVolumeStationary: ["row1.left.denominator"],
      frameSpeed: [
        "row1.right.numerator.radicand.args.1.argument.base.argument.numerator",
        "row1.right.denominator.args.1.argument.args.0.numerator",
      ],
      speedOfLight: [
        "row1.right.numerator.radicand.args.1.argument.base.argument.denominator",
        "row1.right.denominator.args.1.argument.args.0.denominator",
      ],
      propagationAngleStationary: ["row1.right.denominator.args.1.argument.args.1.argument"],
    },
    "eq-s8-d5": {
      lightComplexEnergyMoving: ["row1.left.numerator"],
      lightComplexEnergyStationary: ["row1.left.denominator"],
      frameSpeed: [
        "row1.right.radicand.numerator.args.1.argument.numerator",
        "row1.right.radicand.denominator.args.1.numerator",
      ],
      speedOfLight: [
        "row1.right.radicand.numerator.args.1.argument.denominator",
        "row1.right.radicand.denominator.args.1.denominator",
      ],
    },
  };

export const RELATIVITY_CONSEQUENCE_GUIDES: Readonly<Record<string, RelativityOperationGuide>> =
  Object.fromEntries(
    Object.entries(CONSEQUENCE_OPERATIONS).map(([id, guide]) => [
      id,
      {
        ...guide,
        primary: {
          ...guide.primary,
          ...Object.fromEntries(
            Object.entries(SOURCE_QUANTITY_PATHS[id] ?? {}).flatMap(([quantityId, paths]) =>
              paths.map((path) => [
                path,
                primary("symbol", [quantityId], {
                  title: "Retain the quantity in its printed position",
                  does: "Keep this occurrence in its stated frame and physical role.",
                  why: "Quantities with equal dimensions can have different meanings. Exchanging numerator and denominator, or stationary and moving quantities, changes the transformation.",
                  foundation: "frames-events",
                }),
              ]),
            ),
          ),
        },
      },
    ]),
  );
