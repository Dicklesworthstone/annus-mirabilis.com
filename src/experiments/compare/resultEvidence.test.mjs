import assert from "node:assert/strict";
import test from "node:test";
import { pinBaseline } from "./Baseline.ts";
import { compareBaselines } from "./compatibility.ts";
import { comparisonEvidence } from "./resultEvidence.ts";

const identity = {
  modelVersion: "model-1",
  streamVersion: "stream-1",
  allocationId: "allocation-1",
  constantSetId: "constants-1",
  sourceDigest: "source-1",
  artifactDigest: null,
  executionLabel: "host-calculation",
};
const quantity = {
  quantityId: "reading",
  unit: "m",
  semanticKind: "coordinate-reading",
  ownerId: "reference.reading",
};
const contract = {
  experimentId: "evidence-fixture",
  inputs: {
    radius: {
      label: "Radius",
      unit: "m",
      displayFactor: 1,
      command: "setup-change",
      comparable: true,
    },
  },
  outputs: [{ id: "reading", label: "Reading", displayUnit: "m", displayFactor: 1 }],
};
function pin(payload, variant = false, owned = true) {
  const { ownerId, ...unowned } = quantity;
  return pinBaseline(
    {
      experimentId: contract.experimentId,
      instanceId: "fixture-instance",
      runId: variant ? "variant-run" : "baseline-run",
      snapshotVersion: variant ? 2 : 1,
      actionIndex: variant ? 2 : 1,
      final: true,
      revisions: { input: variant ? 2 : 1, observer: 0, measurement: 0, estimator: 0 },
      parameters: { radius: variant ? 2 : 1 },
      outputs: [{ ...(owned ? quantity : unowned), ...payload }],
    },
    identity,
    ["reading"],
  );
}
const cases = [
  {
    payload: { status: "symbolic", expressionRef: "energy.absolute", unspecifiedSymbols: ["E₀"] },
    explanation: /Supply E₀/,
  },
  {
    payload: {
      status: "analytic-limit",
      description: "All mass is concentrated at the initial position.",
      representation: { kind: "point-mass", location: 0, mass: 1 },
    },
    explanation: /initial position/,
  },
  {
    payload: {
      status: "underdetermined",
      compatibleFamily: "radius × molecular number is fixed",
      neededInformation: ["Supply an independently measured radius."],
    },
    explanation: /independently measured radius/,
  },
  {
    payload: { status: "not-applicable", reason: "One-way speed is assigned by convention." },
    explanation: /assigned by convention/,
  },
  {
    payload: {
      status: "outside-domain",
      condition: "positive radius",
      domainKind: "model",
      reason: "This model requires a positive radius.",
      boundary: { parameterId: "radius", value: 1 },
    },
    explanation: /Set radius to 1/,
  },
  {
    payload: {
      status: "divergent",
      expressionRef: "spectrum.total",
      divergenceKind: "integral",
      variable: "frequency",
      range: { lower: 0, upper: "unbounded" },
      rate: { statement: "The integral grows without a finite bound." },
      modelId: "spectrum-model",
      finiteUnder: { parameterId: "cutoff", value: 10 },
    },
    explanation: /Set cutoff to 10/,
  },
];
for (const { payload, explanation } of cases) {
  test(`${payload.status}: retain evidence and explain why arithmetic cannot supply an answer`, () => {
    const baseline = pin(payload),
      variant = pin({ status: "value", value: 2 }, true);
    const reading = baseline.outputs.reading;
    assert.equal(reading.status, payload.status);
    assert.equal(reading.value, null);
    assert.deepEqual(reading.evidence, { ...quantity, ...payload });
    assert.match(reading.reason, explanation);
    assert.ok(Object.isFrozen(reading.evidence));
    const result = compareBaselines(baseline, variant, contract);
    assert.equal(result.kind, "accepted");
    for (const operation of ["ratio", "difference"]) {
      assert.equal(result.rows[0][operation].status, "not-applicable");
      assert.match(result.rows[0][operation].reason, explanation);
      assert.doesNotMatch(
        result.rows[0][operation].reason,
        /Baseline: (symbolic|analytic-limit|underdetermined|not-applicable|outside-domain|divergent)\./,
      );
    }
    assert.deepEqual(JSON.parse(JSON.stringify(baseline)).outputs.reading.evidence, reading.evidence);
  });
}

test("pinned nested evidence is detached and cannot change through either reference", () => {
  const payload = structuredClone(cases[0].payload);
  const baseline = pin(payload);
  payload.unspecifiedSymbols.push("changed later");
  assert.deepEqual(baseline.outputs.reading.evidence.unspecifiedSymbols, ["E₀"]);
  assert.throws(() => baseline.outputs.reading.evidence.unspecifiedSymbols.push("changed"), TypeError);
  const domain = pin(cases[4].payload).outputs.reading.evidence;
  assert.throws(() => {
    domain.boundary.value = 2;
  }, TypeError);
});

