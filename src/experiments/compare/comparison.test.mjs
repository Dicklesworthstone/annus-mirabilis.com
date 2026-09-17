import assert from "node:assert/strict";
import test from "node:test";
import { pinBaseline } from "./Baseline.ts";
import { singleVariationLock } from "./singleVariationLock.ts";
import { compareBaselines } from "./compatibility.ts";
import { COMMON_RANDOM_NUMBERS_NOTE, comparisonStatement } from "./comparisonStatement.ts";

const identity = { modelVersion: "model-1", streamVersion: "normal-1", allocationId: "allocation-1",
  constantSetId: "constants-1", sourceDigest: "source:sha256:example", artifactDigest: null, executionLabel: "host-calculation" };
const input = (label, command = "setup-change", comparable = true) => ({ label, command, comparable, unit: "", displayFactor: 1 });
const contract = { experimentId: "fixture", inputs: { radius: input("Radius"), viscosity: input("Viscosity"),
  seed: input("Seed", "setup-change", false), interval: input("Observation interval", "measurement-change"),
  frame: input("Frame", "observer-change"), estimator: input("Estimator", "estimator-change"),
  zoom: input("Zoom", "presentation-change") },
  outputs: [{ id: "spread", label: "Spread", displayUnit: "m", displayFactor: 1 }] };
function snapshot(patch = {}) {
  return { experimentId: "fixture", instanceId: "instance-1", runId: "run-1", snapshotVersion: 1,
    actionIndex: 1, final: true, revisions: { input: 1, observer: 0, measurement: 0, estimator: 0 },
    parameters: { radius: 1, viscosity: 1, seed: "18446744073709551615", interval: 1, frame: 0, estimator: "rms", zoom: 1 },
    outputs: [{ quantityId: "spread", unit: "m", semanticKind: "coordinate-rms", status: "value", value: 4 }], ...patch };
}
const pin = (s = snapshot(), metadata = identity) => pinBaseline(s, metadata, ["spread"]);
function variant(parameters = { radius: 2 }, patch = {}) {
  const s = snapshot();
  return pin({ ...s, runId: "run-2", snapshotVersion: 2, actionIndex: 2,
    parameters: { ...s.parameters, ...parameters }, ...patch });
}

