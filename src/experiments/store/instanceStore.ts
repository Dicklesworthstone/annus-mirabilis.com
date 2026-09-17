import {
  decodeOutcome,
  decodeRefusal,
  decodeResultBatch,
  type Revisions,
} from "../results/codec.ts";
import type { ExecutionOutcome } from "../results/outcomes.ts";
import type { RequestRefusal } from "../results/refusals.ts";
import type { OutputStatus, ScientificResult } from "../results/types.ts";

export type ParameterClass = "input" | "observer" | "measurement" | "estimator" | "presentation";
export type Parameters = Readonly<Record<string, number | string | boolean>>;
export type Command =
  | "setup-change"
  | "physical-intervention"
  | "observer-change"
  | "measurement-change"
  | "estimator-change"
  | "presentation-change"
  | "continue";
export type NumericView = Readonly<{
  length: number;
  at(index: number): number;
  copy(): Float64Array;
}>;
type ValueResult = Extract<ScientificResult, { status: "value" }>;
export type PublishedResult =
  | Exclude<ScientificResult, ValueResult>
  | (Omit<ValueResult, "value"> & Readonly<{ value: number | NumericView }>);
export type RequestToken = Readonly<{
  experimentId: string;
  instanceId: string;
  runId: string;
  /** The run this one was forked from (am-rt-command-classes-dzp requirement 3), or null for
   * the instance's first run. Set only on the setup-change or physical-intervention command
   * that created this runId; every later command on the same run repeats that run's own value. */
  parentRunId: string | null;
  actionIndex: number;
  revisions: Revisions;
  parameters: Parameters;
}>;
/** One identified run's lineage, retrievable by id after the instance has moved on
 * (am-rt-command-classes-dzp: "the old run stays identifiable"). Not the run's accepted
 * snapshots -- that history belongs to am-rt-snapshot-store-aft; this is identity only. */
export type RunRecord = Readonly<{
  runId: string;
  parentRunId: string | null;
  /** Set only when this run was forked by a backdated physical-intervention. */
  forkedAtSimulatedTime: number | null;
  startedAtActionIndex: number;
}>;
export type Publication = RequestToken &
  Readonly<{
    stepIndex: number;
    simulationTime: number;
    final: boolean;
    outputs: readonly ScientificResult[];
  }>;
export type AcceptedSnapshot = Omit<Publication, "outputs"> &
  Readonly<{ snapshotVersion: number; outputs: readonly PublishedResult[] }>;
export type ExperimentView = Readonly<{
  status: "idle" | "pending" | "accepted" | "refused" | "paused" | "unavailable";
  pending: boolean;
  requested: RequestToken | null;
  accepted: AcceptedSnapshot | null;
  refusal: RequestRefusal | null;
  outcome: ExecutionOutcome | null;
}>;
export type PublicationReason =
  | "wrong-instance"
  | "no-request"
  | "superseded-run"
  | "stale-action"
  | "unissued-action"
  | "mixed-revisions"
  | "parameter-mismatch"
  | "completed-action"
  | "non-monotone-step"
  | "malformed-publication";
export type PublicationDecision = Readonly<
  { accepted: true } | { accepted: false; reason: PublicationReason }
