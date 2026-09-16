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
  | "declared-printed";

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
): readonly {
  quantityId: string;
  check: EditorialCheck;
  scenarioValue: number;
  setValue?: number;
  message: string;
}[] {
  return editorialInputs.map((entry) => {
    const scenarioValue = asNumber(entry.value);
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
