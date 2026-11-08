import type { ScientificResult } from "../results/types.ts";
import { createCalculationSession } from "../store/calculationSession.ts";
import type { OutputContract, ParameterClass } from "../store/instanceStore.ts";
import { validateBm02Parameters } from "./parameters.ts";
import {
  type Bm02Inputs,
  type Bm02Snapshot,
  computeBm02Snapshot,
  DEFAULT_BM02_INPUTS,
} from "./session.ts";

export const BM02_CLASSES = Object.freeze({
  Np: "input",
  V_um3: "input",
  T: "input",
  a_um: "input",
  A_um2: "input",
  model: "input",
  constantSetId: "input",
} satisfies Record<keyof Bm02Inputs, ParameterClass>);

export const BM02_OUTPUTS = Object.freeze({
  numberDensity: {
    statuses: ["value", "outside-domain"],
    unit: "m-3",
    semanticKind: "particle-number-density",
    ownerId: "bm02.session",
  },
  volumeFraction: {
    statuses: ["value", "outside-domain"],
    unit: "1",
    semanticKind: "solute-volume-fraction",
    ownerId: "diffusion.volumeFraction",
  },
  osmoticPressure: {
    statuses: ["value", "outside-domain"],
    unit: "Pa",
    semanticKind: "ideal-osmotic-pressure",
    ownerId: "diffusion.osmoticPressure",
    admittedOwnerIds: ["diffusion.osmoticPressureClassicalExpectation"],
  },
  partitionForce: {
    statuses: ["value", "outside-domain"],
    unit: "N",
    semanticKind: "osmotic-partition-force",
    ownerId: "diffusion.partitionForce",
    admittedOwnerIds: ["bm02.session"],
  },
  hydrostaticHead: {
    statuses: ["value", "outside-domain"],
    unit: "m",
    semanticKind: "equivalent-column-height",
    ownerId: "diffusion.hydrostaticHead",
    admittedOwnerIds: ["bm02.session"],
  },
} as const satisfies Record<string, OutputContract>);

/** A pressure refusal propagates to its dependent quantities with their own units and identity. */
function dependentResult(
  quantityId: "partitionForce" | "hydrostaticHead",
  result: ScientificResult,
): ScientificResult {
  if (result.quantityId === quantityId) return result;
  const contract = BM02_OUTPUTS[quantityId];
  return {
    ...result,
    quantityId,
    unit: contract.unit,
    semanticKind: contract.semanticKind,
    ownerId: "bm02.session",
  };
}

function results(snapshot: Bm02Snapshot): ScientificResult[] {
  return [
    snapshot.numberDensity,
    snapshot.volumeFraction,
    snapshot.osmoticPressure.result,
    dependentResult("partitionForce", snapshot.partitionForce.result),
    dependentResult("hydrostaticHead", snapshot.hydrostaticHead.result),
  ];
}

export function createBm02Session(instanceId: string, example: Bm02Inputs = DEFAULT_BM02_INPUTS) {
  return createCalculationSession({
    experimentId: "bm-02",
    instanceId,
    initialParameters: example,
    parameterClasses: BM02_CLASSES,
    outputs: BM02_OUTPUTS,
    validate: validateBm02Parameters,
    evaluate: computeBm02Snapshot,
    results,
  });
}
