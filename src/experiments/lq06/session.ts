import { getConstantSet } from "../../physics/reference/constants.ts";
import {
  effectiveIndependentCount,
  meanQuantumEnergyWien,
} from "../../physics/reference/radiation/quanta.ts";
import { parseResult } from "../results/codec.ts";
import type { ScientificResult } from "../results/types.ts";
import { createInstanceStore, type Parameters } from "../store/instanceStore.ts";
import {
  LQ06_CLASSES,
  LQ06_DEFAULTS,
  LQ06_OUTPUTS,
  type Lq06Parameters,
} from "./definition.ts";
import { validateLq06Parameters } from "./parameters.ts";

export type PreparedLq06Example = Readonly<{
  sourceDigest: string;
  parameters: Lq06Parameters | Record<string, unknown>;
  results: readonly string[];
  stepIndex: number;
  simulationTime: number;
}>;

export function evaluateLq06(p: Lq06Parameters): ScientificResult[] {
  const constantSet = getConstantSet(
    p.constantSetId === "einstein-1905-light-quanta-printed"
      ? "modern-si-2019" // Reference math runs in SI, printed layer provides historical adapters
      : "modern-si-2019",
  );

  const kB = 1.380649e-23; // J/K
  const h = 6.62607015e-34; // J*s

  const effResult = effectiveIndependentCount(p.radiationEnergy, p.frequency, constantSet);
  const nEff = effResult.count;
  const qEnergyJ = effResult.quantumEnergy;
  const qEnergyEv = effResult.quantumEnergyEv;

  const lnV = Math.log(p.volumeRatio);
  const radEntropy = kB * nEff * lnV;
  const gasEntropy = kB * p.gasParticles * lnV;

  const radVolumeCoeff = kB * nEff; // E / (B * nu) = kB * E / (h * nu)
  const gasVolumeCoeff = kB * p.gasParticles; // kB * n

  const meanResult = meanQuantumEnergyWien(p.temperature, constantSet);

  let isMatch = false;
  let hasSelection = false;
  if (p.selectedSubexpression === "N_E_over_R_beta_nu") {
    isMatch = true;
    hasSelection = true;
  } else if (p.selectedSubexpression !== "none") {
    isMatch = false;
    hasSelection = true;
  }

  const outputs: ScientificResult[] = [
    {
      quantityId: "radiationEnergy",
      unit: "J",
      semanticKind: "radiation-energy",
      ownerId: "lq06.acceptedInputs",
      status: "value",
      value: p.radiationEnergy,
    },
    {
      quantityId: "frequency",
      unit: "Hz",
      semanticKind: "frequency",
      ownerId: "lq06.acceptedInputs",
      status: "value",
      value: p.frequency,
    },
    {
      quantityId: "volumeRatio",
      unit: "1",
      semanticKind: "volume-ratio",
      ownerId: "lq06.acceptedInputs",
      status: "value",
      value: p.volumeRatio,
    },
    {
      quantityId: "independentPointCount",
      unit: "1",
      semanticKind: "count",
      ownerId: "lq06.acceptedInputs",
      status: "value",
      value: p.gasParticles,
    },
    {
      quantityId: "effectiveIndependentCount",
      unit: "1",
      semanticKind: "effective-independent-count",
      ownerId: "radiation.quanta",
      status: "value",
      value: nEff,
    },
    {
      quantityId: "quantumEnergy",
      unit: "J",
      semanticKind: "quantum-energy",
      ownerId: "radiation.quanta",
      status: "value",
      value: qEnergyJ,
    },
    {
      quantityId: "quantumEnergyEv",
      unit: "eV",
      semanticKind: "quantum-energy",
      ownerId: "radiation.quanta",
      status: "value",
      value: qEnergyEv,
    },
    {
      quantityId: "radiationEntropy",
      unit: "J/K",
      semanticKind: "radiation-entropy-change",
      ownerId: "radiation.entropy",
      status: "value",
      value: radEntropy,
    },
    {
      quantityId: "gasEntropy",
      unit: "J/K",
      semanticKind: "entropy",
      ownerId: "radiation.configurations",
      status: "value",
      value: gasEntropy,
    },
    {
      quantityId: "entropyVolumeCoefficient",
      unit: "J/K",
      semanticKind: "entropy-volume-coefficient",
      ownerId: "radiation.entropy",
      status: "value",
      value: radVolumeCoeff,
    },
    {
      quantityId: "gasEntropyVolumeCoefficient",
      unit: "J/K",
      semanticKind: "entropy-volume-coefficient",
      ownerId: "radiation.configurations",
      status: "value",
      value: gasVolumeCoeff,
    },
    {
      quantityId: "meanQuantumEnergyWien",
      unit: "J",
      semanticKind: "mean-quantum-energy",
      ownerId: "radiation.quanta",
      status: "value",
      value: meanResult.meanQuantumEnergyWien,
    },
    {
      quantityId: "meanQuantumEnergyWienEv",
      unit: "eV",
      semanticKind: "mean-quantum-energy",
      ownerId: "radiation.quanta",
      status: "value",
      value: meanResult.meanQuantumEnergyWienEv,
    },
    {
      quantityId: "moleculeMeanKineticEnergyEv",
      unit: "eV",
      semanticKind: "energy",
      ownerId: "radiation.quanta",
      status: "value",
      value: meanResult.moleculeKineticEnergyEv,
    },
    {
      quantityId: "meanEnergyRatio",
      unit: "1",
      semanticKind: "dimensionless-ratio",
      ownerId: "radiation.quanta",
      status: "value",
      value: meanResult.ratioToMoleculeKinetic,
    },
    {
      quantityId: "ratioAt600THz",
      unit: "1",
      semanticKind: "dimensionless-ratio",
      ownerId: "radiation.quanta",
      status: "value",
      value: meanResult.ratioAt600THz,
    },
  ];

  if (hasSelection) {
    outputs.push({
      quantityId: "correspondenceVerdict",
      unit: "1",
      semanticKind: "verdict",
      ownerId: "lq06.correspondence",
      status: "value",
      value: isMatch ? 1 : 0,
    });
  } else {
    outputs.push({
      quantityId: "correspondenceVerdict",
      unit: "1",
      semanticKind: "verdict",
      ownerId: "lq06.correspondence",
      status: "not-applicable",
      reason: "No subexpression selected yet.",
    });
  }

  return outputs;
}

