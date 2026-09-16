import {
  type EnergySourceCard,
  type EnergySourceCardBoundary,
  evaluateMe03,
  type Me03Snapshot,
} from "../../physics/reference/massEnergy.ts";
import { encodeResult, parseResult } from "../results/codec.ts";
import type { ScientificResult } from "../results/types.ts";
import { createInstanceStore, type Parameters } from "../store/instanceStore.ts";
import { ME03_CLASSES, ME03_DEFAULTS, ME03_OUTPUTS, type Me03Parameters } from "./definition.ts";
import { validateMe03Parameters } from "./parameters.ts";

export type { EnergySourceCard, EnergySourceCardBoundary, Me03Snapshot };
export type Me03Evaluation = Me03Snapshot;

export type PreparedMe03Example = Readonly<{
  sourceDigest: string;
  parameters: Me03Parameters;
  results: readonly string[];
  stepIndex: number;
  simulationTime: number;
}>;

export function snapshotOutputs(p: Me03Parameters): ScientificResult[] {
  const snap = evaluateMe03(p);
  return [
    snap.energyChange,
    snap.massChange,
    snap.radiationEnergyChange,
    snap.radiationMassChange,
    snap.systemEnergyChange,
    snap.systemMassChange,
    snap.invariantMass,
  ];
}

export const DEFAULT_PREPARED_EXAMPLE: PreparedMe03Example = Object.freeze({
  sourceDigest: "src/physics/reference/massEnergy.ts",
  parameters: ME03_DEFAULTS,
  results: snapshotOutputs(ME03_DEFAULTS).map(encodeResult),
  stepIndex: 0,
  simulationTime: 0,
});

export function buildMe03Snapshot(
  _instanceId: string,
  _runId: string,
  parameters: Me03Parameters,
  _inputRevision: number,
  _snapshotVersion: number,
): Me03Snapshot {
  return evaluateMe03(parameters);
}

export function createMe03Session(
  instanceId = "me03-session",
  initialParameters: Me03Parameters = ME03_DEFAULTS,
) {
  const example: PreparedMe03Example = {
    sourceDigest: "src/physics/reference/massEnergy.ts",
    parameters: initialParameters,
    results: snapshotOutputs(initialParameters).map(encodeResult),
    stepIndex: 0,
    simulationTime: 0,
  };

  const store = createInstanceStore({
    experimentId: "me-03",
    instanceId,
    initialParameters: example.parameters as unknown as Parameters,
    parameterClasses: ME03_CLASSES,
    outputs: ME03_OUTPUTS,
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

  if (!published.accepted) throw new Error("Invalid prepared ME-03 example.");
  const serverSnapshot = store.getSnapshot();

  return Object.freeze({
    getSnapshot: store.getSnapshot,
    getServerSnapshot: () => serverSnapshot,
    subscribe: store.subscribe,
    evaluate: evaluateMe03,
    acceptedParameters(): Me03Parameters {
      const accepted = store.getSnapshot().accepted;
      return (accepted?.parameters ?? initialParameters) as Me03Parameters;
    },
    apply(input: unknown) {
      const checked = validateMe03Parameters(input);
      if (checked.kind !== "accepted") return checked;
      const snap = store.getSnapshot();
      const previous = (snap.requested?.parameters ??
        snap.accepted?.parameters ??
        initialParameters) as Me03Parameters;
      const next = checked.data;

      const setup: Record<string, unknown> = {};
      const measurement: Record<string, unknown> = {};
      const presentation: Record<string, unknown> = {};

      (Object.keys(next) as (keyof Me03Parameters)[]).forEach((key) => {
        if (Object.is(next[key], previous[key])) return;
        if (ME03_CLASSES[key] === "input") setup[key] = next[key];
        else if (ME03_CLASSES[key] === "measurement") measurement[key] = next[key];
        else presentation[key] = next[key];
      });

      let request = Object.keys(setup).length
        ? store.issue("setup-change", setup as Parameters)
        : null;
      if (Object.keys(measurement).length)
        request = store.issue("measurement-change", measurement as Parameters);
      if (Object.keys(presentation).length)
        request = store.issue("presentation-change", presentation as Parameters);
      request ??= store.issue("continue");

      const outputs = snapshotOutputs(request.parameters as Me03Parameters);
      const decision = store.publish({
        ...request,
        stepIndex: store.getSnapshot().accepted?.stepIndex ?? 0,
        simulationTime: 0,
        final: true,
        outputs,
      });

      if (!decision.accepted) throw new Error(`ME-03 publication refused: ${decision.reason}`);
      return { kind: "accepted" as const, data: request };
    },
  });
}

export { evaluateMe03 };
