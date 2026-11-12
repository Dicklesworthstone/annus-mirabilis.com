import {
  BM06_PROTOCOL,
  decodeLabHello,
  decodeLabProgress,
  decodeLabResponse,
  LabProtocolError,
} from "../../workers/protocol/bm06.ts";
import type { WorkerAdmission } from "../../workers/scheduler/admission.ts";
import { createHostScheduler, type WorkerChannel } from "../../workers/scheduler/hostScheduler.ts";
import { createRecordingContinuity } from "../../workers/scheduler/recordingContinuity.ts";
import {
  sharedLaboratoryRetention,
  type WorkerRetention,
} from "../../workers/scheduler/retention.ts";
import {
  createVerifiedWorkerChannel,
  type VerifiablePublication,
} from "../../workers/scheduler/verifiedChannel.ts";
import { type DigestValue, scientificDigest } from "../digest/scientificDigest.ts";
import { createSchedulingPause } from "../lifecycle/schedulingPause.ts";
import { PINNED_ARTIFACT } from "../provenance/pinnedFrankenSim.ts";
import { parseResult } from "../results/codec.ts";
import { executionOutcomeRegistry } from "../results/outcomes.ts";
import { createInstanceStore, type Parameters } from "../store/instanceStore.ts";
import {
  BM06_FRANKENSIM_GRID_OWNER,
  BM06_MODEL,
  BM06_OUTPUTS,
  BM06_PARAMETER_CLASSES,
  type Bm06Parameters,
} from "./definition.ts";
import { validateBm06Parameters } from "./parameters.ts";

export type PreparedBm06Example = Readonly<{
  sourceDigest: string;
  /**
   * The function that produced this example, and the hash of its source when the
   * example was generated. ShowTheCode compares the hash against the listing's own
   * sourceHash, which a different prepare step writes from the same file (am-70h7).
   */
  snapshotFunctionName: string;
  snapshotFunctionHash: string;
  /** JSON widens a profile alias to string; the session validates it before accepting anything. */
  parameters: Readonly<Omit<Bm06Parameters, "gridProfile"> & { gridProfile: string }>;
  results: readonly string[];
  stepIndex: number;
  simulationTime: number;
}>;
/**
 * BM-06 has no latent random stream: the owner's entire cached numerical state is its validated
 * outputs, step index and time. Reselecting lower/upper replaces only intervalProbability.
 * Bind every other output (including full fields, analytic limits, units and actual owners),
 * all immutable setup and copy provenance, and the exact stepping artifact. This is a complete
 * state receipt, not a sample of the plot. It never changes the worker's published protocol.
 */
function checkpointValue(value: unknown): DigestValue {
  if (typeof value === "number" || typeof value === "string" || value instanceof Float64Array)
    return value;
  // Containers receive distinct tags too: a Boolean must not collide with a record that
  // happens to contain a field named "boolean". Scalar and vector tags come from the codec.
  if (typeof value === "boolean") return { boolean: value ? 1 : 0 };
  if (value === null) return { null: "null" };
  if (Array.isArray(value)) return { array: value.map(checkpointValue) };
  if (typeof value === "object")
    return {
      record: Object.fromEntries(
        Object.entries(value).map(([key, child]) => [key, checkpointValue(child)]),
      ),
    };
  throw new LabProtocolError("malformed-response", "Invalid complete calculation state.");
}

async function calculationCheckpoint(publication: VerifiablePublication, sourceDigest: string) {
  const parameters = publication.parameters as Bm06Parameters;
  const setup = Object.fromEntries(
    Object.entries(parameters).filter(([key]) => key !== "lower" && key !== "upper"),
  );
  const grid = publication.outputs.find((output) => output.quantityId === "gridDensity");
  const engine = grid?.status === "value" ? grid.ownerId : "not-stepped";
  const format = "bm06-complete-calculation-v1";
  const metadata = {
    format,
    modelId: BM06_MODEL.id,
    constantSetId: BM06_MODEL.constantSetId,
    sourceDigest,
    engine,
    inputRevision: publication.revisions.input,
    stepIndex: publication.stepIndex,
    simulationTime: publication.simulationTime,
  };
  const { digest } = await scientificDigest({
    ...metadata,
    setup: checkpointValue(setup),
    engineArtifact: engine === BM06_FRANKENSIM_GRID_OWNER ? PINNED_ARTIFACT : "host-reference",
    outputs: Object.fromEntries(
      publication.outputs
        .filter((output) => output.quantityId !== "intervalProbability")
        .map((output) => [output.quantityId, checkpointValue(output)]),
    ),
  });
  return Object.freeze({ ...metadata, digest });
}

