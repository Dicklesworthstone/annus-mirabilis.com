import { evaluateSr12 } from "../../physics/reference/fields.ts";
import { encodeResult, parseResult } from "../results/codec.ts";
import type { ScientificResult } from "../results/types.ts";
import { createInstanceStore, type Parameters } from "../store/instanceStore.ts";
import { SR12_CLASSES, SR12_DEFAULTS, SR12_OUTPUTS, type Sr12Parameters } from "./definition.ts";
import { sr12InputFromParameters, validateSr12Parameters } from "./parameters.ts";

export type PreparedSr12Example = Readonly<{
  sourceDigest: string;
  parameters: Sr12Parameters;
  results: readonly string[];
  stepIndex: number;
  simulationTime: number;
}>;

export function snapshotOutputs(p: Sr12Parameters): ScientificResult[] {
  const snap = evaluateSr12(sr12InputFromParameters(p));
  return [
    snap.chargeDensityStationary,
    snap.chargeDensityMoving,
    snap.currentDensityStationary,
    snap.currentDensityMoving,
    snap.fourCurrentInvariant,
    snap.fourCurrentInvariantNormalized,
    snap.lorentzFactor,
    snap.continuityResidualStationary,
    snap.continuityResidualMoving,
    snap.loopLegChargePositive,
    snap.loopLegChargeNegative,
    snap.loopTotalCharge,
    snap.sphereTotalChargeStationary,
    snap.sphereTotalChargeMoving,
  ];
}

export const DEFAULT_PREPARED_EXAMPLE: PreparedSr12Example = Object.freeze({
  sourceDigest: "source:sha256:default-sr12",
  parameters: SR12_DEFAULTS,
  results: snapshotOutputs(SR12_DEFAULTS).map(encodeResult),
  stepIndex: 0,
  simulationTime: 0,
});

export function createSr12Session(
  instanceId = "sr12-session",
  example: PreparedSr12Example = DEFAULT_PREPARED_EXAMPLE,
) {
  const store = createInstanceStore({
    experimentId: "sr-12",
    instanceId,
    initialParameters: example.parameters as unknown as Parameters,
    parameterClasses: SR12_CLASSES,
    outputs: SR12_OUTPUTS,
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
    throw new Error(`Invalid prepared SR-12 example: ${published.reason}`);
  }

  const serverSnapshot = store.getSnapshot();

  return Object.freeze({
    getSnapshot: store.getSnapshot,
    getServerSnapshot: () => serverSnapshot,
    subscribe: store.subscribe,
    evaluate: evaluateSr12,
    acceptedParameters(): Sr12Parameters {
      return (store.getSnapshot().accepted?.parameters ??
        example.parameters) as unknown as Sr12Parameters;
    },
    apply(input: unknown) {
      const previous = (store.getSnapshot().accepted?.parameters ??
        example.parameters) as unknown as Sr12Parameters;
      const merged =
        typeof input === "object" && input !== null
          ? { ...previous, ...(input as Record<string, unknown>) }
          : input;
      const checked = validateSr12Parameters(merged);
      if (checked.kind !== "accepted") return checked;
      const next = checked.data;

      const setup: Record<string, number | string | boolean | object> = {};
      const observer: Record<string, number | string | boolean | object> = {};
      const presentation: Record<string, number | string | boolean | object> = {};

      (Object.keys(next) as (keyof Sr12Parameters)[]).forEach((key) => {
        if (Object.is(next[key], previous[key])) return;
        const cls = SR12_CLASSES[key];
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
        throw new Error(`SR-12 publication refused: ${decision.reason}`);
      }

      return { kind: "accepted" as const, data: request };
    },
  });
}
