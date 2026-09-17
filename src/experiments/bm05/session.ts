import { BM05_PROTOCOL, decodeLabHello, decodeLabResponse } from "../../workers/protocol/bm05.ts";
import { createHostScheduler, type WorkerChannel } from "../../workers/scheduler/hostScheduler.ts";
import { parseResult } from "../results/codec.ts";
import { createInstanceStore, type ParameterClass } from "../store/instanceStore.ts";
import { BM05_CLASSES, BM05_OUTPUTS, type Bm05Parameters } from "./definition.ts";
import { validateBm05Parameters } from "./parameters.ts";
export type PreparedBm05Example = Readonly<{
  sourceDigest: string;
  /**
   * The function that produced this example, and the hash of its source when the
   * example was generated. ShowTheCode compares the hash against the listing's own
   * sourceHash, which a different prepare step writes from the same file (am-70h7).
   */
  snapshotFunctionName: string;
  snapshotFunctionHash: string;
  parameters: Bm05Parameters;
  results: readonly string[];
  stepIndex: number;
  simulationTime: number;
}>;
export function createBm05Session(
  instanceId: string,
  example: PreparedBm05Example,
  workerFactory: () => WorkerChannel,
) {
  const store = createInstanceStore({
    experimentId: "bm-05",
    instanceId,
    initialParameters: example.parameters,
    parameterClasses: BM05_CLASSES,
    outputs: BM05_OUTPUTS,
    allowPartial: true,
  });
  const token = store.issue("setup-change");
  const response = decodeLabResponse(
    {
      messageKind: "result",
      protocolVersion: BM05_PROTOCOL,
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
    throw new Error("Invalid prepared walk example.");
  const serverSnapshot = store.getSnapshot();
  let scheduler: ReturnType<typeof createHostScheduler> | null = null;
  return Object.freeze({
    getSnapshot: store.getSnapshot,
    getServerSnapshot: () => serverSnapshot,
    subscribe: store.subscribe,
    apply(input: unknown) {
      const checked = validateBm05Parameters(input);
      if (checked.kind !== "accepted") return checked;
      const snapshot = store.getSnapshot();
      const previous = snapshot.requested?.parameters;
      if (!previous) {
        throw new Error("Missing requested parameters in snapshot.");
      }
      const p = checked.data;
      const groups: Record<ParameterClass, Record<string, number | string>> = {
        input: {},
        observer: {},
        measurement: {},
        estimator: {},
        presentation: {},
      };
      for (const key of Object.keys(p) as (keyof Bm05Parameters)[]) {
        if (!Object.is(p[key], previous[key])) {
          const cls = BM05_CLASSES[key];
          groups[cls][key] = p[key];
        }
      }
      let request = null;
      for (const [group, command] of [
        ["input", "setup-change"],
        ["measurement", "measurement-change"],
        ["estimator", "estimator-change"],
      ] as const) {
        const payload = groups[group];
        if (Object.keys(payload).length) request = store.issue(command, payload);
      }
      request ??= store.issue("continue");
      scheduler ??= createHostScheduler(store, workerFactory, example.sourceDigest, {
        version: BM05_PROTOCOL,
        decodeHello: decodeLabHello,
        decodeResponse: decodeLabResponse,
      });
      scheduler.request(request);
      return { kind: "accepted" as const, data: request };
    },
    stop() {
      scheduler?.cancel();
    },
    disconnect() {
      scheduler?.dispose();
      scheduler = null;
    },
    acceptedParameters: () => {
      const accepted = store.getSnapshot().accepted;
      if (!accepted) {
        throw new Error("Missing accepted parameters in snapshot.");
      }
      return accepted.parameters as Bm05Parameters;
    },
  });
}
