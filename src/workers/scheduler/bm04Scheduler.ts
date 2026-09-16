import type { createInstanceStore } from "../../experiments/store/instanceStore.ts";
import { BM04_PROTOCOL, decodeLabHello, decodeLabResponse } from "../protocol/bm04.ts";
import { createHostScheduler, type SchedulerEvent, type WorkerChannel } from "./hostScheduler.ts";

export type { SchedulerEvent, WorkerChannel } from "./hostScheduler.ts";

export function createBm04Scheduler(
  store: ReturnType<typeof createInstanceStore>,
  factory: () => WorkerChannel,
  sourceDigest: string,
  report: (event: SchedulerEvent) => void = () => {},
) {
  return createHostScheduler(
    store,
    factory,
    sourceDigest,
    { version: BM04_PROTOCOL, decodeHello: decodeLabHello, decodeResponse: decodeLabResponse },
    report,
  );
}
