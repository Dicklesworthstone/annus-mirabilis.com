import { BM04_PROTOCOL, decodeLabResponse } from "../../workers/protocol/bm04.ts";
import { createBm04Scheduler, type WorkerChannel } from "../../workers/scheduler/bm04Scheduler.ts";
import { parseResult } from "../results/codec.ts";
import { createInstanceStore } from "../store/instanceStore.ts";
import { BM04_OUTPUTS, BM04_PARAMETER_CLASSES, type Bm04Parameters } from "./definition.ts";
import { validateBm04Parameters } from "./parameters.ts";

export type PreparedBm04Example = Readonly<{
  sourceDigest: string;
  parameters: Bm04Parameters;
  results: readonly string[];
  stepIndex: number;
  simulationTime: number;
}>;

/** Pure construction: SSR and hydration receive the same precomputed result; no worker starts here. */
export function createBm04Session(
  instanceId: string,
  example: PreparedBm04Example,
  workerFactory: () => WorkerChannel,
) {
  const store = createInstanceStore({
    experimentId: "bm-04",
    instanceId,
    initialParameters: example.parameters,
    parameterClasses: BM04_PARAMETER_CLASSES,
    outputs: BM04_OUTPUTS,
    allowPartial: true,
  });
  const token = store.issue("setup-change");
  const response = decodeLabResponse(
    {
      messageKind: "result",
      protocolVersion: BM04_PROTOCOL,
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
  ) {
    throw new Error("Invalid prepared laboratory example.");
  }
  const serverSnapshot = store.getSnapshot();
  let scheduler: ReturnType<typeof createBm04Scheduler> | null = null;
  return Object.freeze({
    getSnapshot: store.getSnapshot,
    getServerSnapshot: () => serverSnapshot,
    subscribe: store.subscribe,
    apply(input: unknown) {
      const validated = validateBm04Parameters(input);
      if (validated.kind !== "accepted") return validated;
      const parameters = validated.data;
      const previous = store.getSnapshot().requested?.parameters ?? example.parameters;
      const setup: Record<string, number | string | boolean> = {};
      const intervention: Record<string, number | string | boolean> = {};
      for (const key of Object.keys(parameters) as (keyof Bm04Parameters)[]) {
        if (Object.is(parameters[key], previous[key])) continue;
        if (key === "F") intervention[key] = parameters[key];
        else setup[key] = parameters[key];
      }
      let request = Object.keys(intervention).length
        ? store.issue("physical-intervention", intervention, { atSimulatedTime: 0 })
        : null;
      if (Object.keys(setup).length) request = store.issue("setup-change", setup);
      request ??= store.issue("continue");
      scheduler ??= createBm04Scheduler(store, workerFactory, example.sourceDigest);
      scheduler.request(request);
      return { kind: "accepted" as const, data: request };
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
      (store.getSnapshot().accepted?.parameters ?? example.parameters) as unknown as Bm04Parameters,
  });
}
