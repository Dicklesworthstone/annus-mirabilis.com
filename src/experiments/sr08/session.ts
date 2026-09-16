import { evaluateSr08 } from "../../physics/reference/fields.ts";
import { encodeResult, parseResult } from "../results/codec.ts";
import type { ScientificResult } from "../results/types.ts";
import { createInstanceStore, type Parameters } from "../store/instanceStore.ts";
import { SR08_CLASSES, SR08_DEFAULTS, SR08_OUTPUTS, type Sr08Parameters } from "./definition.ts";
import { sr08InputFromParameters, validateSr08Parameters } from "./parameters.ts";

export type PreparedSr08Example = Readonly<{
  sourceDigest: string;
  parameters: Sr08Parameters;
  results: readonly string[];
  stepIndex: number;
  simulationTime: number;
}>;

export function snapshotOutputs(p: Sr08Parameters): ScientificResult[] {
  const snap = evaluateSr08(sr08InputFromParameters(p));
  return [
    snap.electricFieldStationary,
    snap.electricFieldMoving,
    snap.magneticFieldStationary,
    snap.magneticFieldMoving,
    snap.fieldInvariantEDotB,
    snap.fieldInvariantE2MinusC2B2,
    snap.lorentzFactor,
    snap.chargeVelocityStationary,
    snap.chargeVelocityMoving,
    snap.transverseForceLaboratory,
    snap.transverseForceComoving,
  ];
}

export const DEFAULT_PREPARED_EXAMPLE: PreparedSr08Example = Object.freeze({
  sourceDigest: "source:sha256:default-sr08",
  parameters: SR08_DEFAULTS,
  results: snapshotOutputs(SR08_DEFAULTS).map(encodeResult),
  stepIndex: 0,
  simulationTime: 0,
});

export function createSr08Session(
  instanceId = "sr08-session",
  example: PreparedSr08Example = DEFAULT_PREPARED_EXAMPLE,
) {
  const store = createInstanceStore({
    experimentId: "sr-08",
    instanceId,
    initialParameters: example.parameters as unknown as Parameters,
    parameterClasses: SR08_CLASSES,
    outputs: SR08_OUTPUTS,
    allowPartial: true,
  });

  const initialOutputs = example.results.map(parseResult);
  const token = store.issue("setup-change");
  const published = store.publish({
    ...token,
    stepIndex: example.stepIndex,
    simulationTime: example.simulationTime,
    final: true,
    outputs: initialOutputs,
  });

  if (!published.accepted) {
    throw new Error(`Invalid prepared SR-08 example: ${published.reason}`);
  }

  const serverSnapshot = store.getSnapshot();

  return Object.freeze({
    getSnapshot: store.getSnapshot,
    getServerSnapshot: () => serverSnapshot,
    subscribe: store.subscribe,
    evaluate: evaluateSr08,
    acceptedParameters(): Sr08Parameters {
      return (store.getSnapshot().accepted?.parameters ??
        example.parameters) as unknown as Sr08Parameters;
    },
    apply(input: unknown) {
      const checked = validateSr08Parameters(input);
      if (checked.kind !== "accepted") return checked;
      const previous = (store.getSnapshot().accepted?.parameters ??
        example.parameters) as unknown as Sr08Parameters;
      const next = checked.data;

      const setup: Record<string, number | string | boolean | object> = {};
      const observer: Record<string, number | string | boolean | object> = {};
      const presentation: Record<string, number | string | boolean | object> = {};

      (Object.keys(next) as (keyof Sr08Parameters)[]).forEach((key) => {
        if (Object.is(next[key], previous[key])) return;
        const cls = SR08_CLASSES[key];
        if (cls === "observer") {
          observer[key] = next[key];
        } else if (cls === "presentation") {
          presentation[key] = next[key];
        } else {
          setup[key] = next[key];
        }
      });

      let request = Object.keys(setup).length
        ? store.issue("setup-change", setup as Record<string, number | string | boolean>)
        : null;
      if (Object.keys(observer).length) {
        request = store.issue(
          "observer-change",
          observer as Record<string, number | string | boolean>,
        );
      }
      if (Object.keys(presentation).length) {
        request = store.issue(
          "presentation-change",
          presentation as Record<string, number | string | boolean>,
        );
      }
      request ??= store.issue("continue");

      const outputs = snapshotOutputs(next);
      const decision = store.publish({
        ...request,
        stepIndex: store.getSnapshot().accepted?.stepIndex ?? 0,
        simulationTime: 0,
        final: true,
        outputs,
      });

      if (!decision.accepted) {
        throw new Error(`SR-08 publication refused: ${decision.reason}`);
      }

      return { kind: "accepted" as const, data: request };
    },
  });
}
