import { constantValue, getConstantSet } from "../../physics/reference/constants.ts";
import {
  emissionRate,
  kMax,
  photocurrent,
  quantumEnergy,
  quantumRate,
  stoppingPotentialFromEv,
  thresholdFrequencyFromEv,
  visibleColor,
} from "../../physics/reference/photoelectric.ts";
import { parseResult } from "../results/codec.ts";
import type { ScientificResult } from "../results/types.ts";
import {
  type AcceptedSnapshot,
  createInstanceStore,
  type ExperimentView,
  type Parameters,
} from "../store/instanceStore.ts";
import { acceptedLq08CollectorSweep, type Lq08CollectorSweep } from "./collectorSweep.ts";
import {
  LQ08_CLASSES,
  LQ08_DEFAULTS,
  LQ08_MODEL,
  LQ08_OUTPUTS,
  type Lq08CompatibleParameters,
  type Lq08Parameters,
} from "./definition.ts";
import { acceptedLq08EnergyBudget, type Lq08EnergyBudget } from "./energyBudget.ts";
import { validateLq08Parameters } from "./parameters.ts";

export type PreparedLq08Example = Readonly<{
  sourceDigest: string;
  parameters: Lq08CompatibleParameters;
  results: readonly string[];
  stepIndex: number;
  simulationTime: number;
}>;

export type Lq08ExperimentView = ExperimentView &
  Readonly<{ collectorSweep: Lq08CollectorSweep | null; energyBudget: Lq08EnergyBudget | null }>;

