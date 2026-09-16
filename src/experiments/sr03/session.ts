import { decodeLabResponse, SR03_PROTOCOL } from "../../workers/protocol/sr03.ts";
import { createSr03Scheduler, type WorkerChannel } from "../../workers/scheduler/sr03Scheduler.ts";
import { parseResult } from "../results/codec.ts";
import { createInstanceStore, type Parameters } from "../store/instanceStore.ts";
import { SR03_OUTPUTS, SR03_PARAMETER_CLASSES, type Sr03Parameters } from "./definition.ts";
import { validateSr03Parameters } from "./parameters.ts";

export type PreparedSr03Example = Readonly<{
  sourceDigest: string;
  parameters: Sr03Parameters;
  results: readonly string[];
  stepIndex: number;
  simulationTime: number;
}>;

export function createSr03Session(
  instanceId: string,
  example: PreparedSr03Example,
  workerFactory: () => WorkerChannel = () => {
    throw new Error("Worker factory not provided for interactive session.");
  },
) {
  const store = createInstanceStore({
    experimentId: "sr-03",
    instanceId,
    initialParameters: example.parameters as unknown as Parameters,
    parameterClasses: SR03_PARAMETER_CLASSES,
    outputs: SR03_OUTPUTS,
    allowPartial: true,
  });
  const token = store.issue("setup-change");
  const response = decodeLabResponse(
    {
      messageKind: "result",
      protocolVersion: SR03_PROTOCOL,
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
  let scheduler: ReturnType<typeof createSr03Scheduler> | null = null;
  return Object.freeze({
    getSnapshot: store.getSnapshot,
    getServerSnapshot: () => serverSnapshot,
    subscribe: store.subscribe,
    apply(input: unknown) {
      const validated = validateSr03Parameters(input);
      if (validated.kind !== "accepted") return validated;
      const parameters = validated.data;
      const previous = store.getSnapshot().requested?.parameters ?? example.parameters;
      const setup: Record<string, number | string | boolean> = {};
      const observer: Record<string, number | string | boolean> = {};
      const measurement: Record<string, number | string | boolean> = {};

      for (const key of Object.keys(parameters) as (keyof Sr03Parameters)[]) {
        if (Object.is(parameters[key], previous[key])) continue;
        const val = parameters[key];
        if (val === undefined) continue;
        const cls = SR03_PARAMETER_CLASSES[key];
        if (cls === "observer") observer[key] = val;
        else if (cls === "measurement") measurement[key] = val;
        else setup[key] = val;
      }

      let request = Object.keys(measurement).length
        ? store.issue("measurement-change", measurement)
        : null;
      if (Object.keys(observer).length) request = store.issue("observer-change", observer);
      if (Object.keys(setup).length) request = store.issue("setup-change", setup);
      request ??= store.issue("continue");

      scheduler ??= createSr03Scheduler(store, workerFactory, example.sourceDigest);
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
    acceptedParameters: () =>
      (store.getSnapshot().accepted?.parameters ?? example.parameters) as unknown as Sr03Parameters,
  });
}
