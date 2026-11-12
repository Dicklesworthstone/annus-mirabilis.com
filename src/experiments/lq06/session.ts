import {
  constantValue,
  getConstantSet,
  thermalConstant,
} from "../../physics/reference/constants.ts";
import {
  effectiveIndependentCount,
  meanQuantumEnergyWien,
} from "../../physics/reference/radiation/quanta.ts";
import { thermalConstantSI } from "../../physics/reference/radiation/quantumConstants.ts";
import { regimeRelativeErrors } from "../../physics/reference/radiation/spectra.ts";
import { ExperimentRuntimeError } from "../refusal.ts";
import { makeRefusal } from "../results/refusals.ts";
import type { ScientificResult } from "../results/types.ts";
import { createInstanceStore, type Parameters, type RequestToken } from "../store/instanceStore.ts";
import { lq06Changes } from "./changes.ts";
import {
  LQ06_CLASSES,
  LQ06_DEFAULTS,
  LQ06_OUTPUTS,
  LQ06_WIEN_RELATIVE_TOLERANCE,
  type Lq06Parameters,
} from "./definition.ts";
import { mergeLq06Parameters, validateLq06Parameters } from "./parameters.ts";

export type PreparedLq06Example = Readonly<{
  sourceDigest: string;
  parameters: Lq06Parameters | Record<string, unknown>;
  results: readonly string[];
  stepIndex: number;
  simulationTime: number;
}>;

export function evaluateLq06(p: Lq06Parameters): ScientificResult[] {
  const validated = validateLq06Parameters(p);
  if (validated.kind !== "accepted")
    throw new ExperimentRuntimeError("parameters-rejected", "Invalid LQ-06 parameters.", "lq-06");
  return lq06Outputs(validated.data);
}

/**
 * The calculation alone, for parameters validateLq06Parameters has accepted. Every setting inside
 * the declared domain gives finite results, so the range guard below is reached only by a caller
 * that skips that check; lq06.session.test.ts drives it that way.
 */
export function lq06Outputs(p: Lq06Parameters): ScientificResult[] {
  const constantSet = getConstantSet(p.constantSetId);
  const kB = thermalConstantSI(constantSet, { read: constantValue, thermal: thermalConstant });
  const eff = effectiveIndependentCount(p.radiationEnergy, p.frequency, constantSet);
  const mean = meanQuantumEnergyWien(p.temperature, constantSet);
  const logVolume = Math.log(p.volumeRatio);
  // At fixed energy and frequency band, density scales as V0/V. Wien's relative error is
  // rho/(A nu^3), so the reference error must meet epsilon * min(1, V/V0) to admit BOTH
  // endpoints. Reuse the spectrum owner's regime test, including the printed beta, without
  // constructing an arbitrary volume/bandwidth or underflowing a deep-Wien spectral density.
  const regime = regimeRelativeErrors(p.frequency, p.temperature, constantSet, {
    epsilonW: LQ06_WIEN_RELATIVE_TOLERANCE * Math.min(1, p.volumeRatio),
  });
  const domainReason =
    "The radiation correspondence is admitted only in the Wien regime. At these settings, the reference or changed volume exceeds the 1% Wien-to-Planck relative-error limit. Increase the frequency, lower the reference temperature, or reduce the compression.";
  const needsWien = new Set([
    "effectiveIndependentCount",
    "radiationEntropy",
    "entropyVolumeCoefficient",
  ]);
  const values: Record<string, number> = {
    radiationEnergy: p.radiationEnergy,
    frequency: p.frequency,
    volumeRatio: p.volumeRatio,
    independentPointCount: p.gasParticles,
    effectiveIndependentCount: eff.count,
    quantumEnergy: eff.quantumEnergy,
    quantumEnergyEv: eff.quantumEnergyEv,
    radiationEntropy: kB * eff.count * logVolume,
    gasEntropy: kB * p.gasParticles * logVolume,
    entropyVolumeCoefficient: kB * eff.count,
    gasEntropyVolumeCoefficient: kB * p.gasParticles,
    meanQuantumEnergyWien: mean.meanQuantumEnergyWien,
    meanQuantumEnergyWienEv: mean.meanQuantumEnergyWienEv,
    moleculeMeanKineticEnergyEv: mean.moleculeKineticEnergyEv,
    meanEnergyRatio: mean.ratioToMoleculeKinetic,
    ratioAt600THz: mean.ratioAt600THz,
  };
  const outputs: ScientificResult[] = Object.entries(values).map(([quantityId, value]) => {
    if (
      !Number.isFinite(value) ||
      (value === 0 && quantityId !== "radiationEntropy" && quantityId !== "gasEntropy")
    ) {
      throw new ExperimentRuntimeError(
        "outside-numeric-range",
        `The ${quantityId} calculation is outside the representable numeric range.`,
      );
    }
    const contract = LQ06_OUTPUTS[quantityId];
    if (!contract)
      throw new ExperimentRuntimeError(
        "missing-output-contract",
        `Missing output contract: ${quantityId}.`,
        "lq-06",
      );
    const identity = {
      quantityId,
      unit: contract.unit,
      semanticKind: contract.semanticKind,
      ownerId: contract.ownerId,
    };
    if (!regime.wienAdmitted && needsWien.has(quantityId))
      return {
        ...identity,
        status: "outside-domain",
        condition: "outside-wien-regime",
        domainKind: "model",
        reason: domainReason,
        boundary: { alternativeModel: "Compare Planck's law in the spectrum laboratory (LQ-03)." },
      };
    return {
      ...identity,
      status: "value",
      value,
    };
  });
  const verdict = {
    quantityId: "correspondenceVerdict",
    unit: "1",
    semanticKind: "verdict",
    ownerId: "lq06.correspondence",
  };
  outputs.push(
    !regime.wienAdmitted
      ? { ...verdict, status: "not-applicable", reason: domainReason }
      : p.selectedSubexpression === "none"
        ? { ...verdict, status: "not-applicable", reason: "No subexpression selected yet." }
        : {
            ...verdict,
            status: "value",
            value: p.selectedSubexpression === "N_E_over_R_beta_nu" ? 1 : 0,
          },
  );
  return outputs;
}

