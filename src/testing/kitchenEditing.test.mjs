import assert from "node:assert/strict";
import test from "node:test";
import { parseKitchenCsv } from "../experiments/bm07/kitchen/csv.ts";
import {
  kitchenInputDraft,
  reviseKitchenInputs,
  setKitchenExclusion,
} from "../experiments/bm07/kitchen/edit.ts";
import { kitchenAnalysisJson } from "../experiments/bm07/kitchen/export.ts";
import { createKitchenHost } from "../experiments/bm07/kitchen/host.ts";
import { createKitchenSession } from "../experiments/bm07/kitchen/session.ts";
import { kitchenFixture } from "./kitchen/fixture.mjs";

const document = () => parseKitchenCsv(kitchenFixture());
test("observation editing preserves every coordinate, time and identity and can restore an excluded row", () => {
  const d = document(),
    e = setKitchenExclusion(d, 1, " Obscured by another particle ");
  assert.equal(e.points.length, d.points.length);
  assert.equal(e.points[1].exclusionReason, "Obscured by another particle");
  for (let i = 0; i < d.points.length; i++) {
    const { status, exclusionReason, ...rest } = e.points[i];
    const { status: a, exclusionReason: b, ...original } = d.points[i];
    assert.deepEqual(rest, original);
  }
  assert.deepEqual(setKitchenExclusion(e, 1, null).points, d.points);
  assert.equal(d.points[1].status, "measured");
  for (const index of [-1, NaN, 80, 60]) assert.throws(() => setKitchenExclusion(d, index, "blur"));
  assert.throws(() => setKitchenExclusion(d, 0, ""));
  const lost = {
    ...d,
    points: d.points.map((p, i) =>
      i === 1 ? { ...p, status: "lost", lossReason: "focus", x: null, y: null } : p,
    ),
  };
  assert.throws(() => setKitchenExclusion(lost, 1, null));
});
test("input revisions cannot rewrite data origin, samples, geometry, coordinates or timing evidence", () => {
  const d = document(),
    input = kitchenInputDraft(d),
    revised = reviseKitchenInputs(d, {
      ...input,
      radius_um: ".5",
      radius_provenance: "independent",
    });
  assert.deepEqual(revised.points, d.points);
  assert.equal(revised.metadata.data_origin, "synthetic");
  assert.equal(revised.metadata.timing_source, d.metadata.timing_source);
  for (const extra of [
    { data_origin: "reader-supplied" },
    { sample: "verified" },
    { source_width_px: "1" },
  ])
    assert.throws(() => reviseKitchenInputs(d, { ...input, ...extra }));
  assert.throws(() => reviseKitchenInputs(d, { ...input, radius_um: "=1+1" }));
  assert.throws(() => reviseKitchenInputs(d, { ...input, exposure_s: "2" }));
  const unsafe = { ...input };
  Object.defineProperty(unsafe, "radius_um", {
    get() {
      throw new Error("getter evaluated");
    },
  });
  assert.throws(() => reviseKitchenInputs(d, unsafe), /bounded text/);
});
test("analysis receipt exports accepted values, provenance and reimportable coordinates without starting more work", async (t) => {
  const source = `source:sha256:${"a".repeat(64)}`;
  let listener,
    requests = 0;
  const host = createKitchenHost((message) => listener(structuredClone(message)), source);
  const session = createKitchenSession(
    "receipt",
    () => ({
      listen(fn) {
        listener = fn;
        return () => {};
      },
      send(message) {
        requests++;
        void host.receive(structuredClone(message));
      },
      dispose() {
        host.dispose();
      },
    }),
    source,
  );
  t.after(() => session.disconnect());
  const done = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("analysis timeout")), 2000);
    const off = session.subscribe(() => {
      if (session.getSnapshot().accepted) {
        clearTimeout(timer);
        off();
        resolve();
      }
    });
  });
  await session.submit(kitchenFixture());
  await done;
  const accepted = session.getSnapshot().accepted,
    encoded = kitchenAnalysisJson(accepted, source),
    receipt = JSON.parse(encoded);
  assert.match(receipt.provenance, /Synthetic practice/);
  assert.deepEqual(parseKitchenCsv(receipt.observationsCsv).points, accepted.document.points);
  assert.deepEqual(
    receipt.results.find((o) => o.quantityId === "pairs").value,
    Array.from(accepted.snapshot.outputs.find((o) => o.quantityId === "pairs").value.copy()),
  );
  assert.equal(requests, 1);
  assert.equal(kitchenAnalysisJson(accepted, source), encoded);
  assert.equal(session.getSnapshot().accepted, accepted);
  assert.throws(
    () => kitchenAnalysisJson({ ...accepted, documentDigest: `sha256:${"b".repeat(64)}` }, source),
    /different identities/,
  );
  assert.throws(() => kitchenAnalysisJson(accepted, "unknown"));
});
