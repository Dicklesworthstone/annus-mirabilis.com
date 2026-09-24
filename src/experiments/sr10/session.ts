import { evaluateSr10 } from "../../physics/reference/waves.ts";
import { encodeResult, parseResult } from "../results/codec.ts";
import type { ScientificResult } from "../results/types.ts";
import { createInstanceStore, type Parameters } from "../store/instanceStore.ts";
import { SR10_CLASSES, SR10_DEFAULTS, SR10_OUTPUTS, type Sr10Parameters } from "./definition.ts";
import { sr10InputFromParameters, validateSr10Parameters } from "./parameters.ts";

export type PreparedSr10Example = Readonly<{
  sourceDigest: string;
  parameters: Sr10Parameters;
  results: readonly string[];
  comparisonResults?: readonly string[];
  stepIndex: number;
  simulationTime: number;
}>;

export function snapshotOutputs(p: Sr10Parameters): ScientificResult[] {
  const snap = evaluateSr10(sr10InputFromParameters(p));
  return [...snap.results];
}

/** The rigid-body countermodel for the same settings, under its model id. It is a named wrong
 * model shown for comparison, so it is never published into the accepted snapshot. */
export function sr10Comparison(p: Sr10Parameters) {
  return evaluateSr10(sr10InputFromParameters(p)).countermodelComparison;
}

export const DEFAULT_PREPARED_EXAMPLE: PreparedSr10Example = Object.freeze({
  sourceDigest: "source:sha256:default-sr10",
  parameters: SR10_DEFAULTS,
  results: snapshotOutputs(SR10_DEFAULTS).map(encodeResult),
  stepIndex: 0,
  simulationTime: 0,
});

export function createSr10Session(
  instanceId = "sr10-session",
  example: PreparedSr10Example = DEFAULT_PREPARED_EXAMPLE,
) {
  const store = createInstanceStore({
    experimentId: "sr-10",
    instanceId,
    initialParameters: example.parameters as unknown as Parameters,
    parameterClasses: SR10_CLASSES,
    outputs: SR10_OUTPUTS,
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
    throw new Error(`Invalid prepared SR-10 example: ${published.reason}`);
  }

  const serverSnapshot = store.getSnapshot();

  return Object.freeze({
    getSnapshot: store.getSnapshot,
    getServerSnapshot: () => serverSnapshot,
    subscribe: store.subscribe,
    acceptedParameters(): Sr10Parameters {
      return (store.getSnapshot().accepted?.parameters ??
        example.parameters) as unknown as Sr10Parameters;
    },
    apply(input: unknown) {
      const checked = validateSr10Parameters(input);
      if (checked.kind !== "accepted") return checked;
      const previous = (store.getSnapshot().accepted?.parameters ??
        example.parameters) as unknown as Sr10Parameters;
      const next = checked.data;

      const setup: Record<string, number | string | boolean> = {};
      const observer: Record<string, number | string | boolean> = {};
      const presentation: Record<string, number | string | boolean> = {};

      (Object.keys(next) as (keyof Sr10Parameters)[]).forEach((key) => {
        if (Object.is(next[key], previous[key])) return;
        const cls = SR10_CLASSES[key];
        if (cls === "observer") {
          observer[key] = next[key];
        } else if (cls === "presentation") {
          presentation[key] = next[key];
        } else {
          setup[key] = next[key];
        }
      });

      let request = Object.keys(setup).length ? store.issue("setup-change", setup) : null;
      if (Object.keys(observer).length) {
        request = store.issue("observer-change", observer);
      }
      if (Object.keys(presentation).length) {
        request = store.issue("presentation-change", presentation);
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
        throw new Error(`SR-10 publication refused: ${decision.reason}`);
      }

      return { kind: "accepted" as const, data: request };
    },
  });
}
