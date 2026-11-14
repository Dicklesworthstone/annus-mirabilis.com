/**
 * The Brownian paper's printed route from diffusivity to an observable spread and an inferred N.
 * These readings describe source operations, without substituting a numerical model or changing
 * Einstein's k (viscosity), P (particle radius), or the two different roles of N in section 5.
 */
import type { Expression } from "../ast.ts";
import type { MassEnergyOperationGuide, OperationReading } from "./massEnergyOperations.ts";

export type BrownianOperationGuide = MassEnergyOperationGuide &
  Readonly<{
    expectedDimension: readonly string[];
    symbolIndices: Readonly<Record<string, string>>;
  }>;

/** The records are shared by the source compiler and every reading face. */
function frozen<T>(value: T): T {
  if (value !== null && typeof value === "object") {
    for (const child of Object.values(value)) frozen(child);
    Object.freeze(value);
  }
  return value;
}

const LENGTH = ["1", "0", "0", "0", "0", "0"];
const DIFFUSIVITY = ["2", "0", "-1", "0", "0", "0"];
const PER_AMOUNT = ["0", "0", "0", "0", "0", "-1"];

const DRAG_PREMISE =
  "The particles are dilute spheres in a liquid at a uniform absolute temperature T. The drag model is the steady, low-speed Stokes law, with positive viscosity k and independently specified radius P. R is the molar gas constant; N is the number of molecules per mole. The relation combines the dilute osmotic law with zero net particle flux at equilibrium.";
const SPREAD_PREMISE =
  "Lambda x is the root mean square displacement along one axis over the observation interval t. The ideal diffusion model has zero drift and a finite, constant D; t is nonnegative. An ensemble mean square, not one signed displacement or the length of a winding path, supplies this spread.";

const EQUILIBRIUM = {
  href: "/papers/brownian-motion/s3/#bm-equilibrium-derivation",
  label: "Follow the equilibrium argument that determines diffusivity",
};
const SPREAD = {
  href: "/lab/bm-01/",
  label: "Compare signed displacement, mean square and RMS in the Brownian laboratory",
};
const INFERENCE = {
  href: "/lab/bm-07/",
  label: "Inspect which measurements let you infer a molecular number",
};

/** Mathematical roles stay separate from the physical premises of the selected display. */
export const BROWNIAN_ARITHMETIC: Readonly<Partial<Record<Expression["kind"], OperationReading>>> =
  frozen({
    relation: {
      title: "Read the equality",
      does: "The complete expressions on the two sides have the same value under the conditions stated for this display.",
      why: "The preceding physical argument supplies the relation. Equal dimensions are necessary but do not prove the model or its assumptions.",
      foundation: "bridge-equals-sign-relationship",
    },
    product: {
      title: "Multiply the complete factors",
      does: "Multiply the adjacent factors, keeping every fraction and square root intact.",
      why: "The dimensions multiply with the factors. Which measured or assumed quantities belong in the product is determined by the physical relation.",
      foundation: "bridge-fractions-ratios",
    },
    quotient: {
      title: "Divide by the complete denominator",
      does: "Divide everything in the numerator by everything in the denominator.",
      why: "The denominator must be nonzero. In these relations the viscosity, particle radius and molecular number are positive; inversion from displacement additionally requires a nonzero measured spread.",
      foundation: "bridge-fractions-ratios",
    },
    root: {
      title: "Take the nonnegative square root",
      does: "Take the nonnegative square root of the complete expression under the root sign.",
      why: "The radicand is nonnegative under the stated conditions. Square roots halve its dimensional exponents; a root of a squared length therefore has the dimension of length.",
      foundation: "mean-variance-rms",
    },
    power: {
      title: "Square the whole displacement scale",
      does: "Multiply lambda x by itself, including the whole quantity named by its subscript.",
      why: "Lambda x is a root mean square displacement, so its square is the mean squared displacement in this zero-drift model. A single observed step is not a substitute for that ensemble quantity.",
      foundation: "mean-variance-rms",
    },
    group: {
      title: "Keep the group together",
      does: "Treat the enclosed expression as one operand of the surrounding operation.",
      why: "A fraction or power outside the delimiters applies to the complete group, rather than to only the nearest factor.",
      foundation: "bridge-fractions-ratios",
    },
  });

