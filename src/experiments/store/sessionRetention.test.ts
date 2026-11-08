import { afterAll, describe, expect, test } from "bun:test";
import example from "../../generated/lq08-example.json";
import { TestLogger } from "../../testing/log/logger.ts";
import { createLq08Session } from "../lq08/session.ts";
import { createSessionRetention } from "./sessionRetention.ts";

const logger = new TestLogger("reader-session-retention");
afterAll(() => logger.flush());
const identity = {
  experimentId: "lq-08",
  instanceId: "instrument-view:lq-08",
  sourceDigest: example.sourceDigest,
};
const create = (id: string) => createLq08Session(id, example);
const settle = () => new Promise<void>((resolve) => queueMicrotask(resolve));

describe("retained actual laboratory owners (am-read-return-stack-oxa)", () => {
  test("uncommitted renders own nothing; a reopened owner preserves the exact accepted result", async () => {
    const cache = createSessionRetention();
    const abandoned = cache.prepare("passage-a", identity, create);
    expect(cache.size()).toBe(0);
    const first = cache.prepare("passage-a", identity, create);
    expect(first.session).not.toBe(abandoned.session);
    const release = cache.retain(first);
    first.session.apply({ frequency: 9e14, collectorPotential: -0.5 });
    const accepted = first.session.getSnapshot().accepted;
    expect(accepted?.parameters.frequency).toBe(9e14);
    expect(accepted?.actionIndex).toBeGreaterThan(0);
    expect(accepted?.snapshotVersion).toBeGreaterThan(1);
    release();
    await settle();
    const reopened = cache.prepare("passage-a", identity, create);
    expect(reopened.reused).toBe(true);
    expect(reopened.session).toBe(first.session);
    expect(reopened.session.getSnapshot().accepted).toBe(accepted);
    expect(reopened.session.acceptedParameters()).toEqual(accepted?.parameters);
    expect(cache.idleSize()).toBe(1);
    logger.log({
      testId: "actual-owner-return",
      beadId: "am-read-return-stack-oxa",
      instrumentId: "lq-08",
      instanceId: accepted?.instanceId,
      runId: accepted?.runId,
      snapshotVersion: accepted?.snapshotVersion,
      acceptedInputRevision: accepted?.revisions.input,
      outcome: "passed",
      message:
        "Close/reopen retains the same accepted owner, parameters, action and snapshot identity.",
    });
    cache.dispose();
  });

  test("effect probes and multiple leases do not disconnect a visible owner", async () => {
    const cache = createSessionRetention();
    let disconnects = 0;
    const first = cache.prepare("passage-a", identity, (id) => ({
      ...create(id),
      disconnect: () => {
        disconnects++;
      },
    }));
    const firstRelease = cache.retain(first);
    firstRelease();
    const secondRelease = cache.retain(first);
    await settle();
    expect(disconnects).toBe(0);
    const thirdRelease = cache.retain(first);
    secondRelease();
    await settle();
    expect(disconnects).toBe(0);
    thirdRelease();
    thirdRelease();
    await settle();
    expect(disconnects).toBe(1);
    cache.dispose();
    expect(disconnects).toBe(1);
  });

  test("bounded least-recently-used idle owners never evict a mounted laboratory", async () => {
    const cache = createSessionRetention({ maxIdleSessions: 2 });
    const active = cache.prepare("visible", identity, create);
    const releaseActive = cache.retain(active);
    const closed = [];
    for (const placement of ["first", "second", "third"]) {
      const item = cache.prepare(placement, identity, create);
      cache.retain(item)();
      await settle();
      closed.push(item);
    }
    expect(cache.size()).toBe(3);
    expect(cache.idleSize()).toBe(2);
    expect(cache.prepare("visible", identity, create).session).toBe(active.session);
    const evicted = cache.prepare("first", identity, create, closed[0]?.instanceId);
    expect(evicted.reused).toBe(false);
    expect(evicted.instanceId).not.toBe(closed[0]?.instanceId);
    expect(cache.prepare("second", identity, create).session).toBe(closed[1]?.session);
    expect(cache.prepare("third", identity, create).session).toBe(closed[2]?.session);
    releaseActive();
    await settle();
    expect(cache.size()).toBe(2);
    cache.dispose();
  });

  test("passages, modes, child slots and source identities cannot alias", async () => {
    const cache = createSessionRetention();
    const first = cache.prepare("/paper/paragraph-a/lq-08", identity, create);
    cache.retain(first)();
    await settle();
    for (const [placement, slot] of [
      ["/paper/paragraph-b/lq-08", identity.instanceId],
      ["/paper/paragraph-a/lq-08:other-mode", identity.instanceId],
      ["/paper/paragraph-a/lq-08", `${identity.instanceId}:comparison`],
    ] as const) {
      expect(cache.prepare(placement, { ...identity, instanceId: slot }, create).session).not.toBe(
        first.session,
      );
    }
    const changed = cache.prepare(
      "/paper/paragraph-a/lq-08",
      {
        ...identity,
        sourceDigest: `source:sha256:${"0".repeat(64)}`,
      },
      create,
    );
    expect(changed.reused).toBe(false);
    expect(changed.sourceChanged).toBe(true);
    expect(changed.instanceId).not.toBe(first.instanceId);
    const release = cache.retain(changed);
    expect(cache.size()).toBe(1);
    release();
    await settle();
    cache.dispose();
  });

  test("missing or invalid source pins never claim a retained compatible owner", async () => {
    for (const sourceDigest of [undefined, "", "source:sha256:incomplete"]) {
      const cache = createSessionRetention();
      const options = { ...identity, sourceDigest };
      const first = cache.prepare("passage-a", options, create);
      cache.retain(first)();
      await settle();
      expect(cache.size()).toBe(0);
      const next = cache.prepare("passage-a", options, create, first.instanceId);
      expect(next.reused).toBe(false);
      expect(next.instanceId).not.toBe(first.instanceId);
      cache.dispose();
    }
  });

  test("route disposal stops active and idle resources exactly once, with optional cleanup", async () => {
    const cache = createSessionRetention();
    let activeStops = 0;
    let idleStops = 0;
    const active = cache.prepare("active", identity, (id) => ({
      getSnapshot: create(id).getSnapshot,
      stop: () => {
        activeStops++;
      },
    }));
    const idle = cache.prepare("idle", identity, (id) => ({
      getSnapshot: create(id).getSnapshot,
      disconnect: () => {
        idleStops++;
      },
    }));
    const resourceFree = cache.prepare("synchronous", identity, (id) => ({
      getSnapshot: create(id).getSnapshot,
    }));
    const release = cache.retain(active);
    cache.retain(idle)();
    cache.retain(resourceFree)();
    await settle();
    expect(idleStops).toBe(1);
    expect(activeStops).toBe(0);
    cache.dispose();
    cache.dispose();
    release();
    await settle();
    expect(activeStops).toBe(1);
    expect(idleStops).toBe(1);
    expect(cache.size()).toBe(0);
    expect(cache.prepare("active", identity, create).reused).toBe(false);
  });
});
