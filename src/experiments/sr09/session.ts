import { evaluateSr09 } from "../../physics/reference/waves.ts";
import { encodeResult, parseResult } from "../results/codec.ts";
import { refuseNonFiniteValues } from "../results/numberRange.ts";
import type { ScientificResult } from "../results/types.ts";
import { createInstanceStore, type Parameters } from "../store/instanceStore.ts";
import { SR09_CLASSES, SR09_DEFAULTS, SR09_OUTPUTS, type Sr09Parameters } from "./definition.ts";
import { sr09InputFromParameters, validateSr09Parameters } from "./parameters.ts";

export type PreparedSr09Example = Readonly<{
  sourceDigest: string;
  parameters: Sr09Parameters;
  results: readonly string[];
  stepIndex: number;
  simulationTime: number;
}>;

export function snapshotOutputs(p: Sr09Parameters): ScientificResult[] {
  const snap = evaluateSr09(sr09InputFromParameters(p));
  // A frequency past about 10^296 THz is infinite in hertz; say so per output instead of letting the
  // store refuse the whole publication, which no caller catches (see numberRange.ts).
  return refuseNonFiniteValues(snap.results, [
    { parameterId: "frequencyTHz", value: p.frequencyTHz, admissible: SR09_DEFAULTS.frequencyTHz },
    {
      parameterId: "countingWindowCycles",
      value: p.countingWindowCycles,
      admissible: SR09_DEFAULTS.countingWindowCycles,
    },
  ]);
}

export const DEFAULT_PREPARED_EXAMPLE: PreparedSr09Example = Object.freeze({
  sourceDigest: "source:sha256:default-sr09",
  parameters: SR09_DEFAULTS,
  results: snapshotOutputs(SR09_DEFAULTS).map(encodeResult),
  stepIndex: 0,
  simulationTime: 0,
});

export function createSr09Session(
  instanceId = "sr09-session",
  example: PreparedSr09Example = DEFAULT_PREPARED_EXAMPLE,
) {
  const store = createInstanceStore({
    experimentId: "sr-09",
    instanceId,
    initialParameters: example.parameters as unknown as Parameters,
    parameterClasses: SR09_CLASSES,
    outputs: SR09_OUTPUTS,
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
    throw new Error(`Invalid prepared SR-09 example: ${published.reason}`);
  }

  const serverSnapshot = store.getSnapshot();

  return Object.freeze({
    getSnapshot: store.getSnapshot,
    getServerSnapshot: () => serverSnapshot,
    subscribe: store.subscribe,
    evaluate: evaluateSr09,
    acceptedParameters(): Sr09Parameters {
      return (store.getSnapshot().accepted?.parameters ??
        example.parameters) as unknown as Sr09Parameters;
    },
    apply(input: unknown) {
      const checked = validateSr09Parameters(input);
      if (checked.kind !== "accepted") return checked;
      const previous = (store.getSnapshot().accepted?.parameters ??
        example.parameters) as unknown as Sr09Parameters;
      const next = checked.data;

      const setup: Record<string, number | string | boolean> = {};
      const observer: Record<string, number | string | boolean> = {};
      const presentation: Record<string, number | string | boolean> = {};

      (Object.keys(next) as (keyof Sr09Parameters)[]).forEach((key) => {
        if (Object.is(next[key], previous[key])) return;
        const cls = SR09_CLASSES[key];
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
        throw new Error(`SR-09 publication refused: ${decision.reason}`);
      }

      return { kind: "accepted" as const, data: request };
    },
  });
}
