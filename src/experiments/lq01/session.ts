import { decodeLabResponse, LQ01_PROTOCOL } from "../../workers/protocol/lq01.ts";
import { createLq01Scheduler, type WorkerChannel } from "../../workers/scheduler/lq01Scheduler.ts";
import { parseResult } from "../results/codec.ts";
import { createInstanceStore } from "../store/instanceStore.ts";
import { LQ01_OUTPUTS, LQ01_PARAMETER_CLASSES, type Lq01Parameters } from "./definition.ts";
import { validateLq01Parameters } from "./parameters.ts";

export type PreparedLq01Example = Readonly<{
  sourceDigest: string;
  parameters: Lq01Parameters;
  results: readonly string[];
  stepIndex: number;
  simulationTime: number;
}>;

/** Pure construction: SSR and hydration receive the same precomputed result; no worker starts here. */
export function createLq01Session(
  instanceId: string,
  example: PreparedLq01Example,
  workerFactory: () => WorkerChannel = () => {
    throw new Error("Worker factory not provided for interactive session.");
  },
) {
  const store = createInstanceStore({
    experimentId: "lq-01",
    instanceId,
    initialParameters: example.parameters,
    parameterClasses: LQ01_PARAMETER_CLASSES,
    outputs: LQ01_OUTPUTS,
    allowPartial: true,
  });
  const token = store.issue("setup-change");
  const response = decodeLabResponse(
    {
      messageKind: "result",
      protocolVersion: LQ01_PROTOCOL,
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
  let scheduler: ReturnType<typeof createLq01Scheduler> | null = null;
  return Object.freeze({
    getSnapshot: store.getSnapshot,
    getServerSnapshot: () => serverSnapshot,
    subscribe: store.subscribe,
    apply(input: unknown) {
      const validated = validateLq01Parameters(input);
      if (validated.kind !== "accepted") return validated;
      const parameters = validated.data;
      const previous = store.getSnapshot().requested?.parameters ?? example.parameters;
      const setup: Record<string, number | string | boolean> = {};
      const intervention: Record<string, number | string | boolean> = {};
      for (const key of Object.keys(parameters) as (keyof Lq01Parameters)[]) {
        if (Object.is(parameters[key], previous[key])) continue;
        if (key === "delta" || key === "P" || key === "r") intervention[key] = parameters[key];
        else setup[key] = parameters[key];
      }
      let request = Object.keys(intervention).length
        ? store.issue("physical-intervention", intervention, { atSimulatedTime: 0 })
        : null;
      if (Object.keys(setup).length) request = store.issue("setup-change", setup);
      request ??= store.issue("continue");
      scheduler ??= createLq01Scheduler(store, workerFactory, example.sourceDigest);
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
      (store.getSnapshot().accepted?.parameters ?? example.parameters) as unknown as Lq01Parameters,
  });
}
