import { evaluateMe01, type Me01Snapshot } from "../../physics/reference/massEnergy.ts";
import { encodeResult, parseResult } from "../results/codec.ts";
import type { ScientificResult } from "../results/types.ts";
import { createInstanceStore, type Parameters } from "../store/instanceStore.ts";
import { ME01_CLASSES, ME01_DEFAULTS, ME01_OUTPUTS, type Me01Parameters } from "./definition.ts";
import { validateMe01Parameters } from "./parameters.ts";

export type PreparedMe01Example = Readonly<{
  sourceDigest: string;
  parameters: Me01Parameters;
  results: readonly string[];
  stepIndex: number;
  simulationTime: number;
}>;

export function snapshotOutputs(p: Me01Parameters): ScientificResult[] {
  const snap = evaluateMe01(p);
  return [
    snap.movingBalanceLight,
    snap.restBalanceLight,
    snap.restBodyBefore,
    snap.restBodyAfter,
    snap.movingBodyBefore,
    snap.movingBodyAfter,
    snap.kineticEnergyDifference,
    snap.additiveEnergyConstant,
  ];
}

export const DEFAULT_PREPARED_EXAMPLE: PreparedMe01Example = Object.freeze({
  sourceDigest: "src/physics/reference/massEnergy.ts",
  parameters: ME01_DEFAULTS,
  results: snapshotOutputs(ME01_DEFAULTS).map(encodeResult),
  stepIndex: 0,
  simulationTime: 0,
});

export function buildMe01Snapshot(
  _instanceId: string,
  _runId: string,
  parameters: Me01Parameters,
  _inputRevision: number,
  _snapshotVersion: number,
): Me01Snapshot {
  return evaluateMe01(parameters);
}

export function createMe01Session(
  instanceId = "me01-session",
  initialParameters: Me01Parameters = ME01_DEFAULTS,
) {
  const example: PreparedMe01Example = {
    sourceDigest: "src/physics/reference/massEnergy.ts",
    parameters: initialParameters,
    results: snapshotOutputs(initialParameters).map(encodeResult),
    stepIndex: 0,
    simulationTime: 0,
  };

  const store = createInstanceStore({
    experimentId: "me-01",
    instanceId,
    initialParameters: example.parameters as unknown as Parameters,
    parameterClasses: ME01_CLASSES,
    outputs: ME01_OUTPUTS,
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

  if (!published.accepted) throw new Error("Invalid prepared ME-01 example.");
  const serverSnapshot = store.getSnapshot();

  return Object.freeze({
    getSnapshot: store.getSnapshot,
    getServerSnapshot: () => serverSnapshot,
    subscribe: store.subscribe,
    evaluate: evaluateMe01,
    acceptedParameters(): Me01Parameters {
      const accepted = store.getSnapshot().accepted;
      return (accepted?.parameters ?? initialParameters) as Me01Parameters;
    },
    apply(input: unknown) {
      const checked = validateMe01Parameters(input);
      if (checked.kind !== "accepted") return checked;
      const snap = store.getSnapshot();
      const previous = (snap.requested?.parameters ??
        snap.accepted?.parameters ??
        initialParameters) as Me01Parameters;
      const next = checked.data;

      const setup: Record<string, unknown> = {};
      const observer: Record<string, unknown> = {};
      const presentation: Record<string, unknown> = {};

      (Object.keys(next) as (keyof Me01Parameters)[]).forEach((key) => {
        if (Object.is(next[key], previous[key])) return;
        if (ME01_CLASSES[key] === "input") setup[key] = next[key];
        else if (ME01_CLASSES[key] === "observer") observer[key] = next[key];
        else presentation[key] = next[key];
      });

      let request = Object.keys(setup).length
        ? store.issue("setup-change", setup as Parameters)
        : null;
      if (Object.keys(observer).length)
        request = store.issue("observer-change", observer as Parameters);
      if (Object.keys(presentation).length)
        request = store.issue("presentation-change", presentation as Parameters);
      request ??= store.issue("continue");

      const outputs = snapshotOutputs(request.parameters as Me01Parameters);
      const decision = store.publish({
        ...request,
        stepIndex: store.getSnapshot().accepted?.stepIndex ?? 0,
        simulationTime: 0,
        final: true,
        outputs,
      });

      if (!decision.accepted) throw new Error(`ME-01 publication refused: ${decision.reason}`);
      return { kind: "accepted" as const, data: request };
    },
  });
}

export { evaluateMe01 };