>;
export type OutputContract = Readonly<{
  statuses: readonly OutputStatus[];
  unit: string;
  semanticKind: string;
  ownerId: string;
}>;
const allParameterClasses = [
  "input",
  "observer",
  "measurement",
  "estimator",
  "presentation",
] as const;
const revisionKeys = ["input", "observer", "measurement", "estimator"] as const;
const revisionFor = {
  "setup-change": "input",
  "physical-intervention": "input",
  "observer-change": "observer",
  "measurement-change": "measurement",
  "estimator-change": "estimator",
  "presentation-change": null,
} as const;
function freeze<T>(value: T): T {
  if (value !== null && typeof value === "object") {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
}
function parameterCopy(input: Parameters): Parameters {
  if (input === null || ![Object.prototype, null].includes(Object.getPrototypeOf(input)))
    throw new TypeError("Parameters must be a plain record.");
  if (Object.keys(input).length > 256) throw new RangeError("Too many parameters.");
  for (const [key, value] of Object.entries(input)) {
    if (
      !key.trim() ||
      !["number", "boolean", "string"].includes(typeof value) ||
      (typeof value === "number" && !Number.isFinite(value)) ||
      (typeof value === "string" && value.length > 4096)
    )
      throw new TypeError(`Invalid parameter: ${key}.`);
  }
  return Object.freeze({ ...input });
}
function equalParameters(a: Parameters, b: Parameters): boolean {
  return (
    Object.keys(a).length === Object.keys(b).length &&
    Object.keys(a).every((key) => Object.hasOwn(b, key) && Object.is(a[key], b[key]))
  );
}
function published(result: ScientificResult): PublishedResult {
  if (result.status !== "value") return freeze(result);
  if (typeof result.value === "number") return freeze({ ...result, value: result.value });
  const data = result.value.slice();
  const view: NumericView = Object.freeze({
    length: data.length,
    at(index: number): number {
      if (!Number.isSafeInteger(index) || index < 0 || index >= data.length)
        throw new RangeError("Numeric view index out of range.");
      const val = data[index];
      if (val === undefined) throw new RangeError("Numeric view index out of range.");
      return val;
    },
    copy: () => data.slice(),
  });
  return freeze({ ...result, value: view });
}
const denied = (reason: PublicationReason): PublicationDecision =>
  Object.freeze({ accepted: false, reason });

/** Pure per-placement store. Worker scheduling, React bindings and route lifetime are separate owners. */
export function createInstanceStore(options: {
  experimentId: string;
  instanceId: string;
  initialParameters: Parameters;
  parameterClasses: Readonly<Record<string, ParameterClass>>;
  outputs: Readonly<Record<string, OutputContract>>;
  allowPartial?: boolean;
  onListenerError?: (error: unknown) => void;
}) {
  const { instanceId, experimentId } = options;
  if (!instanceId.trim() || !experimentId.trim())
    throw new TypeError("Experiment and placement identities are required.");
  let parameters = parameterCopy(options.initialParameters);
  const classes = freeze(structuredClone(options.parameterClasses));
  if (
    !equalParameters(
      Object.fromEntries(Object.keys(parameters).map((k) => [k, true])),
      Object.fromEntries(Object.keys(classes).map((k) => [k, true])),
    ) ||
    Object.values(classes).some((c) => !allParameterClasses.includes(c))
  )
    throw new TypeError("Every parameter needs exactly one declared command class.");
  const contracts = freeze(structuredClone(options.outputs));
  if (!Object.keys(contracts).length) throw new TypeError("Declare at least one output.");
  const statuses = Object.fromEntries(
    Object.entries(contracts).map(([id, contract]) => [id, contract.statuses]),
  );
  const allowPartial = options.allowPartial ?? false;
  let revisions: Revisions = Object.freeze({ input: 0, observer: 0, measurement: 0, estimator: 0 });
  let actionIndex = 0,
    runNumber = 0,
    snapshotVersion = 0;
  let completed = false;
  const runs: RunRecord[] = [];
  let view: ExperimentView = freeze({
    status: "idle",
    pending: false,
    requested: null,
    accepted: null,
    refusal: null,
    outcome: null,
  });
  const serverSnapshot = view;
  const listeners = new Set<() => void>();
  function emit(next: ExperimentView): void {
    view = Object.freeze(next);
    for (const listener of [...listeners]) {
      try {
        listener();
      } catch (error) {
        // A broken view cannot turn an already-committed publication into a rejection.
        if (options.onListenerError) {
          try {
            options.onListenerError(error);
          } catch (reportingError) {
            queueMicrotask(() => {
              throw reportingError;
            });
          }
        } else
          queueMicrotask(() => {
            throw error;
          });
      }
    }
  }
  function matches(token: RequestToken): PublicationDecision {
    if (token.instanceId !== instanceId || token.experimentId !== experimentId)
      return denied("wrong-instance");
    const requested = view.requested;
    if (!requested) return denied("no-request");
    if (token.runId !== requested.runId) return denied("superseded-run");
    if (token.actionIndex < requested.actionIndex) return denied("stale-action");
    if (token.actionIndex !== requested.actionIndex) return denied("unissued-action");
    if (revisionKeys.some((k) => token.revisions[k] !== requested.revisions[k]))
      return denied("mixed-revisions");
    if (!equalParameters(token.parameters, requested.parameters))
      return denied("parameter-mismatch");
    if (completed) return denied("completed-action");
    return { accepted: true };
  }
  function issue(
    command: Command,
    patch: Parameters = {},
    commandOptions: Readonly<{ atSimulatedTime?: number }> = {},
  ): RequestToken {
    if (!(command === "continue" || Object.hasOwn(revisionFor, command)))
      throw new TypeError("Unknown scientific command.");
    if (command !== "setup-change" && command !== "presentation-change" && runNumber === 0)
      throw new Error("Start a setup before changing its description.");
    if (command === "physical-intervention") {
      if (
        !Number.isFinite(commandOptions.atSimulatedTime) ||
        (commandOptions.atSimulatedTime as number) < 0
      )
        throw new TypeError(
          "physical-intervention requires a non-negative finite atSimulatedTime.",
        );
    } else if (commandOptions.atSimulatedTime !== undefined) {
      throw new TypeError(
        `atSimulatedTime is only meaningful for physical-intervention, not ${command}.`,
      );
    }
    const checked = parameterCopy(patch);
    const revision =
      command === "continue" || command === "presentation-change" ? null : revisionFor[command];
    for (const key of Object.keys(checked)) {
      const expectedClass = command === "presentation-change" ? "presentation" : revision;
      if (!Object.hasOwn(classes, key) || classes[key] !== expectedClass)
        throw new TypeError(`Parameter ${key} does not belong to ${command}.`);
    }
    if (
      actionIndex === Number.MAX_SAFE_INTEGER ||
      runNumber === Number.MAX_SAFE_INTEGER ||
      (revision !== null && revisions[revision] === Number.MAX_SAFE_INTEGER)
    )
      throw new RangeError("The instance identity counter is exhausted.");
    // A setup-change always forks a new identified run (am-rt-command-classes-dzp requirement
    // 3): "the old run stays identifiable; the new accepted run is explicit". A
    // physical-intervention forks only when it is backdated -- atSimulatedTime earlier than the
    // latest accepted simulatedTime on this run -- so it never silently rewrites accepted
    // history; a forward intervention keeps the current runId exactly as printed there.
    const latestAcceptedTime =
      view.accepted && view.accepted.runId === `${instanceId}/run/${runNumber}`
        ? view.accepted.simulationTime
        : null;
    const isBackdated =
      command === "physical-intervention" &&
      latestAcceptedTime !== null &&
      (commandOptions.atSimulatedTime as number) < latestAcceptedTime;
    const forks = command === "setup-change" || isBackdated;
    const currentRunId = runNumber === 0 ? null : `${instanceId}/run/${runNumber}`;
    if (forks) {
      runNumber++;
      runs.push(
        freeze({
          runId: `${instanceId}/run/${runNumber}`,
          parentRunId: currentRunId,
          forkedAtSimulatedTime: isBackdated ? (commandOptions.atSimulatedTime as number) : null,
          startedAtActionIndex: actionIndex + 1,
        }),
      );
    }
    if (revision !== null)
      revisions = Object.freeze({ ...revisions, [revision]: revisions[revision] + 1 });
    parameters = parameterCopy({ ...parameters, ...checked });
    actionIndex++;
    completed = false;
    const runId = `${instanceId}/run/${runNumber}`;
    // Every run this instance has ever forked is in `runs` (pushed exactly when `forks` was
    // true for it, including the instance's first run), so a continuing command's parentRunId
    // is always found by looking up its own already-recorded run.
    const parentRunId = forks
      ? currentRunId
      : (runs.find((r) => r.runId === runId)?.parentRunId ?? null);
    const token = freeze({
      instanceId,
      experimentId,
      runId,
      parentRunId,
      actionIndex,
      revisions,
      parameters,
    });
    emit({
      ...view,
      requested: token,
      status: "pending",
      pending: true,
      refusal: null,
      outcome: null,
    });
    return token;
  }
  function publish(message: Publication): PublicationDecision {
    try {
      if (
        message === null ||
        Object.getPrototypeOf(message) !== Object.prototype ||
        Object.keys(message).some(
          (k) =>
            ![
              "experimentId",
              "instanceId",
              "runId",
              "parentRunId",
              "actionIndex",
              "revisions",
              "parameters",
              "stepIndex",
              "simulationTime",
              "final",
              "outputs",
            ].includes(k),
        )
      )
        return denied("malformed-publication");
      const match = matches(message);
      if (!match.accepted) return match;
      if (
        !Number.isSafeInteger(message.stepIndex) ||
        message.stepIndex < 0 ||
        !Number.isFinite(message.simulationTime) ||
        message.simulationTime < 0 ||
        typeof message.final !== "boolean"
      )
        return denied("malformed-publication");
      const previous = view.accepted;
      if (
        previous?.runId === message.runId &&
        (message.stepIndex < previous.stepIndex ||
          message.simulationTime < previous.simulationTime ||
          (message.actionIndex === previous.actionIndex &&
            message.stepIndex === previous.stepIndex))
      )
        return denied("non-monotone-step");
      const batch = decodeResultBatch(
        { revisions: message.revisions, outputs: message.outputs },
        { expectedRevisions: revisions, statuses, allowPartial },
      );
      for (const output of batch.outputs) {
        const expected = contracts[output.quantityId];
        if (
          !expected ||
          output.unit !== expected.unit ||
          output.semanticKind !== expected.semanticKind ||
          output.ownerId !== expected.ownerId
        )
          return denied("malformed-publication");
      }
      if (!view.requested) return denied("no-request");
      if (snapshotVersion === Number.MAX_SAFE_INTEGER) return denied("malformed-publication");
      const accepted: AcceptedSnapshot = freeze({
        ...view.requested,
        stepIndex: message.stepIndex,
        simulationTime: message.simulationTime,
        final: message.final,
        snapshotVersion: snapshotVersion + 1,
        outputs: batch.outputs.map(published),
      });
      snapshotVersion++;
      completed = message.final;
      emit({
        ...view,
        accepted,
        status: message.final ? "accepted" : "pending",
        pending: !message.final,
        refusal: null,
        outcome: null,
      });
      return { accepted: true };
    } catch {
      return denied("malformed-publication");
    }
  }
  function refuse(token: RequestToken, refusal: unknown): PublicationDecision {
    try {
      const match = matches(token);
      if (!match.accepted) return match;
      const decoded = freeze(decodeRefusal(refusal));
      completed = true;
      emit({ ...view, status: "refused", pending: false, refusal: decoded, outcome: null });
      return { accepted: true };
    } catch {
      return denied("malformed-publication");
    }
  }
  function fail(token: RequestToken, outcome: unknown): PublicationDecision {
    try {
      const match = matches(token);
      if (!match.accepted) return match;
      const decoded = freeze(decodeOutcome(outcome));
      completed = true;
      emit({ ...view, status: "unavailable", pending: false, refusal: null, outcome: decoded });
      return { accepted: true };
    } catch {
      return denied("malformed-publication");
    }
  }
  return Object.freeze({
    issue,
    publish,
    refuse,
    fail,
    getSnapshot: () => view,
    getServerSnapshot: () => serverSnapshot,
    /** The old run stays identifiable after a setup-change or a backdated physical-intervention
     * forks a new one (am-rt-command-classes-dzp requirement 3): looked up by id, not just the
     * current run. Returns undefined for a runId this instance never created. */
    getRun: (runId: string): RunRecord | undefined => runs.find((r) => r.runId === runId),
    /** Every run this instance has ever forked, oldest first. Identity only -- accepted
     * snapshots per run belong to am-rt-snapshot-store-aft, not here. */
    listRuns: (): readonly RunRecord[] => runs.slice(),
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    pause() {
      if (!view.requested || view.status === "paused") return;
      completed = true;
      emit({ ...view, status: "paused", pending: false });
    },
  });
}