export function evaluateLq08(p: Lq08CompatibleParameters): ScientificResult[] {
  const constants = getConstantSet(LQ08_MODEL.constantSetId);
  const transferModel = "transferModel" in p ? p.transferModel : "complete";
  const planckConstant = constantValue(constants, "planckConstant").value;
  const elementaryCharge = constantValue(constants, "elementaryCharge").value;
  const workFunctionJoules = p.workFunction * elementaryCharge;
  const qeRes = quantumEnergy(p.frequency, constants);
  const tfRes = thresholdFrequencyFromEv(p.workFunction, constants);
  const kmRes = kMax(p.frequency, workFunctionJoules, constants, transferModel);
  const spRes = stoppingPotentialFromEv(p.frequency, p.workFunction, constants, transferModel);
  const qrRes = quantumRate(p.incidentPower, p.frequency, constants);
  const erRes = emissionRate(
    p.incidentPower,
    p.frequency,
    workFunctionJoules,
    p.quantumEfficiency,
    constants,
  );
  const pcRes = photocurrent(
    {
      incidentPowerWatts: p.incidentPower,
      nu: p.frequency,
      workFunctionJoules,
      quantumEfficiency: p.quantumEfficiency,
      collectorPotentialVolts: p.collectorPotential,
      distributionModel: "distributionModel" in p ? p.distributionModel : "none",
      transferModel,
    },
    constants,
  );

  const outputs: ScientificResult[] = [
    // The controls and legacy workFunction output retain eV. The equation consumes this
    // separately identified SI escape work from the same accepted input and constant set.
    {
      quantityId: "escapeWork",
      unit: "J",
      semanticKind: "work-function",
      ownerId: "lq08.acceptedInputs",
      status: "value",
      value: workFunctionJoules,
    },
    {
      quantityId: "planckConstant",
      unit: "J s",
      semanticKind: "planck-constant",
      ownerId: "lq08.acceptedConstants",
      status: "value",
      value: planckConstant,
    },
    {
      quantityId: "elementaryCharge",
      unit: "C",
      semanticKind: "elementary-charge-magnitude",
      ownerId: "lq08.acceptedConstants",
      status: "value",
      value: elementaryCharge,
    },
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
  } else if (kmRes.status === "underdetermined") {
    outputs.push({
      quantityId: "maxKineticEnergy",
      unit: "J",
      semanticKind: "max-kinetic-energy",
      ownerId: "photoelectric.kMax",
      status: "underdetermined",
      compatibleFamily: kmRes.compatibleFamily,
      neededInformation: kmRes.neededInformation,
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
  } else if (spRes.status === "underdetermined") {
    outputs.push({
      quantityId: "stoppingPotentialMagnitude",
      unit: "V",
      semanticKind: "stopping-potential",
      ownerId: "photoelectric.stoppingPotentialMagnitude",
      status: "underdetermined",
      compatibleFamily: spRes.compatibleFamily,
      neededInformation: spRes.neededInformation,
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
  const initialParams: Lq08Parameters = Object.freeze({
    ...LQ08_DEFAULTS,
    ...example?.parameters,
  });

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
    : evaluateLq08(initialParams);

  const token = store.issue("setup-change");
  store.publish({
    ...token,
    outputs: initialOutputs,
    stepIndex: 0,
    simulationTime: 0,
    final: true,
  });

  const views = new WeakMap<ExperimentView, Lq08ExperimentView>();
  const sweeps = new WeakMap<AcceptedSnapshot, Lq08CollectorSweep | null>();
  const budgets = new WeakMap<AcceptedSnapshot, Lq08EnergyBudget | null>();
  function withCollectorSweep(view: ExperimentView): Lq08ExperimentView {
    const cached = views.get(view);
    if (cached) return cached;
    const accepted = view.accepted;
    if (accepted && !sweeps.has(accepted)) {
      const checked = validateLq08Parameters(accepted.parameters);
      const budget =
        checked.kind === "accepted" ? acceptedLq08EnergyBudget(accepted, checked.data) : null;
      budgets.set(accepted, budget);
      sweeps.set(
        accepted,
        checked.kind === "accepted" && budget
          ? acceptedLq08CollectorSweep(accepted, checked.data, budget)
          : null,
      );
    }
    const extended = Object.freeze({
      ...view,
      collectorSweep: accepted ? (sweeps.get(accepted) ?? null) : null,
      energyBudget: accepted ? (budgets.get(accepted) ?? null) : null,
    });
    views.set(view, extended);
    return extended;
  }
  const getSnapshot = () => withCollectorSweep(store.getSnapshot());
  const serverSnapshot = getSnapshot();

  function apply(input: unknown, newRun = false) {
    const current = (store.getSnapshot().accepted?.parameters ??
      initialParams) as Parameters as Lq08Parameters;
    const complete = validateLq08Parameters(input);
    const merged =
      complete.kind === "accepted"
        ? complete.data
        : input && typeof input === "object"
          ? { ...current, ...input }
          : input;
    const validated = validateLq08Parameters(merged);
    if (validated.kind !== "accepted") return validated;
    const parameters = validated.data;
    const previous = (store.getSnapshot().requested?.parameters ??
      initialParams) as Parameters as Lq08Parameters;
    const setup: Record<string, number | string | boolean> = {};
    const measurement: Record<string, number | string | boolean> = {};

    for (const key of Object.keys(parameters) as (keyof Lq08Parameters)[]) {
      if (Object.is(parameters[key], previous[key])) continue;
      if (key === "collectorPotential") {
        measurement[key] = parameters[key];
      } else {
        setup[key] = parameters[key];
      }
    }

    let request = newRun || Object.keys(setup).length ? store.issue("setup-change", setup) : null;
    if (Object.keys(measurement).length) {
      request = store.issue("measurement-change", measurement);
    }
    request ??= store.issue("continue");

    const computedOutputs = evaluateLq08(parameters);
    store.publish({
      ...request,
      outputs: computedOutputs,
      stepIndex: (store.getSnapshot().accepted?.stepIndex ?? 0) + 1,
      simulationTime: 0,
      final: true,
    });

    return { kind: "accepted" as const, data: request };
  }

  return Object.freeze({
    getSnapshot,
    getServerSnapshot: () => serverSnapshot,
    subscribe: store.subscribe,
    exportCheckpoint: store.exportCheckpoint,
    restoreCheckpoint: store.restoreCheckpoint,
    apply: (input: unknown) => apply(input),
    startNewRun: (input: unknown) => apply(input, true),
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

export { visibleColor };
