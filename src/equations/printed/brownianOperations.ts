/**
 * The Brownian paper's printed route from osmotic pressure and drift to diffusivity, spread and N.
 * These readings describe source operations, without substituting a numerical model or changing
 * Einstein's k (viscosity), P (particle radius), or the two different roles of N in section 5.
 */
import type { Expression } from "../ast.ts";
import { BROWNIAN_CALCULUS_GUIDES } from "./brownianCalculusOperations.ts";
import type { MassEnergyOperationGuide, OperationReading } from "./massEnergyOperations.ts";

export type BrownianOperationGuide = MassEnergyOperationGuide &
  Readonly<{
    expectedDimension: readonly string[];
    symbolIndices: Readonly<Record<string, string>>;
    /** A standalone source expression must not acquire an invented equality. */
    relationOperator?: "=" | null;
    /** Both printed equals signs need their own dimensional and physical readings. */
    allowChainedRelations?: boolean;
    functionArities?: Readonly<Record<string, readonly number[]>>;
    allowCalculus?: boolean;
    allowExponentials?: boolean;
    functions?: Readonly<Partial<Record<"exp" | "ln" | "sin" | "cos", OperationReading>>>;
    primary: Readonly<
      Record<
        string,
        MassEnergyOperationGuide["primary"][string] &
          Readonly<{
            derivativeOrder?: number;
            variableQuantity?: string;
            integralBounds?: "all-real";
            functionArguments?: readonly (
              | string
              | Readonly<{ quantityId: string; negated: true }>
            )[];
          }>
      >
    >;
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
const ENERGY = ["2", "1", "-2", "0", "0", "0"];
const PRESSURE = ["-1", "1", "-2", "0", "0", "0"];
const VELOCITY = ["1", "0", "-1", "0", "0", "0"];
const NUMBER_FLUX = ["-2", "0", "-1", "0", "0", "0"];

const OSMOTIC_PREMISE =
  "A dilute non-electrolyte solution at uniform absolute temperature T occupies the partial volume V star. The wall passes the solvent but retains the solute. The amount z is measured in moles, not a particle count; R is the molar gas constant. This is the ideal dilute osmotic law, not a pressure law for an arbitrary concentrated solution.";
const SUSPENSION_PREMISE =
  "The n suspended particles occupy the positive partial volume V star at uniform absolute temperature T. N is the number of molecules per mole and nu is the suspended-particle number density n/V star. The particles are sufficiently far apart for the dilute osmotic model. Extending the osmotic law to suspended particles is the physical claim justified in section 2, not a consequence of relabelling symbols.";
const DRIFT_PREMISE =
  "A signed force K acts on each dilute spherical particle of radius P in a liquid with positive viscosity k. The steady, low-speed Stokes drag law gives the drift along that force; inertia, walls and particle interactions are neglected. K is a force per particle, not the force on the whole suspension. The printed k is viscosity, not the Boltzmann constant.";

const OSMOTIC = {
  href: "/lab/bm-02/",
  label: "Compare the osmotic pressure of dissolved molecules and suspended particles",
};
const DRIFT = {
  href: "/lab/bm-04/",
  label: "Compare directed drift with the opposing diffusion flux",
};

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
      why: "The denominator must be nonzero under the conditions stated for this display. Division subtracts its dimensional exponents from those of the numerator.",
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
    negate: {
      title: "Reverse the sign of the complete argument",
      does: "The minus sign acts on the whole following expression.",
      why: "A reversed displacement names the opposite direction. A negative exponent instead makes the exponential decrease with its positive argument; the surrounding operation determines the role.",
      foundation: "bridge-negative-numbers-direction",
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

/** Opt in the authored algebra and drift expressions; the rounded fixture stays a source form. */
export const BROWNIAN_OPERATION_GUIDES: Readonly<Record<string, BrownianOperationGuide>> = frozen({
  ...BROWNIAN_CALCULUS_GUIDES,
  "eq-s1-d1": {
    expectedDimension: ENERGY,
    symbolIndices: {},
    context: "The paper starts from the dilute osmotic law for dissolved molecules.",
    premise: OSMOTIC_PREMISE,
    next: OSMOTIC,
    primary: {
      row1: {
        kind: "relation",
        literalNumbers: [],
        constantNames: [],
        quantities: [
          "osmoticPressure",
          "volume",
          "molarGasConstant",
          "temperature",
          "soluteAmount",
        ],
        title: "Read the dilute osmotic law",
        does: "The product of osmotic pressure p and partial volume V star equals R T times the dissolved amount z.",
        why: "Both sides have energy dimensions. The equality uses the dilute-solution law and the selective wall, rather than defining pressure for every mixture.",
        foundation: "bridge-equals-sign-relationship",
      },
      "row1.left": {
        kind: "product",
        quantities: ["osmoticPressure", "volume"],
        title: "Multiply pressure by the occupied partial volume",
        does: "Multiply p by V star, the region accessible to the solute, rather than by the total volume of solvent.",
        why: "Pressure is force per area, so multiplying it by a volume gives an energy scale. Moving the selective wall changes V star without changing the amount of solute.",
        foundation: "work-energy",
      },
      "row1.right": {
        kind: "product",
        quantities: ["molarGasConstant", "temperature", "soluteAmount"],
        title: "Keep the molar amount distinct from a count",
        does: "Multiply the molar energy R T by z moles of solute.",
        why: "The amount units cancel R's inverse-amount dimension. Substituting a particle count for z would require the separate division by N in the next display.",
        foundation: "unit-system-1905",
      },
    },
  },
  "eq-s1-d2": {
    expectedDimension: PRESSURE,
    symbolIndices: {},
    allowChainedRelations: true,
    context:
      "Rewrite the osmotic law in terms of the number and concentration of suspended particles.",
    premise: SUSPENSION_PREMISE,
    next: OSMOTIC,
    primary: {
      row1: {
        kind: "relation",
        literalNumbers: [],
        constantNames: [],
        quantities: [
          "osmoticPressure",
          "molarGasConstant",
          "temperature",
          "volume",
          "particleCount",
          "avogadroConstant",
        ],
        title: "Convert particle count to amount before finding pressure",
        does: "Divide n by N to obtain an amount, then multiply it by R T divided by the partial volume V star.",
        why: "The molar coefficient R and the count n are on different scales. Their conversion is explicit; a modern Boltzmann constant has not been silently substituted for the source notation.",
        foundation: "unit-system-1905",
      },
      "row1.right.args.0": {
        kind: "quotient",
        quantities: ["molarGasConstant", "temperature", "volume"],
        title: "Use molar thermal energy per accessible volume",
        does: "Divide R T by the positive volume V star available to the suspended particles.",
        why: "This factor alone is pressure per amount. It becomes a pressure only after multiplication by n/N.",
        foundation: "bridge-fractions-ratios",
      },
      "row1.right.args.1": {
        kind: "quotient",
        quantities: ["particleCount", "avogadroConstant"],
        title: "Convert n particles to n over N moles",
        does: "Divide the dimensionless count n by N, the molecular number per mole.",
        why: "The result has amount dimensions. It is not the concentration nu, which additionally divides the count by volume.",
        foundation: "unit-system-1905",
      },
      row2: {
        kind: "relation",
        literalNumbers: [],
        constantNames: [],
        quantities: [
          "osmoticPressure",
          "molarGasConstant",
          "temperature",
          "avogadroConstant",
          "numberDensity",
        ],
        title: "Use the same pressure with number density",
        does: "The second equals sign writes the same pressure p as R T divided by N, multiplied by nu.",
        why: "It uses nu = n/V star from the surrounding source text. The equality is not a second measurement and does not supply an independent test of the osmotic premise.",
        foundation: "bridge-equals-sign-relationship",
      },
      "row2.right": {
        kind: "product",
        quantities: ["molarGasConstant", "temperature", "avogadroConstant", "numberDensity"],
        title: "Multiply energy per particle by particles per volume",
        does: "Multiply the energy scale R T/N by the number density nu.",
        why: "Energy per volume has pressure dimensions. At the same temperature and N, doubling number density doubles this model's osmotic pressure.",
        foundation: "bridge-fractions-ratios",
      },
      "row2.right.args.0": {
        kind: "quotient",
        quantities: ["molarGasConstant", "temperature", "avogadroConstant"],
        title: "Convert the molar thermal scale to a particle scale",
        does: "Divide R T by N, leaving an energy rather than an energy per mole.",
        why: "The molar factors cancel. The source's N is a supplied conversion here; it becomes an inferred unknown only when later displacement measurements are used to solve for it.",
        foundation: "unit-system-1905",
      },
    },
  },
  "eq-s3-d5": {
    expectedDimension: VELOCITY,
    symbolIndices: {},
    relationOperator: null,
    context: "The force on one particle produces a steady drift in the viscous liquid.",
    premise: DRIFT_PREMISE,
    next: DRIFT,
    primary: {
      row1: {
        kind: "quotient",
        literalNumbers: ["6"],
        constantNames: ["pi"],
        quantities: ["externalForcePerParticle", "viscosity", "particleRadius"],
        title: "Divide the force by the Stokes drag coefficient",
        does: "Divide K by 6 pi k P to obtain the signed steady drift velocity.",
        why: "Force divided by drag coefficient has velocity dimensions. This is directed drift, not the speed of a jagged Brownian path or the RMS displacement over an observation interval.",
        foundation: "viscosity-stokes-drag",
      },
      "row1.denominator": {
        kind: "product",
        literalNumbers: ["6"],
        constantNames: ["pi"],
        quantities: ["viscosity", "particleRadius"],
        title: "Combine viscosity, radius and spherical geometry",
        does: "Multiply the positive viscosity k and radius P by the Stokes factor 6 pi.",
        why: "At fixed K, doubling k or P halves the steady drift. The denominator is a force per velocity, not itself a force; a zero K gives zero drift without a division by K.",
        foundation: "viscosity-stokes-drag",
      },
    },
  },
  "eq-s3-d6": {
    expectedDimension: NUMBER_FLUX,
    symbolIndices: {},
    relationOperator: null,
    context: "Number density turns the drift of one particle into a flow across a unit area.",
    premise:
      DRIFT_PREMISE +
      " Nu is the number of suspended particles per unit volume. This is the drift contribution alone; equilibrium requires its cancellation by diffusion.",
    next: EQUILIBRIUM,
    primary: {
      row1: {
        kind: "quotient",
        literalNumbers: ["6"],
        constantNames: ["pi"],
        quantities: ["numberDensity", "externalForcePerParticle", "viscosity", "particleRadius"],
        title: "Count particles crossing an area by directed drift",
        does: "Multiply the drift velocity K/(6 pi k P) by the number density nu.",
        why: "Number per volume times velocity is number per area per time. This is a particle flux, not a mass flux and not the total flux after diffusion is included.",
        foundation: "viscosity-stokes-drag",
      },
      "row1.numerator": {
        kind: "product",
        quantities: ["numberDensity", "externalForcePerParticle"],
        title: "Keep density and force per particle separate",
        does: "Multiply nu by the force K on each particle before dividing by the single-particle drag coefficient.",
        why: "Nu K is force per volume. Increasing the number density increases this model's drift flux without increasing the force acting on an individual particle.",
        foundation: "bridge-fractions-ratios",
      },
      "row1.denominator": {
        kind: "product",
        literalNumbers: ["6"],
        constantNames: ["pi"],
        quantities: ["viscosity", "particleRadius"],
        title: "Use the same single-particle drag coefficient",
        does: "Divide by 6 pi k P, exactly the resistance factor in the preceding drift-speed expression.",
        why: "The factor stays attached to one sphere. Multiplying it by the particle count again would wrongly count concentration twice.",
        foundation: "viscosity-stokes-drag",
      },
    },
  },
  "eq-s3-d9": diffusivityGuide,
  "eq-s4-d12": {
    expectedDimension: LENGTH,
    symbolIndices: {},
    allowChainedRelations: true,
    context:
      "The distribution's mean square connects the definition of RMS to the diffusion prediction.",
    premise:
      SPREAD_PREMISE +
      " The overbar names the arithmetic mean of squared displacements, not a signed mean or a variance with the mean subtracted. The first equality defines RMS; the second uses the diffusion result.",
    next: SPREAD,
    primary: {
      row1: {
        kind: "relation",
        literalNumbers: [],
        constantNames: [],
        quantities: ["rmsDisplacement1d", "meanSquareDisplacement1d"],
        title: "Define RMS from the mean of squared displacements",
        does: "Lambda x equals the nonnegative square root of the arithmetic mean of the squared X-axis displacements.",
        why: "This is the statistic the surrounding paragraph specifies. Averaging signed displacements first would let opposite directions cancel and would define a different statistic.",
        foundation: "mean-variance-rms",
      },
      "row1.right": {
        kind: "root",
        quantities: ["meanSquareDisplacement1d"],
        title: "Take the square root after averaging the squares",
        does: "Take the nonnegative square root of the complete overlined quantity, whose dimension is length squared.",
        why: "The result has length dimensions. Mean square and variance coincide when the signed mean is zero, as assumed here, but the source's overbar still names mean square and must retain that meaning.",
        foundation: "mean-variance-rms",
      },
      row2: {
        kind: "relation",
        literalNumbers: ["2"],
        constantNames: [],
        quantities: ["rmsDisplacement1d", "diffusionCoefficient", "observationInterval"],
        title: "Connect the same RMS to the diffusion model",
        does: "The second equals sign gives that same lambda x as the square root of 2 D t.",
        why: "The preceding distribution supplies mean square 2 D t for one coordinate. This physical result uses zero drift and constant diffusivity; it is not part of the definition of RMS for an arbitrary sample.",
        foundation: "mean-variance-rms",
      },
      "row2.right": {
        kind: "root",
        quantities: ["diffusionCoefficient", "observationInterval"],
        title: "Convert predicted mean square to a displacement scale",
        does: "Take the nonnegative square root of the whole product 2 D t.",
        why: "At fixed D, multiplying the observation interval by four doubles this RMS scale. It does not make the length of a particle's winding path equal to its displacement.",
        foundation: "mean-variance-rms",
      },
      "row2.right.radicand": {
        kind: "product",
        literalNumbers: ["2"],
        constantNames: [],
        quantities: ["diffusionCoefficient", "observationInterval"],
        title: "Form the one-axis mean-square displacement",
        does: "Multiply the diffusion coefficient D by the observation interval t and the factor two.",
        why: "D has length-squared-per-time dimensions, so D t has length-squared dimensions. Here t is the duration over which the displacement occurs, not the absolute time coordinate used earlier for the density field.",
        foundation: "mean-variance-rms",
      },
    },
  },
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