const diffusivityGuide: BrownianOperationGuide = {
  expectedDimension: DIFFUSIVITY,
  symbolIndices: {},
  context: "The equilibrium argument fixes the diffusion coefficient from temperature and drag.",
  premise: DRAG_PREMISE,
  next: EQUILIBRIUM,
  primary: {
    row1: {
      kind: "relation",
      literalNumbers: ["1", "6"],
      constantNames: ["pi"],
      quantities: [
        "diffusionCoefficient",
        "molarGasConstant",
        "temperature",
        "avogadroConstant",
        "viscosity",
        "particleRadius",
      ],
      title: "Read the diffusivity relation",
      does: "D equals the thermal energy scale R T divided by N, multiplied by the particle's mobility in the Stokes drag model.",
      why: "Section 3 matches drift and diffusion in the same equilibrium. This is a model-based relation, not a definition of N or a direct observation of molecular paths.",
      foundation: "viscosity-stokes-drag",
    },
    "row1.right.args.0": {
      kind: "quotient",
      quantities: ["molarGasConstant", "temperature", "avogadroConstant"],
      title: "The thermal energy scale R T over N",
      does: "Divide the molar energy R T by the molecular number per mole N to obtain an energy per particle.",
      why: "The amount units cancel. The printed k elsewhere in this expression is the liquid's viscosity, not the Boltzmann constant; replacing k with a thermal constant would change the equation.",
      foundation: "unit-system-1905",
    },
    "row1.right.args.1": {
      kind: "quotient",
      quantities: ["viscosity", "particleRadius"],
      title: "The mobility one over six pi k P",
      does: "Divide one by the Stokes drag coefficient 6 pi k P. This is steady drift velocity per unit applied force.",
      why: "The factor belongs to a spherical particle of radius P in a liquid of viscosity k. Multiplying this mobility by the thermal energy scale produces length squared per time, the dimension of D.",
      foundation: "viscosity-stokes-drag",
    },
  },
};

