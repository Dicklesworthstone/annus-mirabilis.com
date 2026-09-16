import { BM06_OUTPUTS, BM06_PARAMETER_CLASSES, type Bm06Parameters } from "./definition.ts";
import { validateBm06Parameters } from "./parameters.ts";
import { parseResult } from "../results/codec.ts";
import { createInstanceStore, type Parameters } from "../store/instanceStore.ts";
import { createBm06Scheduler, type WorkerChannel } from "../../workers/scheduler/bm06Scheduler.ts";
import { BM06_PROTOCOL, decodeLabResponse } from "../../workers/protocol/bm06.ts";

export type PreparedBm06Example = Readonly<{
  sourceDigest: string; parameters: Bm06Parameters; results: readonly string[];
  stepIndex: number; simulationTime: number;
}>;
/** Pure construction: SSR and hydration receive the same precomputed result; no worker starts here. */
export function createBm06Session(instanceId: string, example: PreparedBm06Example, workerFactory: () => WorkerChannel) {
  const store = createInstanceStore({
    experimentId: "bm-06", instanceId, initialParameters: example.parameters,
    parameterClasses: BM06_PARAMETER_CLASSES, outputs: BM06_OUTPUTS, allowPartial: true,
  });
  const token = store.issue("setup-change");
  const response = decodeLabResponse({
    messageKind: "result", protocolVersion: BM06_PROTOCOL, sourceDigest: example.sourceDigest, token,
    result: { kind: "accepted", data: { outputs: example.results.map(parseResult), stepIndex: example.stepIndex, simulationTime: example.simulationTime } },
  }, token, example.sourceDigest);
  if (response.result.kind !== "accepted" || !store.publish({ ...token, ...response.result.data, final: true }).accepted) throw new Error("Invalid prepared laboratory example.");
  const serverSnapshot = store.getSnapshot();
  let scheduler: ReturnType<typeof createBm06Scheduler> | null = null;
  return Object.freeze({
    getSnapshot: store.getSnapshot, getServerSnapshot: () => serverSnapshot, subscribe: store.subscribe,
    apply(input: unknown) {
      const validated = validateBm06Parameters(input);
      if (validated.kind !== "accepted") return validated;
      const parameters = validated.data;
      const previous = store.getSnapshot().requested!.parameters;
      const setup: Record<string, number | boolean> = {}, measurement: Record<string, number> = {};
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
    stop() { scheduler?.cancel(); },
    /** Safe to reconnect after a StrictMode cleanup or an explicit stop. */
    disconnect() { scheduler?.dispose(); scheduler = null; },
    acceptedParameters: () => store.getSnapshot().accepted!.parameters as Parameters as Bm06Parameters,
  });
}