/** Pure construction: SSR and hydration receive the same precomputed result; no worker starts here. */
export function createBm06Session(
  instanceId: string,
  example: PreparedBm06Example,
  workerFactory: () => WorkerChannel,
  resources: Readonly<{ admission?: WorkerAdmission; retention?: WorkerRetention | null }> = {},
) {
  const prepared = validateBm06Parameters(example.parameters);
  if (prepared.kind !== "accepted")
    throw new LabProtocolError("malformed-response", "Invalid prepared laboratory settings.");
  const initialParameters = prepared.data;
  const store = createInstanceStore({
    experimentId: "bm-06",
    instanceId,
    initialParameters,
    parameterClasses: BM06_PARAMETER_CLASSES,
    outputs: BM06_OUTPUTS,
    allowPartial: true,
  });
  const token = store.issue("setup-change");
  const response = decodeLabResponse(
    {
      messageKind: "result",
      protocolVersion: BM06_PROTOCOL,
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
    throw new Error("Invalid prepared laboratory example.");
  const serverSnapshot = store.getSnapshot();
  let scheduler: ReturnType<typeof createHostScheduler> | null = null;
  const schedulingPause = createSchedulingPause((paused) => scheduler?.setSchedulingPaused(paused));
  const continuity = createRecordingContinuity(store);
  const ownerProtocol = {
    version: BM06_PROTOCOL,
    decodeHello: decodeLabHello,
    decodeProgress: decodeLabProgress,
    decodeResponse: decodeLabResponse,
  };

  function apply(input: unknown, newRun = false) {
    const validated = validateBm06Parameters(input);
    if (validated.kind !== "accepted") return validated;
    const parameters = validated.data;
    const snapshot = store.getSnapshot();
    const previous =
      snapshot.requested?.parameters ?? snapshot.accepted?.parameters ?? initialParameters;
    const setup: Record<string, number | boolean | string> = {},
      measurement: Record<string, number> = {};
    for (const key of Object.keys(parameters) as (keyof Bm06Parameters)[]) {
      if (key === "lower" || key === "upper") {
        if (!Object.is(parameters[key], previous[key])) measurement[key] = parameters[key];
      } else if (newRun || !Object.is(parameters[key], previous[key])) setup[key] = parameters[key];
    }
    const superseded = () => ({
      kind: "outcome" as const,
      outcome: { outcome: "superseded" as const, ...executionOutcomeRegistry.superseded },
    });
    let request = newRun || Object.keys(setup).length ? store.issue("setup-change", setup) : null;
    if (request && store.getSnapshot().requested !== request) return superseded();
    if (Object.keys(measurement).length) {
      request = store.issue("measurement-change", measurement);
      if (store.getSnapshot().requested !== request) return superseded();
    }
    request ??= store.issue("continue");
    if (store.getSnapshot().requested !== request) return superseded();
    scheduler ??= createHostScheduler(
      store,
      () =>
        createVerifiedWorkerChannel(
          workerFactory(),
          ownerProtocol,
          example.sourceDigest,
          (token) => {
            const verify = continuity.verifier(token);
            return async (publication) => {
              const recordingCheckpoint = await calculationCheckpoint(
                publication,
                example.sourceDigest,
              );
              const notice = await verify({ ...publication, recordingCheckpoint });
              return notice === null
                ? null
                : "The saved calculation could not be reconstructed with the same model, engine and complete numerical state. The previous accepted result is unchanged. Start a new calculation to continue.";
            };
          },
        ),
      example.sourceDigest,
      ownerProtocol,
      undefined,
      {
        admission: resources.admission,
        retention:
          resources.retention === null
            ? undefined
            : {
                pool: resources.retention ?? sharedLaboratoryRetention(),
                canRetire: continuity.canRetire,
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
    startNewRun: (input: unknown) => apply(input, true),
    /** A one-time value copy from a named BM-01 instance's accepted snapshot: `source` is read
     * once, spread into an ordinary setup-change patch, and never retained or subscribed to, so
     * a later change to the source instance cannot reach back into this parameter set. */
    copyDiffusivityFrom(
      source: Readonly<{
        instanceId: string;
        runId: string;
        snapshotVersion: number;
        value: number;
      }>,
    ) {
      const current = (store.getSnapshot().accepted?.parameters ??
        initialParameters) as Parameters as Bm06Parameters;
      return apply({
        ...current,
        copiedDiffusivityInstanceId: source.instanceId,
        copiedDiffusivityRunId: source.runId,
        copiedDiffusivitySnapshotVersion: source.snapshotVersion,
        copiedDiffusivityValue: source.value,
      });
    },
    ...schedulingPause,
    stop() {
      scheduler?.cancel();
    },
    /** Safe to reconnect after a StrictMode cleanup or an explicit stop. */
    disconnect() {
      scheduler?.dispose();
      scheduler = null;
    },
    acceptedParameters: () =>
      (store.getSnapshot().accepted?.parameters ??
        initialParameters) as Parameters as Bm06Parameters,
  });
}
