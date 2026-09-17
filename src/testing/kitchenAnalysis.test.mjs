import test from "node:test";
import assert from "node:assert/strict";
import { parseKitchenCsv } from "../experiments/bm07/kitchen/csv.ts";
import {
  analyzeKitchen,
  kitchenTracks,
  KITCHEN_OPTIONS,
  KITCHEN_OUTPUTS,
} from "../experiments/bm07/kitchen/analyze.ts";
import { kitchenFixture } from "./kitchen/fixture.mjs";
import { decodeResultBatch } from "../experiments/results/codec.ts";
const doc = (patch = {}) => parseKitchenCsv(kitchenFixture(patch));
const a = (d = doc(), patch = {}) => analyzeKitchen(d, { ...KITCHEN_OPTIONS, ...patch });
const out = (r, id) => r.outputs.find((o) => o.quantityId === id);
const n = (r, id) => {
  const o = out(r, id);
  assert.equal(o.status, "value", JSON.stringify(o));
  return o.value;
};
const change = (d, index, patch) => ({
  ...d,
  points: d.points.map((p, i) => (i === index ? { ...p, ...patch } : p)),
});
test("observational analysis publishes complete typed results from fixed disjoint pairs and stationary noise", () => {
  const r = a();
  assert.equal(r.counts.retainedPairs, 30);
  assert.equal(n(r, "pairDegrees"), 29);
  assert.equal(r.counts.stationary, 20);
  assert.equal(r.scale, 1e-7);
  assert.equal(r.scaleSource, "measured");
  assert.ok(n(r, "noiseVariance") > 0);
  assert.ok(n(r, "correctedD") < n(r, "naiveD"));
  assert.equal(out(r, "diffusionInterval").status, "value");
  assert.equal(out(r, "molecularNumber").status, "underdetermined");
  assert.equal(r.numberMeaning, "synthetic-recovery");
  const revisions = { input: 1, observer: 0, measurement: 0, estimator: 0 };
  assert.equal(
    decodeResultBatch(
      { revisions, outputs: r.outputs },
      {
        expectedRevisions: revisions,
        allowPartial: true,
        statuses: Object.fromEntries(
          Object.entries(KITCHEN_OUTPUTS).map(([k, c]) => [k, c.statuses]),
        ),
      },
    ).outputs.length,
    Object.keys(KITCHEN_OUTPUTS).length,
  );
});
test("unknown localization/exposure and uncalibrated axes stay explicit, not zero-error defaults", () => {
  const d = doc(),
    without = { ...d, points: d.points.filter((p) => p.kind !== "stationary") };
  assert.match(a(without).intervalReasons.join(" "), /Localization error unknown/);
  assert.notEqual(out(a(without), "noiseVariance").status, "value");
  assert.notEqual(out(a(without), "correctedD").status, "value");
  assert.match(
    a(doc({ metadata: { exposure_s: "" } })).intervalReasons.join(" "),
    /Declare the exposure/,
  );
  const x = doc({
    metadata: { calibration_axes: "x", pixels_per_um_y: "", pixel_aspect_ratio: "" },
  });
  assert.equal(a(x).scale, 1e-7);
  const y = a(x, { axis: "y" });
  assert.equal(y.scale, null);
  assert.notEqual(out(y, "naiveD").status, "value");
  const derived = a(
    doc({ metadata: { calibration_axes: "x", pixels_per_um_y: "", pixel_aspect_ratio: "2" } }),
    { axis: "y" },
  );
  assert.equal(derived.scale, 2e-7);
  assert.equal(derived.scaleSource, "derived");
});
test("exclusions, interpolation and absent slots never shift later pair boundaries", () => {
  const d = doc(),
    original = n(a(d), "pairTimes");
  for (const status of ["excluded", "interpolated"]) {
    const r = a(change(d, 1, { status, exclusionReason: status === "excluded" ? "Blurred" : "" }));
    assert.equal(r.counts.retainedPairs, 29);
    assert.deepEqual(n(r, "pairTimes"), original.slice(2));
    assert.equal(r.lostPairs[status], 1);
    if (status === "excluded") assert.notEqual(out(r, "diffusionInterval").status, "value");
  }
  const missing = { ...d, points: d.points.filter((_, i) => i !== 2) };
  assert.equal(a(missing).counts.retainedPairs, 29);
  assert.deepEqual([...n(a(missing), "pairTimes")].slice(0, 4), [0, 1, 4, 5]);
  assert.deepEqual(n(a(d), "pairTimes"), original);
});
test("loss threshold counts attempts; reacquisition retains holes and new-object splits labels", () => {
  let d = doc();
  for (let i = 0; i < 7; i++)
    d = change(d, 2 * i, { status: "lost", lossReason: "edge", x: null, y: null });
  const r = a(d);
  assert.equal(r.counts.attemptedPairs, 30);
  assert.equal(r.lostPairs.edge, 7);
  assert.match(r.intervalReasons.join(" "), /20%/);
  assert.equal(out(r, "diffusionInterval").status, "not-applicable");
  const small = a(change(doc(), 0, { status: "lost", lossReason: "edge", x: null, y: null }));
  assert.equal(small.counts.retainedPairs, 29);
  assert.ok(small.warnings.some((s) => /biased low/.test(s)));
  const split = change(change(doc(), 3, { status: "lost", lossReason: "focus" }), 4, {
    identityDecision: "new-object",
  });
  assert.equal(kitchenTracks(split).length, 2);
  const second = a(split, { track: kitchenTracks(split)[1].key });
  assert.equal(second.selectedTrack, kitchenTracks(split)[1].key);
  assert.equal(n(second, "pairTimes")[0], 4);
});
test("irregular actual timing, duplicate nominal slots and mixed calibration never acquire interval coverage", () => {
  const d = doc();
  for (const patch of [{ time: 1.01 }, { time: 0.01 }, { calibrationId: "cal-2" }]) {
    const r = a(change(d, 1, patch));
    assert.notEqual(out(r, "diffusionInterval").status, "value");
    assert.ok(r.intervalReasons.length);
  }
  const ratio = a(doc({ metadata: { pixels_per_um_y: "20" } }));
  assert.match(ratio.intervalReasons.join(" "), /aspect ratio/);
  assert.ok(ratio.warnings.some((x) => /pooled/.test(x)));
  const checked = a(doc({ metadata: { pixels_per_um_y: "20", pixel_aspect_ratio: ".5" } }));
  assert.equal(checked.intervalReasons.length, 0);
});
test("changing independent radius or constant interpretation cannot alter observations or diffusion", () => {
  const d = doc({
      metadata: {
        radius_um: ".5",
        radius_provenance: "independent",
        data_origin: "reader-supplied",
      },
    }),
    r = a(d);
  assert.equal(r.numberMeaning, "independent-estimate");
  assert.ok(n(r, "molecularNumber") > 0);
  const before = JSON.stringify(d.points);
  const modern = a(d, { constantSet: "modern-si-2019" });
  assert.equal(modern.numberMeaning, "consistency-check");
  assert.ok(n(modern, "consistencyRatio") > 0);
  assert.equal(n(modern, "correctedD"), n(r, "correctedD"));
  assert.deepEqual(n(modern, "diffusionInterval"), n(r, "diffusionInterval"));
  assert.equal(JSON.stringify(d.points), before);
  const larger = a({ ...d, metadata: { ...d.metadata, radius_um: "1" } });
  assert.equal(n(larger, "molecularNumber"), n(r, "molecularNumber") / 2);
  assert.deepEqual(n(larger, "pairs"), n(r, "pairs"));
  assert.equal(
    out(
      a({ ...d, metadata: { ...d.metadata, radius_provenance: "same-displacements" } }),
      "molecularNumber",
    ).status,
    "underdetermined",
  );
});
test("unsupported historical sets and omitted physical conditions never fabricate a molecular number", () => {
  const historical = a(
    doc({
      metadata: {
        radius_um: ".5",
        radius_provenance: "independent",
        constant_set_id: "einstein-1905-brownian-printed",
      },
    }),
  );
  assert.equal(historical.numberMeaning, "unavailable");
  assert.notEqual(out(historical, "molecularNumber").status, "value");
  assert.equal(out(historical, "diffusionInterval").status, "value");
  for (const key of ["temperature_k", "viscosity_mpa_s"]) {
    const r = a(
      doc({ metadata: { [key]: "", radius_um: ".5", radius_provenance: "independent" } }),
    );
    assert.notEqual(out(r, "molecularNumber").status, "value");
  }
  assert.match(a().combinedIntervalReason, /No combined interval/);
  assert.throws(() => a(doc(), { coverage: 1 }));
  assert.throws(() => a(doc(), { track: "invented" }));
});
