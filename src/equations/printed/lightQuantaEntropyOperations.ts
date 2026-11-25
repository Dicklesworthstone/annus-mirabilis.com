/**
 * The printed route from spectral entropy to Wien's inverse temperature and its integral.
 * The spectrum is an admitted limiting law; integrating it does not prove the quantum hypothesis.
 */
import type { Expression } from "../ast.ts";
import type { MassEnergyOperationGuide, OperationReading } from "./massEnergyOperations.ts";

type PrimaryReading = MassEnergyOperationGuide["primary"][string] &
  Readonly<{
    exponent?: 3;
    functionName?: "exp" | "ln";
    derivativeOrder?: number;
    variableQuantity?: string;
    integralBounds?: "nonnegative";
    functionArguments?: readonly string[];
  }>;

export type LightQuantaEntropyGuide = MassEnergyOperationGuide &
  Readonly<{
    expectedDimension: readonly string[];
    functionArities?: Readonly<Record<string, readonly number[]>>;
    allowCalculus?: boolean;
    allowExponentials?: boolean;
    primary: Readonly<Record<string, PrimaryReading>>;
  }>;

const SPECTRAL = ["frequencyEnergyDensity", "frequency", "spectralEntropyDensity"];
const WIEN = ["frequencyEnergyDensity", "wienConstantAlpha", "wienConstantBeta", "frequency"];
const ENTROPY = ["2", "1", "-2", "-1", "0", "0"];
const INVERSE_TEMPERATURE = ["0", "0", "0", "-1", "0", "0"];
const SPECTRAL_DENSITY = ["-1", "1", "-1", "0", "0", "0"];
const SPECTRAL_ENTROPY = ["-1", "1", "-1", "-1", "0", "0"];

const ENTROPY_LAB = {
  href: "/lab/lq-04/",
  label: "Compare the entropy slope with inverse temperature in the radiation workbench",
};
const SPECTRUM_LAB = {
  href: "/lab/lq-03/",
  label: "Compare Wien's spectrum with the full Planck spectrum",
};
const VOLUME_ARGUMENT = {
  href: "/papers/light-quanta/s4/#lq-wien-entropy-derivation",
  label: "Follow the boundary condition and the fixed-band volume comparison",
};
const EQUILIBRIUM_PREMISE =
  "The radiation is homogeneous in a fixed volume. Rho is energy per volume per frequency interval; phi is entropy per volume per frequency interval. The equilibrium argument varies the spectrum at fixed total energy. Comparing the resulting common entropy slope with dS = dE/T identifies inverse absolute temperature; dimensional agreement alone does not establish this thermodynamic relation.";
const WIEN_PREMISE =
  "The spectral constants alpha and beta, the frequency nu and the absolute temperature are positive. Rho uses a frequency-density convention. Wien's law applies to dilute radiation with beta nu/T large; it is a limiting form of the spectrum, not the full Planck law at arbitrary density. Solving its algebra at positive temperature requires 0 < rho/(alpha nu cubed) < 1, which alone is weaker than being well inside the Wien regime.";
const BOUNDARY_PREMISE =
  "Integrate with respect to rho while holding nu fixed. The primitive initially admits a function C(nu). Requiring phi to tend to zero as rho tends to zero at each positive frequency fixes that function to zero. An unfixed entropy-density constant would contribute differently in different volumes, so it cannot be discarded by claiming it cancels.";

export const LIGHT_QUANTA_ENTROPY_ARITHMETIC: Readonly<
  Partial<Record<Expression["kind"], OperationReading>>
> = {
  product: {
    title: "Multiply the complete factors",
    does: "Multiply the adjacent factors without separating a fraction, power or grouped expression.",
    why: "Dimensions multiply with the factors. The spectral density and entropy density remain quantities per volume per frequency interval until the corresponding measure is supplied.",
    foundation: "bridge-fractions-ratios",
  },
  quotient: {
    title: "Divide by the complete denominator",
    does: "Divide the whole numerator by every factor below the fraction bar.",
    why: "The admitted frequency, temperature and spectral constants are positive. A logarithm's argument must additionally be dimensionless; a fraction does not lose its units merely because it is inside a logarithm.",
    foundation: "quantities-units",
  },
  negate: {
    title: "Reverse the sign of the complete contribution",
    does: "The minus sign applies to the whole following factor or grouped expression.",
    why: "The negative exponent makes the Wien factor decrease. The negative prefactor in the inverted law makes its negative logarithm correspond to a positive inverse temperature.",
    foundation: "bridge-negative-numbers-direction",
  },
  group: {
    title: "Keep the logarithm and its integration term together",
    does: "The braces make the logarithm minus one a single factor of the expression outside them.",
    why: "The integration term belongs inside the same product as the logarithm. Multiplying only the first term would change the derivative and the entropy.",
    foundation: "bridge-fractions-ratios",
  },
};

