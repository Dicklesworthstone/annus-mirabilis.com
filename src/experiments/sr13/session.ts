import { evaluateSr13, type Sr13Input } from "../../physics/reference/electron.ts";
import { encodeResult, parseResult } from "../results/codec.ts";
import type { ScientificResult } from "../results/types.ts";
import { createInstanceStore, type Parameters } from "../store/instanceStore.ts";
import { SR13_CLASSES, SR13_DEFAULTS, SR13_OUTPUTS, type Sr13Parameters } from "./definition.ts";
import { validateSr13Parameters } from "./parameters.ts";

export type PreparedSr13Example = Readonly<{
  sourceDigest: string;
  parameters: Sr13Parameters;
  results: readonly string[];
  stepIndex: number;
  simulationTime: number;
}>;

export function sr13InputFromParameters(p: Sr13Parameters): Sr13Input {
  return {
    electricFieldX: p.electricFieldX,
    electricFieldY: p.electricFieldY,
    electricFieldZ: p.electricFieldZ,
    magneticFieldX: p.magneticFieldX,
    magneticFieldY: p.magneticFieldY,
    magneticFieldZ: p.magneticFieldZ,
    initialSpeed: p.initialSpeed,
    initialDirectionDeg: p.initialDirectionDeg,
    integrationInterval: p.integrationInterval,
    forceConvention: p.forceConvention,
    massLanguage: p.massLanguage,
    particle: p.particle,
    customCharge: p.customCharge,
    customMass: p.customMass,
    datasetOverlay: p.datasetOverlay,
  };
}

export function snapshotOutputs(p: Sr13Parameters): ScientificResult[] {
  const record = evaluateSr13(sr13InputFromParameters(p));
  return Object.values(record);
}

export const DEFAULT_PREPARED_EXAMPLE: PreparedSr13Example = Object.freeze({
  sourceDigest: "source:sha256:default-sr13",
  parameters: SR13_DEFAULTS,
  results: snapshotOutputs(SR13_DEFAULTS).map(encodeResult),
  stepIndex: 0,
  simulationTime: 0,
});

export function createSr13Session(
  instanceId = "sr13-session",
  example: PreparedSr13Example = DEFAULT_PREPARED_EXAMPLE,
) {
  const store = createInstanceStore({
    experimentId: "sr-13",
    instanceId,
    initialParameters: example.parameters as unknown as Parameters,
    parameterClasses: SR13_CLASSES,
    outputs: SR13_OUTPUTS,
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
    throw new Error(`Invalid prepared SR-13 example: ${published.reason}`);
  }

  const serverSnapshot = store.getSnapshot();

  return Object.freeze({
    getSnapshot: store.getSnapshot,
    getServerSnapshot: () => serverSnapshot,
    subscribe: store.subscribe,
    evaluate: evaluateSr13,
    acceptedParameters(): Sr13Parameters {
      return (store.getSnapshot().accepted?.parameters ??
        example.parameters) as unknown as Sr13Parameters;
    },
    apply(input: unknown) {
      const checked = validateSr13Parameters(input);
      if (checked.kind !== "accepted") return checked;
      const previous = (store.getSnapshot().accepted?.parameters ??
        example.parameters) as unknown as Sr13Parameters;
      const next = checked.data;

      const setup: Record<string, number | string | boolean> = {};
      const observer: Record<string, number | string | boolean> = {};
      const presentation: Record<string, number | string | boolean> = {};

      (Object.keys(next) as (keyof Sr13Parameters)[]).forEach((key) => {
        if (Object.is(next[key], previous[key])) return;
        const cls = SR13_CLASSES[key];
        if (cls === "observer") {
          observer[key] = next[key] as number | string | boolean;
        } else if (cls === "presentation") {
          presentation[key] = next[key] as number | string | boolean;
        } else {
          setup[key] = next[key] as number | string | boolean;
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
        throw new Error(`SR-13 publication refused: ${decision.reason}`);
      }

      return { kind: "accepted" as const, data: request };
    },
  });
}
