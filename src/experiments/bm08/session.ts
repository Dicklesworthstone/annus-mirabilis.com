import { BM08_PROTOCOL, decodeLabHello, decodeLabResponse } from "../../workers/protocol/bm08.ts";
import { createHostScheduler, type WorkerChannel } from "../../workers/scheduler/hostScheduler.ts";
import { parseResult } from "../results/codec.ts";
import { createInstanceStore } from "../store/instanceStore.ts";
import { BM08_CLASSES, BM08_OUTPUTS, type Bm08Parameters } from "./definition.ts";
import { validateBm08Parameters } from "./parameters.ts";
export type PreparedBm08Example = Readonly<{
  sourceDigest: string;
  parameters: Bm08Parameters;
  results: readonly string[];
  stepIndex: number;
  simulationTime: number;
}>;
export function createBm08Session(
  instanceId: string,
  example: PreparedBm08Example,
  workerFactory: () => WorkerChannel,
) {
  const store = createInstanceStore({
    experimentId: "bm-08",
    instanceId,
    initialParameters: example.parameters,
    parameterClasses: BM08_CLASSES,
    outputs: BM08_OUTPUTS,
    allowPartial: true,
  });
  const token = store.issue("setup-change");
  const response = decodeLabResponse(
    {
      messageKind: "result",
      protocolVersion: BM08_PROTOCOL,
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
    throw new Error("Invalid prepared camera example.");
  const serverSnapshot = store.getSnapshot();
  let scheduler: ReturnType<typeof createHostScheduler> | null = null;
  return Object.freeze({
    getSnapshot: store.getSnapshot,
    getServerSnapshot: () => serverSnapshot,
    subscribe: store.subscribe,
    apply(input: unknown) {
      const checked = validateBm08Parameters(input);
      if (checked.kind !== "accepted") return checked;
      const previous = store.getSnapshot().requested!.parameters,
        p = checked.data;
      const groups: Record<string, Record<string, number | string | boolean>> = {
        input: {},
        measurement: {},
        estimator: {},
      };
      for (const key of Object.keys(p) as (keyof Bm08Parameters)[])
        if (!Object.is(p[key], previous[key])) groups[BM08_CLASSES[key]]![key] = p[key];
      let request = null;
      for (const [group, command] of [
        ["input", "setup-change"],
        ["measurement", "measurement-change"],
        ["estimator", "estimator-change"],
      ] as const)
        if (Object.keys(groups[group]!).length) request = store.issue(command, groups[group]!);
      request ??= store.issue("continue");
      scheduler ??= createHostScheduler(store, workerFactory, example.sourceDigest, {
        version: BM08_PROTOCOL,
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
    acceptedParameters: () => store.getSnapshot().accepted!.parameters as Bm08Parameters,
  });
}