export const LIGHT_QUANTA_ENTROPY_FUNCTIONS = {
  exp: {
    title: "Read the exponential Wien factor",
    does: "Raise e to the full dimensionless exponent minus beta nu/T.",
    why: "At fixed frequency the factor rises with temperature. Wien's approximation requires beta nu/T to be large, so this expression does not describe every spectral regime.",
    foundation: "exponentials",
  },
  ln: {
    title: "Undo an exponential with the natural logarithm",
    does: "The printed lg denotes the natural logarithm. Apply it to the whole positive density ratio.",
    why: "Dividing rho by alpha nu cubed first removes the density units. In Wien's law the logarithm of this ratio is minus beta nu/T.",
    foundation: "logarithms",
  },
} as const satisfies Readonly<Partial<Record<"exp" | "ln" | "sin" | "cos", OperationReading>>>;

const entropyFunction: PrimaryReading = {
  kind: "symbol",
  quantities: SPECTRAL,
  functionArguments: ["frequencyEnergyDensity", "frequency"],
  title: "Evaluate entropy density at the specified density and frequency",
  does: "Phi of rho and nu is one spectral entropy-density function with two arguments. The parentheses do not multiply phi by rho or by nu.",
  why: "Frequency labels the spectral interval. At a fixed frequency, changing its energy density changes its entropy density; these two roles are kept distinct in the partial derivative.",
  foundation: "partial-derivatives",
};
const frequencyCube: PrimaryReading = {
  kind: "power",
  quantities: ["frequency"],
  exponent: 3,
  title: "Cube the frequency in the Wien prefactor",
  does: "Multiply nu by itself three times, then multiply by alpha.",
  why: "Alpha nu cubed has the dimensions of frequency-basis energy density. Its cube is part of the source's spectral law; changing the spectral variable to wavelength requires a Jacobian.",
  foundation: "fields-waves",
};
const densityRatio: PrimaryReading = {
  kind: "quotient",
  quantities: ["frequencyEnergyDensity", "wienConstantAlpha", "frequency"],
  title: "Form a dimensionless spectral density ratio",
  does: "Divide rho by the complete prefactor alpha nu cubed before taking its logarithm.",
  why: "Both numerator and denominator are densities per volume per frequency interval. Their units cancel. The ratio is positive and below one for positive temperature in the inverted Wien expression.",
  foundation: "quantities-units",
};
const inverseTemperature: PrimaryReading = {
  kind: "quotient",
  quantities: ["temperature"],
  literalNumbers: ["1"],
  title: "Take the reciprocal of absolute temperature",
  does: "Divide one by the positive temperature T.",
  why: "The result has units inverse kelvin. It is the entropy gained per added energy at the stated equilibrium constraints, rather than an energy or an entropy on its own.",
  foundation: "entropy-temperature",
};

