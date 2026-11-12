import { SHELF_DEFINITIONS } from "../../experiments/shelfOptics/definition.ts";
import { evaluateShelfOptics } from "../../experiments/shelfOptics/evaluation.ts";
import { type FizeauRecord, fizeauSourceParameters } from "../../experiments/shelfOptics/fizeau.ts";
import { loadFizeauRecord } from "../../experiments/shelfOptics/fizeauRecord.ts";

/** Build-time composition: the no-script example and interactive laboratory use the same owner. */
export function prepareFizeauWorldCheck(record: FizeauRecord = loadFizeauRecord()) {
  const parameters = fizeauSourceParameters(record) ?? SHELF_DEFINITIONS["shelf-fizeau"].defaults;
  return Object.freeze({ record, example: evaluateShelfOptics(parameters) });
}
