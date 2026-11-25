/**
 * The printed section 4 route from a normalized step kernel to diffusion and its Gaussian.
 * The source first uses f for particles per volume, then explicitly reinterprets f dx as a
 * particle count. These readings keep those densities, and their different units, separate.
 */
import type { BrownianOperationGuide } from "./brownianOperations.ts";

type Reading = BrownianOperationGuide["primary"][string];

const KERNEL_PREMISE =
  "Phi is a nonnegative probability density for the signed displacement Delta during one positive step interval tau. Its integral is one. The resting homogeneous liquid supplies the symmetry between opposite directions; a finite second moment is additionally required to define D. Independence of successive coarse steps is a physical assumption, not a consequence of normalization.";
const KERNEL_NEXT = {
  href: "/foundations/distributions/",
  label: "Read density as probability per unit displacement",
};
const DIFFUSION_NEXT = {
  href: "/foundations/diffusion-equation/",
  label: "Connect local flux, curvature and the change in density",
};
const KERNEL_VALUE: Reading = {
  kind: "symbol",
  quantities: ["transitionKernel", "displacementIncrement"],
  functionArguments: ["displacementIncrement"],
  title: "Evaluate the step density at a displacement",
  does: "Phi of Delta gives probability per unit length at the signed step Delta. The parentheses supply an argument; they do not multiply phi by Delta.",
  why: "A density value is not the probability of one exact displacement. Multiplying by a displacement interval, or integrating over an interval, supplies a probability.",
  foundation: "distributions",
};
const NORMALIZATION: BrownianOperationGuide = {
  expectedDimension: ["0", "0", "0", "0", "0", "0"],
  symbolIndices: {},
  allowCalculus: true,
  functionArities: { transitionKernel: [1] },
  context: "Every particle makes some signed step, so the total probability over all steps is one.",
  premise: KERNEL_PREMISE,
  next: KERNEL_NEXT,
  primary: {
    row1: {
      kind: "relation",
      quantities: ["transitionKernel", "displacementIncrement"],
      literalNumbers: ["1"],
      constantNames: ["infinity", "infinity"],
      title: "Normalize the probability of all steps",
      does: "The area under phi from minus infinity to plus infinity equals one.",
      why: "The one is total probability, not a particle count or the density at a point. This condition conserves the number of particles when the step distribution moves them.",
      foundation: "distributions",
    },
    "row1.left": {
      kind: "integral",
      quantities: ["transitionKernel", "displacementIncrement"],
      variableQuantity: "displacementIncrement",
      integralBounds: "all-real",
      title: "Add the probabilities over signed displacements",
      does: "Integrate phi with respect to Delta over the full real line. The differential d Delta supplies a length interval.",
      why: "Phi has dimension inverse length; integration over displacement cancels that length and returns a dimensionless probability. The infinite bounds describe the integration domain, not physical values of Delta to substitute into the density.",
      foundation: "integration",
    },
    "row1.left.expression": KERNEL_VALUE,
  },
};

const GAUSSIAN_EXPONENTIAL = {
  title: "Use a dimensionless negative exponent",
  does: "Evaluate the exponential of minus x squared divided by four D t.",
  why: "Both x squared and D t have dimension length squared. Their ratio is dimensionless, so it can be an exponential's argument. For positive D and t the negative sign makes the density decrease away from the origin.",
  foundation: "exponentials",
};

