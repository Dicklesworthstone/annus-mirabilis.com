import {
  emissionRate,
  kMax,
  photocurrent,
  quantumEnergy,
  quantumRate,
  stoppingPotentialFromEv,
  thresholdFrequencyFromEv,
} from "../../physics/reference/photoelectric.ts";
import { parseResult } from "../results/codec.ts";
import type { ScientificResult } from "../results/types.ts";
import { createInstanceStore, type Parameters } from "../store/instanceStore.ts";
import { LQ08_CLASSES, LQ08_OUTPUTS, type Lq08Parameters } from "./definition.ts";
import { validateLq08Parameters } from "./parameters.ts";

export type PreparedLq08Example = Readonly<{
  sourceDigest: string;
  parameters: Lq08Parameters;
  results: readonly string[];
  stepIndex: number;
  simulationTime: number;
}>;

function evaluateOutputs(p: Lq08Parameters): ScientificResult[] {
  const qeRes = quantumEnergy(p.frequency);
  const tfRes = thresholdFrequencyFromEv(p.workFunction);
  const kmRes = kMax(p.frequency, p.workFunction * 1.602176634e-19);
  const spRes = stoppingPotentialFromEv(p.frequency, p.workFunction);
  const qrRes = quantumRate(p.incidentPower, p.frequency);
  const erRes = emissionRate(
    p.incidentPower,
    p.frequency,
    p.workFunction * 1.602176634e-19,
    p.quantumEfficiency,
  );
  const pcRes = photocurrent(
    p.incidentPower,
    p.frequency,
    p.workFunction * 1.602176634e-19,
    p.quantumEfficiency,
    p.collectorPotential,
  );

  const outputs: ScientificResult[] = [
    {
      quantityId: "incidentPower",
      unit: "W",
      semanticKind: "radiant-power",
      ownerId: "lq08.acceptedInputs",
      status: "value",
      value: p.incidentPower,
    },
    {
      quantityId: "frequency",
      unit: "Hz",
      semanticKind: "monochromatic-frequency",
      ownerId: "lq08.acceptedInputs",
      status: "value",
      value: p.frequency,
    },
    {
      quantityId: "workFunction",
      unit: "eV",
      semanticKind: "work-function",
      ownerId: "lq08.acceptedInputs",
      status: "value",
      value: p.workFunction,
    },
    {
      quantityId: "quantumEfficiency",
      unit: "1",
      semanticKind: "quantum-efficiency",
      ownerId: "lq08.acceptedInputs",
      status: "value",
      value: p.quantumEfficiency,
    },
    {
      quantityId: "collectorPotential",
      unit: "V",
      semanticKind: "collector-potential",
      ownerId: "lq08.acceptedInputs",
      status: "value",
      value: p.collectorPotential,
    },
  ];

  if (qeRes.status === "value") {
    outputs.push({
      quantityId: "quantumEnergy",
      unit: "J",
      semanticKind: "quantum-energy",
      ownerId: "photoelectric.quantumEnergy",
      status: "value",
      value: qeRes.value,
    });
  }

  if (tfRes.status === "value") {
    outputs.push({
      quantityId: "thresholdFrequency",
      unit: "Hz",
      semanticKind: "threshold-frequency",
      ownerId: "photoelectric.thresholdFrequency",
      status: "value",
      value: tfRes.value,
    });
  }

  if (kmRes.status === "value") {
    outputs.push({
      quantityId: "maxKineticEnergy",
      unit: "J",
      semanticKind: "max-kinetic-energy",
      ownerId: "photoelectric.kMax",
      status: "value",
      value: kmRes.value,
    });
  } else if (kmRes.status === "not-applicable") {
    outputs.push({
      quantityId: "maxKineticEnergy",
      unit: "J",
      semanticKind: "max-kinetic-energy",
      ownerId: "photoelectric.kMax",
      status: "not-applicable",
      reason: kmRes.reason,
    });
  }

  if (spRes.status === "value") {
    outputs.push({
      quantityId: "stoppingPotentialMagnitude",
      unit: "V",
      semanticKind: "stopping-potential",
      ownerId: "photoelectric.stoppingPotentialMagnitude",
      status: "value",
      value: spRes.value,
    });
  } else if (spRes.status === "not-applicable") {
    outputs.push({
      quantityId: "stoppingPotentialMagnitude",
      unit: "V",
      semanticKind: "stopping-potential",
      ownerId: "photoelectric.stoppingPotentialMagnitude",
      status: "not-applicable",
      reason: spRes.reason,
    });
  }

  if (qrRes.status === "value") {
    outputs.push({
      quantityId: "quantumRate",
      unit: "s^-1",
      semanticKind: "quantum-rate",
      ownerId: "photoelectric.quantumRate",
      status: "value",
      value: qrRes.value,
    });
  }

  if (erRes.status === "value") {
    outputs.push({
      quantityId: "emissionRate",
      unit: "s^-1",
      semanticKind: "emission-rate",
      ownerId: "photoelectric.emissionRate",
      status: "value",
      value: erRes.value,
    });
  }

  if (pcRes.status === "value") {
    outputs.push({
      quantityId: "photocurrent",
      unit: "A",
      semanticKind: "photocurrent",
      ownerId: "photoelectric.photocurrent",
      status: "value",
      value: pcRes.value,
    });
  } else if (pcRes.status === "underdetermined") {
    outputs.push({
      quantityId: "photocurrent",
      unit: "A",
      semanticKind: "photocurrent",
      ownerId: "photoelectric.photocurrent",
      status: "underdetermined",
      compatibleFamily: pcRes.compatibleFamily,
      neededInformation: pcRes.neededInformation,
    });
  }

  return outputs;
}

