/**
 * Printed energy budgets in paper 1, §§7–9. Bounds keep their authored direction and physical
 * process; the standalone photoelectric expression does not acquire an invented equality.
 * Electrical dimensions use the source's electromagnetic-CGS context, including amount.
 */
import type { Expression } from "../ast.ts";
import type { MassEnergyOperationGuide, OperationReading } from "./massEnergyOperations.ts";

type LightQuantaBudgetGuide = MassEnergyOperationGuide &
  Readonly<{
    expectedDimension: readonly string[];
    unitSystem: "emu-cgs";
    /** Null admits a standalone expression; existing equality guides never inherit this. */
    relationOperator: "=" | "le" | "ge" | null;
  }>;
type PrimaryReading = MassEnergyOperationGuide["primary"][string];

const ENERGY = ["2", "1", "-2", "0", "0", "0"];
const ENERGY_PER_AMOUNT = ["2", "1", "-2", "0", "0", "-1"];
const FREQUENCY = ["0", "0", "-1", "0", "0", "0"];
const AMOUNT = ["0", "0", "0", "0", "0", "1"];
const FLUORESCENCE = {
  href: "/papers/light-quanta/#arg-lq-fluorescence-budget",
  label: "Compare the fluorescence budget with the restricted single-emission model",
};
const PHOTOELECTRIC = {
  href: "/papers/light-quanta/#arg-lq-photoelectric-energy",
  label: "Follow the one-quantum transfer and escape-work argument",
};
const STOPPING = {
  href: "/papers/light-quanta/#arg-lq-stopping-and-losses",
  label: "Follow the potential convention, stopping condition and losses",
};
const INVERSE = {
  href: "/papers/light-quanta/view/english/#s8-p10-s1",
  label: "Read the source's separate inverse-process budget for cathode luminescence",
};
const IONIZATION = {
  href: "/papers/light-quanta/#arg-lq-ionization-and-counts",
  label: "Follow the ionization threshold and the conditions for a count equality",
};

const FLUORESCENCE_PREMISE =
  "This applies the quantum-energy hypothesis carried from section 6. At low incident-quantum density, one incoming quantum supplies an event independently, with no added energy from the material or another incoming quantum. Additional outgoing quanta and heat may take nonnegative shares of that energy. The source allows departures when inputs combine, or when the light has a different energetic character from black radiation in Wien's range. R, N, beta and both frequencies are positive.";
const EMISSION_PREMISE =
  "The fastest escaping electron receives a whole light quantum at the surface and leaves normally, paying the escape work P without an additional internal loss. The residual must be nonnegative for this emission endpoint to exist. A negative residual is an energy deficit, not a negative kinetic energy or a stopping potential for an emitted electron.";
const ELECTRICAL_PREMISE =
  "The printed electrical quantities use electromagnetic-CGS units. Pi is a nonnegative potential magnitude; epsilon and E are positive charge magnitudes at their stated single-electron and gram-equivalent scales. The electron's signed charge is not substituted for either magnitude.";

/** Budget arithmetic has no entropy-state subtraction or probability-independence reading. */
export const LIGHT_QUANTA_BUDGET_ARITHMETIC: Readonly<
  Partial<Record<Expression["kind"], OperationReading>>
> = {
  sum: {
    title: "Combine the signed energy contributions",
    does: "Add or subtract the complete contributions with the signs printed in this budget.",
    why: "Every contribution uses the same energy or energy-per-amount scale. The sign belongs to the physical process stated for this display.",
    foundation: "work-energy",
  },
  negate: {
    title: "Subtract the escape work",
    does: "Subtract the work required to leave the body from the energy received by the electron.",
    why: "Paying an escape cost reduces the available kinetic energy. A negative remainder records an energy deficit rather than an emitted electron with negative kinetic energy.",
    foundation: "work-energy",
  },
  product: {
    title: "Multiply the complete factors",
    does: "Multiply the adjacent factors, keeping a fraction intact as one factor.",
    why: "The product's dimensions come from every factor, including any amount dimension. Its physical meaning is supplied by the budget and the checked quantity bindings.",
    foundation: "bridge-fractions-ratios",
  },
  quotient: {
    title: "Divide by the positive denominator",
    does: "Divide the complete numerator by the complete denominator.",
    why: "R, N, beta and the frequency used here are positive. Dividing by their positive product is defined and preserves an inequality's direction.",
    foundation: "bridge-fractions-ratios",
  },
};

