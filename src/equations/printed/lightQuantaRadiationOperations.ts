/**
 * The printed classical radiation argument and low-frequency coefficient comparison, §§1–2.
 * These guides read the source expressions. Equipartition, the oscillator-field relation and
 * the low-frequency approximation remain separate premises, rather than conclusions of units.
 */
import type { Expression } from "../ast.ts";
import type { MassEnergyOperationGuide, OperationReading } from "./massEnergyOperations.ts";

type PrimaryReading = MassEnergyOperationGuide["primary"][string] &
  Readonly<{
    /** Each power is admitted at its authored path; a different exponent invalidates the guide. */
    exponent?: 2 | 3;
  }>;

export type LightQuantaRadiationGuide = MassEnergyOperationGuide &
  Readonly<{
    expectedDimension: readonly string[];
    allowChainedRelations?: boolean;
    primary: Readonly<Record<string, PrimaryReading>>;
  }>;

const ENERGY = ["2", "1", "-2", "0", "0", "0"];
const SPECTRAL_DENSITY = ["-1", "1", "-1", "0", "0", "0"];
const SPECTRAL_COEFFICIENT = ["-1", "1", "1", "-1", "0", "0"];
const THERMAL = ["molarGasConstant", "avogadroConstant", "temperature"];
const SPECTRAL = ["speedOfLight", "frequency", "frequencyEnergyDensity"];

const ALLOCATION = {
  href: "/lab/lq-02/",
  label: "Change the classical mode allocation and inspect the finite-cutoff energy",
};
const SPECTRUM = {
  href: "/lab/lq-03/",
  label: "Compare the classical, Planck and Wien spectra in their respective regimes",
};
const INFERENCE = {
  href: "/papers/light-quanta/#arg-lq-planck-constants",
  label: "Follow the historical coefficient comparison to the molecular-number inference",
};

const CLASSICAL_PREMISE =
  "The cavity and its matter are in thermal equilibrium at positive absolute temperature T. Classical equipartition assigns the full mean energy R T/N to a one-dimensional harmonic resonator, including both kinetic and potential contributions. R is the molar gas constant and N is the number of molecules per mole. This allocation is a premise under examination; it does not assign an energy to a freely propagating light quantum.";
const FIELD_PREMISE =
  "The admitted classical electrodynamic relation connects a resonator at positive frequency nu to equilibrium cavity radiation. Rho nu is energy per volume per frequency interval. L is the positive speed of light; the factor 8 pi nu squared/L cubed counts electromagnetic modes on this frequency basis, including both polarizations. Changing to wavelength density requires a Jacobian, rather than relabelling nu.";
const LIMIT_PREMISE =
  "The spectral constants alpha and beta are positive and use the same frequency-density convention as rho nu. The displayed form is the leading low-frequency limit of Planck's law when beta nu/T is much smaller than one, at positive temperature. The source prints an equals sign for this limiting form. At finite beta nu/T it is an approximation, and it is the opposite regime from the Wien approximation used later in the paper.";

/** Every nontrivial power below has a separate, exponent-checked reading. */
export const LIGHT_QUANTA_RADIATION_ARITHMETIC: Readonly<
  Partial<Record<Expression["kind"], OperationReading>>
> = {
  product: {
    title: "Multiply the complete factors",
    does: "Multiply the adjacent factors, keeping each fraction and power intact.",
    why: "The product combines the dimensions of every factor. The physical meaning comes from the stated energy allocation or spectral relation.",
    foundation: "bridge-fractions-ratios",
  },
  quotient: {
    title: "Divide by the complete denominator",
    does: "Divide the whole numerator by all the factors below the fraction bar.",
    why: "The molecular number, light speed, spectral constant beta and admitted frequency are positive where they occur as denominators. The result keeps the source's frequency-density convention.",
    foundation: "bridge-fractions-ratios",
  },
};

