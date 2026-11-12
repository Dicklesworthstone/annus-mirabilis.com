import { BM08_PROTOCOL, decodeLabHello, decodeLabResponse } from "../../workers/protocol/bm08.ts";
import { createHostScheduler, type WorkerChannel } from "../../workers/scheduler/hostScheduler.ts";
import {
  createVerifiedWorkerChannel,
  type PublicationVerifier,
  type VerifiablePublication,
} from "../../workers/scheduler/verifiedChannel.ts";
import { createSchedulingPause } from "../lifecycle/schedulingPause.ts";
import { parseResult } from "../results/codec.ts";
import { executionOutcomeRegistry } from "../results/outcomes.ts";
import {
  type Command,
  createInstanceStore,
  type ParameterClass,
  type RequestToken,
} from "../store/instanceStore.ts";
import { BM08_CLASSES, BM08_OUTPUTS, type Bm08Parameters } from "./definition.ts";
import { validateBm08Parameters } from "./parameters.ts";
import type { Bm08RecordingCheckpoint } from "./recordingCheckpoint.ts";
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
  // Keep the validated recording receipt, not a second copy of the worker's output buffers.
  // The prepared example deliberately has no receipt: it cannot become a personal recording.
  let recordingReceipt: Readonly<{
    token: RequestToken;
    stepIndex: number;
    simulationTime: number;
    recordingCheckpoint: Bm08RecordingCheckpoint;
  }> | null = null;
  let scheduler: ReturnType<typeof createHostScheduler> | null = null;
  const schedulingPause = createSchedulingPause((paused) => scheduler?.setSchedulingPaused(paused));
  const verifiers = new WeakMap<RequestToken, PublicationVerifier>();
  const ownerProtocol = {
    version: BM08_PROTOCOL,
    decodeHello: decodeLabHello,
    decodeResponse: decodeLabResponse,
  };
  function apply(input: unknown, newRun = false, verify?: PublicationVerifier) {
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
      if ((newRun && BM08_CLASSES[key] === "input") || !Object.is(p[key], previous[key])) {
        const cls = BM08_CLASSES[key];
        groups[cls][key] = p[key];
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
      const payload = groups[group];
      if (Object.keys(payload).length) {
        request = store.issue(command, payload);
        if (store.getSnapshot().requested !== request) return superseded();
      }
    }
    request ??= store.issue("continue");
    if (store.getSnapshot().requested !== request) return superseded();
    if (verify) verifiers.set(request, verify);
    if (workerFactory) {
      scheduler ??= createHostScheduler(
        store,
        () =>
          createVerifiedWorkerChannel(
            workerFactory(),
            ownerProtocol,
            example.sourceDigest,
            (token) => verifiers.get(token),
          ),
        example.sourceDigest,
        {
          ...ownerProtocol,
          decodeResponse(message, token, digest) {
            const response = decodeLabResponse(message, token, digest);
            if (response.result.kind !== "accepted") return response;
            const { outputs, stepIndex, simulationTime, recordingCheckpoint } =
              response.result.data;
            // The protocol has validated this receipt against the exact worker request. The
            // store still decides whether to accept the result; exposure below checks that too.
            recordingReceipt = recordingCheckpoint
              ? {
                  token,
                  stepIndex,
                  simulationTime,
                  recordingCheckpoint: { ...recordingCheckpoint },
                }
              : null;
            return {
              ...response,
              result: { kind: "accepted", data: { outputs, stepIndex, simulationTime } },
            };
          },
        },
      );
      scheduler.setSchedulingPaused(schedulingPause.getSchedulingPaused());
      scheduler.request(request);
    }
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
    acceptedParameters: () => {
      const accepted = store.getSnapshot().accepted;
      if (!accepted) {
        throw new Error("Missing accepted parameters in snapshot.");
      }
      return accepted.parameters as Bm08Parameters;
    },
    acceptedPublication(): VerifiablePublication | null {
      const view = store.getSnapshot();
      const accepted = view.accepted;
      const receipt = recordingReceipt;
      if (
        !accepted ||
        !receipt ||
        view.status !== "accepted" ||
        view.pending ||
        !accepted.final ||
        accepted.parameters.coverageTrials !== 0 ||
        view.requested !== receipt.token
      )
        return null;
      const request = receipt.token;
      if (
        accepted.experimentId !== request.experimentId ||
        accepted.instanceId !== request.instanceId ||
        accepted.runId !== request.runId ||
        accepted.parentRunId !== request.parentRunId ||
        accepted.actionIndex !== request.actionIndex ||
        accepted.stepIndex !== receipt.stepIndex ||
        accepted.simulationTime !== receipt.simulationTime ||
        Object.entries(request.revisions).some(
          ([key, value]) => accepted.revisions[key as keyof typeof request.revisions] !== value,
        ) ||
        Object.keys(accepted.parameters).length !== Object.keys(request.parameters).length ||
        Object.entries(request.parameters).some(
          ([key, value]) => !Object.is(accepted.parameters[key], value),
        )
      )
        return null;
      const quantities = new Set(accepted.outputs.map((output) => output.quantityId));
      if (Object.keys(BM08_OUTPUTS).some((id) => !quantities.has(id))) return null;
      return {
        ...request,
        parameters: { ...accepted.parameters },
        revisions: { ...accepted.revisions },
        stepIndex: accepted.stepIndex,
        simulationTime: accepted.simulationTime,
        final: true,
        outputs: accepted.outputs.map((output) => {
          if (output.status !== "value") return structuredClone(output);
          return structuredClone({
            ...output,
            value: typeof output.value === "number" ? output.value : output.value.copy(),
          });
        }),
        recordingCheckpoint: { ...receipt.recordingCheckpoint },
      };
    },
  });
}
