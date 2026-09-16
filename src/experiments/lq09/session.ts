import {
  einsteinPrintedIonizationChecks,
  ionizationBounds,
  ionizationCount,
  visibleColor,
  type IonizationBoundsResult,
  type IonizationCountResult,
} from "../../physics/reference/photoelectric.ts";
import { parseResult } from "../results/codec.ts";
import type { ScientificResult } from "../results/types.ts";
import { createInstanceStore, type Parameters } from "../store/instanceStore.ts";
import { LQ09_CLASSES, LQ09_DEFAULTS, LQ09_OUTPUTS, type Lq09Parameters } from "./definition.ts";
import { validateLq09Parameters } from "./parameters.ts";

export type PreparedLq09Example = Readonly<{
  sourceDigest: string;
  parameters: Lq09Parameters;
  results: readonly string[];
  stepIndex: number;
  simulationTime: number;
}>;

export type Lq09Evaluation = Readonly<{
  bounds: IonizationBoundsResult;
  count: IonizationCountResult;
  outputs: readonly ScientificResult[];
}>;

export function evaluateLq09(p: Lq09Parameters): ScientificResult[] {
  const bounds = ionizationBounds({
    nu: p.frequency,
    ionizationEnergyEv: p.ionizationEnergyEv,
    gasCitation: { gasName: p.gasName, citation: p.gasCitation },
  });

  const countRes = ionizationCount({
    nu: p.frequency,
    ionizationEnergyEv: p.ionizationEnergyEv,
    incidentPowerWatts: p.incidentPower,
    absorptionEfficiency: p.absorptionEfficiency,
    durationSeconds: p.duration,
    absorptionMode: p.absorptionMode,
    declaredFraction: p.declaredFraction,
    gasCitation: { gasName: p.gasName, citation: p.gasCitation },
  });

  const outputs: ScientificResult[] = [
    {
      quantityId: "incidentPower",
      unit: "W",
      semanticKind: "radiant-power",
      ownerId: "lq09.acceptedInputs",
      status: "value",
      value: p.incidentPower,
    },
    {
      quantityId: "frequency",
      unit: "Hz",
      semanticKind: "monochromatic-frequency",
      ownerId: "lq09.acceptedInputs",
      status: "value",
      value: p.frequency,
    },
    {
      quantityId: "ionizationEnergyPerMolecule",
      unit: "eV",
      semanticKind: "ionization-energy",
      ownerId: "lq09.acceptedInputs",
      status: "value",
      value: p.ionizationEnergyEv,
    },
    {
      quantityId: "absorptionEfficiency",
      unit: "1",
      semanticKind: "absorption-efficiency",
      ownerId: "lq09.acceptedInputs",
      status: "value",
      value: p.absorptionEfficiency,
    },
    {
      quantityId: "duration",
      unit: "s",
      semanticKind: "duration",
      ownerId: "lq09.acceptedInputs",
      status: "value",
      value: p.duration,
    },
    {
      quantityId: "absorbedLightEnergy",
      unit: "J",
      semanticKind: "energy",
      ownerId: "photoelectric.ionizationCount",
      status: "value",
      value: countRes.absorbedLightEnergyJoules,
    },
    {
      quantityId: "quantumEnergy",
      unit: "J",
      semanticKind: "quantum-energy",
      ownerId: "photoelectric.ionizationBounds",
      status: "value",
      value: bounds.quantumEnergyJoules,
    },
    {
      quantityId: "quantumEnergyEv",
      unit: "eV",
      semanticKind: "quantum-energy",
      ownerId: "photoelectric.ionizationBounds",
      status: "value",
      value: bounds.quantumEnergyEv,
    },
    {
      quantityId: "thresholdFrequency",
      unit: "Hz",
      semanticKind: "threshold-frequency",
      ownerId: "photoelectric.ionizationBounds",
      status: "value",
      value: bounds.thresholdFrequencyHz,
    },
    {
      quantityId: "thresholdWavelengthNm",
      unit: "nm",
      semanticKind: "wavelength",
      ownerId: "photoelectric.ionizationBounds",
      status: "value",
      value: bounds.thresholdWavelengthNm,
    },
    {
      quantityId: "excessEnergyEv",
      unit: "eV",
      semanticKind: "energy",
      ownerId: "photoelectric.ionizationBounds",
      status: "value",
      value: bounds.excessEnergyEv,
    },
    {
      quantityId: "singleQuantumAllowed",
      unit: "1",
      semanticKind: "boolean-verdict",
      ownerId: "photoelectric.ionizationBounds",
      status: "value",
      value: bounds.singleQuantumAllowed ? 1 : 0,
    },
  ];

  if (countRes.incidentQuantumRatePerSecond.status === "value") {
    outputs.push({
      quantityId: "quantumRate",
      unit: "s^-1",
      semanticKind: "quantum-rate",
      ownerId: "photoelectric.ionizationCount",
      status: "value",
      value: countRes.incidentQuantumRatePerSecond.value,
    });
  }

  if (countRes.absorbedQuantumRatePerSecond.status === "value") {
    outputs.push({
      quantityId: "absorbedQuantumRate",
      unit: "s^-1",
      semanticKind: "quantum-rate",
      ownerId: "photoelectric.ionizationCount",
      status: "value",
      value: countRes.absorbedQuantumRatePerSecond.value,
    });
  }

  // Ionization rate
  if (countRes.ionizationRatePerSecond.status === "value") {
    outputs.push({
      quantityId: "ionizationRate",
      unit: "s^-1",
      semanticKind: "ionization-rate",
      ownerId: "photoelectric.ionizationCount",
      status: "value",
      value: countRes.ionizationRatePerSecond.value,
    });
  } else if (countRes.ionizationRatePerSecond.status === "not-applicable") {
    outputs.push({
      quantityId: "ionizationRate",
      unit: "s^-1",
      semanticKind: "ionization-rate",
      ownerId: "photoelectric.ionizationCount",
      status: "not-applicable",
      reason: countRes.ionizationRatePerSecond.reason,
    });
  } else if (countRes.ionizationRatePerSecond.status === "underdetermined") {
    outputs.push({
      quantityId: "ionizationRate",
      unit: "s^-1",
      semanticKind: "ionization-rate",
      ownerId: "photoelectric.ionizationCount",
      status: "underdetermined",
      compatibleFamily: countRes.ionizationRatePerSecond.compatibleFamily,
      neededInformation: countRes.ionizationRatePerSecond.neededInformation,
    });
  } else if (countRes.ionizationRatePerSecond.status === "outside-domain") {
    outputs.push({
      quantityId: "ionizationRate",
      unit: "s^-1",
      semanticKind: "ionization-rate",
      ownerId: "photoelectric.ionizationCount",
      status: "outside-domain",
      condition: countRes.ionizationRatePerSecond.condition,
      domainKind: countRes.ionizationRatePerSecond.domainKind,
      reason: countRes.ionizationRatePerSecond.reason,
    });
  }

  // Ionization count
  if (countRes.ionizationCountMolecules.status === "value") {
    outputs.push({
      quantityId: "ionizationCount",
      unit: "1",
      semanticKind: "count",
      ownerId: "photoelectric.ionizationCount",
      status: "value",
      value: countRes.ionizationCountMolecules.value,
    });
  } else if (countRes.ionizationCountMolecules.status === "not-applicable") {
    outputs.push({
      quantityId: "ionizationCount",
      unit: "1",
      semanticKind: "count",
      ownerId: "photoelectric.ionizationCount",
      status: "not-applicable",
      reason: countRes.ionizationCountMolecules.reason,
    });
  } else if (countRes.ionizationCountMolecules.status === "underdetermined") {
    outputs.push({
      quantityId: "ionizationCount",
      unit: "1",
      semanticKind: "count",
      ownerId: "photoelectric.ionizationCount",
      status: "underdetermined",
      compatibleFamily: countRes.ionizationCountMolecules.compatibleFamily,
      neededInformation: countRes.ionizationCountMolecules.neededInformation,
    });
  } else if (countRes.ionizationCountMolecules.status === "outside-domain") {
    outputs.push({
      quantityId: "ionizationCount",
      unit: "1",
      semanticKind: "count",
      ownerId: "photoelectric.ionizationCount",
      status: "outside-domain",
      condition: countRes.ionizationCountMolecules.condition,
      domainKind: countRes.ionizationCountMolecules.domainKind,
      reason: countRes.ionizationCountMolecules.reason,
    });
  }

  // Ionized gram molecules
  if (countRes.ionizedGramMolecules.status === "value") {
    outputs.push({
      quantityId: "ionizedGramMolecules",
      unit: "mol",
      semanticKind: "amount-of-substance",
      ownerId: "photoelectric.ionizationCount",
      status: "value",
      value: countRes.ionizedGramMolecules.value,
    });
  } else if (countRes.ionizedGramMolecules.status === "not-applicable") {
    outputs.push({
      quantityId: "ionizedGramMolecules",
      unit: "mol",
      semanticKind: "amount-of-substance",
      ownerId: "photoelectric.ionizationCount",
      status: "not-applicable",
      reason: countRes.ionizedGramMolecules.reason,
    });
  } else if (countRes.ionizedGramMolecules.status === "underdetermined") {
    outputs.push({
      quantityId: "ionizedGramMolecules",
      unit: "mol",
      semanticKind: "amount-of-substance",
      ownerId: "photoelectric.ionizationCount",
      status: "underdetermined",
      compatibleFamily: countRes.ionizedGramMolecules.compatibleFamily,
      neededInformation: countRes.ionizedGramMolecules.neededInformation,
    });
  } else if (countRes.ionizedGramMolecules.status === "outside-domain") {
    outputs.push({
      quantityId: "ionizedGramMolecules",
      unit: "mol",
      semanticKind: "amount-of-substance",
      ownerId: "photoelectric.ionizationCount",
      status: "outside-domain",
      condition: countRes.ionizedGramMolecules.condition,
      domainKind: countRes.ionizedGramMolecules.domainKind,
      reason: countRes.ionizedGramMolecules.reason,
    });
  }

  return outputs;
}

