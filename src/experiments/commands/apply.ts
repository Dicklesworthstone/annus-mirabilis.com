/**
 * The experiment command router and controller (am-rt-command-classes-dzp requirement 2, 8, 10).
 *
 * Routes every incoming command by its declared class, assigns logical actionIndex via the
 * store, validates model choices, checks replay grids for observation cadence, and enforces
 * per-class invariants before and after state publication.
 */
import type { RequestRefusal } from "../results/refusals.ts";
import type {
  Command,
  createInstanceStore,
  Parameters,
  RequestToken,
} from "../store/instanceStore.ts";

import {
  checkCommandInvariants,
  type ExecutionStateSnapshot,
  type InvariantCheckResult,
} from "./invariants.ts";
import { assertModelChoiceAndFallbackAreDisjoint, validateModelChoice } from "./modelChoice.ts";
import { checkObservationInterval, type ReplayGrid } from "./replayGrid.ts";
import { isCommandClass, type TypedCommand } from "./types.ts";

export type InstanceStore = ReturnType<typeof createInstanceStore>;

export interface CommandControllerOptions {
  readonly store: InstanceStore;
  readonly declaredModelIds?: readonly string[] | ReadonlySet<string> | undefined;
  readonly replayGrid?: ReplayGrid | undefined;
  readonly isProduction?: boolean | undefined;
}

export type CommandApplyResult =
  | Readonly<{
      accepted: true;
      token: RequestToken;
      command: TypedCommand;
    }>
  | Readonly<{
      accepted: false;
      refusal: RequestRefusal;
    }>;

/**
 * Creates an execution snapshot of the store's current state for invariant tracking.
 */
export function extractExecutionSnapshot(
  store: InstanceStore,
  extra?: {
    digests?: ExecutionStateSnapshot["digests"];
    drawCounters?: ExecutionStateSnapshot["drawCounters"];
    modelId?: string;
    fallbackReason?: string;
  },
): ExecutionStateSnapshot {
  const snap = store.getSnapshot();
  const accepted = snap.accepted;
  const requested = snap.requested;

  const runId = accepted?.runId ?? requested?.runId ?? "initial/run/0";
  const parentRunId = accepted?.parentRunId ?? requested?.parentRunId ?? null;
  const actionIndex = accepted?.actionIndex ?? requested?.actionIndex ?? 0;
  const stepIndex = accepted?.stepIndex ?? 0;
  const simulatedTime = accepted?.simulationTime ?? 0;
  const revisions = accepted?.revisions ??
    requested?.revisions ?? {
      input: 0,
      observer: 0,
      measurement: 0,
      estimator: 0,
    };

  return Object.freeze({
    instanceId: accepted?.instanceId ?? requested?.instanceId ?? "instance",
    runId,
    parentRunId,
    actionIndex,
    stepIndex,
    simulatedTime,
    revisions,
    digests: Object.freeze(extra?.digests ?? {}),
    drawCounters: Object.freeze(extra?.drawCounters ?? {}),
    modelId: extra?.modelId,
    fallbackReason: extra?.fallbackReason,
  });
}

/**
 * Validates and applies a typed command to an instance store.
 */
export function applyCommand(
  controllerOptions: CommandControllerOptions,
  command: TypedCommand,
): CommandApplyResult {
  const { store, declaredModelIds, replayGrid } = controllerOptions;

  if (!isCommandClass(command.class)) {
    throw new TypeError(`Unknown command class: ${command.class}`);
  }

  // 1. Model choice validation on setup-change
  if (command.class === "setup-change") {
    const payload = command.payload;
    if (payload.modelId !== undefined) {
      assertModelChoiceAndFallbackAreDisjoint(payload);
      if (declaredModelIds) {
        const decision = validateModelChoice(declaredModelIds, payload.modelId);
        if (!decision.accepted) {
          return { accepted: false, refusal: decision.refusal };
        }
      }
    }
  }

  // 2. Replay grid validation on measurement-change
  if (command.class === "measurement-change" && replayGrid) {
    const payload = command.payload;
    const interval = payload.observationInterval ?? payload.samplingCadence;
    if (typeof interval === "number") {
      const decision = checkObservationInterval(replayGrid, interval, "observationInterval");
      if (!decision.accepted) {
        return { accepted: false, refusal: decision.refusal };
      }
    }
  }

  // 3. Issue command through store
  const patch: Parameters = (command.payload.parameters as Parameters) ?? {};
  const issueOptions =
    command.class === "physical-intervention"
      ? { atSimulatedTime: command.payload.atSimulatedTime }
      : {};

  const token = store.issue(command.class as Command, patch, issueOptions);

  return {
    accepted: true,
    token,
    command,
  };
}

/**
 * Helper to verify invariants after an owner execution has published its snapshot.
 */
export function verifyPostExecutionInvariants(
  preState: ExecutionStateSnapshot,
  postState: ExecutionStateSnapshot,
  command: TypedCommand,
  options?: { isProduction?: boolean },
): InvariantCheckResult {
  return checkCommandInvariants(preState, postState, command, options);
}
