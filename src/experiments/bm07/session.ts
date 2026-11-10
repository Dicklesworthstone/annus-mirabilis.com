import { BM07_PROTOCOL, decodeLabHello, decodeLabResponse } from "../../workers/protocol/bm07.ts";
import { createHostScheduler, type WorkerChannel } from "../../workers/scheduler/hostScheduler.ts";
import {
  createVerifiedWorkerChannel,
  type PublicationVerifier,
} from "../../workers/scheduler/verifiedChannel.ts";
import { createSchedulingPause } from "../lifecycle/schedulingPause.ts";
import { parseResult } from "../results/codec.ts";
import { executionOutcomeRegistry } from "../results/outcomes.ts";
import { createInstanceStore, type RequestToken } from "../store/instanceStore.ts";
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
  const schedulingPause = createSchedulingPause((paused) => scheduler?.setSchedulingPaused(paused));
  const verifiers = new WeakMap<RequestToken, PublicationVerifier>();
  const ownerProtocol = {
    version: BM07_PROTOCOL,
    decodeHello: decodeLabHello,
    decodeResponse: decodeLabResponse,
  };
  function apply(input: unknown, newRun = false, verify?: PublicationVerifier) {
    const checked = validateBm07Parameters(input);
    if (checked.kind !== "accepted") return checked;
    const snapshot = store.getSnapshot();
    const previous =
      snapshot.requested?.parameters ?? snapshot.accepted?.parameters ?? example.parameters;
    const p = checked.data;
    const groups: Record<string, Record<string, number | string | boolean>> = {
      input: {},
      measurement: {},
      estimator: {},
    };
    for (const key of Object.keys(p) as (keyof Bm07Parameters)[]) {
      const cls = BM07_CLASSES[key];
      const targetGroup = groups[cls];
      if (targetGroup && ((newRun && cls === "input") || !Object.is(p[key], previous[key]))) {
        targetGroup[key] = p[key];
      }
    }
    const superseded = () => ({
      kind: "outcome" as const,
      outcome: { outcome: "superseded" as const, ...executionOutcomeRegistry.superseded },
    });
    let request = newRun ? store.issue("setup-change", groups.input) : null;
    if (request && store.getSnapshot().requested !== request) return superseded();
    for (const [group, command] of [
      ["input", "setup-change"],
      ["measurement", "measurement-change"],
      ["estimator", "estimator-change"],
    ] as const) {
      if (newRun && group === "input") continue;
      const groupObj = groups[group];
      if (groupObj && Object.keys(groupObj).length) {
        request = store.issue(command, groupObj);
        // A subscriber can supersede this request while issue notifies it. Never attach the
        // remaining estimator controls to that newer request or publish the stale outer trial.
        if (store.getSnapshot().requested !== request) return superseded();
      }
    }
    request ??= store.issue("continue");
    if (store.getSnapshot().requested !== request) return superseded();
    if (verify) verifiers.set(request, verify);
    scheduler ??= createHostScheduler(
      store,
      () =>
        createVerifiedWorkerChannel(workerFactory(), ownerProtocol, example.sourceDigest, (token) =>
          verifiers.get(token),
        ),
      example.sourceDigest,
      {
        ...ownerProtocol,
        decodeResponse(message, token, digest) {
          const response = decodeLabResponse(message, token, digest);
          if (response.result.kind !== "accepted") return response;
          const { outputs, stepIndex, simulationTime } = response.result.data;
          // Verification consumes transport metadata before the store publishes its declared
          // scientific outputs. A failed checksum leaves the prior accepted snapshot readable.
          return {
            ...response,
            result: { kind: "accepted", data: { outputs, stepIndex, simulationTime } },
          };
        },
      },
    );
    scheduler.setSchedulingPaused(schedulingPause.getSchedulingPaused());
    scheduler.request(request);
    return { kind: "accepted" as const, data: request };
  }
  return Object.freeze({
    getSnapshot: store.getSnapshot,
    getServerSnapshot: () => serverSnapshot,
    subscribe: store.subscribe,
    apply: (input: unknown) => apply(input),
    applyVerified: (input: unknown, verify: PublicationVerifier) => apply(input, false, verify),
    startNewRun: (input: unknown) => apply(input, true),
    ...schedulingPause,
    stop() {
      scheduler?.cancel();
    },
    disconnect() {
      scheduler?.dispose();
      scheduler = null;
    },
    acceptedParameters: () =>
      (store.getSnapshot().accepted?.parameters ?? example.parameters) as Bm07Parameters,
  });
}
