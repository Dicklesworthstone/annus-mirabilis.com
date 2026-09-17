import { describe, expect, test } from "bun:test";
import { createInstanceStore } from "../../experiments/store/instanceStore.ts";
import { getLogger } from "../../testing/log/logger.ts";
import {
  createDedicatedScheduler,
  type HostProtocol,
  type WorkerChannel,
} from "../../workers/scheduler/scheduler.ts";
import {
  gatedWorkerFactory,
  readingOnlyLoadPolicy,
  schedulerAutoload,
  shouldCreateWorker,
} from "./schedulerBinding.ts";

const logger = getLogger("a11y-reading-only");
const BEAD = "am-a11y-reading-only-6wwd";
const SOURCE_DIGEST = "reading-only-scheduler-digest";

function mockProtocol(): HostProtocol {
  return {
    version: "bm06-host-v1",
    decodeHello: () => ({ messageKind: "hello" }),
    decodeResponse: (_msg, token) => ({
      token,
      result: {
        kind: "accepted" as const,
        data: {
          stepIndex: 1,
          simulationTime: 0,
          outputs: [
            {
              status: "value" as const,
              quantityId: "concentration",
              unit: "mol/m^3",
              semanticKind: "scalar",
              ownerId: "bm-06",
              value: 1,
            },
          ],
        },
      },
    }),
  };
}

function mockChannel(): WorkerChannel {
  return {
    send() {},
    listen(onMsg) {
      onMsg({ messageKind: "hello" });
      return () => {};
    },
    dispose() {},
  };
}

describe("reading-only scheduler binding", () => {
  test("reading-only sets autoload false; viewport and intent do not create a worker; explicit load does", () => {
    expect(readingOnlyLoadPolicy(true)).toEqual({ readingOnly: true, autoload: false });
    expect(schedulerAutoload(true)).toBe(false);
    expect(shouldCreateWorker(true, "autoload")).toBe(false);
    expect(shouldCreateWorker(true, "viewport")).toBe(false);
    expect(shouldCreateWorker(true, "intent")).toBe(false);
    expect(shouldCreateWorker(true, "explicit")).toBe(true);
    expect(shouldCreateWorker(false, "autoload")).toBe(true);
    expect(shouldCreateWorker(false, "viewport")).toBe(true);

    let created = 0;
    const factory = () => {
      created += 1;
      return mockChannel();
    };

    expect(() => gatedWorkerFactory(true, "viewport", factory)()).toThrow(/explicit load/);
    expect(() => gatedWorkerFactory(true, "intent", factory)()).toThrow(/explicit load/);
    expect(() => gatedWorkerFactory(true, "autoload", factory)()).toThrow(/explicit load/);
    expect(created).toBe(0);

    const store = createInstanceStore({
      experimentId: "bm-06",
      instanceId: "inst-reading-only",
      initialParameters: { diffusivity: 1 },
      parameterClasses: { diffusivity: "input" },
      outputs: {
        concentration: {
          statuses: ["value"],
          unit: "mol/m^3",
          semanticKind: "scalar",
          ownerId: "bm-06",
        },
      },
    });
    const scheduler = createDedicatedScheduler({
      store,
      factory: gatedWorkerFactory(true, "explicit", factory),
      sourceDigest: SOURCE_DIGEST,
      protocol: mockProtocol(),
    });
    const token = store.issue("setup-change", { diffusivity: 2 });
    scheduler.request(token, "setup-change");
    expect(created).toBe(1);
    scheduler.dispose();
    logger.log({
      testId: "scheduler-reading-only-gates-worker",
      beadId: BEAD,
      outcome: "passed",
      extra: { readingOnly: true, heavyRequests: created },
      message: "viewport and intent create no worker; explicit load does",
    });
  });

  test("turning reading-only off restores autoload without constructing a new policy object by hand", () => {
    expect(schedulerAutoload(true)).toBe(false);
    expect(schedulerAutoload(false)).toBe(true);
    expect(shouldCreateWorker(false, "autoload")).toBe(true);
    let created = 0;
    const store = createInstanceStore({
      experimentId: "bm-06",
      instanceId: "inst-reading-only-off",
      initialParameters: { diffusivity: 1 },
      parameterClasses: { diffusivity: "input" },
      outputs: {
        concentration: {
          statuses: ["value"],
          unit: "mol/m^3",
          semanticKind: "scalar",
          ownerId: "bm-06",
        },
      },
    });
    const scheduler = createDedicatedScheduler({
      store,
      factory: gatedWorkerFactory(false, "autoload", () => {
        created += 1;
        return mockChannel();
      }),
      sourceDigest: SOURCE_DIGEST,
      protocol: mockProtocol(),
    });
    scheduler.request(store.issue("setup-change", { diffusivity: 2 }), "setup-change");
    expect(created).toBe(1);
    scheduler.dispose();
    logger.log({
      testId: "scheduler-autoload-restored",
      beadId: BEAD,
      outcome: "passed",
      extra: { readingOnly: false },
      message: "turning reading-only off restores autoload",
    });
  });
});