const thermalRatio: PrimaryReading = {
  kind: "quotient",
  quantities: ["molarGasConstant", "avogadroConstant"],
  title: "Convert the molar thermal scale to a particle scale",
  does: "Divide R by N. Multiplying this coefficient by the absolute temperature gives the classical mean resonator energy.",
  why: "R and N both carry inverse amount, so that dimension cancels. R/N has energy-per-temperature dimensions; N remains an unknown molecular number in the historical inference.",
  foundation: "unit-system-1905",
};
const lightSpeedCube: PrimaryReading = {
  kind: "power",
  exponent: 3,
  quantities: ["speedOfLight"],
  title: "Cube the speed of light",
  does: "Multiply L by itself three times, retaining the full speed dimension each time.",
  why: "The cube belongs to the three-dimensional cavity-mode relation. L denotes a speed here, so L cubed has volume-per-time-cubed dimensions rather than volume alone.",
  foundation: "fields-waves",
};
const frequencySquare: PrimaryReading = {
  kind: "power",
  exponent: 2,
  quantities: ["frequency"],
  title: "Square the frequency",
  does: "Multiply nu by itself. At fixed temperature the classical spectral density therefore rises with the square of frequency.",
  why: "The factor comes from the number of electromagnetic modes per frequency interval. It does not increase the classical mean energy assigned to each mode, which is R T/N.",
  foundation: "functions-graphs",
};
const inverseModeDensity: PrimaryReading = {
  kind: "quotient",
  quantities: ["speedOfLight", "frequency"],
  literalNumbers: ["8"],
  constantNames: ["pi"],
  title: "Convert spectral energy density to mean resonator energy",
  does: "Multiply rho nu by L cubed divided by 8 pi nu squared, the reciprocal of the mode density per volume per frequency interval.",
  why: "The reciprocal factor has volume-times-frequency dimensions, which cancel both density denominators. This conversion rests on the classical oscillator-field relation; dimensional agreement alone does not establish it.",
  foundation: "fields-waves",
};
const modeDensity: PrimaryReading = {
  kind: "quotient",
  quantities: ["frequency", "speedOfLight"],
  literalNumbers: ["8"],
  constantNames: ["pi"],
  title: "Count modes per volume per frequency interval",
  does: "Form 8 pi nu squared divided by L cubed, then multiply it by the mean energy R T/N.",
  why: "Increasing the frequency adds more modes per equal frequency interval. Classical equipartition gives each mode the same mean energy at fixed T, so extending this rule to arbitrarily high frequency gives an unbounded total energy.",
  foundation: "fields-waves",
};
const planckCoefficient: PrimaryReading = {
  kind: "quotient",
  quantities: ["wienConstantAlpha", "wienConstantBeta"],
  title: "Read the low-frequency spectral coefficient",
  does: "Divide alpha by beta to obtain the coefficient multiplying nu squared times T in the leading low-frequency spectrum.",
  why: "Replacing exp(beta nu/T) minus one by beta nu/T cancels one frequency factor from the numerator alpha nu cubed. That approximation requires beta nu/T much smaller than one.",
  foundation: "taylor-expansion",
};

export const LIGHT_QUANTA_RADIATION_GUIDES: Readonly<
  Record<string, LightQuantaRadiationGuide>
