import { ContentError } from "../content/compiler/json.ts";
import { LIGHT_QUANTA_QUANTITIES } from "./lightQuantaQuantities.ts";
import { BROWNIAN_QUANTITIES, type Quantity, type QuantityRegistry } from "./quantities.ts";

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
    ].map((q) => [q.id, q]),
  ),
);