export function createLq09Session(instanceId: string, example?: PreparedLq09Example) {
  const initialParams = example?.parameters ?? LQ09_DEFAULTS;

  const store = createInstanceStore({
    experimentId: "lq-09",
    instanceId,
    initialParameters: initialParams,
    parameterClasses: LQ09_CLASSES,
    outputs: LQ09_OUTPUTS,
    allowPartial: true,
  });

  const initialOutputs = example?.results
    ? example.results.map(parseResult)
    : evaluateLq09(initialParams);

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
        initialParams) as Parameters as Lq09Parameters;
      const merged = input && typeof input === "object" ? { ...current, ...input } : input;
      const validated = validateLq09Parameters(merged);
      if (validated.kind !== "accepted") return validated;
      const parameters = validated.data;
      const previous = (store.getSnapshot().requested?.parameters ??
        initialParams) as Parameters as Lq09Parameters;
      const setup: Record<string, unknown> = {};
      for (const key of Object.keys(parameters) as (keyof Lq09Parameters)[]) {
        if (Object.is(parameters[key], previous[key])) continue;
        setup[key] = parameters[key];
      }

      const request = Object.keys(setup).length
        ? store.issue("setup-change", setup as Record<string, number>)
        : store.issue("continue");

      const computedOutputs = evaluateLq09(parameters);
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
      return (accepted?.parameters ?? initialParams) as Parameters as Lq09Parameters;
    },
  });
}

export { einsteinPrintedIonizationChecks, visibleColor };
