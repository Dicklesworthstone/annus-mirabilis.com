import { BM06_PROTOCOL, decodeLabResponse } from "../../workers/protocol/bm06.ts";
import { createBm06Scheduler, type WorkerChannel } from "../../workers/scheduler/bm06Scheduler.ts";
import { parseResult } from "../results/codec.ts";
import { createInstanceStore, type Parameters } from "../store/instanceStore.ts";
import { BM06_OUTPUTS, BM06_PARAMETER_CLASSES, type Bm06Parameters } from "./definition.ts";
import { validateBm06Parameters } from "./parameters.ts";

export type PreparedBm06Example = Readonly<{
  sourceDigest: string;
  /**
   * The function that produced this example, and the hash of its source when the
   * example was generated. ShowTheCode compares the hash against the listing's own
   * sourceHash, which a different prepare step writes from the same file (am-70h7).
   */
  snapshotFunctionName: string;
  snapshotFunctionHash: string;
  parameters: Bm06Parameters;
  results: readonly string[];
  stepIndex: number;
  simulationTime: number;
}>;
/** Pure construction: SSR and hydration receive the same precomputed result; no worker starts here. */
export function createBm06Session(
  instanceId: string,
  example: PreparedBm06Example,
  workerFactory: () => WorkerChannel,
) {
  const store = createInstanceStore({
    experimentId: "bm-06",
    instanceId,
    initialParameters: example.parameters,
    parameterClasses: BM06_PARAMETER_CLASSES,
    outputs: BM06_OUTPUTS,
    allowPartial: true,
  });
  const token = store.issue("setup-change");
  const response = decodeLabResponse(
    {
      messageKind: "result",
      protocolVersion: BM06_PROTOCOL,
      sourceDigest: example.sourceDigest,
      token,
      result: {
        kind: "accepted",
        data: {
          outputs: example.results.map(parseResult),
          stepIndex: example.stepIndex,
          simulationTime: example.simulationTime,
        },
      },
    },
    token,
    example.sourceDigest,
  );
  if (
    response.result.kind !== "accepted" ||
    !store.publish({ ...token, ...response.result.data, final: true }).accepted
  )
    throw new Error("Invalid prepared laboratory example.");
  const serverSnapshot = store.getSnapshot();
  let scheduler: ReturnType<typeof createBm06Scheduler> | null = null;
  return Object.freeze({
    getSnapshot: store.getSnapshot,
    getServerSnapshot: () => serverSnapshot,
    subscribe: store.subscribe,
    apply(input: unknown) {
      const validated = validateBm06Parameters(input);
      if (validated.kind !== "accepted") return validated;
      const parameters = validated.data;
      const snapshot = store.getSnapshot();
      const previous =
        snapshot.requested?.parameters ?? snapshot.accepted?.parameters ?? example.parameters;
      const setup: Record<string, number | boolean | string> = {},
        measurement: Record<string, number> = {};
      for (const key of Object.keys(parameters) as (keyof Bm06Parameters)[]) {
        if (Object.is(parameters[key], previous[key])) continue;
        if (key === "lower" || key === "upper") measurement[key] = parameters[key];
        else setup[key] = parameters[key];
      }
      let request = Object.keys(setup).length ? store.issue("setup-change", setup) : null;
      if (Object.keys(measurement).length) request = store.issue("measurement-change", measurement);
      request ??= store.issue("continue");
      scheduler ??= createBm06Scheduler(store, workerFactory, example.sourceDigest);
      scheduler.request(request);
      return { kind: "accepted" as const, data: request };
    },
    /** A one-time value copy from a named BM-01 instance's accepted snapshot: `source` is read
     * once, spread into an ordinary setup-change patch, and never retained or subscribed to, so
     * a later change to the source instance cannot reach back into this parameter set. */
    copyDiffusivityFrom(
      source: Readonly<{
        instanceId: string;
        runId: string;
        snapshotVersion: number;
        value: number;
      }>,
    ) {
      const current = (store.getSnapshot().accepted?.parameters ??
        example.parameters) as Parameters as Bm06Parameters;
      return this.apply({
        ...current,
        copiedDiffusivityInstanceId: source.instanceId,
        copiedDiffusivityRunId: source.runId,
        copiedDiffusivitySnapshotVersion: source.snapshotVersion,
        copiedDiffusivityValue: source.value,
      });
    },
    stop() {
      scheduler?.cancel();
    },
    /** Safe to reconnect after a StrictMode cleanup or an explicit stop. */
    disconnect() {
      scheduler?.dispose();
      scheduler = null;
    },
    acceptedParameters: () =>
      (store.getSnapshot().accepted?.parameters ??
        example.parameters) as Parameters as Bm06Parameters,
  });
}
