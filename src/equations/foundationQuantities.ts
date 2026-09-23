import { ContentError } from "../content/compiler/json.ts";
import { LIGHT_QUANTA_QUANTITIES } from "./lightQuantaQuantities.ts";
import { MASS_ENERGY_QUANTITIES } from "./massEnergyQuantities.ts";
import { BROWNIAN_QUANTITIES, type Quantity, type QuantityRegistry } from "./quantities.ts";
import { SPECIAL_RELATIVITY_QUANTITIES } from "./specialRelativityQuantities.ts";

/**
 * The quantities the foundation lessons' formulas bind. A lesson is not a paper, so it has its own
 * table and its own colours, but its ids are the canonical ones in content/quantities: where a
 * lesson uses a paper's quantity, the entry is that paper's, and a glyph is changed only where the
 * lesson prints the quantity differently (paper 1's lower-case v for a volume). A glyph is never a
 * key. Dimension order is length, mass, time, temperature, current, amount.
 */
export function pickQuantity(
  table: QuantityRegistry,
  id: string,
  change: Partial<Quantity> = {},
): Quantity {
  const q = table[id];
  if (!q)
    throw new ContentError(
      "foundation-quantity-unregistered",
      id,
      `A foundation lesson reuses a paper's quantity by its registered id, and ${id} is not one.`,
    );
  return Object.freeze({ ...q, ...change });
}
const pick = pickQuantity;
const own = (q: Quantity): Quantity =>
  Object.freeze({ ...q, dimension: Object.freeze([...q.dimension]) });
const dimensionless = ["0", "0", "0", "0", "0", "0"];

export const FOUNDATION_QUANTITIES: QuantityRegistry = Object.freeze(
  Object.fromEntries(
    [
      pick(BROWNIAN_QUANTITIES, "genericNumberA"),
      pick(BROWNIAN_QUANTITIES, "genericNumberB"),
      own({
        id: "genericBase",
        name: "Any positive number",
        glyph: "f",
        dimension: dimensionless,
        unit: "1",
        displayUnit: "1",
        displayPower: 0,
        semanticKind: "generic-number",
        role: "input",
        definition:
          "f stands for any positive number raised to a power, in an identity about logarithms.",
      }),
      own({
        id: "genericExponent",
        name: "Any power",
        glyph: "n",
        dimension: dimensionless,
        unit: "1",
        displayUnit: "1",
        displayPower: 0,
        semanticKind: "generic-number",
        role: "input",
        definition: "n stands for any number used as a power, in an identity about logarithms.",
      }),
      own({
        id: "entropy",
        name: "Entropy",
        glyph: "S",
        dimension: ["2", "1", "-2", "-1", "0", "0"],
        unit: "J/K",
        displayUnit: "J/K",
        displayPower: 0,
        semanticKind: "entropy",
        role: "result",
        definition: "A system's entropy; S_0 is its value in the state it is compared with.",
      }),
      pick(BROWNIAN_QUANTITIES, "molarGasConstant"),
      pick(BROWNIAN_QUANTITIES, "avogadroConstant"),
      pick(LIGHT_QUANTA_QUANTITIES, "configurationProbability"),
      pick(LIGHT_QUANTA_QUANTITIES, "independentPointCount", {
        definition: "The number of molecules, each moving independently through the volume.",
      }),
      pick(LIGHT_QUANTA_QUANTITIES, "volume", {
        glyph: "v",
        definition: "A volume: v_0 is the whole volume the molecules move in, and v a part of it.",
      }),
      // Derivatives: the Brownian paper's section 4 concentration, and the difference quotient.
      pick(BROWNIAN_QUANTITIES, "diffusionCoefficient"),
      pick(BROWNIAN_QUANTITIES, "positionCoordinate1d", {
        definition: "Position along the tube, the coordinate the concentration varies with.",
      }),
      own({
        id: "numberDensity",
        name: "Concentration",
        glyph: "f",
        dimension: ["-3", "0", "0", "0", "0", "0"],
        unit: "1/m^3",
        displayUnit: "1/m^3",
        displayPower: 0,
        semanticKind: "number-density",
        role: "result",
        definition:
          "Section 4's f: the number of particles per unit volume at position x and time t.",
      }),
      own({
        id: "elapsedTime",
        name: "Time",
        glyph: "t",
        dimension: ["0", "0", "1", "0", "0", "0"],
        unit: "s",
        displayUnit: "s",
        displayPower: 0,
        semanticKind: "elapsed-time",
        role: "input",
        definition: "The time at which the position or the concentration is read.",
      }),
      own({
        id: "timeIncrement",
        name: "A short interval",
        glyph: "\\Delta t",
        dimension: ["0", "0", "1", "0", "0", "0"],
        unit: "s",
        displayUnit: "s",
        displayPower: 0,
        // A duration like t, so t + Delta t is a sum of like quantities.
        semanticKind: "elapsed-time",
        role: "input",
        definition:
          "A short interval added to t in a difference quotient; the derivative is where the quotient settles as it shrinks.",
      }),
      // Random walks: a walker's net displacement after n steps, printed X_n in the lesson.
      pick(BROWNIAN_QUANTITIES, "displacement1d", {
        glyph: "X",
        definition:
          "X_n: a walker's net displacement after n steps, the sum of the n signed steps.",
      }),
      pick(BROWNIAN_QUANTITIES, "stepRms"),
      pick(BROWNIAN_QUANTITIES, "walkStepCount"),
      // The Gaussian: the unitless variable of the moment integral.
      pick(BROWNIAN_QUANTITIES, "scaledDisplacement"),
      // Events and frames: section 1's light signal from clock A to B and back.
      pick(SPECIAL_RELATIVITY_QUANTITIES, "signalDepartureTimeA"),
      pick(SPECIAL_RELATIVITY_QUANTITIES, "signalReflectionTimeB"),
      pick(SPECIAL_RELATIVITY_QUANTITIES, "signalReturnTimeA", { glyph: "t'_A" }),
      // Energy of motion: one body at everyday speed, then the mass-energy argument's two ledgers.
      own({
        id: "bodyKineticEnergy",
        name: "Energy of motion",
        glyph: "K",
        dimension: ["2", "1", "-2", "0", "0", "0"],
        unit: "J",
        displayUnit: "J",
        displayPower: 0,
        semanticKind: "kinetic-energy",
        role: "result",
        definition: "A body's kinetic energy at a speed small compared with light's.",
      }),
      own({
        id: "bodyMass",
        name: "Mass",
        glyph: "m",
        dimension: ["0", "1", "0", "0", "0", "0"],
        unit: "kg",
        displayUnit: "kg",
        displayPower: 0,
        semanticKind: "body-mass",
        role: "input",
        definition: "A body's inertial mass: its resistance to being set moving.",
      }),
      own({
        id: "bodySpeed",
        name: "Speed",
        glyph: "v",
        dimension: ["1", "0", "-1", "0", "0", "0"],
        unit: "m/s",
        displayUnit: "m/s",
        displayPower: 0,
        semanticKind: "body-speed",
        role: "input",
        definition: "How fast the body moves.",
      }),
      pick(MASS_ENERGY_QUANTITIES, "kineticEnergyBefore"),
      pick(MASS_ENERGY_QUANTITIES, "kineticEnergyAfter"),
      pick(MASS_ENERGY_QUANTITIES, "bodyMassBefore"),
      pick(MASS_ENERGY_QUANTITIES, "bodyMassAfter"),
      pick(MASS_ENERGY_QUANTITIES, "frameSpeed"),
    ].map((q) => [q.id, q]),
  ),
);
