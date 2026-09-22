import type { Quantity, QuantityRegistry } from "./quantities.ts";

/**
 * Modern teaching notation for the light-quanta paper's explanation-face formulas. Every id is a
 * canonical one from content/quantities/ (radiation.yaml, constants.yaml); a glyph is never a key.
 * The formulas these serve are written in modern notation (h, k_B, Phi), so the definitions say
 * where the 1905 paper wrote the same thing differently. Dimension order is length, mass, time,
 * temperature, current, amount.
 */
const energy = ["2", "1", "-2", "0", "0", "0"] as const;
const action = ["2", "1", "-1", "0", "0", "0"] as const;
const rate = ["0", "0", "-1", "0", "0", "0"] as const;
const charge = ["0", "0", "1", "0", "1", "0"] as const;
const potential = ["2", "1", "-3", "0", "-1", "0"] as const;
function quantity(
  id: string,
  name: string,
  glyph: string,
  dimension: readonly string[],
  unit: string,
  semanticKind: string,
  role: Quantity["role"],
  definition: string,
): Quantity {
  return Object.freeze({
    id,
    name,
    glyph,
    dimension: Object.freeze([...dimension]),
    unit,
    displayUnit: unit,
    displayPower: 0,
    semanticKind,
    role,
    definition,
  });
}
export const LIGHT_QUANTA_QUANTITIES: QuantityRegistry = Object.freeze(
  Object.fromEntries(
    [
      quantity(
        "maxKineticEnergy",
        "Largest kinetic energy of an emitted electron",
        "K_{\\mathrm{max}}",
        energy,
        "J",
        "photoelectron-maximum-kinetic-energy",
        "result",
        "The most energy of motion an electron can carry out of the metal in the one-quantum model: one quantum's energy less the escape work. An electron that loses energy on the way out leaves with less.",
      ),
      quantity(
        "planckConstant",
        "Planck's constant",
        "h",
        action,
        "J s",
        "planck-constant",
        "constant",
        "The constant that sets one quantum's energy, h times the frequency. The 1905 paper writes the same quantum as R beta nu over N, from the constants of Planck's radiation formula; h is the later name for R beta over N.",
      ),
      quantity(
        "frequency",
        "Frequency of the light",
        "\\nu",
        rate,
        "Hz",
        "cyclic-frequency",
        "input",
        "The cyclic frequency of the incident light, in cycles per second. It sets the energy of each quantum; the light's power sets how many arrive.",
      ),
      quantity(
        "workFunction",
        "Escape work",
        "\\Phi",
        energy,
        "J",
        "work-function",
        "input",
        "The least energy an electron must spend to leave the metal's surface. Einstein's section 8 calls it P. A value used in an example here is hypothetical, not a measured figure for a named metal.",
      ),
      quantity(
        "thresholdFrequency",
        "Threshold frequency",
        "\\nu_0",
        rate,
        "Hz",
        "photoelectric-threshold-frequency",
        "result",
        "The lowest frequency whose single quantum can pay the escape work: the escape work divided by h. Below it the model emits no electron, however bright the light.",
      ),
      quantity(
        "elementaryCharge",
        "Charge of one electron",
        "e",
        charge,
        "C",
        "elementary-charge-magnitude",
        "constant",
        "The size of one electron's charge. Multiplied by a potential difference it gives an energy, which is how a stopping potential measures the fastest electron's energy.",
      ),
      quantity(
        "stoppingPotentialMagnitude",
        "Stopping potential",
        "V_s",
        potential,
        "V",
        "stopping-potential-magnitude",
        "input",
        "The size of the retarding potential that just stops the fastest electrons from reaching the collector. It is measured, and its product with the electron's charge is an energy.",
      ),
    ].map((q) => [q.id, q]),
  ),
);
