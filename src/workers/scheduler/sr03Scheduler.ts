import type { createInstanceStore } from "../../experiments/store/instanceStore.ts";
import { decodeLabHello, decodeLabResponse, SR03_PROTOCOL } from "../protocol/sr03.ts";
import { createHostScheduler, type SchedulerEvent, type WorkerChannel } from "./hostScheduler.ts";

export type { SchedulerEvent, WorkerChannel } from "./hostScheduler.ts";

export function createSr03Scheduler(
  store: ReturnType<typeof createInstanceStore>,
  factory: () => WorkerChannel,
  sourceDigest: string,
  report: (event: SchedulerEvent) => void = () => {},
) {
  return createHostScheduler(
    store,
    factory,
    sourceDigest,
    { version: SR03_PROTOCOL, decodeHello: decodeLabHello, decodeResponse: decodeLabResponse },
    report,
  );
}
