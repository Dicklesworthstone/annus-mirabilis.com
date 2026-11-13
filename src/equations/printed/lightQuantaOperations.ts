/**
 * The printed volume, probability and entropy comparison in paper 1, §§4–6.
 * These source readings keep the logarithm's algebra, the independent-point premise and the
 * radiation correspondence separate. A matching dimension does not establish any of those claims.
 */
import type { Expression } from "../ast.ts";
import type { MassEnergyOperationGuide, OperationReading } from "./massEnergyOperations.ts";

type LightQuantaOperationGuide = MassEnergyOperationGuide &
  Readonly<{
    expectedDimension: readonly string[];
    /** Authored instance labels on already checked glyphs; a quantity's meaning is unchanged. */
    symbolIndices: Readonly<Record<string, string>>;
  }>;
type PrimaryReading = MassEnergyOperationGuide["primary"][string];

const ENTROPY = ["2", "1", "-2", "-1", "0", "0"];
const DIMENSIONLESS = ["0", "0", "0", "0", "0", "0"];
const COMPARED_STATES = { S_0: "0", v_0: "0" };
const VOLUME = {
  href: "/papers/light-quanta/s4/#lq-wien-entropy-derivation",
  label: "Follow the fixed-band entropy comparison and its boundary condition",
};
const INDEPENDENCE = {
  href: "/papers/light-quanta/#arg-lq-independent-configurations",
  label: "Follow the independent-point probability and entropy argument",
};
const CORRESPONDENCE = {
  href: "/papers/light-quanta/s6/#lq-entropy-correspondence-derivation",
  label: "Follow the conditional coefficient comparison and energy-per-element inference",
};

const WIEN_PREMISE =
  "Compare states with the same radiation energy E, frequency nu and narrow bandwidth. Both endpoint states must remain in the Wien regime. The zero-density entropy boundary fixes the integration constant before the volumes are compared; an unfixed constant would not cancel.";
const POINT_PREMISE =
  "The n points are independent and uniformly distributed in v0. The chosen part has positive volume v no larger than v0. Multiplying their chances uses independence; counting the points alone does not supply it.";
const CORRESPONDENCE_PREMISE =
  WIEN_PREMISE +
  " Reading the matching probability form as independent energy elements is a heuristic correspondence, conditional on Boltzmann's principle. The effective count need not be an integer and is not rounded.";

/** Arithmetic readings for this paper; no observer-speed or body-energy premise is imported. */
export const LIGHT_QUANTA_ARITHMETIC: Readonly<
  Partial<Record<Expression["kind"], OperationReading>>
> = {
  relation: {
    title: "Read the equality",
    does: "The complete expressions on the two sides have the same value under this display's stated conditions.",
    why: "The equals sign states the relation. The physical premise or the preceding algebra supplies its justification; matching units alone does not.",
    foundation: "bridge-equals-sign-relationship",
  },
  sum: {
    title: "Compare the entropies",
    does: "Subtract the entropy in the reference state from the entropy in the compared state.",
    why: "The two entropies have the same dimensions. Reversing the comparison reverses the sign of the difference.",
    foundation: "bridge-negative-numbers-direction",
  },
  negate: {
    title: "Subtract the reference entropy",
    does: "The minus sign applies to the complete reference-state contribution.",
    why: "An entropy change compares two states. This sign keeps the chosen direction of comparison explicit.",
    foundation: "bridge-negative-numbers-direction",
  },
  product: {
    title: "Multiply the factors",
    does: "Multiply the adjacent factors, keeping each fraction or group intact.",
    why: "Dimensions multiply along with the factors. Multiplication of probabilities additionally needs the independence premise stated where that interpretation is used.",
    foundation: "bridge-fractions-ratios",
  },
  quotient: {
    title: "Divide by the denominator",
    does: "Divide the complete numerator by the complete denominator.",
    why: "Every denominator in this comparison is positive under the stated conditions. A quotient cancels units only when its numerator and denominator have matching dimensions.",
    foundation: "bridge-fractions-ratios",
  },
  group: {
    title: "Keep the group together",
    does: "Treat everything inside the delimiters as one argument of the surrounding operation.",
    why: "A logarithm or exponent outside the delimiters applies to the complete enclosed expression.",
    foundation: "bridge-fractions-ratios",
  },
  function: {
    title: "Take the natural logarithm",
    does: "The printed lg is the natural logarithm, to base e. It turns a product into a sum and a power into multiplication by its exponent.",
    why: "The argument is positive and dimensionless. A volume ratio has no units because the two volumes have the same dimension; a probability is already dimensionless.",
    foundation: "logarithms",
  },
  symbolPower: {
    title: "Raise the volume ratio to an exponent",
    does: "The entire volume ratio is the base, and the entire superscript supplies the exponent.",
    why: "A positive, dimensionless base admits a real dimensionless exponent. Interpreting that exponent as a count requires the separate physical premise described for this display.",
    foundation: "logarithms",
  },
};