export function createLq06Session(instanceId: string, example?: PreparedLq06Example) {
  const initialParams = (example?.parameters as unknown as Lq06Parameters) ?? LQ06_DEFAULTS;

  const store = createInstanceStore({
    experimentId: "lq-06",
    instanceId,
    initialParameters: initialParams,
    parameterClasses: LQ06_CLASSES,
    outputs: LQ06_OUTPUTS,
    allowPartial: true,
  });

  const initialOutputs = example?.results
    ? example.results.map(parseResult)
    : evaluateLq06(initialParams);

  const token = store.issue("setup-change");
  store.publish({
    ...token,
    outputs: initialOutputs,
    stepIndex: 0,
    simulationTime: 0,
    final: true,
  });

  const serverSnapshot = store.getSnapshot();

  return Object.freeze({
    getSnapshot: store.getSnapshot,
    getServerSnapshot: () => serverSnapshot,
    subscribe: store.subscribe,
    apply(input: unknown) {
      const current = (store.getSnapshot().accepted?.parameters ??
        initialParams) as Parameters as Lq06Parameters;
      const merged = input && typeof input === "object" ? { ...current, ...input } : input;
      const validated = validateLq06Parameters(merged);
      if (validated.kind !== "accepted") return validated;
      const parameters = validated.data;
      const previous = (store.getSnapshot().requested?.parameters ??
        initialParams) as Parameters as Lq06Parameters;
      const setup: Record<string, unknown> = {};
      for (const key of Object.keys(parameters) as (keyof Lq06Parameters)[]) {
        if (Object.is(parameters[key], previous[key])) continue;
        setup[key] = parameters[key];
      }

      const request = Object.keys(setup).length
        ? store.issue("setup-change", setup as Record<string, number>)
        : store.issue("continue");

      const computedOutputs = evaluateLq06(parameters);
      store.publish({
        ...request,
        outputs: computedOutputs,
        stepIndex: (store.getSnapshot().accepted?.stepIndex ?? 0) + 1,
        simulationTime: 0,
        final: true,
      });

      return { kind: "accepted" as const, data: request };
    },
    stop() {
      // Synchronous host evaluator has no background workers
    },
    disconnect() {
      // Synchronous host evaluator has no resources to dispose
    },
    acceptedParameters: () => {
      const accepted = store.getSnapshot().accepted;
      return (accepted?.parameters ?? initialParams) as Parameters as Lq06Parameters;
    },
  });
}
