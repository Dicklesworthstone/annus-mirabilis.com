import { BM01_PROTOCOL, decodeLabHello, decodeLabResponse } from "../../workers/protocol/bm01.ts";
import { LabProtocolError } from "../../workers/protocol/bm06.ts";
import { createHostScheduler, type WorkerChannel } from "../../workers/scheduler/hostScheduler.ts";
import {
  createVerifiedWorkerChannel,
  type PublicationVerifier,
} from "../../workers/scheduler/verifiedChannel.ts";
import { parseResult } from "../results/codec.ts";
import { executionOutcomeRegistry } from "../results/outcomes.ts";
import {
  createInstanceStore,
  type ParameterClass,
  type RequestToken,
} from "../store/instanceStore.ts";
import { BM01_CLASSES, BM01_OUTPUTS, type Bm01Parameters } from "./definition.ts";
import { validateBm01Parameters } from "./parameters.ts";
export type PreparedBm01Example = Readonly<{
  sourceDigest: string;
  /**
   * The function that produced this example, and the hash of its source when the
   * example was generated. ShowTheCode compares the hash against the listing's own
   * sourceHash, which a different prepare step writes from the same file (am-70h7).
   */
  snapshotFunctionName: string;
  snapshotFunctionHash: string;
  parameters: Bm01Parameters;
  results: readonly string[];
  stepIndex: number;
  simulationTime: number;
}>;
export function createBm01Session(
  instanceId: string,
  example: PreparedBm01Example,
  workerFactory: () => WorkerChannel,
) {
  const initial = validateBm01Parameters(example.parameters);
  if (initial.kind !== "accepted")
    throw new LabProtocolError("malformed-response", "Invalid prepared tracer settings.");
  const store = createInstanceStore({
    experimentId: "bm-01",
    instanceId,
    initialParameters: initial.data,
    parameterClasses: BM01_CLASSES,
    outputs: BM01_OUTPUTS,
    allowPartial: true,
  });
  const token = store.issue("setup-change");
  const response = decodeLabResponse(
    {
      messageKind: "result",
      protocolVersion: BM01_PROTOCOL,
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
    throw new Error("Invalid prepared tracer example.");
  const serverSnapshot = store.getSnapshot();
  let scheduler: ReturnType<typeof createHostScheduler> | null = null;
  const verifiers = new WeakMap<RequestToken, PublicationVerifier>();
  const ownerProtocol = {
    version: BM01_PROTOCOL,
    decodeHello: decodeLabHello,
    decodeResponse: decodeLabResponse,
  };
  function apply(input: unknown, newRun = false, verify?: PublicationVerifier) {
    const checked = validateBm01Parameters(input);
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
    for (const key of Object.keys(p) as (keyof Bm01Parameters)[]) {
      if ((newRun && BM01_CLASSES[key] === "input") || !Object.is(p[key], previous[key])) {
        const cls = BM01_CLASSES[key];
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
        // A subscriber may apply a newer complete setup during issue(). Never attach remaining
        // measurement/estimator changes to that newer run or dispatch the stale outer request.
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
          // The recording checksum is checked at the channel seam; the result store owns only
          // its declared scientific outputs, so transport metadata never enters publication.
          return {
            ...response,
            result: { kind: "accepted", data: { outputs, stepIndex, simulationTime } },
          };
        },
      },
    );
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
      return accepted.parameters as Bm01Parameters;
    },
  });
}
