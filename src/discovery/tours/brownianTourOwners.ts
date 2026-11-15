import { createBm01BrowserChannel } from "../../experiments/bm01/browser.ts";
import { BM01_OUTPUTS, BM01_FRANKENSIM_RECORDER_OWNER } from "../../experiments/bm01/definition.ts";
import { createBm01Session } from "../../experiments/bm01/session.ts";
import { createBm05BrowserChannel } from "../../experiments/bm05/browser.ts";
import { BM05_OUTPUTS } from "../../experiments/bm05/definition.ts";
import { createBm05Session } from "../../experiments/bm05/session.ts";
import { walkExecutionKind } from "../../experiments/bm05/walkExecution.ts";
import { createBm06BrowserChannel } from "../../experiments/bm06/browser.ts";
import { BM06_OUTPUTS } from "../../experiments/bm06/definition.ts";
import { createBm06Session } from "../../experiments/bm06/session.ts";
import { executionStateKindFromHostLabel } from "../../experiments/labels/executionLabelFor.ts";
import { deriveHostExecution, type ExecutionStateKind } from "../../experiments/provenance/executionState.ts";
import type { ExperimentView } from "../../experiments/store/instanceStore.ts";
import type { WorkerChannel } from "../../workers/scheduler/hostScheduler.ts";
import type { BrownianTourSpec } from "./brownianTourSpec.ts";

/** Pure session construction; ordinary workers remain lazy until a reader changes a setting. */
export function createBrownianTourOwner(
  spec: BrownianTourSpec,
  instanceId: string,
  workerFactory?: () => WorkerChannel,
) {
  if (spec.id === "bm-01")
    return createBm01Session(instanceId, spec.example, workerFactory ?? createBm01BrowserChannel);
  if (spec.id === "bm-05")
    return createBm05Session(instanceId, spec.example, workerFactory ?? createBm05BrowserChannel);
  return createBm06Session(instanceId, spec.example, workerFactory ?? createBm06BrowserChannel);
}

export function brownianAcceptedAction(spec: BrownianTourSpec, view: ExperimentView) {
  const parameters = view.accepted?.parameters;
  return parameters ? spec.actions.find((action) => Object.entries(action.parameters)
    .every(([key, value]) => Object.is(parameters[key], value))) : undefined;
}

/** An engine label is earned by these accepted outputs, never by merely loading a module. */
export function brownianTourExecution(
  spec: BrownianTourSpec,
  view: ExperimentView,
  isStatic: boolean,
): ExecutionStateKind {
  const contracts = spec.id === "bm-01" ? BM01_OUTPUTS : spec.id === "bm-05" ? BM05_OUTPUTS : BM06_OUTPUTS;
  const provenance = deriveHostExecution(view, contracts, spec.sourceDigest, isStatic);
  const kind = executionStateKindFromHostLabel(provenance.label);
  if (view.status === "unavailable") return "unavailable";
  if (kind !== "host-accepted") return kind;
  if (spec.id === "bm-05") return walkExecutionKind(view.accepted?.outputs, false);
  const positions = view.accepted?.outputs.find((output) => output.quantityId === "tracerPositions");
  return spec.id === "bm-01" && positions?.status === "value" &&
    positions.ownerId === BM01_FRANKENSIM_RECORDER_OWNER ? "frankensim-accepted" : kind;
}
