import { evaluateSr08 } from "../../physics/reference/fields.ts";
import { encodeResult } from "../results/codec.ts";
import { makeRefusal } from "../results/refusals.ts";
import type { ScientificResult } from "../results/types.ts";
import { createInstanceStore, type Parameters } from "../store/instanceStore.ts";
import { SR08_CLASSES, SR08_DEFAULTS, SR08_OUTPUTS, type Sr08Parameters } from "./definition.ts";
import { forceLedgerOutputs, SR08_FORCE_LEDGER_OUTPUTS } from "./forceLedger.ts";
import { sr08InputFromParameters, validateSr08Parameters } from "./parameters.ts";

export type PreparedSr08Example = Readonly<{
  sourceDigest: string;
  parameters: Sr08Parameters;
  results: readonly string[];
  stepIndex: number;
  simulationTime: number;
}>;

export function snapshotOutputs(p: Sr08Parameters): ScientificResult[] {
  const input = sr08InputFromParameters(p);
  const snap = evaluateSr08(input);
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
    ...forceLedgerOutputs(input, snap),
  ];
}

function computationFailure(outputs: readonly ScientificResult[]): string | null {
  for (const output of outputs) {
    if (output.status === "outside-domain") return output.reason;
    if (output.status === "value") {
      const finite =
        typeof output.value === "number"
          ? Number.isFinite(output.value)
          : output.value instanceof Float64Array && output.value.every(Number.isFinite);
      if (!finite)
        return "These settings exceed the finite numerical range. Reduce field strength, charge, or speed.";
    }
  }
  return null;
}

export const DEFAULT_PREPARED_EXAMPLE: PreparedSr08Example = Object.freeze({
  sourceDigest: "source:sha256:default-sr08",
  parameters: SR08_DEFAULTS,
  results: snapshotOutputs(SR08_DEFAULTS).map(encodeResult),
  stepIndex: 0,
  simulationTime: 0,
});

export const SR08_SESSION_OUTPUTS = Object.freeze({
  ...SR08_OUTPUTS,
  ...SR08_FORCE_LEDGER_OUTPUTS,
});

export function createSr08Session(
  instanceId = "sr08-session",
  example: PreparedSr08Example = DEFAULT_PREPARED_EXAMPLE,
) {
  const initial = validateSr08Parameters(example.parameters);
  if (initial.kind !== "accepted") throw new Error("Invalid prepared SR-08 parameters.");
  // Recompute validated inputs with the current owners. Serialized result rows
  // from an older build cannot supply a different world or omit new readings.
  const initialOutputs = snapshotOutputs(initial.data);
  const initialFailure = computationFailure(initialOutputs);
  if (initialFailure) throw new Error(`Invalid prepared SR-08 example: ${initialFailure}`);
  const store = createInstanceStore({
    experimentId: "sr-08",
    instanceId,
    initialParameters: initial.data as unknown as Parameters,
    parameterClasses: SR08_CLASSES,
    outputs: SR08_SESSION_OUTPUTS,
    allowPartial: false,
  });
  const token = store.issue("setup-change");
  const published = store.publish({
    ...token,
    stepIndex: 0,
    simulationTime: 0,
    final: true,
    outputs: initialOutputs,
  });
  if (!published.accepted)
    throw new Error(`Invalid prepared SR-08 publication: ${published.reason}`);
  const serverSnapshot = store.getSnapshot();

  return Object.freeze({
    getSnapshot: store.getSnapshot,
    getServerSnapshot: () => serverSnapshot,
    subscribe: store.subscribe,
    evaluate: evaluateSr08,
    acceptedParameters(): Sr08Parameters {
      return (store.getSnapshot().accepted?.parameters ??
        initial.data) as unknown as Sr08Parameters;
    },
    apply(input: unknown) {
      const checked = validateSr08Parameters(input);
      if (checked.kind !== "accepted") return checked;
      const next = checked.data;
      const outputs = snapshotOutputs(next);
      const failure = computationFailure(outputs);
      // Refuse BEFORE issuing a command: an invalid draft does not change
      // revisions, run identity, or the last accepted physics.
      if (failure)
        return {
          kind: "refused" as const,
          refusal: {
            ...makeRefusal("invalid-parameter", { parameterIds: ["boost", "testCharge"] }),
            message: `${failure} The last accepted calculation is unchanged.`,
          },
        };
      const acceptedSnap = store.getSnapshot().accepted;
      if (!acceptedSnap) throw new Error("SR-08 session has no accepted snapshot.");
      const previous = acceptedSnap.parameters as unknown as Sr08Parameters;
      const setup: Record<string, number | string | boolean> = {};
      const observer: Record<string, number | string | boolean> = {};
      const presentation: Record<string, number | string | boolean> = {};
      for (const key of Object.keys(next) as (keyof Sr08Parameters)[]) {
        if (Object.is(next[key], previous[key])) continue;
        const target =
          SR08_CLASSES[key] === "observer"
            ? observer
            : SR08_CLASSES[key] === "presentation"
              ? presentation
              : setup;
        target[key] = next[key];
      }
      if (![setup, observer, presentation].some((patch) => Object.keys(patch).length)) {
        const req = store.getSnapshot().requested;
        if (!req) throw new Error("SR-08 session has no requested snapshot.");
        return { kind: "accepted" as const, data: req };
      }
      let request = Object.keys(setup).length ? store.issue("setup-change", setup) : null;
      if (Object.keys(observer).length) request = store.issue("observer-change", observer);
      if (Object.keys(presentation).length)
        request = store.issue("presentation-change", presentation);
      if (!request) throw new Error("SR-08 changed parameters without a command.");
      const decision = store.publish({
        ...request,
        stepIndex: 0,
        simulationTime: 0,
        final: true,
        outputs,
      });
      if (!decision.accepted) throw new Error(`SR-08 publication refused: ${decision.reason}`);
      return { kind: "accepted" as const, data: request };
    },
  });
}