for (const uncertainty of [
  {
    kind: "statistical-interval",
    lower: 1,
    upper: 3,
    coverage: 0.95,
    sampleSize: 100,
    method: "fixture interval",
  },
  { kind: "enclosure", lower: 1, upper: 3, method: "fixture enclosure" },
  {
    kind: "numerical-error-estimate",
    magnitude: 0.01,
    method: "fixture estimate",
    guarantee: "estimate",
  },
  { kind: "input-precision", significantFigures: 3, source: "fixture source" },
  {
    kind: "measurement-uncertainty",
    magnitude: 0.2,
    datasetId: "fixture-data",
    uncertaintyType: "standard uncertainty",
  },
]) {
  test(`${uncertainty.kind}: preserve uncertainty without inventing propagated error bars`, () => {
    const baseline = pin({ status: "value", value: 2, uncertainty });
    const variant = pin({ status: "value", value: 4 }, true);
    assert.deepEqual(baseline.outputs.reading.evidence.uncertainty, uncertainty);
    assert.ok(Object.isFrozen(baseline.outputs.reading.evidence.uncertainty));
    const result = compareBaselines(baseline, variant, contract);
    assert.deepEqual(result.rows[0].ratio, { status: "value", value: 2 });
    assert.deepEqual(result.rows[0].difference, { status: "value", value: 2 });
  });
}

test("an analytic coefficient remains a limit, not a silently substituted numeric result", () => {
  const reading = pin({
    status: "analytic-limit",
    description: "The limiting coefficient is zero.",
    representation: { kind: "coefficient", value: 0 },
  }).outputs.reading;
  assert.equal(reading.value, null);
  assert.equal(reading.evidence.representation.value, 0);
});

test("malformed owned evidence is rejected instead of downgraded to a scalar", () => {
  for (const payload of [
    { status: "symbolic", expressionRef: "energy.absolute", unspecifiedSymbols: [] },
    {
      status: "value",
      value: 2,
      uncertainty: { kind: "enclosure", lower: 3, upper: 1, method: "fixture" },
    },
    { status: "value", value: 2, ownerId: undefined },
    { status: "not-applicable" },
    { status: "outside-domain", reason: "Missing model boundary" },
    { status: "unknown", reason: "Not an admitted result" },
  ])
    assert.throws(() => pin(payload), TypeError);
});

test("arrays, infinities, and NaN cannot enter a scalar comparison", () => {
  for (const value of [new Float64Array([2]), Infinity, NaN])
    assert.throws(() => pin({ status: "value", value }), TypeError);
  assert.throws(
    () => comparisonEvidence({ ...quantity, status: "value", value: new Float64Array([2]) }),
    TypeError,
  );
  // AND THE CODE (am-muyh), for the same reason. A Float64Array rather than a plain array is what
  // reaches this guard: the decoder accepts the typed array as a vector result and refuses a plain one
  // with its own error, so a plain-array plant would stop above the thing being tested.
  assert.throws(
    () => comparisonEvidence({ ...quantity, status: "value", value: new Float64Array([2]) }),
    { code: "comparison-requires-scalar" },
  );
});

test("evidence validation rejects accessors without executing them", () => {
  let called = false;
  const output = { ...quantity, status: "symbolic", expressionRef: "energy.absolute" };
  Object.defineProperty(output, "unspecifiedSymbols", {
    enumerable: true,
    get() {
      called = true;
      return ["E₀"];
    },
  });
  assert.throws(() => comparisonEvidence(output), TypeError);
  assert.equal(called, false);
});

test("same labels cannot make different scientific owners equivalent", () => {
  const result = compareBaselines(
    pin({ status: "value", value: 2 }),
    pin({ status: "value", value: 4, ownerId: "different.reading" }, true),
    contract,
  );
  assert.equal(result.kind, "refused");
  assert.equal(result.code, "output-owner-mismatch");
});

test("loss of an owner is also a comparison identity mismatch", () => {
  const result = compareBaselines(
    pin({ status: "value", value: 2 }),
    pin({ status: "value", value: 4 }, true, false),
    contract,
  );
  assert.equal(result.code, "output-owner-mismatch");
});

test("existing ownerless scalar projections remain compatible", () => {
  const baseline = pin(
    { status: "not-applicable", reason: "Zero elapsed time", value: undefined },
    false,
    false,
  );
  assert.equal(baseline.outputs.reading.reason, "Zero elapsed time");
  assert.equal(baseline.outputs.reading.evidence, undefined);
  assert.equal(
    compareBaselines(baseline, pin({ status: "value", value: 4 }, true, false), contract).kind,
    "accepted",
  );
  assert.match(pin({ status: "symbolic" }, false, false).outputs.reading.reason, /unspecified quantities/);
});
