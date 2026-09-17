/**
 * Wires reading-only to the worker scheduler's autoload option
 * (am-a11y-reading-only-6wwd). Viewport and intent triggers are ignored
 * while reading-only is on; only an explicit load action creates a worker.
 */

import {
  type LoadOnDemandPolicy,
  shouldInitializeWorker,
} from "../../workers/scheduler/loadOnDemand.ts";

export function readingOnlyLoadPolicy(readingOnly: boolean): LoadOnDemandPolicy {
  return {
    readingOnly,
    autoload: !readingOnly,
  };
}

export function schedulerAutoload(readingOnly: boolean): boolean {
  return readingOnly === false;
}

export type LoadTrigger = "explicit" | "autoload" | "viewport" | "intent";

export function shouldCreateWorker(readingOnly: boolean, trigger: LoadTrigger): boolean {
  const policy = readingOnlyLoadPolicy(readingOnly);
  if (trigger === "explicit") return shouldInitializeWorker(policy, true);
  if (trigger === "viewport") {
    return shouldInitializeWorker({ ...policy, viewportTrigger: true }, false);
  }
  if (trigger === "intent") {
    return shouldInitializeWorker({ ...policy, intentTrigger: true }, false);
  }
  return shouldInitializeWorker(policy, false);
}

/** Wraps a scheduler worker factory so reading-only cannot create a worker by accident. */
export function gatedWorkerFactory<T>(
  readingOnly: boolean,
  trigger: LoadTrigger,
  factory: () => T,
): () => T {
  return () => {
    if (!shouldCreateWorker(readingOnly, trigger)) {
      throw new Error("reading-only: worker factory must not run until an explicit load.");
    }
    return factory();
  };
}
