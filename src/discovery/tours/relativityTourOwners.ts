import { createSr01Session } from "../../experiments/sr01/session.ts";
import { createSr03Session } from "../../experiments/sr03/session.ts";
import { createSr06Session } from "../../experiments/sr06/session.ts";
import { createSr09Session } from "../../experiments/sr09/session.ts";
import type { ExperimentView } from "../../experiments/store/instanceStore.ts";
import type { WorkerChannel } from "../../workers/scheduler/sr03Scheduler.ts";
import type { RelativityTourSpec } from "./relativityTourSpec.ts";

/** Presentation only: the full laboratories' owners, validators and accepted stores. */
export function createRelativityTourOwner(
  spec: RelativityTourSpec,
  instanceId: string,
  workerFactory?: () => WorkerChannel,
) {
  if (spec.id === "sr-01") return createSr01Session(instanceId, spec.initial);
  if (spec.id === "sr-03") return createSr03Session(instanceId, spec.example, workerFactory);
  if (spec.id === "sr-06") return createSr06Session(instanceId, spec.initial);
  return createSr09Session(instanceId, spec.example);
}

/** A requested or refused setting must never relabel the accepted numbers. */
export function relativityAcceptedAction(spec: RelativityTourSpec, view: ExperimentView) {
  const accepted = view.accepted?.parameters;
  if (!accepted) return undefined;
  return spec.actions.find((action) =>
    Object.entries(action.parameters).every(([key, value]) => Object.is(accepted[key], value)),
  );
}
