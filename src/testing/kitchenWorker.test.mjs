import assert from "node:assert/strict";
import test from "node:test";
import { Worker } from "node:worker_threads";
import { exportKitchenCsv } from "../experiments/bm07/kitchen/csv.ts";
import { KITCHEN_OPTIONS } from "../experiments/bm07/kitchen/definition.ts";
import { createKitchenSession } from "../experiments/bm07/kitchen/session.ts";
import { kitchenFixture } from "./kitchen/fixture.mjs";

const sourceDigest = `source:sha256:${"a".repeat(64)}`;
const value = (a, id) => a.snapshot.outputs.find((o) => o.quantityId === id);
function factory(counts, extra = {}) {
  return () => {
    counts.created++;
    const w = new Worker(new URL("./worker-fixtures/kitchenNodeWorker.mjs", import.meta.url), {
      execArgv: ["--experimental-strip-types"],
      workerData: { sourceDigest, ...extra },
    });
    return {
      send(m) {
        counts.sent++;
        w.postMessage(m);
      },
      listen(onMessage, onError) {
        w.on("message", onMessage);
        w.on("error", onError);
        return () => {
          w.off("message", onMessage);
          w.off("error", onError);
        };
      },
      dispose() {
        counts.disposed++;
        void w.terminate();
      },
    };
  };
}
function session(t, id = "kitchen", extra = {}) {
  const counts = { created: 0, sent: 0, disposed: 0 },
    s = createKitchenSession(id, factory(counts, extra), sourceDigest);
  t.after(() => s.disconnect());
  return { s, counts };
}
function wait(s, pred) {
  if (pred(s.getSnapshot())) return Promise.resolve(s.getSnapshot());
  return new Promise((res, rej) => {
    const timer = setTimeout(() => {
        off();
        rej(new Error(s.getSnapshot().message || s.getSnapshot().view.status));
      }, 10000),
      off = s.subscribe(() => {
        const state = s.getSnapshot();
        if (pred(state)) {
          clearTimeout(timer);
          off();
          res(state);
        }
      });
  });
}
async function apply(s, fn) {
  await fn();
  return (await wait(s, (x) => x.view.status === "accepted" && !x.preparing)).accepted;
}
test("empty kitchen creates no worker; actual local analysis binds document, report and immutable snapshot", async (t) => {
  const { s, counts } = session(t);
  assert.equal(s.getSnapshot(), s.getServerSnapshot());
  assert.equal(counts.created, 0);
  const a = await apply(s, () => s.submit(kitchenFixture()));
  assert.equal(counts.created, 1);
  assert.equal(a.document.points.length, 80);
  assert.equal(value(a, "pairCount").value, 30);
  assert.equal(a.report.counts.retainedPairs, 30);
  assert.ok(/^sha256:[0-9a-f]{64}$/.test(a.sourceId));
  assert.equal(a.sourceId, a.documentDigest);
  assert.ok(Object.isFrozen(a.report.counts));
  const buffer = value(a, "pairs").value,
    original = buffer.at(0);
  buffer.copy()[0] = 123;
  assert.equal(buffer.at(0), original);
  assert.throws(() => {
    a.document.points[0].x = 123;
  });
});
test("inference choices reuse exact observations and physical identity; independent radius edits change only revision", async (t) => {
  const { s } = session(t);
  const a = await apply(s, () =>
      s.submit(kitchenFixture({ metadata: { data_origin: "reader-supplied" } })),
    ),
    b = await apply(s, () =>
      s.reanalyze({ ...KITCHEN_OPTIONS, coverage: 0.9, constantSet: "modern-si-2019" }),
    );
  assert.deepEqual(a.document, b.document);
  assert.equal(a.sourceId, b.sourceId);
  assert.equal(a.snapshot.runId, b.snapshot.runId);
  assert.equal(a.snapshot.revisions.measurement, b.snapshot.revisions.measurement);
  assert.ok(b.snapshot.revisions.estimator > a.snapshot.revisions.estimator);
  assert.equal(value(a, "correctedD").value, value(b, "correctedD").value);
  const c = await apply(s, () =>
    s.revise({
      ...b.document,
      metadata: { ...b.document.metadata, radius_um: ".5", radius_provenance: "independent" },
    }),
  );
  assert.equal(c.snapshot.runId, b.snapshot.runId);
  assert.notEqual(c.documentDigest, b.documentDigest);
  assert.equal(c.sourceId, b.sourceId);
  assert.deepEqual(c.document.points, b.document.points);
  assert.equal(value(c, "molecularNumber").status, "value");
});
test("malformed CSV, oversize inputs and unsupported choices preserve accepted science", async (t) => {
  const { s } = session(t);
  const a = await apply(s, () => s.submit(kitchenFixture()));
  await s.submit("not a CSV");
  await wait(s, (x) => x.view.status === "refused");
  assert.equal(s.getSnapshot().accepted, a);
  assert.match(s.getSnapshot().message, /columns/);
  await s.submit("x".repeat(2097153));
  assert.equal(s.getSnapshot().accepted, a);
  assert.match(s.getSnapshot().message, /2 MiB/);
  await s.reanalyze({ ...KITCHEN_OPTIONS, coverage: 1 });
  assert.equal(s.getSnapshot().accepted, a);
  const b = await apply(s, () => s.reanalyze(KITCHEN_OPTIONS));
  assert.equal(b.sourceId, a.sourceId);
  assert.equal(b.snapshot.parameters.sourceId, a.sourceId);
  assert.deepEqual(b.document, a.document);
});
test("exclusions are reversible edits; timestamps and source coordinates survive unchanged", async (t) => {
  const { s } = session(t),
    a = await apply(s, () => s.submit(kitchenFixture()));
  const points = a.document.points.map((p, i) =>
    i === 1 ? { ...p, status: "excluded", exclusionReason: "Blurred frame" } : p,
  );
  const b = await apply(s, () => s.revise({ ...a.document, points }));
  assert.equal(value(b, "pairCount").value, 29);
  assert.equal(value(b, "diffusionInterval").status, "not-applicable");
  assert.equal(b.document.points[1].x, a.document.points[1].x);
  assert.equal(b.snapshot.runId, a.snapshot.runId);
  assert.ok(exportKitchenCsv(b.document).includes("Blurred frame"));
  const restored = await apply(s, () => s.revise(a.document));
  assert.equal(value(restored, "pairCount").value, 30);
  assert.deepEqual(value(restored, "pairs").value.copy(), value(a, "pairs").value.copy());
});
test("malformed worker arrays never replace an accepted local analysis", async (t) => {
  const { s } = session(t, "bad", { breakAfter: 2 });
  const a = await apply(s, () => s.submit(kitchenFixture()));
  await s.reanalyze({ ...KITCHEN_OPTIONS, axis: "y" });
  await wait(s, (x) => x.view.status === "unavailable");
  assert.equal(s.getSnapshot().accepted, a);
  assert.match(s.getSnapshot().message, /malformed/);
});
test("rapid changes coalesce; older work and digest races cannot overwrite the newest request", async (t) => {
  const { s, counts } = session(t, "rapid", { delay: 80 });
  await s.submit(kitchenFixture());
  for (let i = 0; i < 15; i++)
    await s.submit(kitchenFixture({ metadata: { sample: `request ${i}` } }));
  const a = (await wait(s, (x) => x.view.status === "accepted")).accepted;
  assert.equal(a.document.metadata.sample, "request 14");
  assert.ok(counts.sent <= 3);
  await new Promise((r) => setTimeout(r, 120));
  assert.equal(s.getSnapshot().accepted, a);
  const jobs = [];
  for (let i = 0; i < 20; i++)
    jobs.push(s.submit(kitchenFixture({ metadata: { sample: `digest ${i}` } })));
  await Promise.all(jobs);
  await wait(
    s,
    (x) => x.view.status === "accepted" && x.accepted.document.metadata.sample === "digest 19",
  );
});
test("independent placements and clear release local data without deleting other instances or files", async (t) => {
  const { s: a, counts } = session(t, "first"),
    { s: b } = session(t, "second");
  const first = await apply(a, () => a.submit(kitchenFixture())),
    second = await apply(b, () =>
      b.submit(kitchenFixture({ metadata: { pixels_per_um_x: "20", pixels_per_um_y: "20" } })),
    );
  assert.notEqual(first.snapshot.runId, second.snapshot.runId);
  assert.notEqual(value(first, "naiveD").value, value(second, "naiveD").value);
  a.clear();
  assert.equal(a.getSnapshot().accepted, null);
  assert.equal(counts.disposed, 1);
  assert.equal(b.getSnapshot().accepted, second);
  const again = await apply(a, () => a.submit(kitchenFixture()));
  assert.notEqual(again.snapshot.runId, first.snapshot.runId);
});
test("stop invalidates pending analysis and retains the previous accepted bundle", async (t) => {
  const { s, counts } = session(t, "stop", { delay: 80 }),
    a = await apply(s, () => s.submit(kitchenFixture()));
  await s.reanalyze({ ...KITCHEN_OPTIONS, axis: "y" });
  s.stop();
  await new Promise((r) => setTimeout(r, 160));
  assert.equal(s.getSnapshot().accepted, a);
  assert.equal(s.getSnapshot().view.status, "paused");
  assert.equal(counts.disposed, 1);
});
