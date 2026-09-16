import type { createInstanceStore } from "../../experiments/store/instanceStore.ts";
import { decodeLabHello, decodeLabResponse, LQ01_PROTOCOL } from "../protocol/lq01.ts";
import { createHostScheduler, type SchedulerEvent, type WorkerChannel } from "./hostScheduler.ts";

export type { SchedulerEvent, WorkerChannel } from "./hostScheduler.ts";

export function createLq01Scheduler(
  store: ReturnType<typeof createInstanceStore>,
  factory: () => WorkerChannel,
  sourceDigest: string,
  report: (event: SchedulerEvent) => void = () => {},
) {
  return createHostScheduler(
    store,
    factory,
    sourceDigest,
    { version: LQ01_PROTOCOL, decodeHello: decodeLabHello, decodeResponse: decodeLabResponse },
    report,
  );
}
