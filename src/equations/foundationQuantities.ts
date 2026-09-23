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
        definition: "Position along x.",
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
      // Mean, variance and RMS: the spread of the displacements around their mean.
      own({
        id: "displacementVariance1d",
        name: "Variance of the displacement",
        glyph: "\\operatorname{Var}",
        dimension: ["2", "0", "0", "0", "0", "0"],
        unit: "m^2",
        displayUnit: "m^2",
        displayPower: 0,
        semanticKind: "displacement-variance",
        role: "result",
        definition:
          "The mean square of the displacements' distances from their own mean: spread around the mean, not distance from zero.",
      }),
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
      // Diffusion: the density and its flux along one coordinate.
      pick(BROWNIAN_QUANTITIES, "probabilityDensity"),
      pick(BROWNIAN_QUANTITIES, "displacementIncrement"),
      own({
        id: "probabilityFlux1d",
        name: "Probability flux",
        glyph: "J",
        dimension: ["0", "0", "-1", "0", "0", "0"],
        unit: "1/s",
        displayUnit: "1/s",
        displayPower: 0,
        semanticKind: "probability-flux",
        role: "result",
        definition: "How much probability crosses a point per second, along one coordinate.",
      }),
      // Continuity: particles counted per area per second, beside the concentration they change.
      own({
        id: "particleFlux",
        name: "Particle flux",
        glyph: "J",
        dimension: ["-2", "0", "-1", "0", "0", "0"],
        unit: "1/(m^2 s)",
        displayUnit: "1/(m^2 s)",
        displayPower: 0,
        semanticKind: "particle-flux",
        role: "result",
        definition:
          "The net number of particles crossing a surface per unit area and per second, rightward crossings counted positive.",
      }),
      // Radiation: Wien's law and section 3's entropy derivative, in the paper's own letters.
      pick(LIGHT_QUANTA_QUANTITIES, "frequencyEnergyDensity", { glyph: "\\rho" }),
      pick(LIGHT_QUANTA_QUANTITIES, "wienConstantAlpha", { glyph: "\\alpha" }),
      pick(LIGHT_QUANTA_QUANTITIES, "wienConstantBeta", { glyph: "\\beta" }),
      pick(LIGHT_QUANTA_QUANTITIES, "frequency"),
      pick(LIGHT_QUANTA_QUANTITIES, "temperature"),
      pick(LIGHT_QUANTA_QUANTITIES, "spectralEntropyDensity", { glyph: "\\varphi" }),
      // Fields and waves: a travelling wave's field, and the speed of its crests.
      own({
        id: "radiationElectricField",
        name: "Electric field",
        glyph: "E",
        dimension: ["1", "1", "-3", "0", "-1", "0"],
        unit: "V/m",
        displayUnit: "V/m",
        displayPower: 0,
        semanticKind: "electric-field",
        role: "result",
        definition: "The electric field of the wave at position x and time t.",
      }),
      own({
        id: "waveAmplitude",
        name: "Amplitude of the wave",
        glyph: "E_0",
        dimension: ["1", "1", "-3", "0", "-1", "0"],
        unit: "V/m",
        displayUnit: "V/m",
        displayPower: 0,
        semanticKind: "field-amplitude",
        role: "input",
        definition: "The largest value the field reaches, at each crest.",
      }),
      own({
        id: "angularWavenumber",
        name: "Wavenumber",
        glyph: "k",
        dimension: ["-1", "0", "0", "0", "0", "0"],
        unit: "1/m",
        displayUnit: "1/m",
        displayPower: 0,
        semanticKind: "angular-wavenumber",
        role: "input",
        definition:
          "k = 2 pi / lambda: how fast the wave's phase advances along x, in radians per metre.",
      }),
      own({
        id: "angularFrequency",
        name: "Angular frequency",
        glyph: "\\omega",
        dimension: ["0", "0", "-1", "0", "0", "0"],
        unit: "1/s",
        displayUnit: "1/s",
        displayPower: 0,
        semanticKind: "angular-frequency",
        role: "input",
        definition:
          "omega = 2 pi nu: how fast the wave's phase advances in time, in radians per second.",
      }),
      own({
        id: "wavelength",
        name: "Wavelength",
        glyph: "\\lambda",
        dimension: ["1", "0", "0", "0", "0", "0"],
        unit: "m",
        displayUnit: "m",
        displayPower: 0,
        semanticKind: "wavelength",
        role: "input",
        definition: "The distance from one crest to the next.",
      }),
      // The push of a beam: absorbed, and reflected straight back.
      own({
        id: "radiationForceAbsorbed",
        name: "Push on an absorbing surface",
        glyph: "F_{\\text{absorbed}}",
        dimension: ["1", "1", "-2", "0", "0", "0"],
        unit: "N",
        displayUnit: "N",
        displayPower: 0,
        semanticKind: "radiation-force",
        role: "result",
        definition: "The force of a beam on a surface that absorbs it.",
      }),
      own({
        id: "radiationForceReflected",
        name: "Push on a mirror",
        glyph: "F_{\\text{reflected}}",
        dimension: ["1", "1", "-2", "0", "0", "0"],
        unit: "N",
        displayUnit: "N",
        displayPower: 0,
        semanticKind: "radiation-force",
        role: "result",
        definition: "The force of a beam on a mirror that sends it straight back.",
      }),
      own({
        id: "beamPower",
        name: "Power of the beam",
        glyph: "P",
        dimension: ["2", "1", "-3", "0", "0", "0"],
        unit: "W",
        displayUnit: "W",
        displayPower: 0,
        semanticKind: "beam-power",
        role: "input",
        definition: "The light energy the beam delivers each second.",
      }),
      // A lamp's power spread over a sphere: intensity falls as the square of the distance.
      own({
        id: "intensity",
        name: "Intensity",
        glyph: "I",
        dimension: ["0", "1", "-3", "0", "0", "0"],
        unit: "W/m^2",
        displayUnit: "W/m^2",
        displayPower: 0,
        semanticKind: "intensity",
        role: "result",
        definition: "Power arriving on each square metre facing the source.",
      }),
      own({
        id: "sourcePower",
        name: "Power of the lamp",
        glyph: "P",
        dimension: ["2", "1", "-3", "0", "0", "0"],
        unit: "W",
        displayUnit: "W",
        displayPower: 0,
        semanticKind: "source-power",
        role: "input",
        definition: "The total power the lamp gives out, equally in all directions.",
      }),
      own({
        id: "distanceFromSource",
        name: "Distance from the lamp",
        glyph: "r",
        dimension: ["1", "0", "0", "0", "0", "0"],
        unit: "m",
        displayUnit: "m",
        displayPower: 0,
        semanticKind: "distance-from-source",
        role: "input",
        definition: "The radius of the sphere the lamp's power spreads over.",
      }),
      // Light's momentum: Maxwell's p = E/c.
      pick(LIGHT_QUANTA_QUANTITIES, "radiationEnergy"),
      pick(LIGHT_QUANTA_QUANTITIES, "speedOfLight"),
      own({
        id: "pulseMomentum",
        name: "Momentum of the light",
        glyph: "p",
        dimension: ["1", "1", "-1", "0", "0", "0"],
        unit: "kg m/s",
        displayUnit: "kg m/s",
        displayPower: 0,
        semanticKind: "light-momentum",
        role: "result",
        definition: "The momentum light carries in one direction: its energy divided by c.",
      }),
    ].map((q) => [q.id, q]),
  ),
);
