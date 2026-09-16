import { BM06_PROTOCOL, decodeLabHello, decodeLabResponse } from "../protocol/bm06.ts";
import { createHostScheduler, type WorkerChannel, type SchedulerEvent } from "./hostScheduler.ts";
import type { createInstanceStore } from "../../experiments/store/instanceStore.ts";
export type { WorkerChannel, SchedulerEvent } from "./hostScheduler.ts";
export function createBm06Scheduler(
  store: ReturnType<typeof createInstanceStore>,
  factory: () => WorkerChannel,
  sourceDigest: string,
  report: (event: SchedulerEvent) => void = () => {},
) {
  return createHostScheduler(
    store,
    factory,
    sourceDigest,
    { version: BM06_PROTOCOL, decodeHello: decodeLabHello, decodeResponse: decodeLabResponse },
    report,
  );
}