const quantumEnergy: PrimaryReading = {
  kind: "product",
  quantities: ["molarGasConstant", "avogadroConstant", "wienConstantBeta", "frequency"],
  title: "The energy assigned to one light quantum",
  does: "Multiply R/N by beta nu to form the energy delivered by one quantum in the paper's hypothesis.",
  why: "R/N has entropy dimensions and beta nu has temperature dimensions, so the product is an energy. The assignment of that energy to one quantum remains the physical hypothesis.",
  foundation: "work-energy",
};
const residual: PrimaryReading = {
  kind: "sum",
  quantities: [...quantumEnergy.quantities, "workFunction"],
  title: "The energy left after escape work",
  does: "Subtract P from the full quantum energy to obtain the fastest escaping electron's energy under the stated surface-transfer premise.",
  why: "The source prints an energy expression here. It supplies no negative kinetic energy: when the subtraction is negative, this channel cannot provide an escaping electron.",
  foundation: "work-energy",
};
const molarQuantumEnergy: PrimaryReading = {
  kind: "product",
  quantities: ["molarGasConstant", "wienConstantBeta", "frequency"],
  title: "Put the quantum energy on the amount scale",
  does: "R beta nu is N times the single-quantum energy, expressed as energy per amount of substance.",
  why: "R carries inverse amount. Multiplying by beta nu removes the temperature dimension, leaving energy per amount rather than the energy of a single quantum.",
  foundation: "bridge-fractions-ratios",
};
const electricalEnergy: PrimaryReading = {
  kind: "product",
  quantities: ["stoppingPotentialMagnitude", "gramEquivalentCharge"],
  title: "Convert the potential magnitude to energy per amount",
  does: "Multiply Pi by the charge per gram-equivalent E to obtain the electrical energy contribution on the same amount scale as P prime.",
  why: "In electromagnetic-CGS, the potential and charge dimensions multiply to energy. E also carries inverse amount; it is the source's charge quantity here.",
  foundation: "unit-system-1905",
};
const molarBudget: PrimaryReading = {
  kind: "sum",
  quantities: [
    "stoppingPotentialMagnitude",
    "gramEquivalentCharge",
    "workFunctionPerGramEquivalent",
  ],
  title: "Keep both contributions in the printed budget",
  does: "Add Pi E and P prime before comparing their total with R beta nu.",
  why: "Both terms are energies per amount. Dropping P prime changes the energy budget; the surrounding inequality belongs to the specific forward or inverse process.",
  foundation: "work-energy",
};

