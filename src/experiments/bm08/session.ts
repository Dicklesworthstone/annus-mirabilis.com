import { BM08_PROTOCOL, decodeLabHello, decodeLabResponse } from "../../workers/protocol/bm08.ts";
import { createHostScheduler, type WorkerChannel } from "../../workers/scheduler/hostScheduler.ts";
import { parseResult } from "../results/codec.ts";
import { type Command, createInstanceStore, type ParameterClass } from "../store/instanceStore.ts";
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
  workerFactory?: () => WorkerChannel,
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
      const snap = store.getSnapshot();
      const previous = (snap.requested?.parameters ??
        snap.accepted?.parameters ??
        example.parameters) as Bm08Parameters;
      const merged =
        typeof input === "object" && input !== null
          ? { ...previous, ...(input as Record<string, unknown>) }
          : input;
      const checked = validateBm08Parameters(merged);
      if (checked.kind !== "accepted") {
        if (checked.kind === "refused") {
          let command: Command = "measurement-change";
          const payload: Record<string, number | string | boolean> = {};
          if (typeof merged === "object" && merged !== null) {
            const patch = merged as Record<string, unknown>;
            const hasInput = Object.keys(patch).some(
              (k) =>
                BM08_CLASSES[k as keyof Bm08Parameters] === "input" &&
                !Object.is(patch[k], previous[k as keyof Bm08Parameters]),
            );
            const hasMeasurement = Object.keys(patch).some(
              (k) =>
                BM08_CLASSES[k as keyof Bm08Parameters] === "measurement" &&
                !Object.is(patch[k], previous[k as keyof Bm08Parameters]),
            );
            const hasEstimator = Object.keys(patch).some(
              (k) =>
                BM08_CLASSES[k as keyof Bm08Parameters] === "estimator" &&
                !Object.is(patch[k], previous[k as keyof Bm08Parameters]),
            );

            if (hasInput) command = "setup-change";
            else if (hasMeasurement) command = "measurement-change";
            else if (hasEstimator) command = "estimator-change";

            const targetClass =
              command === "setup-change"
                ? "input"
                : command === "measurement-change"
                  ? "measurement"
                  : "estimator";
            for (const [k, v] of Object.entries(patch)) {
              if (BM08_CLASSES[k as keyof Bm08Parameters] === targetClass) {
                if (
                  typeof v === "string" ||
                  typeof v === "boolean" ||
                  (typeof v === "number" && Number.isFinite(v))
                ) {
                  payload[k] = v;
                }
              }
            }
          }
          const token = store.issue(command, payload);
          store.refuse(token, checked.refusal);
        }
        return checked;
      }
      const p = checked.data;
      const groups: Record<ParameterClass, Record<string, number | string | boolean>> = {
        input: {},
        observer: {},
        measurement: {},
        estimator: {},
        presentation: {},
      };
      for (const key of Object.keys(p) as (keyof Bm08Parameters)[]) {
        if (!Object.is(p[key], previous[key])) {
          const cls = BM08_CLASSES[key];
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
      if (workerFactory) {
        scheduler ??= createHostScheduler(store, workerFactory, example.sourceDigest, {
          version: BM08_PROTOCOL,
          decodeHello: decodeLabHello,
          decodeResponse: decodeLabResponse,
        });
        scheduler.request(request);
      }
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
      return accepted.parameters as Bm08Parameters;
    },
  });
}
