import { afterEach, expect, test } from "bun:test";
import { kitchenFixture } from "../../../testing/kitchen/fixture.mjs";
import { KITCHEN_OPTIONS } from "./definition.ts";
import { createKitchenHost } from "./host.ts";
import type { KitchenRequest } from "./protocol.ts";
import { createKitchenSession } from "./session.ts";

const sourceDigest = `source:sha256:${"a".repeat(64)}`;
const sessions: ReturnType<typeof createKitchenSession>[] = [];
afterEach(() => {
  for (const session of sessions.splice(0)) session.disconnect();
});

/** Control transport timing; every response still comes from the actual analysis owner. */
function laboratory(id: string) {
  const requests: KitchenRequest[] = [];
  const pending: {
    host: ReturnType<typeof createKitchenHost>;
    request: KitchenRequest;
  }[] = [];
  const counts = { created: 0, disposed: 0, unlistened: 0 };
  const session = createKitchenSession(
    id,
    () => {
      counts.created++;
      let deliver: ((message: unknown) => void) | undefined;
      const host = createKitchenHost(
        (message) => deliver?.(structuredClone(message)),
        sourceDigest,
      );
      return {
        listen(listener: (message: unknown) => void) {
          deliver = listener;
          return () => {
            counts.unlistened++;
            deliver = undefined;
          };
        },
        send(message: unknown) {
          const request = structuredClone(message) as KitchenRequest;
          requests.push(request);
          pending.push({ host, request });
        },
        dispose() {
          counts.disposed++;
          host.dispose();
        },
      };
    },
    sourceDigest,
  );
  sessions.push(session);
  return {
    session,
    requests,
    counts,
    async completeNext() {
      const next = pending.shift();
      if (!next) throw new Error("An actual kitchen request must be in flight.");
      await next.host.receive(next.request);
    },
  };
}

async function acceptInitial(lab: ReturnType<typeof laboratory>) {
  await lab.session.submit(kitchenFixture());
  await lab.completeNext();
  const accepted = lab.session.getSnapshot().accepted;
  if (!accepted)
    throw new Error(lab.session.getSnapshot().message || "Expected accepted analysis.");
  expect(accepted.snapshot).toBe(lab.session.getSnapshot().view.accepted);
  return accepted;
}

test("hiding before the file digest settles queues only the latest observations without creating a worker", async () => {
  const lab = laboratory("digest-visibility");
  const preparing = lab.session.submit(kitchenFixture());
  expect(lab.session.getSnapshot().preparing).toBe(true);
  lab.session.setSchedulingPaused(true);
  expect(await preparing).toBe(true);
  const latest = kitchenFixture({ metadata: { sample: "Latest synthetic observation fixture" } });
  await lab.session.submit(latest, { ...KITCHEN_OPTIONS, axis: "y", coverage: 0.9 });
  const requested = lab.session.getSnapshot().view.requested;
  expect(lab.counts.created).toBe(0);
  expect(lab.requests).toEqual([]);
  expect(lab.session.getSnapshot().view.pending).toBe(true);
  expect(lab.session.getSnapshot().accepted).toBeNull();

  lab.session.setSchedulingPaused(false);
  lab.session.setSchedulingPaused(false);
  expect(lab.counts.created).toBe(1);
  expect(lab.requests).toHaveLength(1);
  expect(lab.requests[0]?.token).toEqual(requested);
  expect(lab.requests[0]?.csv).toBe(latest);
  await lab.completeNext();
  const accepted = lab.session.getSnapshot().accepted;
  expect(accepted?.csv).toBe(latest);
  expect(accepted?.report.options).toEqual({ ...KITCHEN_OPTIONS, axis: "y", coverage: 0.9 });
  expect(accepted?.snapshot).toBe(lab.session.getSnapshot().view.accepted);
});

test("an in-flight current analysis may finish hidden and visibility alone preserves its accepted identity", async () => {
  const lab = laboratory("current-hidden");
  await lab.session.submit(kitchenFixture());
  lab.session.setSchedulingPaused(true);
  await lab.completeNext();
  const acceptedState = lab.session.getSnapshot();
  expect(acceptedState.accepted).not.toBeNull();
  expect(acceptedState.accepted?.snapshot).toBe(acceptedState.view.accepted);
  expect(acceptedState.view.pending).toBe(false);
  lab.session.setSchedulingPaused(false);
  lab.session.setSchedulingPaused(true);
  lab.session.setSchedulingPaused(false);
  expect(lab.session.getSnapshot()).toBe(acceptedState);
  expect(lab.requests).toHaveLength(1);
  expect(lab.counts.disposed).toBe(0);
});