export const LIGHT_QUANTA_ENTROPY_GUIDES: Readonly<Record<string, LightQuantaEntropyGuide>> = {
  "eq-s3-d1": {
    expectedDimension: ENTROPY,
    allowCalculus: true,
    functionArities: { spectralEntropyDensity: [2] },
    context: "Add the spectral entropy over frequency and over the homogeneous cavity volume.",
    premise: EQUILIBRIUM_PREMISE,
    next: ENTROPY_LAB,
    primary: {
      row1: {
        kind: "relation",
        quantities: ["radiationEntropy", "volume", ...SPECTRAL],
        literalNumbers: ["0"],
        constantNames: ["infinity"],
        title: "Build total entropy from its spectral density",
        does: "S is the volume v times the integral of phi over nonnegative frequency.",
        why: "Phi is not the total entropy. The frequency measure removes its per-frequency dimension and the homogeneous volume removes its per-volume dimension. This general accounting step does not assume Wien's spectrum at every frequency.",
        foundation: "integration",
      },
      "row1.right.args.0": {
        kind: "symbol",
        quantities: ["volume"],
        title: "Use the homogeneous cavity volume",
        does: "Multiply the integrated entropy density by the positive volume v.",
        why: "The density is uniform in this construction. Multiplying by the actual volume makes the entropy extensive; a negative volume factor would reverse the source relation.",
        foundation: "quantities-units",
      },
      "row1.right.args.1": {
        kind: "integral",
        quantities: SPECTRAL,
        variableQuantity: "frequency",
        integralBounds: "nonnegative",
        title: "Sum entropy density over the frequency spectrum",
        does: "Integrate phi with respect to nu from zero to infinity. The differential d nu supplies the frequency measure.",
        why: "Frequency is nonnegative here; negative frequencies are not a second set of independent radiation modes. The result is entropy per volume. The infinite endpoint is a limit of integration, not a frequency value to enter in an instrument.",
        foundation: "integration",
      },
      "row1.right.args.1.expression": entropyFunction,
    },
  },
  "eq-s3-d8": {
    expectedDimension: INVERSE_TEMPERATURE,
    allowCalculus: true,
    functionArities: { spectralEntropyDensity: [0] },
    context: "The equilibrium entropy slope at fixed frequency is inverse temperature.",
    premise: EQUILIBRIUM_PREMISE,
    next: ENTROPY_LAB,
    primary: {
      row1: {
        kind: "relation",
        quantities: ["spectralEntropyDensity", "frequencyEnergyDensity", "temperature"],
        literalNumbers: ["1"],
        constantNames: [],
        title: "Identify the common equilibrium slope",
        does: "The partial derivative of phi with respect to rho equals one over T.",
        why: "The maximum-entropy argument makes the slope common across frequencies. The thermodynamic relation dS = dE/T then identifies its value. This is not a formula for total entropy divided by total energy.",
        foundation: "entropy-temperature",
      },
      "row1.left": {
        kind: "derivative",
        quantities: ["spectralEntropyDensity", "frequencyEnergyDensity"],
        derivativeOrder: 1,
        variableQuantity: "frequencyEnergyDensity",
        title: "Change the spectral energy density while holding frequency fixed",
        does: "Differentiate phi with respect to rho at the same nu. The partial signs form a derivative operator, not an ordinary quotient of phi and rho.",
        why: "Dividing entropy-density dimensions by energy-density dimensions cancels volume and frequency and leaves inverse kelvin. Differentiating with respect to frequency instead would ask a different question and have different units.",
        foundation: "partial-derivatives",
      },
      "row1.right": inverseTemperature,
    },
  },
  "eq-s4-d1": {
    expectedDimension: SPECTRAL_DENSITY,
    allowExponentials: true,
    context: "Wien's spectrum supplies temperature as a function of density at a fixed frequency.",
    premise: WIEN_PREMISE,
    next: SPECTRUM_LAB,
    primary: {
      row1: {
        kind: "relation",
        quantities: [...WIEN, "temperature"],
        literalNumbers: [],
        constantNames: [],
        title: "State the admitted Wien spectral law",
        does: "Multiply the prefactor alpha nu cubed by exp of minus beta nu/T to obtain rho.",
        why: "The printed equality states the chosen Wien model. The approximation to physical equilibrium radiation is restricted to its dilute regime; its success there does not extend it to all frequencies and temperatures.",
        foundation: "fields-waves",
      },
      "row1.right.args.0": {
        kind: "symbol",
        quantities: ["wienConstantAlpha"],
        title: "Keep the positive Wien normalization",
        does: "Use the positive spectral constant alpha as the prefactor of nu cubed.",
        why: "Together with nu cubed it supplies the spectral-density units. Negating this factor would give negative energy density even with the correct decaying exponential.",
        foundation: "quantities-units",
      },
      "row1.right.args.1": frequencyCube,
      "row1.right.args.2": {
        ...LIGHT_QUANTA_ENTROPY_FUNCTIONS.exp,
        kind: "function",
        functionName: "exp",
        quantities: ["wienConstantBeta", "frequency", "temperature"],
      },
      "row1.right.args.2.argument.args.0": {
        kind: "negate",
        quantities: ["wienConstantBeta"],
        title: "Keep the negative sign in the Wien exponent",
        does: "Use minus beta in the product with nu/T.",
        why: "At fixed T the exponential suppresses large positive frequency. Reversing this sign would make the high-frequency tail grow rather than decay.",
        foundation: "exponentials",
      },
    },
  },
  "eq-s4-d2": {
    expectedDimension: INVERSE_TEMPERATURE,
    context:
      "Divide out the spectral prefactor and take a logarithm to isolate inverse temperature.",
    premise: WIEN_PREMISE,
    next: ENTROPY_LAB,
    primary: {
      row1: {
        kind: "relation",
        quantities: [...WIEN, "temperature"],
        literalNumbers: ["1", "1"],
        constantNames: [],
        title: "Invert the admitted Wien law",
        does: "One over T equals minus the logarithm of rho/(alpha nu cubed), divided by beta nu.",
        why: "Taking a natural logarithm undoes the exponential. Both this algebra and the following entropy integral retain the Wien approximation's range of validity.",
        foundation: "logarithms",
      },
      "row1.left": inverseTemperature,
      "row1.right.args.0": {
        kind: "negate",
        quantities: ["wienConstantBeta", "frequency"],
        title: "Divide the logarithm by minus beta nu",
        does: "Multiply the logarithm by minus one over beta nu.",
        why: "Beta nu has temperature dimensions. Its reciprocal supplies inverse kelvin, and the minus sign turns the negative logarithm into a positive inverse temperature.",
        foundation: "entropy-temperature",
      },
      "row1.right.args.1.argument": densityRatio,
      "row1.right.args.1": {
        ...LIGHT_QUANTA_ENTROPY_FUNCTIONS.ln,
        kind: "function",
        functionName: "ln",
        quantities: ["frequencyEnergyDensity", "wienConstantAlpha", "frequency"],
      },
      "row1.right.args.1.argument.denominator.args.1": frequencyCube,
    },
  },
  "eq-s4-d3": {
    expectedDimension: SPECTRAL_ENTROPY,
    functionArities: { spectralEntropyDensity: [2] },
    context: "Integrate the entropy slope at fixed frequency and fix the zero-density boundary.",
    premise: WIEN_PREMISE + " " + BOUNDARY_PREMISE,
    next: VOLUME_ARGUMENT,
    primary: {
      row1: {
        kind: "relation",
        quantities: [...WIEN, "spectralEntropyDensity"],
        literalNumbers: ["1"],
        constantNames: [],
        title: "Obtain the spectral entropy density",
        does: "Phi is minus rho/(beta nu) times the natural logarithm of rho/(alpha nu cubed), minus one inside the braces.",
        why: "Differentiating rho times (ln(rho/A) minus one), with A fixed, gives ln(rho/A). The minus one is required by integration. The zero-density boundary fixes the additional function of frequency.",
        foundation: "integration",
      },
      "row1.left": entropyFunction,
      "row1.right.args.0": {
        kind: "negate",
        quantities: ["frequencyEnergyDensity", "wienConstantBeta", "frequency"],
        title: "Retain the negative entropy-density prefactor",
        does: "Multiply the full bracket by minus rho divided by beta nu.",
        why: "The ratio has spectral entropy-density dimensions. Its sign and the bracket together give positive phi in the admitted dilute regime, while its derivative gives positive inverse temperature.",
        foundation: "entropy-temperature",
      },
      "row1.right.args.1.argument": {
        kind: "sum",
        quantities: ["frequencyEnergyDensity", "wienConstantAlpha", "frequency"],
        literalNumbers: ["1"],
        title: "Keep the integration term minus one",
        does: "Subtract one from the logarithm before multiplying by the density prefactor.",
        why: "The product rule differentiates rho times ln(rho/A) to ln(rho/A) plus one. Subtracting rho cancels that extra one. Omitting the term would change the entropy slope even though the units still match.",
        foundation: "integration",
      },
      "row1.right.args.1.argument.args.0.argument": densityRatio,
      "row1.right.args.1.argument.args.0": {
        ...LIGHT_QUANTA_ENTROPY_FUNCTIONS.ln,
        kind: "function",
        functionName: "ln",
        quantities: ["frequencyEnergyDensity", "wienConstantAlpha", "frequency"],
      },
      "row1.right.args.1.argument.args.0.argument.denominator.args.1": frequencyCube,
      "row1.right.args.1.argument.args.1": {
        kind: "negate",
        quantities: [],
        literalNumbers: ["1"],
        title: "Subtract the dimensionless integration term",
        does: "Retain minus one inside the braces.",
        why: "Changing this subtraction into addition would leave an extra contribution when the expression is differentiated. A dimension check alone would not detect that wrong sign.",
        foundation: "integration",
      },
    },
  },
};