export const LIGHT_QUANTA_BUDGET_GUIDES: Readonly<Record<string, LightQuantaBudgetGuide>> = {
  "eq-s7-d1": {
    expectedDimension: ENERGY,
    unitSystem: "emu-cgs",
    relationOperator: "le",
    context: "Section 7 bounds the energy of an outgoing quantum in photoluminescence.",
    premise: FLUORESCENCE_PREMISE,
    next: FLUORESCENCE,
    primary: {
      row1: {
        kind: "relation",
        quantities: [
          "molarGasConstant",
          "avogadroConstant",
          "wienConstantBeta",
          "emittedFrequency",
          "incidentFrequency",
        ],
        title: "The outgoing quantum cannot exceed its energy supply",
        does: "The energy at frequency nu2 is at most the energy of the incoming quantum at nu1.",
        why: "The other outgoing quanta and heat can use part of the supply. This bound on one outgoing quantum does not require that it be the only one produced.",
        foundation: "work-energy",
      },
      "row1.left": {
        ...quantumEnergy,
        quantities: [
          ...quantumEnergy.quantities.filter((q) => q !== "frequency"),
          "emittedFrequency",
        ],
        title: "The energy of the selected outgoing quantum",
        does: "Use the outgoing frequency nu2 in the same positive energy-per-frequency coefficient R beta/N.",
      },
      "row1.right": {
        ...quantumEnergy,
        quantities: [
          ...quantumEnergy.quantities.filter((q) => q !== "frequency"),
          "incidentFrequency",
        ],
        title: "The one incoming quantum's energy supply",
        does: "Use the incoming frequency nu1 to calculate the total energy supplied to this event by that quantum.",
      },
    },
  },
  "eq-s7-d2": {
    expectedDimension: FREQUENCY,
    unitSystem: "emu-cgs",
    relationOperator: "le",
    context: "Cancel the common positive energy-per-frequency coefficient to obtain Stokes's rule.",
    premise: FLUORESCENCE_PREMISE,
    next: FLUORESCENCE,
    primary: {
      row1: {
        kind: "relation",
        quantities: ["emittedFrequency", "incidentFrequency"],
        title: "Divide the bound by a positive common factor",
        does: "Dividing both sides by R beta/N leaves nu2 at most nu1.",
        why: "The common factor is positive, so division preserves the direction. The result retains the single-input energy premise; it is not a universal prohibition on higher-frequency emission.",
        foundation: "bridge-fractions-ratios",
      },
    },
  },
  "eq-s8-d1": {
    expectedDimension: ENERGY,
    unitSystem: "emu-cgs",
    relationOperator: null,
    context:
      "Section 8 first prints the fastest escaping electron's energy as a standalone expression.",
    premise: EMISSION_PREMISE,
    next: PHOTOELECTRIC,
    primary: { row1: residual, "row1.args.0": quantumEnergy },
  },
  "eq-s8-d2": {
    expectedDimension: ENERGY,
    unitSystem: "emu-cgs",
    relationOperator: "=",
    context: "Equate the retarding energy to the maximum kinetic energy of the emitted electrons.",
    premise: `${EMISSION_PREMISE} ${ELECTRICAL_PREMISE}`,
    next: STOPPING,
    primary: {
      row1: {
        kind: "relation",
        quantities: [...residual.quantities, "stoppingPotentialMagnitude", "elementaryCharge"],
        title: "The stopping condition for the fastest electrons",
        does: "Pi epsilon equals the nonnegative residual quantum energy after escape work, at the endpoint where the fastest electrons are just stopped.",
        why: "Retarding work removes their kinetic energy. The equality describes this ideal endpoint; it does not assign a stopping endpoint to a forbidden emission channel.",
        foundation: "work-energy",
      },
      "row1.left": {
        kind: "product",
        quantities: ["stoppingPotentialMagnitude", "elementaryCharge"],
        title: "Use the potential and charge magnitudes",
        does: "Multiply the stopping-potential magnitude Pi by the charge magnitude epsilon to obtain the retarding energy for one electron.",
        why: "Their electromagnetic-CGS dimensions multiply to energy. Substituting a negative electron charge here would change the source's magnitude convention.",
        foundation: "unit-system-1905",
      },
      "row1.right": residual,
      "row1.right.args.0": quantumEnergy,
    },
  },
  "eq-s8-d3": {
    expectedDimension: ENERGY_PER_AMOUNT,
    unitSystem: "emu-cgs",
    relationOperator: "=",
    context: "Write the same ideal stopping condition on the gram-equivalent scale.",
    premise: `${EMISSION_PREMISE} ${ELECTRICAL_PREMISE}`,
    next: STOPPING,
    primary: {
      row1: {
        kind: "relation",
        quantities: [
          ...electricalEnergy.quantities,
          ...molarQuantumEnergy.quantities,
          "workFunctionPerGramEquivalent",
        ],
        title: "Scale the single-electron budget by N",
        does: "Multiplication by N gives E = N epsilon and P prime = N P, and turns the incident energy into R beta nu. Pi is unchanged.",
        why: "E is charge per gram-equivalent, while P prime and every term of this equation are energy per amount. This change of scale is not a replacement of E by radiation energy.",
        foundation: "bridge-fractions-ratios",
      },
      "row1.left": electricalEnergy,
      "row1.right.args.0": molarQuantumEnergy,
    },
  },
  "eq-s8-d4": {
    expectedDimension: ENERGY_PER_AMOUNT,
    unitSystem: "emu-cgs",
    relationOperator: "le",
    context:
      "Allow partial energy transfer in photoelectric emission instead of the ideal full-transfer equality.",
    premise:
      "One incoming light quantum supplies an electron, but the electron may receive only part of it or lose energy inside matter. Escape still costs P prime on the amount scale. " +
      ELECTRICAL_PREMISE,
    next: STOPPING,
    primary: {
      row1: {
        kind: "relation",
        quantities: [...molarBudget.quantities, ...molarQuantumEnergy.quantities],
        title: "The photoelectric output and escape cost have an upper budget",
        does: "The sum Pi E + P prime is at most R beta nu, the incoming energy on the same amount scale.",
        why: "Partial transfer or internal losses reduce the recoverable energy. This is the forward photoelectric process; the following reversed inequality describes a different process.",
        foundation: "work-energy",
      },
      "row1.left": molarBudget,
      "row1.left.args.0": electricalEnergy,
      "row1.right": molarQuantumEnergy,
    },
  },
  "eq-s8-d5": {
    expectedDimension: ENERGY_PER_AMOUNT,
    unitSystem: "emu-cgs",
    relationOperator: "ge",
    context:
      "The paper now considers the inverse process, cathode luminescence: electrons supply energy for emitted light.",
    premise:
      "Use the source's inverse-process energy budget. The electrical and surface contributions must supply at least the energy of the light produced; the source allows one electron to produce many light quanta. This is a separate process from partial-transfer photoemission. " +
      ELECTRICAL_PREMISE,
    next: INVERSE,
    primary: {
      row1: {
        kind: "relation",
        quantities: [...molarBudget.quantities, ...molarQuantumEnergy.quantities],
        title: "The inverse process needs enough energy to produce the light",
        does: "For cathode luminescence, Pi E + P prime must be at least R beta nu.",
        why: "The light energy is now an output that the left-hand budget must supply. The two opposite inequalities describe different processes and cannot be combined to force equality for either process.",
        foundation: "work-energy",
      },
      "row1.left": molarBudget,
      "row1.left.args.0": electricalEnergy,
      "row1.right": molarQuantumEnergy,
    },
  },
  "eq-s9-d1": {
    expectedDimension: ENERGY_PER_AMOUNT,
    unitSystem: "emu-cgs",
    relationOperator: "ge",
    context: "Section 9 asks whether one light quantum can pay the work of ionization.",
    premise:
      "One quantum supplies one molecular ionization in this idealization. J is the required ionization work per gram-equivalent, and R beta nu uses that same amount scale. The constants and frequency are positive.",
    next: IONIZATION,
    primary: {
      row1: {
        kind: "relation",
        quantities: [...molarQuantumEnergy.quantities, "ionizationWorkPerGramEquivalent"],
        title: "The quantum must meet the ionization cost",
        does: "R beta nu must be at least J for the assumed one-quantum ionization to be energetically possible.",
        why: "Meeting an energy threshold is necessary under this premise. It does not determine an absorption probability or guarantee that an ionization occurs.",
        foundation: "work-energy",
      },
      "row1.left": molarQuantumEnergy,
    },
  },
  "eq-s9-d3": {
    expectedDimension: AMOUNT,
    unitSystem: "emu-cgs",
    relationOperator: "=",
    context:
      "Convert absorbed monochromatic energy into an amount of ionized gas under the paper's stated one-to-one condition.",
    premise:
      "Each absorbed quantum ionizes exactly one molecule, with no appreciable absorption unaccompanied by ionization. L is absorbed energy at the positive frequency nu, not all incident energy. j is an amount of ionized gram-molecules, not an ionization rate or a dimensionless molecule count.",
    next: IONIZATION,
    primary: {
      row1: {
        kind: "relation",
        quantities: [
          ...molarQuantumEnergy.quantities,
          "absorbedLightEnergy",
          "ionizedGramMolecules",
        ],
        title: "The equality needs one ionization per absorbed quantum",
        does: "Set j equal to the absorbed energy L divided by R beta nu under the complete-conversion premise.",
        why: "Absorption without ionization would reduce the amount ionized. The printed equality retains its stated condition; it does not silently assume a perfect yield for every gas.",
        foundation: "work-energy",
      },
      "row1.right": {
        kind: "quotient",
        quantities: [...molarQuantumEnergy.quantities, "absorbedLightEnergy"],
        title: "Divide energy by energy per amount",
        does: "Divide the absorbed energy L by the energy-per-amount denominator R beta nu to obtain an amount of substance.",
        why: "The positive denominator is nonzero. Energy divided by energy per amount leaves amount, so this quotient does not directly give a number of individual molecules or a rate.",
        foundation: "bridge-fractions-ratios",
      },
      "row1.right.denominator": molarQuantumEnergy,
    },
  },
};
