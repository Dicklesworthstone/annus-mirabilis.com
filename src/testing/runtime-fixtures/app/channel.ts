/**
 * Real browser Worker channel. Dispose terminates the worker. The live
 * set is how the teardown check proves no leak, and how the planted
 * leak page fails that same check.
 */
import type { WorkerChannel } from "../../../workers/scheduler/scheduler.ts";
import { RUNTIME_WORKER_SOURCE } from "./workerSource.ts";

const liveWorkers = new Set<Worker>();

export function liveWorkerCount(): number {
  return liveWorkers.size;
}

export function createRuntimeWorkerChannel(): WorkerChannel {
  const blob = new Blob([RUNTIME_WORKER_SOURCE], { type: "text/javascript" });
  const url = URL.createObjectURL(blob);
  const worker = new Worker(url, { name: "runtime-conformance" });
  liveWorkers.add(worker);
  return {
    send(message: unknown): void {
      worker.postMessage(message);
    },
    listen(onMessage: (message: unknown) => void, onError: () => void): () => void {
      const handleMessage = (event: MessageEvent<unknown>) => {
        onMessage(event.data);
      };
      const handleError = () => {
        onError();
      };
      worker.addEventListener("message", handleMessage);
      worker.addEventListener("error", handleError);
      return () => {
        worker.removeEventListener("message", handleMessage);
        worker.removeEventListener("error", handleError);
      };
    },
    dispose(): void {
      worker.terminate();
      liveWorkers.delete(worker);
      URL.revokeObjectURL(url);
    },
  };
}

export function sendWorkerHook(channel: WorkerChannel, hook: string): void {
  channel.send({ messageKind: "hook", hook });
}
