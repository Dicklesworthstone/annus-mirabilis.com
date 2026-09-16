import type { createInstanceStore } from "../../experiments/store/instanceStore.ts";
import { BM06_PROTOCOL, decodeLabHello, decodeLabResponse } from "../protocol/bm06.ts";
import { createHostScheduler, type SchedulerEvent, type WorkerChannel } from "./hostScheduler.ts";

export type { SchedulerEvent, WorkerChannel } from "./hostScheduler.ts";
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
