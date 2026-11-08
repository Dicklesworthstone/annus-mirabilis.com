import type { ScientificResult } from "../results/types.ts";
import { createCalculationSession, rejectCalculation } from "../store/calculationSession.ts";
import type { OutputContract, ParameterClass } from "../store/instanceStore.ts";
import { validateLq02Parameters } from "./parameters.ts";
import {
  computeLq02Snapshot,
  DEFAULT_LQ02_INPUTS,
  type Lq02Inputs,
  type Lq02Snapshot,
  type RadiationResult,
  removeUpperLimit,
} from "./session.ts";

export const LQ02_CLASSES = Object.freeze({
  T: "input",
  nuCutoff: "input",
  probeFrequency: "measurement",
  constantSetId: "input",
} satisfies Record<keyof Lq02Inputs, ParameterClass>);

export const LQ02_OUTPUTS = Object.freeze({
  meanResonatorEnergy: {
    statuses: ["value", "outside-domain"],
    unit: "J",
    semanticKind: "mean-resonator-energy",
    ownerId: "radiation.meanResonatorEnergy",
  },
  energyUpToCutoff: {
    statuses: ["value", "outside-domain"],
    unit: "J/m^3",
    semanticKind: "energy-density-below-cutoff",
    ownerId: "radiation.classicalCutoffEnergyDensity",
  },
  energyUpToProbe: {
    statuses: ["value", "outside-domain"],
    unit: "J/m^3",
    semanticKind: "energy-density-below-probe",
    ownerId: "radiation.classicalCutoffEnergyDensity",
  },
  shareAboveProbe: {
    statuses: ["value", "outside-domain"],
    unit: "1",
    semanticKind: "energy-share-above-probe",
    ownerId: "lq02.session",
  },
  tenfoldWidenedEnergy: {
    statuses: ["value", "outside-domain"],
    unit: "J/m^3",
    semanticKind: "energy-density-below-tenfold-cutoff",
    ownerId: "radiation.classicalCutoffEnergyDensity",
  },
} as const satisfies Record<string, OutputContract>);

function result(
  quantityId: keyof typeof LQ02_OUTPUTS,
  value: RadiationResult<number>,
): ScientificResult {
  const contract = LQ02_OUTPUTS[quantityId];
  const identity = {
    quantityId,
    unit: contract.unit,
    semanticKind: contract.semanticKind,
    ownerId: contract.ownerId,
  };
  if (value.status === "value") return { ...identity, status: "value", value: value.value };
  if (value.status === "outside-domain")
    return {
      ...identity,
      status: value.status,
      condition: value.condition,
      domainKind: value.domainKind,
      reason: value.reason,
      boundary: value.boundary ?? {
        alternativeModel: "Choose a finite, positive temperature and frequency range.",
      },
    };
  return rejectCalculation(`LQ-02 ${quantityId}: unsupported owner status ${value.status}.`);
}

function results(snapshot: Lq02Snapshot): ScientificResult[] {
  return [
    result("meanResonatorEnergy", snapshot.meanResonatorEnergy),
    result("energyUpToCutoff", snapshot.energyUpToCutoff),
    result("energyUpToProbe", snapshot.energyUpToProbe),
    result("shareAboveProbe", snapshot.shareAboveProbe),
    result("tenfoldWidenedEnergy", snapshot.tenfoldWidenedEnergy),
  ];
}

export function createLq02Session(instanceId: string, example: Lq02Inputs = DEFAULT_LQ02_INPUTS) {
  const session = createCalculationSession({
    experimentId: "lq-02",
    instanceId,
    initialParameters: example,
    parameterClasses: LQ02_CLASSES,
    outputs: LQ02_OUTPUTS,
    validate: validateLq02Parameters,
    evaluate: computeLq02Snapshot,
    results,
  });
  return Object.freeze({
    ...session,
    // Asking about an infinite range preserves the identified, accepted finite-range run.
    removeUpperLimit: () => removeUpperLimit(session.acceptedParameters()),
  });
}