> = {
  "eq-s1-d1": {
    expectedDimension: ENERGY,
    context: "Classical equipartition assigns the full mean energy of a harmonic resonator.",
    premise: CLASSICAL_PREMISE,
    next: ALLOCATION,
    primary: {
      row1: {
        kind: "relation",
        quantities: ["meanResonatorEnergy", ...THERMAL],
        literalNumbers: [],
        constantNames: [],
        title: "State the classical mean-energy allocation",
        does: "The mean resonator energy E bar is R T/N, proportional to absolute temperature.",
        why: "A harmonic resonator has kinetic and potential contributions. Their classical thermal means together give this value; the relation is an assumption of the classical model being tested.",
        foundation: "work-energy",
      },
      "row1.right.args.0": thermalRatio,
    },
  },
  "eq-s1-d2": {
    expectedDimension: ENERGY,
    context: "The classical field relation connects radiation density to a resonator's mean energy.",
    premise: FIELD_PREMISE,
    next: ALLOCATION,
    primary: {
      row1: {
        kind: "relation",
        quantities: ["meanResonatorEnergyAtFrequency", ...SPECTRAL],
        literalNumbers: ["8"],
        constantNames: ["pi"],
        title: "Relate one frequency's resonator energy to the radiation field",
        does: "E bar sub nu equals the frequency-basis spectral density divided by the cavity-mode density.",
        why: "This electrodynamic relation is distinct from the equipartition statement. The next step combines the two; neither follows from the other by changing a symbol's name.",
        foundation: "fields-waves",
      },
      "row1.right.args.0": inverseModeDensity,
      "row1.right.args.0.numerator": lightSpeedCube,
      "row1.right.args.0.denominator.args.2": frequencySquare,
    },
  },
  "eq-s1-d6": {
    expectedDimension: ENERGY,
    allowChainedRelations: true,
    context: "Three equalities join thermal allocation to the frequency-resolved radiation field.",
    premise: CLASSICAL_PREMISE + " " + FIELD_PREMISE,
    next: ALLOCATION,
    primary: {
      row1: {
        kind: "relation",
        quantities: [...THERMAL, "meanResonatorEnergy"],
        literalNumbers: [],
        constantNames: [],
        title: "Start with classical equipartition",
        does: "The first equality identifies R T/N with the full mean resonator energy E bar.",
        why: "This is the same thermal-allocation premise as the earlier displayed equation, now used as the left side of the whole comparison.",
        foundation: "work-energy",
      },
      "row1.left.args.0": thermalRatio,
      row2: {
        kind: "relation",
        quantities: [...THERMAL, "meanResonatorEnergyAtFrequency"],
        literalNumbers: [],
        constantNames: [],
        title: "Apply the same allocation to a resonator of frequency nu",
        does: "The second equality assigns R T/N to E bar sub nu as well. The general mean and the frequency-specific mean retain their distinct quantity identities.",
        why: "In this classical equilibrium allocation, changing the resonator frequency does not change its mean energy at fixed T. This is the assumption whose combination with the field relation creates the difficulty.",
        foundation: "fields-waves",
      },
      row3: {
        kind: "relation",
        quantities: [...THERMAL, ...SPECTRAL],
        literalNumbers: ["8"],
        constantNames: ["pi"],
        title: "Join the thermal and field descriptions",
        does: "The last equality compares the same R T/N with L cubed times rho nu divided by 8 pi nu squared.",
        why: "All expressions in the chain have energy dimensions. The chain uses both the equipartition premise and the electrodynamic coupling relation; the equality signs alone establish neither premise.",
        foundation: "bridge-equals-sign-relationship",
      },
      "row3.right.args.0": inverseModeDensity,
      "row3.right.args.0.numerator": lightSpeedCube,
      "row3.right.args.0.denominator.args.2": frequencySquare,
    },
  },
  "eq-s1-d7": {
    expectedDimension: SPECTRAL_DENSITY,
    context: "Solving the joined classical relations gives a spectral density that grows as nu squared.",
    premise: CLASSICAL_PREMISE + " " + FIELD_PREMISE,
    next: ALLOCATION,
    primary: {
      row1: {
        kind: "relation",
        quantities: ["frequencyEnergyDensity", ...THERMAL, "frequency", "speedOfLight"],
        literalNumbers: ["8"],
        constantNames: ["pi"],
        title: "Solve for the classical spectrum",
        does: "Multiply the preceding energy equality by 8 pi nu squared/L cubed to isolate rho nu.",
        why: "At fixed positive T, the result grows quadratically with frequency. A finite frequency cutoff gives finite energy, but the unrestricted classical spectrum has no finite total. This failure does not by itself derive the light-quantum hypothesis.",
        foundation: "functions-graphs",
      },
      "row1.right.args.0": thermalRatio,
      "row1.right.args.1": modeDensity,
      "row1.right.args.1.numerator.args.2": frequencySquare,
      "row1.right.args.1.denominator": lightSpeedCube,
    },
  },
  "eq-s2-d4": {
    expectedDimension: SPECTRAL_DENSITY,
    context: "The leading low-frequency form of Planck's spectrum has the same nu-squared-T dependence.",
    premise: LIMIT_PREMISE,
    next: SPECTRUM,
    primary: {
      row1: {
        kind: "relation",
        quantities: [
          "frequencyEnergyDensity",
          "wienConstantAlpha",
          "wienConstantBeta",
          "frequency",
          "temperature",
        ],
        literalNumbers: [],
        constantNames: [],
        title: "Read the source's leading limiting form",
        does: "The spectral density approaches alpha/beta times nu squared times T as beta nu/T becomes small.",
        why: "The source's equality is retained, with its limiting qualification. This expression is not the complete Planck spectrum at every frequency, and it is not the high-frequency Wien approximation.",
        foundation: "taylor-expansion",
      },
      "row1.right.args.0": planckCoefficient,
      "row1.right.args.1": {
        ...frequencySquare,
        why: "In this leading low-frequency limit, the cubic numerator loses one frequency factor to the linearized exponential denominator. The resulting square matches the frequency dependence of the classical mode allocation.",
      },
    },
  },
  "eq-s2-d5": {
    expectedDimension: SPECTRAL_COEFFICIENT,
    context: "Matching the two low-frequency coefficients constrains the historical molecular number.",
    premise:
      LIMIT_PREMISE +
      " Compare spectra expressed per frequency interval in identical units and equate their leading coefficients. R and the fitted spectral constants must be independent inputs if this is to infer N. Inserting today's exact constants would instead recover the defined molecular number. The comparison does not establish independently moving light quanta.",
    next: INFERENCE,
    primary: {
      row1: {
        kind: "relation",
        quantities: [
          "molarGasConstant",
          "avogadroConstant",
          "speedOfLight",
          "wienConstantAlpha",
          "wienConstantBeta",
        ],
        literalNumbers: ["8"],
        constantNames: ["pi"],
        title: "Match the coefficient of nu squared times T",
        does: "Set (R/N)(8 pi/L cubed) equal to alpha/beta. Multiplying by N and beta/alpha then isolates N.",
        why: "The two spectra have the same leading dependence on frequency and temperature. Matching coefficients avoids dividing by the vanishing density at exactly zero frequency. It is a conditional inference from independent spectral and gas-law inputs.",
        foundation: "bridge-equals-sign-relationship",
      },
      "row1.left.args.0": thermalRatio,
      "row1.left.args.1": {
        kind: "quotient",
        quantities: ["speedOfLight"],
        literalNumbers: ["8"],
        constantNames: ["pi"],
        title: "Retain the frequency-independent cavity factor",
        does: "After matching the nu-squared-T dependence, the classical mode factor contributes 8 pi/L cubed.",
        why: "This factor alone is not a mode density: its frequency-squared dependence has already been factored out. Keeping the cube of light speed is necessary for the coefficient's dimensions.",
        foundation: "fields-waves",
      },
      "row1.left.args.1.denominator": lightSpeedCube,
      "row1.right": planckCoefficient,
    },
  },
};
