import { constantValue, convert, getConstantSet } from "../../physics/reference/constants.ts";
import {
  evaluateLightThread,
  LIGHT_THREAD_DEFAULTS,
  LIGHT_THREAD_QUANTITIES,
  type LightThreadConstantSetId,
  type LightThreadOwners,
  type LightThreadParameters,
  type LightThreadSnapshot,
  validateLightThreadParameters,
} from "../../physics/reference/lightThread.ts";
import { effectiveIndependentCount } from "../../physics/reference/radiation/quanta.ts";
import { dopplerFactor, lightComplexFactors } from "../../physics/reference/waves.ts";
import { ExperimentRuntimeError } from "../refusal.ts";
import type { ScientificResult } from "../results/types.ts";
import {
  decodeInstanceCheckpoint,
  type InstanceCheckpointRestore,
} from "../store/instanceCheckpoint.ts";
import {
  createInstanceStore,
  type OutputContract,
  type ParameterClass,
  type Parameters,
} from "../store/instanceStore.ts";

/** Only adapters live here: the registered radiation owner derives the printed Rβ/N in SI. */
export function lightThreadOwnersFor(constantSetId: LightThreadConstantSetId): LightThreadOwners {
  const constants = getConstantSet(constantSetId);
  const speed = constantValue(constants, "speedOfLight");
  const speedUnit = constants.entries.find((entry) => entry.quantityId === "speedOfLight")?.unit;
  const speedOfLight =
    speedUnit === "m/s"
      ? speed.value
      : speedUnit === "cm/s"
        ? convert(speed.value, "cm", "m")
        : Number.NaN;
  return Object.freeze({
    constantSetId,
    speedOfLight,
    quantumComparison: (energyJ: number, frequencyHz: number) =>
      effectiveIndependentCount(energyJ, frequencyHz, constants),
    frequencyFactor: dopplerFactor,
    energyFactor: (beta: number, thetaRad: number) => {
      const factors = lightComplexFactors(beta, thetaRad);
      return factors.energyDensityFactor * factors.volumeFactor;
    },
  });
}

export const LIGHT_THREAD_OWNERS = lightThreadOwnersFor("modern-si-2019");

function evaluate(input: unknown) {
  const checked = validateLightThreadParameters(input);
  return checked.kind === "accepted"
    ? evaluateLightThread(
        checked.parameters,
        lightThreadOwnersFor(checked.parameters.constantSetId),
      )
    : checked;
}

const classes: Readonly<Record<keyof LightThreadParameters, ParameterClass>> = Object.freeze({
  frequencyHz: "input",
  pulseEnergyJ: "input",
  beta: "observer",
  angleDeg: "input",
  constantSetId: "input",
});

export const LIGHT_THREAD_OUTPUTS: Readonly<Record<string, OutputContract>> = Object.freeze(
  Object.fromEntries(
    Object.entries(LIGHT_THREAD_QUANTITIES).map(([id, quantity]) => [
      id,
      Object.freeze({
        unit: quantity.unit,
        semanticKind: quantity.semanticKind,
        ownerId: "light-thread",
        statuses: Object.freeze(["value"] as const),
      }),
    ]),
  ),
);

function scientificResults(snapshot: LightThreadSnapshot): readonly ScientificResult[] {
  return Object.freeze(
    Object.entries(snapshot.values).map(([quantityId, value]) => {
      const quantity = LIGHT_THREAD_QUANTITIES[quantityId as keyof typeof LIGHT_THREAD_QUANTITIES];
      return Object.freeze({
        quantityId,
        unit: quantity.unit,
        semanticKind: quantity.semanticKind,
        ownerId: "light-thread",
        status: "value" as const,
        value,
      });
    }),
  );
}

export function createLightThreadSession(
  instanceId = "light-thread-session",
  initialParameters: LightThreadParameters = LIGHT_THREAD_DEFAULTS,
) {
  const initial = evaluate(initialParameters);
  if (initial.kind !== "accepted")
    throw new ExperimentRuntimeError("parameters-rejected", initial.reason, "light-thread");
  const initialSnapshot = initial.snapshot;
  const store = createInstanceStore({
    experimentId: "light-thread",
    instanceId,
    initialParameters: initial.snapshot.parameters,
    parameterClasses: classes,
    outputs: LIGHT_THREAD_OUTPUTS,
  });
  const first = store.issue("setup-change");
  const published = store.publish({
    ...first,
    stepIndex: 0,
    simulationTime: 0,
    final: true,
    outputs: scientificResults(initial.snapshot),
  });
  if (!published.accepted)
    throw new ExperimentRuntimeError(
      "publication-refused",
      `Light-thread publication refused: ${published.reason}`,
      "light-thread",
    );
  const serverSnapshot = store.getSnapshot();

  function apply(input: unknown, newRun = false) {
    // Calculate before issuing any command: a rejected input cannot disturb the last state.
    const evaluated = evaluate(input);
    if (evaluated.kind !== "accepted") return evaluated;
    const next = evaluated.snapshot.parameters;
    const previous = store.getSnapshot().accepted?.parameters ?? initialSnapshot.parameters;
    const setup: Record<string, number | string> = {};
    const observer: Record<string, number | string> = {};
    for (const key of Object.keys(classes) as (keyof LightThreadParameters)[]) {
      if (Object.is(next[key], previous[key])) continue;
      (classes[key] === "observer" ? observer : setup)[key] = next[key];
    }
    if (!newRun && !Object.keys(setup).length && !Object.keys(observer).length) {
      return Object.freeze({ kind: "accepted" as const, parameters: next });
    }
    let token =
      newRun || Object.keys(setup).length ? store.issue("setup-change", setup as Parameters) : null;
    if (Object.keys(observer).length) token = store.issue("observer-change", observer);
    if (!token)
      throw new ExperimentRuntimeError(
        "no-command-for-change",
        "Changed light-thread settings produced no command.",
        "light-thread",
      );
    const decision = store.publish({
      ...token,
      stepIndex: 0,
      simulationTime: 0,
      final: true,
      outputs: scientificResults(evaluated.snapshot),
    });
    if (!decision.accepted)
      throw new ExperimentRuntimeError(
        "publication-refused",
        `Light-thread publication refused: ${decision.reason}`,
        "light-thread",
      );
    return Object.freeze({ kind: "accepted" as const, parameters: next });
  }

  /** Refuse a relabelled constant set before the retained owner can accept its old numbers. */
  function restoreCheckpoint(input: unknown): InstanceCheckpointRestore {
    try {
      const { publication } = decodeInstanceCheckpoint(input);
      const evaluated = evaluate(publication.parameters);
      if (
        evaluated.kind !== "accepted" ||
        publication.outputs.length !== Object.keys(LIGHT_THREAD_QUANTITIES).length ||
        publication.outputs.some(
          (output) =>
            output.status !== "value" ||
            !Object.is(
              output.value,
              evaluated.snapshot.values[output.quantityId as keyof typeof LIGHT_THREAD_QUANTITIES],
            ),
        )
      ) {
        return {
          kind: "not-restored",
          notice:
            "The recorded results do not match the declared light-thread settings and constants.",
        };
      }
      return store.restoreCheckpoint(input);
    } catch {
      return { kind: "not-restored", notice: "The light-thread checkpoint is invalid." };
    }
  }

  return Object.freeze({
    getSnapshot: store.getSnapshot,
    getServerSnapshot: () => serverSnapshot,
    subscribe: store.subscribe,
    exportCheckpoint: store.exportCheckpoint,
    restoreCheckpoint,
    apply: (input: unknown) => apply(input),
    startNewRun: (input: unknown) => apply(input, true),
  });
}
