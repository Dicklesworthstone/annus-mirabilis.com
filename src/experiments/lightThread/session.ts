import { constantValue, getConstantSet } from "../../physics/reference/constants.ts";
import {
  evaluateLightThread,
  LIGHT_THREAD_DEFAULTS,
  LIGHT_THREAD_QUANTITIES,
  type LightThreadOwners,
  type LightThreadParameters,
  type LightThreadSnapshot,
} from "../../physics/reference/lightThread.ts";
import { dopplerFactor, lightComplexFactors } from "../../physics/reference/waves.ts";
import { ExperimentRuntimeError } from "../refusal.ts";
import type { ScientificResult } from "../results/types.ts";
import {
  createInstanceStore,
  type OutputContract,
  type ParameterClass,
  type Parameters,
} from "../store/instanceStore.ts";

const constants = getConstantSet("modern-si-2019");
export const LIGHT_THREAD_OWNERS: LightThreadOwners = Object.freeze({
  constantSetId: "modern-si-2019",
  planckConstant: constantValue(constants, "planckConstant").value,
  speedOfLight: constantValue(constants, "speedOfLight").value,
  frequencyFactor: dopplerFactor,
  energyFactor: (beta: number, thetaRad: number) =>
    lightComplexFactors(beta, thetaRad).energyFactor,
});

const classes: Readonly<Record<keyof LightThreadParameters, ParameterClass>> = Object.freeze({
  frequencyHz: "input",
  pulseEnergyJ: "input",
  beta: "observer",
  angleDeg: "input",
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
  const initial = evaluateLightThread(initialParameters, LIGHT_THREAD_OWNERS);
  if (initial.kind !== "accepted")
    throw new ExperimentRuntimeError("parameters-rejected", initial.reason, "light-thread");
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

  return Object.freeze({
    getSnapshot: store.getSnapshot,
    getServerSnapshot: () => serverSnapshot,
    subscribe: store.subscribe,
    apply(input: unknown) {
      // Calculate before issuing any command: a rejected input cannot disturb the last state.
      const evaluated = evaluateLightThread(input, LIGHT_THREAD_OWNERS);
      if (evaluated.kind !== "accepted") return evaluated;
      const next = evaluated.snapshot.parameters;
      const previous = store.getSnapshot().accepted?.parameters ?? initial.snapshot.parameters;
      const setup: Record<string, number> = {};
      const observer: Record<string, number> = {};
      for (const key of Object.keys(classes) as (keyof LightThreadParameters)[]) {
        if (Object.is(next[key], previous[key])) continue;
        (classes[key] === "observer" ? observer : setup)[key] = next[key];
      }
      if (!Object.keys(setup).length && !Object.keys(observer).length) {
        return Object.freeze({ kind: "accepted" as const, parameters: next });
      }
      let token = Object.keys(setup).length
        ? store.issue("setup-change", setup as Parameters)
        : null;
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
    },
  });
}
