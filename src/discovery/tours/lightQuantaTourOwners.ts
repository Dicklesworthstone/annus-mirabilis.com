import { createLq01Session } from "../../experiments/lq01/session.ts";
import { createLq05Session } from "../../experiments/lq05/session.ts";
import { createLq08Session } from "../../experiments/lq08/session.ts";
import type { ExperimentView } from "../../experiments/store/instanceStore.ts";
import type { WorkerChannel } from "../../workers/scheduler/lq01Scheduler.ts";
import type { LightQuantaTourSpec } from "./lightQuantaTourSpec.ts";

/** A presentation adapter only: the same owners, validators and stores as the full labs. */
export function createLightQuantaTourOwner(
  spec: LightQuantaTourSpec,
  instanceId: string,
  workerFactory?: () => WorkerChannel,
) {
  if (spec.id === "lq-01") return createLq01Session(instanceId, spec.example, workerFactory);
  if (spec.id === "lq-05") return createLq05Session(instanceId, spec.initial);
  return createLq08Session(instanceId, spec.example);
}

/** Pending or refused settings must never relabel the last accepted numbers. */
export function lightQuantaAcceptedAction(spec: LightQuantaTourSpec, view: ExperimentView) {
  const accepted = view.accepted?.parameters;
  if (!accepted) return undefined;
  return spec.actions.find((action) =>
    Object.entries(action.parameters).every(([key, value]) => Object.is(accepted[key], value)),
  );
}