const radiationCoefficient: PrimaryReading = {
  kind: "quotient",
  quantities: ["radiationEnergy", "wienConstantBeta", "frequency"],
  title: "The entropy coefficient E over beta nu",
  does: "E divided by beta nu sets the size of the entropy change for a given logarithmic volume change.",
  why: "Beta has dimensions of time times temperature, so beta nu is a temperature and E/(beta nu) is an entropy. It is not yet a dimensionless count.",
  foundation: "entropy-temperature",
};
const entropyScale: PrimaryReading = {
  kind: "quotient",
  quantities: ["molarGasConstant", "avogadroConstant"],
  title: "The entropy scale R over N",
  does: "Dividing the molar gas constant by Avogadro's constant gives the entropy scale multiplying the logarithm.",
  why: "The amount dimensions cancel, leaving energy per temperature. The paper adopts this coefficient from kinetic theory; the logarithm alone does not fix its size.",
  foundation: "entropy-multiplicity",
};
const volumeLog: PrimaryReading = {
  kind: "function",
  quantities: ["volume"],
  title: "The logarithm of the volume ratio",
  does: "Take the natural logarithm of v/v0. Equal multiplicative changes in volume give equal changes in this logarithm.",
  why: "The positive volume ratio is dimensionless. It gives zero at equal volumes, a negative logarithm for concentration and a positive logarithm for expansion.",
  foundation: "logarithms",
};
const volumeFraction: PrimaryReading = {
  kind: "quotient",
  quantities: ["volume"],
  title: "The fraction of the original volume",
  does: "Divide the chosen part v by the whole volume v0.",
  why: "Here 0 < v <= v0, so the dimensionless fraction lies between zero and one. Uniform spatial probability makes this the chance for one point to lie in the chosen part.",
  foundation: "probability-independence",
};
const effectiveCount: PrimaryReading = {
  kind: "product",
  quantities: [
    "avogadroConstant",
    "molarGasConstant",
    "radiationEnergy",
    "wienConstantBeta",
    "frequency",
  ],
  title: "Build the dimensionless effective count",
  does: "Multiply E/(beta nu) by N/R. The two entropy dimensions cancel, leaving the coefficient that occupies the place of n in the independent-point formula.",
  why: "Compare the dependence on volume; do not divide by the zero logarithm at v = v0. This algebraic coefficient does not count observed objects or require rounding. Interpreting independent energy elements is the paper's additional heuristic step.",
  foundation: "entropy-multiplicity",
};

