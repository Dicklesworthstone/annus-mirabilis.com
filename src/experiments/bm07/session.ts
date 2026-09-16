import { BM07_PROTOCOL, decodeLabHello, decodeLabResponse } from "../../workers/protocol/bm07.ts";
import { createHostScheduler, type WorkerChannel } from "../../workers/scheduler/hostScheduler.ts";
import { parseResult } from "../results/codec.ts";
import { createInstanceStore } from "../store/instanceStore.ts";
import { BM07_CLASSES, BM07_OUTPUTS, type Bm07Parameters } from "./definition.ts";
import { validateBm07Parameters } from "./parameters.ts";
export type PreparedBm07Example = Readonly<{
  sourceDigest: string;
  parameters: Bm07Parameters;
  results: readonly string[];
  stepIndex: number;
  simulationTime: number;
}>;
export function createBm07Session(
  instanceId: string,
  example: PreparedBm07Example,
  workerFactory: () => WorkerChannel,
) {
  const store = createInstanceStore({
    experimentId: "bm-07",
    instanceId,
    initialParameters: example.parameters,
    parameterClasses: BM07_CLASSES,
    outputs: BM07_OUTPUTS,
    allowPartial: true,
  });
  const token = store.issue("setup-change");
  const response = decodeLabResponse(
    {
      messageKind: "result",
      protocolVersion: BM07_PROTOCOL,
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
    throw new Error("Invalid prepared inference example.");
  const serverSnapshot = store.getSnapshot();
  let scheduler: ReturnType<typeof createHostScheduler> | null = null;
  return Object.freeze({
    getSnapshot: store.getSnapshot,
    getServerSnapshot: () => serverSnapshot,
    subscribe: store.subscribe,
    apply(input: unknown) {
      const checked = validateBm07Parameters(input);
      if (checked.kind !== "accepted") return checked;
      const previous = store.getSnapshot().requested!.parameters,
        p = checked.data;
      const groups: Record<string, Record<string, number | string | boolean>> = {
        input: {},
        measurement: {},
        estimator: {},
      };
      for (const key of Object.keys(p) as (keyof Bm07Parameters)[])
        if (!Object.is(p[key], previous[key])) groups[BM07_CLASSES[key]]![key] = p[key];
      let request = null;
      for (const [group, command] of [
        ["input", "setup-change"],
        ["measurement", "measurement-change"],
        ["estimator", "estimator-change"],
      ] as const)
        if (Object.keys(groups[group]!).length) request = store.issue(command, groups[group]!);
      request ??= store.issue("continue");
      scheduler ??= createHostScheduler(store, workerFactory, example.sourceDigest, {
        version: BM07_PROTOCOL,
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
    acceptedParameters: () => store.getSnapshot().accepted!.parameters as Bm07Parameters,
  });
}
