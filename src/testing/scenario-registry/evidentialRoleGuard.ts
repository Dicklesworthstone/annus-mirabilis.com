import {
  type ConstantSet,
  createDeclaredConstantSet,
  getConstantSet,
  thermalConstant,
} from "../../physics/reference/constants.ts";
import { rmsDisplacement, stokesEinsteinD } from "../../physics/reference/diffusion.ts";

export const ILLUSTRATIVE_VALUE_AS_INPUT = "illustrative-value-as-input";
export const HISTORICAL_INFERENCE_USES_DERIVED_VALUE = "historical-inference-uses-derived-value";

const ILLUSTRATIVE_MESSAGE = (entry: string, scenarioId: string, instead: string) =>
  `${ILLUSTRATIVE_VALUE_AS_INPUT}: ${entry} is an illustrative computation in this constant set and must not be read as an input to ${scenarioId}; use ${instead} instead.`;

export function resolveConstantSet(id: string, declared?: ConstantSet): ConstantSet {
  if (declared && declared.id === id) return declared;
  try {
    return getConstantSet(id);
  } catch {
    if (declared) return declared;
    throw new Error(`Unknown constant set: ${id}`);
  }
}

export function guardIllustrativeInputs(
  quantityIds: readonly string[],
  set: ConstantSet,
  scenarioId: string,
  instead: string,
): { code: string; message: string; entry: string } | null {
  for (const id of quantityIds) {
    const entry = set.entries.find((e) => e.quantityId === id);
    if (entry?.evidentialRole === "illustrative-computation") {
      return {
        code: ILLUSTRATIVE_VALUE_AS_INPUT,
        message: ILLUSTRATIVE_MESSAGE(id, scenarioId, instead),
        entry: id,
      };
    }
  }
  return null;
}

export function historicalDerivedValueFlag(
  quantityIds: readonly string[],
  set: ConstantSet,
  historicalMode: boolean,
): { flag: string; entry: string } | null {
  if (!historicalMode) return null;
  for (const id of quantityIds) {
    const entry = set.entries.find((e) => e.quantityId === id);
    if (entry?.evidentialRole === "theoretical-estimate") {
      return { flag: HISTORICAL_INFERENCE_USES_DERIVED_VALUE, entry: id };
    }
  }
  return null;
}

/** Recomputes an illustrative displacement from its dependsOn chain, never by reading the entry as input. */
export function checkPrintedConsistency(
  set: ConstantSet,
  inputs: { T: number; eta: number; a: number; t: number },
): { quantityId: string; expected: number; actual: number }[] {
  const out: { quantityId: string; expected: number; actual: number }[] = [];
  for (const entry of set.entries) {
    if (entry.evidentialRole !== "illustrative-computation") continue;
    if (entry.quantityId !== "rmsDisplacement1d") continue;
    const D = stokesEinsteinD({ T: inputs.T, eta: inputs.eta, a: inputs.a, medium: "liquid" }, set);
    if (D.result.status !== "value" || typeof D.result.value !== "number") continue;
    const rms = rmsDisplacement(D.result.value, inputs.t);
    if (rms.result.status !== "value" || typeof rms.result.value !== "number") continue;
    out.push({ quantityId: entry.quantityId, expected: entry.value, actual: rms.result.value });
  }
  void thermalConstant;
  void createDeclaredConstantSet;
  return out;
}
