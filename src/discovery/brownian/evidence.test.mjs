import assert from "node:assert/strict";
import test from "node:test";
import {
  captureTracerEvidence, compareTracerEvidence, diffusivitySource,
  tracerEvidenceCsv, TRACER_EVIDENCE_QUANTITIES,
} from "./evidence.ts";

function snapshot(patch = {}) {
  const values = [0.4e-12, 1, -0.1e-6, 0.8e-12, 0.9e-6, 0.894e-6, 0.9e-6, 0.894e-6];
  const units = ["m2/s", "s", "m", "m2", "m", "m", "m/s", "m/s"];
  return {
    experimentId: "bm-01", instanceId: "tracer-a", runId: "run-1",
    snapshotVersion: 1, final: true,
    parameters: { seed: "18446744073709551615", interval: 1, d: 1, axis: 0 },
    outputs: TRACER_EVIDENCE_QUANTITIES.map((quantityId, i) => ({
      quantityId, status: "value", value: values[i], unit: units[i],
    })),
    ...patch,
  };
}
const capture = (s = snapshot()) => captureTracerEvidence(s, "digest-a");

test("capture detaches parameters and outputs from subsequent mutation", () => {
  const input = snapshot();
  const saved = capture(input);
  input.parameters.interval = 4;
  input.outputs[0].value = 42;
  assert.equal(saved.parameters.interval, 1);
  assert.equal(saved.outputs.diffusionCoefficient.value, 0.4e-12);
  assert.ok(Object.isFrozen(saved));
  assert.ok(Object.isFrozen(saved.parameters));
  assert.ok(Object.isFrozen(saved.outputs.diffusionCoefficient));
});
test("preserves full unsigned 64-bit seeds through JSON", () => {
  assert.equal(JSON.parse(JSON.stringify(capture())).parameters.seed, "18446744073709551615");
});
test("refuses an unfinished, foreign or unidentified snapshot", () => {
  for (const patch of [{ final: false }, { experimentId: "bm-06" },
    { snapshotVersion: NaN }, { snapshotVersion: 0 }, { runId: "" }]) {
    assert.throws(() => capture(snapshot(patch)), TypeError);
  }
});
test("refuses missing, duplicate and nonfinite scalar outputs", () => {
  const input = snapshot();
  assert.throws(() => capture({ ...input, outputs: input.outputs.slice(1) }));
  assert.throws(() => capture({ ...input, outputs: [...input.outputs, input.outputs[0]] }));
  for (const value of [NaN, Infinity, new Float64Array([1])]) {
    const bad = snapshot(); bad.outputs[0].value = value;
    assert.throws(() => capture(bad), TypeError);
  }
});
test("typed nonnumeric results are not converted to zero", () => {
  const input = snapshot();
  input.outputs[7] = { quantityId: "modelApparentSpeed", status: "not-applicable", unit: "m/s" };
  const record = capture(input);
  assert.deepEqual(record.outputs.modelApparentSpeed, {
    status: "not-applicable", unit: "m/s", value: null,
  });
  assert.equal(compareTracerEvidence(record, record).modelApparentSpeedRatio, null);
});
test("diffusivity handoff retains the exact source identity and value", () => {
  assert.deepEqual(diffusivitySource(capture()), {
    instanceId: "tracer-a", runId: "run-1", snapshotVersion: 1, value: 0.4e-12,
  });
});
test("handoff rejects wrong units, zero and nonnumeric diffusivity", () => {
  for (const patch of [{ unit: "m2" }, { value: 0 }, { status: "not-applicable" }]) {
    const input = snapshot(); Object.assign(input.outputs[0], patch);
    assert.throws(() => diffusivitySource(capture(input)), TypeError);
  }
});
test("same-recording comparisons use accepted readouts, not an idealized recomputation", () => {
  const before = capture(), input = snapshot({ snapshotVersion: 2 });
  input.parameters.interval = 4;
  input.outputs[1].value = 4;
  input.outputs[4].value = 1.73e-6;
  input.outputs[5].value *= 2;
  input.outputs[7].value /= 2;
  const comparison = compareTracerEvidence(before, capture(input));
  assert.equal(comparison.intervalRatio, 4);
  assert.equal(comparison.modelRmsRatio, 2);
  assert.equal(comparison.sampleRmsRatio, 1.73e-6 / 0.9e-6);
  assert.equal(comparison.modelApparentSpeedRatio, 0.5);
});
test("changing trial, placement, build or projection invalidates paired ratios", () => {
  const baseline = capture();
  const variants = [capture(snapshot({ runId: "new-trial" })),
    capture(snapshot({ instanceId: "tracer-b" })),
    captureTracerEvidence(snapshot(), "other-build"),
    capture(snapshot({ parameters: { ...snapshot().parameters, axis: 1 } }))];
  for (const current of variants) {
    assert.equal(compareTracerEvidence(baseline, current).sampleRmsRatio, null);
  }
});
test("zero baseline never yields infinity or a fabricated ratio", () => {
  const input = snapshot(); input.outputs[4].value = 0;
  assert.equal(compareTracerEvidence(capture(input), capture()).sampleRmsRatio, null);
});
test("CSV carries units, status, provenance, negative measurements and exact settings", () => {
  const csv = tracerEvidenceCsv([capture()]);
  assert.equal(csv.split("\r\n").length, 10);
  assert.match(csv, /"tracer-a","run-1",/);
  assert.match(csv, /"sampleMean","-1e-7","m","value"/);
  assert.ok(csv.includes("18446744073709551615"));
  assert.ok(csv.includes('""seed""'));
});
test("CSV escapes quotes, newlines and spreadsheet formulas in provenance", () => {
  const csv = tracerEvidenceCsv([capture(snapshot({ instanceId: '=HYPERLINK("bad")\n' }))]);
  assert.ok(csv.includes('"\'=HYPERLINK(""bad"")\n"'));
});