test("finishing superseded work while hidden retains accepted observations and coalesces queued revisions", async () => {
  const lab = laboratory("queued-hidden");
  const accepted = await acceptInitial(lab);
  await lab.session.reanalyze({ ...KITCHEN_OPTIONS, coverage: 0.9 });
  await lab.session.reanalyze({ ...KITCHEN_OPTIONS, axis: "y", coverage: 0.8 });
  lab.session.setSchedulingPaused(true);
  await lab.completeNext();
  expect(lab.requests).toHaveLength(2);
  expect(lab.session.getSnapshot().accepted).toBe(accepted);
  expect(lab.session.getSnapshot().view.pending).toBe(true);
  await lab.session.reanalyze({ ...KITCHEN_OPTIONS, axis: "y", coverage: 0.99 });
  const latest = lab.session.getSnapshot().view.requested;
  expect(lab.session.getSnapshot().accepted).toBe(accepted);
  expect(lab.requests).toHaveLength(2);
  lab.session.setSchedulingPaused(false);
  lab.session.setSchedulingPaused(false);
  expect(lab.counts.created).toBe(1);
  expect(lab.requests).toHaveLength(3);
  expect(lab.requests[2]?.token).toEqual(latest);
  await lab.completeNext();
  const revised = lab.session.getSnapshot().accepted;
  expect(revised?.report.options).toEqual({ ...KITCHEN_OPTIONS, axis: "y", coverage: 0.99 });
  expect(revised?.sourceId).toBe(accepted.sourceId);
  expect(revised?.snapshot.runId).toBe(accepted.snapshot.runId);
  expect(revised?.csv).toBe(accepted.csv);
  expect(revised?.snapshot).toBe(lab.session.getSnapshot().view.accepted);
});

for (const phase of ["preparing", "queued"] as const)
  test(`stopping hidden ${phase} work never resurrects it on resume or removes accepted observations`, async () => {
    const lab = laboratory(`stop-hidden-${phase}`);
    const accepted = await acceptInitial(lab);
    lab.session.setSchedulingPaused(true);
    const submission = lab.session.reanalyze({ ...KITCHEN_OPTIONS, coverage: 0.9 });
    if (phase === "queued") await submission;
    else expect(lab.session.getSnapshot().preparing).toBe(true);
    lab.session.stop();
    expect(await submission).toBe(phase === "queued");
    lab.session.setSchedulingPaused(false);
    expect(lab.requests).toHaveLength(1);
    expect(lab.counts.disposed).toBe(1);
    expect(lab.counts.unlistened).toBe(1);
    expect(lab.session.getSnapshot().accepted).toBe(accepted);
    expect(lab.session.getSnapshot().view.pending).toBe(false);
    expect(lab.session.getSnapshot().preparing).toBe(false);
  });

for (const action of ["disconnect", "clear"] as const)
  test(`${action} while hidden releases the in-flight owner and drops queued work before resume`, async () => {
    const lab = laboratory(`${action}-hidden`);
    const accepted = await acceptInitial(lab);
    await lab.session.reanalyze({ ...KITCHEN_OPTIONS, coverage: 0.9 });
    lab.session.setSchedulingPaused(true);
    await lab.session.reanalyze({ ...KITCHEN_OPTIONS, axis: "y" });
    lab.session[action]();
    await lab.completeNext();
    lab.session.setSchedulingPaused(false);
    expect(lab.requests).toHaveLength(2);
    expect(lab.counts.disposed).toBe(1);
    expect(lab.counts.unlistened).toBe(1);
    expect(lab.session.getSnapshot().accepted).toBe(action === "clear" ? null : accepted);
    expect(lab.session.getSnapshot().view.pending).toBe(false);
  });

test("a subscriber hiding the newly requested input prevents dispatch until it is visible", async () => {
  const lab = laboratory("subscriber-visibility");
  const off = lab.session.subscribe(() => {
    if (lab.session.getSnapshot().view.pending && !lab.session.getSnapshot().preparing)
      lab.session.setSchedulingPaused(true);
  });
  await lab.session.submit(kitchenFixture());
  expect(lab.requests).toEqual([]);
  off();
  lab.session.setSchedulingPaused(false);
  await lab.completeNext();
  expect(lab.session.getSnapshot().accepted).not.toBeNull();
  expect(lab.requests).toHaveLength(1);
});