test("pinning detaches scalar data and provenance from later mutation", () => {
  const s = snapshot(), meta = { ...identity }, baseline = pin(s, meta);
  s.parameters.radius = 99; s.outputs[0].value = 99; s.revisions.input = 99; meta.sourceDigest = "changed";
  assert.equal(baseline.parameters.radius, 1); assert.equal(baseline.outputs.spread.value, 4);
  assert.equal(baseline.acceptedInputRevision, 1); assert.equal(baseline.identity.sourceDigest, identity.sourceDigest);
  assert.ok(Object.isFrozen(baseline.outputs.spread)); assert.ok(Object.isFrozen(baseline.identity));
});
test("full unsigned 64-bit seeds survive JSON without numeric conversion", () => {
  assert.equal(JSON.parse(JSON.stringify(pin())).parameters.seed, "18446744073709551615");
});
test("pinning refuses partial snapshots and missing accepted identities", () => {
  for (const patch of [{ final: false }, { snapshotVersion: 0 }, { instanceId: "" }, { actionIndex: NaN }])
    assert.throws(() => pin(snapshot(patch)), TypeError);
});
test("pinning refuses invalid seeds instead of rounding or coercing them", () => {
  for (const seed of [1905, "01", "-1", "18446744073709551616", "1e3"]) {
    const s = snapshot(); s.parameters.seed = seed; assert.throws(() => pin(s), TypeError);
  }
});
test("nonnumeric statuses stay typed with their owner explanation", () => {
  const s = snapshot(); s.outputs[0] = { ...s.outputs[0], status: "not-applicable", reason: "Zero elapsed time", value: undefined };
  const baseline = pin(s);
  assert.equal(baseline.outputs.spread.value, null); assert.equal(baseline.outputs.spread.reason, "Zero elapsed time");
  const result = compareBaselines(baseline, variant(), contract);
  assert.equal(result.kind, "accepted"); assert.equal(result.rows[0].ratio.status, "not-applicable");
});
test("missing, duplicate, nonfinite or array scalar outputs are refused", () => {
  const s = snapshot();
  for (const outputs of [[], [...s.outputs, s.outputs[0]], [{ ...s.outputs[0], value: Infinity }],
    [{ ...s.outputs[0], value: new Float64Array([4]) }]]) assert.throws(() => pin({ ...s, outputs }));
});
test("a duplicate output selection is refused", () => {
  assert.throws(() => pinBaseline(snapshot(), identity, ["spread", "spread"]));
});
test("the lock allows exactly one declared independent input", () => {
  const a = pin(), b = variant();
  assert.deepEqual(singleVariationLock(a.parameters, b.parameters, contract),
    { kind: "accepted", changedInput: "radius", command: "setup-change" });
});
test("a second input change is blocked with a re-baseline repair", () => {
  const result = compareBaselines(pin(), variant({ radius: 2, viscosity: 2 }), contract);
  assert.equal(result.code, "second-input-change"); assert.match(result.message, /pin a new baseline/u);
});
test("seeds remain locked: common random numbers are not called independent trials", () => {
  assert.equal(compareBaselines(pin(), variant({ seed: "1906" }), contract).code, "input-locked");
  assert.match(COMMON_RANDOM_NUMBERS_NOTE, /not independent trials/u);
});
test("a new baseline deliberately permits a different next change", () => {
  const baseline = variant();
  const current = variant({ radius: 2, viscosity: 2 }, { runId: "run-3", snapshotVersion: 3, actionIndex: 3 });
  assert.equal(compareBaselines(baseline, current, contract).kind, "accepted");
});
test("unknown, omitted, mistyped and undeclared settings are refused", () => {
  const p = pin().parameters;
  for (const changed of [{ ...p, surprise: 2 }, { ...p, radius: "2" }, { ...p, radius: NaN }])
    assert.equal(singleVariationLock(p, changed, contract).code, "invalid-input");
  const { radius, ...missing } = p;
  assert.equal(singleVariationLock(p, missing, contract).code, "invalid-input");
  assert.equal(singleVariationLock(p, p, { ...contract, inputs: {} }).code, "invalid-input");
});
test("parameter accessors never execute at the boundary", () => {
  let called = false; const p = { ...pin().parameters };
  Object.defineProperty(p, "radius", { enumerable: true, get() { called = true; return 1; } });
  assert.equal(singleVariationLock(pin().parameters, p, contract).kind, "refused"); assert.equal(called, false);
});
test("each model and executable mismatch refuses otherwise plausible numbers", () => {
  for (const key of Object.keys(identity)) {
    const current = pin(snapshot({ runId: "run-2" }), { ...identity, [key]: "changed" });
    assert.equal(compareBaselines(pin(), current, contract).kind, "refused", key);
  }
});
test("same-quantity labels do not hide different units or semantic kinds", () => {
  for (const patch of [{ unit: "cm" }, { semanticKind: "radial-rms" }]) {
    const s = snapshot(); s.outputs[0] = { ...s.outputs[0], ...patch };
    assert.equal(compareBaselines(pin(), pin(s), contract).code, "output-contract-mismatch");
  }
});
test("physical setup changes branch the run; an unchanged identity is refused", () => {
  assert.equal(compareBaselines(pin(), variant({ radius: 2 }, { runId: "run-1" }), contract).code, "run-not-branched");
});
for (const [parameter, value, command] of [["interval", 4, "measurement-change"], ["frame", .6, "observer-change"], ["estimator", "mean-square", "estimator-change"]]) {
  test(`${command} retains the run instead of simulating a different world`, () => {
    assert.equal(compareBaselines(pin(), variant({ [parameter]: value }), contract).code, "run-not-preserved");
    const result = compareBaselines(pin(), variant({ [parameter]: value }, { runId: "run-1" }), contract);
    assert.equal(result.kind, "accepted"); assert.equal(result.variation.command, command);
  });
}
test("zero baseline ratios and numeric overflow are explicitly not applicable", () => {
  const s = snapshot(); s.outputs[0].value = 0;
  const result = compareBaselines(pin(s), variant(), contract);
  assert.equal(result.rows[0].ratio.status, "not-applicable"); assert.equal(result.rows[0].difference.value, 4);
  s.outputs[0].value = Number.MIN_VALUE;
  assert.equal(compareBaselines(pin(s), variant(), contract).rows[0].ratio.status, "not-applicable");
});
test("ratios and differences use accepted values rather than a model recomputation", () => {
  const s = snapshot(); s.outputs[0].value = 3;
  const b = variant({ radius: 2 }, { outputs: s.outputs });
  const result = compareBaselines(pin(), b, contract);
  assert.equal(result.rows[0].ratio.value, .75); assert.equal(result.rows[0].difference.value, -1);
  const text = comparisonStatement(pin(), b, contract, result);
  for (const phrase of ["Physically changed:", "Held fixed:", "Re-described:", "Changed as a consequence", "ratio 0.75"])
    assert.ok(text.includes(phrase));
});
test("presentation changes make no scientific claim", () => {
  const a = pin(), b = variant({ zoom: 2 }, { runId: "run-1" });
  assert.match(comparisonStatement(a, b, contract, compareBaselines(a, b, contract)), /^Only the view changed/u);
});
test("a stale or mixed snapshot is not a valid measurement variant", () => {
  const a = variant({}, { runId: "run-1", snapshotVersion: 5, actionIndex: 5 });
  assert.equal(compareBaselines(a, pin(), contract).code, "stale-variant");
  assert.equal(compareBaselines(pin(), variant({ interval: 4 }, { runId: "run-1", snapshotVersion: 1 }), contract).code, "mixed-snapshot");
});