/** Opt in only the useful symbolic relations; the rounded 0.8-micron fixture stays a source form. */
export const BROWNIAN_OPERATION_GUIDES: Readonly<Record<string, BrownianOperationGuide>> = frozen({
  "eq-s3-d9": diffusivityGuide,
  "eq-s5-d1": diffusivityGuide,
  "eq-s5-d2": {
    expectedDimension: LENGTH,
    symbolIndices: {},
    context: "The diffusion coefficient determines an observable displacement spread after time t.",
    premise: SPREAD_PREMISE,
    next: SPREAD,
    primary: {
      row1: {
        kind: "relation",
        literalNumbers: ["2"],
        constantNames: [],
        quantities: ["rmsDisplacement1d", "diffusionCoefficient", "observationInterval"],
        title: "Connect diffusivity to a one-axis spread",
        does: "Lambda x is the square root of 2 D t, the mean squared displacement along one axis in the diffusion model.",
        why: "The signed average can vanish while the mean square grows. The factor two is for a single coordinate; it is not the three-dimensional mean squared distance.",
        foundation: "mean-variance-rms",
      },
      "row1.right": {
        kind: "root",
        quantities: ["diffusionCoefficient", "observationInterval"],
        title: "Recover a length from the mean square",
        does: "Take the nonnegative square root of 2 D t. The result is a displacement scale with units of length.",
        why: "D has dimensions of length squared per time, so D t has dimensions of length squared. Four times the observation interval gives twice the RMS spread at the same D; this is not uniform motion at a fixed speed.",
        foundation: "mean-variance-rms",
      },
    },
  },
  "eq-s5-d3": {
    expectedDimension: LENGTH,
    symbolIndices: {},
    context: "Insert the diffusivity relation into the RMS displacement relation.",
    premise: DRAG_PREMISE + " " + SPREAD_PREMISE,
    next: SPREAD,
    primary: {
      row1: {
        kind: "relation",
        literalNumbers: ["1", "3"],
        constantNames: ["pi"],
        quantities: [
          "rmsDisplacement1d",
          "observationInterval",
          "molarGasConstant",
          "temperature",
          "avogadroConstant",
          "viscosity",
          "particleRadius",
        ],
        title: "Combine diffusion and viscous drag",
        does: "Substitute D into the preceding square root. The factor two cancels half of the six in the Stokes denominator, leaving three.",
        why: "The thermodynamic and drag assumptions remain necessary after substitution. The resulting spread is an ensemble prediction, rather than a reconstruction of one particle's path.",
        foundation: "viscosity-stokes-drag",
      },
      "row1.right.args.0": {
        kind: "root",
        quantities: ["observationInterval"],
        title: "Separate the square-root dependence on time",
        does: "Take the square root of the observation interval t as a separate factor.",
        why: "With nonnegative time and positive model parameters, the square root of their product can be written as the product of square roots. This factor alone has the dimension of the square root of time, not length.",
        foundation: "mean-variance-rms",
      },
      "row1.right.args.1": {
        kind: "root",
        quantities: [
          "molarGasConstant",
          "temperature",
          "avogadroConstant",
          "viscosity",
          "particleRadius",
        ],
        title: "Collect the remaining physical factors",
        does: "Take the square root of the complete product of R T over N and one over 3 pi k P.",
        why: "The radicand is twice D. Its square root supplies length divided by the square root of time, so multiplying by the first factor gives a length.",
        foundation: "viscosity-stokes-drag",
      },
    },
  },
  "eq-s5-d5": {
    expectedDimension: PER_AMOUNT,
    symbolIndices: {},
    context:
      "Reverse the prediction: infer a molecular number from measured displacement statistics.",
    premise:
      DRAG_PREMISE +
      " Here N is the molecular-number estimate to be inferred. The observed one-axis mean square and elapsed interval must be positive. Temperature, viscosity and particle radius must be known independently of the displacement data; a single path does not remove their uncertainty.",
    next: INFERENCE,
    primary: {
      row1: {
        kind: "relation",
        literalNumbers: ["3"],
        constantNames: ["pi"],
        quantities: [
          "avogadroNumberEstimate",
          "observationInterval",
          "rmsDisplacement1d",
          "molarGasConstant",
          "temperature",
          "viscosity",
          "particleRadius",
        ],
        title: "Infer N instead of prescribing it",
        does: "Solve the squared displacement relation for N using the observed RMS displacement and the independently supplied physical inputs.",
        why: "The printed N now names an estimate. It cannot also be supplied as the known answer, and agreement with a chosen number is not independent evidence for that number.",
        foundation: "error-and-inference",
      },
      "row1.right.args.0": {
        kind: "quotient",
        quantities: ["observationInterval", "rmsDisplacement1d"],
        title: "Use time divided by the mean squared displacement",
        does: "Divide the observation interval t by lambda x squared. A larger measured spread at the same time lowers this factor.",
        why: "The denominator is a positive ensemble mean square, not the square of the signed average. If it vanishes, this inversion supplies no finite molecular-number estimate.",
        foundation: "mean-variance-rms",
      },
      "row1.right.args.1": {
        kind: "quotient",
        quantities: ["molarGasConstant", "temperature", "viscosity", "particleRadius"],
        title: "Supply the independent physical measurements",
        does: "Multiply by R T divided by 3 pi k P, using the temperature, liquid viscosity and particle radius of the observation.",
        why: "The displacement data alone constrain the product of radius and molecular number. Choosing a different unknown radius gives a different compatible N; more displayed decimals do not resolve that ambiguity.",
        foundation: "error-and-inference",
      },
    },
  },
});