export const BROWNIAN_CALCULUS_GUIDES: Readonly<Record<string, BrownianOperationGuide>> = {
  "eq-s4-d2": NORMALIZATION,
  "eq-s4-d8": NORMALIZATION,
  "eq-s4-d3": {
    expectedDimension: ["-1", "0", "0", "0", "0", "0"],
    symbolIndices: {},
    functionArities: { transitionKernel: [1] },
    context: "The step distribution has no preferred direction in the resting liquid.",
    premise: KERNEL_PREMISE,
    next: KERNEL_NEXT,
    primary: {
      row1: {
        kind: "relation",
        quantities: ["transitionKernel", "displacementIncrement"],
        literalNumbers: [],
        constantNames: [],
        title: "Match the densities of opposite steps",
        does: "Phi has the same value at Delta and at minus Delta.",
        why: "This is an even distribution. Its positive and negative first-moment contributions cancel when that moment exists, while its second moment can remain positive and produce spreading.",
        foundation: "distributions",
      },
      "row1.left": KERNEL_VALUE,
      "row1.right": {
        ...KERNEL_VALUE,
        functionArguments: [{ quantityId: "displacementIncrement", negated: true }],
        title: "Read the density at the opposite displacement",
        does: "Evaluate the same step density at minus Delta, reversing the signed direction without changing its magnitude.",
      },
      "row1.right.at": {
        kind: "negate",
        quantities: ["displacementIncrement"],
        title: "Reverse the direction of the step",
        does: "Minus Delta is the same step length in the opposite direction.",
        why: "The minus sign belongs inside phi's argument. Negating the density itself would produce a negative probability density and is a different operation.",
        foundation: "bridge-negative-numbers-direction",
      },
    },
  },
  "eq-s4-d9": {
    expectedDimension: ["2", "0", "-1", "0", "0", "0"],
    symbolIndices: {},
    allowCalculus: true,
    functionArities: { transitionKernel: [1] },
    context: "The surviving second moment of the symmetric step distribution determines D.",
    premise: KERNEL_PREMISE,
    next: DIFFUSION_NEXT,
    primary: {
      row1: {
        kind: "relation",
        quantities: [
          "stepInterval",
          "displacementIncrement",
          "transitionKernel",
          "diffusionCoefficient",
        ],
        literalNumbers: ["1", "2"],
        constantNames: ["infinity", "infinity"],
        title: "Relate step variance to diffusivity",
        does: "D equals the mean squared step divided by twice the step interval tau.",
        why: "For this symmetric zero-drift kernel the mean square is its variance. D is a rate of spreading with units length squared per time; it is not a particle speed.",
        foundation: "diffusion-equation",
      },
      "row1.left.args.0": {
        kind: "quotient",
        quantities: ["stepInterval"],
        title: "Convert the step contribution into a rate",
        does: "Multiply the half-moment by one over the positive step interval tau.",
        why: "Tau is the interval used to describe independent coarse steps. It is distinct from the later observation time t and cannot be set to zero in this printed ratio.",
        foundation: "bridge-fractions-ratios",
      },
      "row1.left.args.1": {
        kind: "integral",
        quantities: ["displacementIncrement", "transitionKernel"],
        variableQuantity: "displacementIncrement",
        integralBounds: "all-real",
        title: "Average half the squared step",
        does: "Integrate Delta squared over two, weighted by phi of Delta, over all possible signed steps.",
        why: "The density and differential together supply probability weight. The result has dimension length squared and must be finite for this diffusion coefficient to exist.",
        foundation: "integration",
      },
      "row1.left.args.1.expression.args.0": {
        kind: "quotient",
        quantities: ["displacementIncrement"],
        title: "Retain the Taylor coefficient one half",
        does: "Divide the squared step by two before averaging it.",
        why: "The factor comes from the second-order Taylor contribution. Dropping it would give a spreading rate twice the D defined here.",
        foundation: "taylor-expansion",
      },
      "row1.left.args.1.expression.args.0.numerator": {
        kind: "power",
        quantities: ["displacementIncrement"],
        title: "Square the signed step",
        does: "Multiply Delta by itself, so positive and negative displacements contribute equally.",
        why: "Symmetry cancels the signed first moment, not this second moment. Its growth records spreading even when the mean displacement is zero.",
        foundation: "mean-variance-rms",
      },
      "row1.left.args.1.expression.args.1": KERNEL_VALUE,
    },
  },
  "eq-s4-1": {
    expectedDimension: ["-3", "0", "-1", "0", "0", "0"],
    symbolIndices: {},
    allowCalculus: true,
    functionArities: { numberDensity: [0, 2] },
    context:
      "The small-step expansion gives the diffusion equation for the spatially varying volume density.",
    premise:
      "Here f equals nu, particles per unit volume, as stated at the start of the derivation. The field depends on one position coordinate x and time t in a homogeneous resting liquid with constant D. Independent symmetric steps, a finite second moment and a smooth density justify the continuum approximation; the equation is not an exact statement for arbitrary finite jumps or a single jagged particle path.",
    next: DIFFUSION_NEXT,
    primary: {
      row1: {
        kind: "relation",
        quantities: [
          "numberDensity",
          "fieldTimeCoordinate",
          "diffusionCoefficient",
          "positionCoordinate1d",
        ],
        literalNumbers: [],
        constantNames: [],
        title: "Relate change in time to curvature in space",
        does: "The time derivative of f equals D times its second derivative with respect to x.",
        why: "Both sides have units particles per volume per time. Positive curvature fills a local trough; negative curvature lowers a local peak. This describes an evolving ensemble density, not an instantaneous velocity of one particle.",
        foundation: "diffusion-equation",
      },
      "row1.left": {
        kind: "derivative",
        derivativeOrder: 1,
        variableQuantity: "fieldTimeCoordinate",
        quantities: ["numberDensity", "fieldTimeCoordinate"],
        title: "Measure local change at fixed position",
        does: "Differentiate the density f with respect to time t while keeping x fixed.",
        why: "The partial derivative describes how the density at a chosen location changes. Dividing its dimension by time gives particles per volume per time; the printed fraction is a derivative operator, not a quotient of two independent quantities.",
        foundation: "partial-derivatives",
      },
      "row1.right.args.1": {
        kind: "derivative",
        derivativeOrder: 2,
        variableQuantity: "positionCoordinate1d",
        quantities: ["numberDensity", "positionCoordinate1d"],
        title: "Measure spatial curvature at fixed time",
        does: "Differentiate f twice with respect to x while keeping t fixed.",
        why: "A first derivative measures slope; this second derivative measures how the slope changes. It divides the density dimension by length squared, which D converts into a rate in time.",
        foundation: "partial-derivatives",
      },
    },
  },
  "eq-s4-d11": {
    expectedDimension: ["-1", "0", "0", "0", "0", "0"],
    symbolIndices: {},
    allowExponentials: true,
    functionArities: { numberDensity1d: [2] },
    functions: { exp: GAUSSIAN_EXPONENTIAL },
    context:
      "The source now reinterprets f(x,t) dx as the number of particles in a displacement interval.",
    premise:
      "Each particle's initial position is its own origin. All n particles start at zero displacement at t = 0; the formula is the continuum solution on the unbounded line for constant positive D and t > 0, with zero drift. Here f counts particles per unit displacement and integrates to n. The probability density is f/n, distinct from the volume density used earlier to derive equation (1).",
    next: {
      href: "/foundations/gaussian-distributions/",
      label: "Explore the Gaussian's area, width and mean square",
    },
    primary: {
      row1: {
        kind: "relation",
        quantities: [
          "numberDensity1d",
          "positionCoordinate1d",
          "fieldTimeCoordinate",
          "particleCount",
          "diffusionCoefficient",
        ],
        literalNumbers: ["4", "4"],
        constantNames: ["pi"],
        title: "Read the spreading particle-count density",
        does: "The Gaussian gives the number of particles per unit displacement at coordinate x and time t.",
        why: "Its integral is n, while its width grows with the square root of D t. This is a count density with dimension inverse length, not particles per volume and not a probability until divided by n.",
        foundation: "gaussian-distributions",
      },
      "row1.left": {
        kind: "symbol",
        quantities: ["numberDensity1d", "positionCoordinate1d", "fieldTimeCoordinate"],
        functionArguments: ["positionCoordinate1d", "fieldTimeCoordinate"],
        title: "Read the density at a position and a time",
        does: "Evaluate f at x and t, in that order. These arguments select a point of the evolving density field.",
        why: "The parentheses indicate a two-variable function; they do not multiply f by x or by t. In this paragraph x is measured from each particle's initial position.",
        foundation: "functions-graphs",
      },
      "row1.right.args.0": {
        kind: "quotient",
        quantities: ["particleCount", "diffusionCoefficient"],
        title: "Keep the total count in the normalization",
        does: "Divide n by the square root of four pi D; the separate square root of t completes the normalization.",
        why: "Together the two denominators give the square root of four pi D t, with dimension length. The prefactor therefore has units particles per length and keeps the total area equal to n.",
        foundation: "gaussian-distributions",
      },
      "row1.right.args.0.denominator": {
        kind: "root",
        quantities: ["diffusionCoefficient"],
        title: "Take the diffusivity part of the normalization",
        does: "Take the positive square root of four pi D.",
        why: "Its dimension is length divided by square root of time. Multiplying it by the source's separate square root of t produces a length without changing the printed factorization.",
        foundation: "gaussian-distributions",
      },
      "row1.right.args.1.numerator": {
        ...GAUSSIAN_EXPONENTIAL,
        kind: "function",
        quantities: ["positionCoordinate1d", "diffusionCoefficient", "fieldTimeCoordinate"],
      },
      "row1.right.args.1.numerator.argument.argument.numerator": {
        kind: "power",
        quantities: ["positionCoordinate1d"],
        title: "Give opposite displacements the same weight",
        does: "Square x before dividing by four D t.",
        why: "The square makes the Gaussian even in displacement. Its mean remains zero while its mean squared displacement grows as two D t.",
        foundation: "mean-variance-rms",
      },
      "row1.right.args.1.denominator": {
        kind: "root",
        quantities: ["fieldTimeCoordinate"],
        title: "Lower the peak as the cloud spreads",
        does: "Divide by the positive square root of t.",
        why: "For t > 0, spreading over a width proportional to square root of t requires the peak to decrease by the same factor to conserve the total count. At t = 0 the initial point mass is a limiting distribution, not a finite value of this formula.",
        foundation: "gaussian-distributions",
      },
    },
  },
};