export function createLq06Session(instanceId: string, example?: PreparedLq06Example) {
  const checked = validateLq06Parameters(example?.parameters ?? LQ06_DEFAULTS);
  if (checked.kind !== "accepted")
    throw new ExperimentRuntimeError(
      "parameters-rejected",
      "The prepared LQ-06 parameters are invalid.",
      "lq-06",
    );
  const initialParams = checked.data;
  // Recompute this inexpensive host calculation: serialized examples from an older owner
  // must not publish modern values beneath historical parameter labels.
  const initialOutputs = evaluateLq06(initialParams);
  const store = createInstanceStore({
    experimentId: "lq-06",
    instanceId,
    initialParameters: initialParams,
    parameterClasses: LQ06_CLASSES,
    outputs: LQ06_OUTPUTS,
    // No selection leaves the verdict undecided. Leaving Wien's domain also removes the
    // radiation interpretation while the independent gas and formal energy results remain.
    // Each result still has to satisfy its own declared status contract.
    allowPartial: true,
  });
  const initial = store.issue("setup-change");
  const first = store.publish({
    ...initial,
    outputs: initialOutputs,
    stepIndex: 0,
    simulationTime: 0,
    final: true,
  });
  if (!first.accepted)
    throw new ExperimentRuntimeError(
      "publication-refused",
      `LQ-06 initial publication failed: ${first.reason}.`,
      "lq-06",
    );
  const serverSnapshot = store.getSnapshot();

  function apply(input: unknown, newRun = false) {
    const current = (store.getSnapshot().accepted?.parameters ??
      initialParams) as Parameters as Lq06Parameters;
    const validated = mergeLq06Parameters(current, input);
    if (validated.kind !== "accepted") return validated;
    const parameters = validated.data;
    let outputs: ScientificResult[];
    try {
      // A failed calculation cannot advance the request or damage the last accepted state.
      outputs = evaluateLq06(parameters);
    } catch (error) {
      return {
        kind: "refused" as const,
        refusal: makeRefusal(
          "invalid-parameter",
          { capabilityId: "lq06.evaluation" },
          {
            // The reader's sentence, never the error's own text, which is written for developers
            // ("[experiment] The quantumEnergy calculation is ... (outside-numeric-range)").
            details: {
              requirements:
                error instanceof ExperimentRuntimeError && error.code === "outside-numeric-range"
                  ? "These settings take the calculation beyond the numbers it can represent."
                  : "These settings could not be calculated.",
            },
          },
        ),
      };
    }
    const previous = (store.getSnapshot().requested?.parameters ??
      initialParams) as Parameters as Lq06Parameters;
    const stepIndex = (store.getSnapshot().accepted?.stepIndex ?? 0) + 1;
    let request: RequestToken | null = null;
    const changes = lq06Changes(previous, parameters);
    if (newRun && !changes.some((change) => change.command === "setup-change"))
      request = store.issue("setup-change");
    for (const change of changes) {
      request = store.issue(change.command, change.patch);
    }
    request ??= store.issue("continue");
    const publication = store.publish({
      ...request,
      outputs,
      stepIndex,
      simulationTime: 0,
      final: true,
    });
    if (!publication.accepted) {
      const outcome = {
        outcome: "invariant-violation" as const,
        message: "The calculation did not satisfy its required consistency checks.",
        retry: "new-run" as const,
        details: { reason: publication.reason },
      };
      store.fail(request, outcome);
      return { kind: "outcome" as const, outcome };
    }
    return { kind: "accepted" as const, data: request };
  }

  return Object.freeze({
    getSnapshot: store.getSnapshot,
    getServerSnapshot: () => serverSnapshot,
    subscribe: store.subscribe,
    exportCheckpoint: store.exportCheckpoint,
    restoreCheckpoint: store.restoreCheckpoint,
    apply: (input: unknown) => apply(input),
    startNewRun: (input: unknown) => apply(input, true),
    stop() {
      // Synchronous host evaluator has no background workers.
    },
    disconnect() {
      // Synchronous host evaluator has no resources to dispose.
    },
    acceptedParameters: () =>
      (store.getSnapshot().accepted?.parameters ?? initialParams) as Parameters as Lq06Parameters,
  });
}
