import type { ConstantSet } from "../../physics/reference/constants.ts";

export type EditorialInput = Readonly<{
  quantityId: string;
  value: number | string;
  unit: string;
  source: string;
  reason: string;
}>;

export type EditorialCheck =
  | "agreed"
  | "not-declared-in-set"
  | "value-mismatch"
  | "declared-printed"
  /**
   * The editorial input and the scenario's OWN input for the same quantity disagree. Found 2026-10-06 by
   * a plant that was expected to go red and stayed green: a scenario declaring an editorial viscosity of
   * 1.35e-3 while its own `viscosity` input was 1.0798059e-3 passed, because every check above compares
   * the declared value against the CONSTANT SET and water viscosity is in no constant set, so the answer
   * was `not-declared-in-set` and nothing looked further.
   *
   * That is the binding-in-two-places shape: the editorial input is what a reader is told the value is
   * and its source, and the scenario input is what the owner was actually given. A record whose two
   * halves disagree cites a provenance for a number it did not use.
   */
  | "input-mismatch";

const TO_SI: Record<string, number> = {
  "J/(mol K)": 1,
  "J mol^-1 K^-1": 1,
  "erg/(mol K)": 1e-7,
  "erg mol^-1 K^-1": 1e-7,
  m: 1,
  cm: 0.01,
  um: 1e-6,
  μm: 1e-6,
  K: 1,
  "Pa s": 1,
};

function asNumber(value: number | string): number {
  if (typeof value === "number") return value;
  return Number(String(value).replace(",", "."));
}

function toSi(value: number, unit: string): number | null {
  const factor = TO_SI[unit];
  return factor === undefined ? null : value * factor;
}

export function checkEditorialInputs(
  editorialInputs: readonly EditorialInput[],
  set: ConstantSet,
  printedQuantityIds: ReadonlySet<string> = new Set(),
  /**
   * The scenario's own inputs, so a declared value can be checked against the one the owner is actually
   * given. Optional, because the two existing callers that have no scenario to hand still get every other
   * check; absent it, `input-mismatch` can never fire and the function behaves as it did before.
   */
  scenarioInputs: Readonly<Record<string, Readonly<{ value: number | string; unit: string }>>> = {},
): readonly {
  quantityId: string;
  check: EditorialCheck;
  scenarioValue: number;
  setValue?: number;
  message: string;
}[] {
  return editorialInputs.map((entry) => {
    const scenarioValue = asNumber(entry.value);
    // CHECKED FIRST, DELIBERATELY. The constant-set checks below return early, and the
    // `not-declared-in-set` branch is the one that hid this: a quantity in no constant set took that
    // branch and no later check ran. A disagreement with the scenario's own input is worse than any of
    // them, because it means the record's cited provenance belongs to a number the run never used.
    const own = scenarioInputs[entry.quantityId];
    if (own !== undefined) {
      const declaredSi = toSi(scenarioValue, entry.unit);
      const usedValue = asNumber(own.value);
      const usedSi = toSi(usedValue, own.unit);
      const same =
        declaredSi !== null && usedSi !== null
          ? declaredSi === usedSi
          : scenarioValue === usedValue;
      if (!same)
        return {
          quantityId: entry.quantityId,
          check: "input-mismatch" as const,
          scenarioValue,
          message: `Editorial input ${entry.quantityId} declares ${scenarioValue} ${entry.unit} (${entry.source}) and the scenario's own ${entry.quantityId} input is ${usedValue} ${own.unit}. The cited source would stand behind a number the run did not use.`,
        };
    }
    const inSet = set.entries.find((e) => e.quantityId === entry.quantityId);
    if (!inSet) {
      return {
        quantityId: entry.quantityId,
        check: "not-declared-in-set" as const,
        scenarioValue,
        message: `${entry.quantityId} is not declared in ${set.id}; the editorial input stands on its own source.`,
      };
    }
    if (printedQuantityIds.has(entry.quantityId)) {
      return {
        quantityId: entry.quantityId,
        check: "declared-printed" as const,
        scenarioValue,
        setValue: inSet.value,
        message: `${entry.quantityId} is printed in ${set.id}, not an editorial input. A printed value is a transcription and not an editorial choice.`,
      };
    }
    const scenarioSi = toSi(scenarioValue, entry.unit);
    const setSi = toSi(inSet.value, inSet.unit);
    const comparable =
      scenarioSi !== null && setSi !== null ? scenarioSi === setSi : scenarioValue === inSet.value;
    if (!comparable) {
      return {
        quantityId: entry.quantityId,
        check: "value-mismatch" as const,
        scenarioValue,
        setValue: inSet.value,
        message: `Editorial input ${entry.quantityId} is ${scenarioValue} ${entry.unit} (${entry.source}) but ${set.id} declares ${inSet.value} ${inSet.unit} (${inSet.provenance}).`,
      };
    }
    return {
      quantityId: entry.quantityId,
      check: "agreed" as const,
      scenarioValue,
      setValue: inSet.value,
      message: `${entry.quantityId} agrees with ${set.id}.`,
    };
  });
}