export function createLq08Session(instanceId: string, example?: PreparedLq08Example) {
  const initialParams = example?.parameters ?? {
    incidentPower: 0.001,
    frequency: 6.0e14,
    workFunction: 2.2,
    quantumEfficiency: 0.1,
    collectorPotential: 0.0,
  };

  const store = createInstanceStore({
    experimentId: "lq-08",
    instanceId,
    initialParameters: initialParams,
    parameterClasses: LQ08_CLASSES,
    outputs: LQ08_OUTPUTS,
    allowPartial: true,
  });

  const initialOutputs = example?.results
    ? example.results.map(parseResult)
    : evaluateOutputs(initialParams);

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
        initialParams) as Parameters as Lq08Parameters;
      const merged = input && typeof input === "object" ? { ...current, ...input } : input;
      const validated = validateLq08Parameters(merged);
      if (validated.kind !== "accepted") return validated;
      const parameters = validated.data;
      const previous = (store.getSnapshot().requested?.parameters ??
        initialParams) as Parameters as Lq08Parameters;
      const setup: Record<string, number> = {};
      const measurement: Record<string, number> = {};

      for (const key of Object.keys(parameters) as (keyof Lq08Parameters)[]) {
        if (Object.is(parameters[key], previous[key])) continue;
        if (key === "collectorPotential") {
          measurement[key] = parameters[key];
        } else {
          setup[key] = parameters[key];
        }
      }

      let request = Object.keys(setup).length ? store.issue("setup-change", setup) : null;
      if (Object.keys(measurement).length) {
        request = store.issue("measurement-change", measurement);
      }
      request ??= store.issue("continue");

      const computedOutputs = evaluateOutputs(parameters);
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
      // Synchronous host evaluator has no background workers to stop
    },
    disconnect() {
      // Synchronous host evaluator has no resources to dispose
    },
    acceptedParameters: () => {
      const accepted = store.getSnapshot().accepted;
      return (accepted?.parameters ?? initialParams) as Parameters as Lq08Parameters;
    },
  });
}