/** Only these named source displays opt in; the other light-quanta displays retain their form. */
export const LIGHT_QUANTA_OPERATION_GUIDES: Readonly<Record<string, LightQuantaOperationGuide>> = {
  "eq-s4-d5": {
    expectedDimension: ENTROPY,
    symbolIndices: COMPARED_STATES,
    context: "Section 4 compares the entropy of the same dilute radiation in two volumes.",
    premise: WIEN_PREMISE,
    next: VOLUME,
    primary: {
      "row1.right.args.0": radiationCoefficient,
      "row1.right.args.1": volumeLog,
    },
  },
  "eq-s5-d3": {
    expectedDimension: DIMENSIONLESS,
    symbolIndices: { W_1: "1", W_2: "2" },
    context:
      "Section 5 combines the specified configurations of two systems that do not act on each other.",
    premise:
      "The two configurations are statistically independent. A statement that both occur therefore uses the product of their probabilities; correlated configurations need their joint probability instead.",
    next: INDEPENDENCE,
    primary: {
      "row1.right": {
        kind: "product",
        quantities: ["configurationProbability"],
        title: "Multiply independent probabilities",
        does: "Multiply W1 by W2 to obtain the probability W that both configurations occur.",
        why: "This product rule uses independence. Two events having probabilities W1 and W2 does not by itself determine their joint probability.",
        foundation: "probability-independence",
      },
    },
  },
  "eq-s5-d6": {
    expectedDimension: ENTROPY,
    symbolIndices: { S_0: "0" },
    context:
      "The paper states an entropy difference in terms of the probability relative to its reference state.",
    premise:
      "Boltzmann's principle connects entropy with configuration probability. Additive entropies and multiplicative probabilities motivate the logarithm; kinetic theory supplies the coefficient R/N. The probability is positive.",
    next: INDEPENDENCE,
    primary: {
      "row1.right.args.0": entropyScale,
      "row1.right.args.1": {
        kind: "function",
        quantities: ["configurationProbability"],
        title: "Turn probability products into entropy sums",
        does: "Take the natural logarithm of W before multiplying by the entropy scale R/N.",
        why: "For independent systems, lg(W1 W2) = lg W1 + lg W2. This matches additive entropy changes; the physical entropy-probability principle remains an assumption.",
        foundation: "entropy-multiplicity",
      },
    },
  },
  "eq-s5-d7": {
    expectedDimension: DIMENSIONLESS,
    symbolIndices: { v_0: "0" },
    context:
      "Ask whether all n independently movable points lie in the chosen part v of v0 at a randomly selected moment.",
    premise: POINT_PREMISE,
    next: INDEPENDENCE,
    primary: {
      "row1.right": {
        kind: "symbolPower",
        quantities: ["independentPointCount", "volume"],
        title: "One independent factor for each point",
        does: "Each point has probability v/v0 of being inside. Raising that fraction to n multiplies n independent chances.",
        why: "The count n is a whole number in this point model. If the points share one locked position, their chance of all being inside is v/v0, so merely having n labels does not justify the power.",
        foundation: "probability-independence",
      },
      "row1.right.base.argument": volumeFraction,
    },
  },
  "eq-s5-d8": {
    expectedDimension: ENTROPY,
    symbolIndices: COMPARED_STATES,
    context: "Substitute the independent-point probability into Boltzmann's entropy relation.",
    premise:
      POINT_PREMISE +
      " Use the same entropy reference S0 and the coefficient R/N from kinetic theory.",
    next: CORRESPONDENCE,
    primary: {
      "row1.right": {
        kind: "product",
        quantities: ["molarGasConstant", "avogadroConstant", "independentPointCount", "volume"],
        title: "Bring the point count out of the logarithm",
        does: "The identity lg((v/v0)^n) = n lg(v/v0) turns the exponent into a multiplier of the entropy scale R/N.",
        why: "The volume ratio is positive, so the logarithm's power rule applies. Concentrating the same independent points makes the entropy difference negative.",
        foundation: "logarithms",
      },
      "row1.right.args.1.argument": {
        kind: "quotient",
        quantities: ["independentPointCount", "avogadroConstant"],
        title: "Convert the point count to an amount",
        does: "Divide the number n of points by Avogadro's constant N to obtain their amount of substance.",
        why: "N is a count per amount. Therefore n/N has amount dimensions, and multiplying by the molar gas constant R gives an entropy coefficient.",
        foundation: "bridge-fractions-ratios",
      },
      "row1.right.args.2": volumeLog,
    },
  },
  "eq-s6-d1": {
    expectedDimension: ENTROPY,
    symbolIndices: COMPARED_STATES,
    context:
      "Section 6 returns to the radiation entropy law to compare its volume dependence with the independent-point law.",
    premise:
      WIEN_PREMISE +
      " Matching the volume dependence motivates a correspondence; the comparison alone does not establish the nature of light.",
    next: CORRESPONDENCE,
    primary: {
      "row1.right.args.0": radiationCoefficient,
      "row1.right.args.1": volumeLog,
    },
  },
  "eq-s6-d2": {
    expectedDimension: ENTROPY,
    symbolIndices: COMPARED_STATES,
    context:
      "Rewrite the radiation law so the factor outside its logarithm is the R/N of Boltzmann's principle.",
    premise:
      WIEN_PREMISE +
      " The volume ratio is positive, so the logarithm's power rule is valid. This algebraic rewriting does not by itself establish a probability interpretation.",
    next: CORRESPONDENCE,
    primary: {
      "row1.right.args.0": entropyScale,
      "row1.right.args.1": {
        kind: "function",
        quantities: [
          "volume",
          "avogadroConstant",
          "molarGasConstant",
          "radiationEnergy",
          "wienConstantBeta",
          "frequency",
        ],
        title: "Move the coefficient inside the logarithm",
        does: "Use lg(f^a) = a lg f, with f = v/v0 and a = (N/R) E/(beta nu). Multiplying a by the outside R/N recovers E/(beta nu).",
        why: "The positive base f and dimensionless exponent a make this a valid logarithm identity. Calling f^a a configuration probability is the subsequent physical use of Boltzmann's principle.",
        foundation: "logarithms",
      },
      "row1.right.args.1.argument.argument.exponent": effectiveCount,
    },
  },
  "eq-s6-d3": {
    expectedDimension: ENTROPY,
    symbolIndices: { S_0: "0" },
    context:
      "Apply the entropy-probability relation to the radiation comparison before identifying W.",
    premise: CORRESPONDENCE_PREMISE,
    next: CORRESPONDENCE,
    primary: {
      "row1.right.args.0": entropyScale,
      "row1.right.args.1": {
        kind: "function",
        quantities: ["configurationProbability"],
        title: "Read probability through the entropy law",
        does: "The natural logarithm of W is the entropy difference divided by R/N.",
        why: "The logarithm is one-to-one on positive arguments. Equating it with the preceding logarithm identifies the proposed W, conditional on applying Boltzmann's principle to this radiation.",
        foundation: "entropy-multiplicity",
      },
    },
  },
  "eq-s6-d4": {
    expectedDimension: DIMENSIONLESS,
    symbolIndices: { v_0: "0" },
    context:
      "Read the probability form that places the radiation coefficient where the independent-point count stood in section 5.",
    premise:
      CORRESPONDENCE_PREMISE +
      " Here v is a chosen part of v0, with 0 < v <= v0 and positive E, beta and nu, so the proposed W is between zero and one.",
    next: CORRESPONDENCE,
    primary: {
      "row1.right": {
        kind: "symbolPower",
        quantities: [
          "volume",
          "avogadroConstant",
          "molarGasConstant",
          "radiationEnergy",
          "wienConstantBeta",
          "frequency",
        ],
        title: "Compare the power with the independent-point probability",
        does: "The power has the same volume-fraction form as (v/v0)^n. Its exponent is the effective count suggested by the radiation entropy coefficient.",
        why: "This matching thermodynamic form motivates independent energy elements. It does not prove a complete microscopic model, and the dimensionless exponent need not be an observed integer count.",
        foundation: "entropy-multiplicity",
      },
      "row1.right.exponent": effectiveCount,
      "row1.right.base.argument": {
        ...volumeFraction,
        why: "Here v is a positive part of v0, so this dimensionless ratio lies between zero and one. Interpreting the resulting power as a radiation probability uses the entropy-probability correspondence.",
      },
    },
  },
};
