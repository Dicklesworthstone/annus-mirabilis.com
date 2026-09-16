import assert from "node:assert/strict";
import test from "node:test";
import {
  decodeOutcome,
  decodeRefusal,
  decodeResult,
  decodeResultBatch,
  encodeResult,
  parseResult,
} from "../experiments/results/codec.ts";
import {
  executionOutcomeIds,
  outputStatusIds,
  resultIds,
  statusEnumIds,
} from "../experiments/results/ids.ts";
import { executionOutcomeRegistry } from "../experiments/results/outcomes.ts";
import { defineRefusalRegistry, refusalCodeRegistry } from "../experiments/results/refusalCodes.ts";
import { makeRefusal } from "../experiments/results/refusals.ts";

const identity = {
  quantityId: "displacement",
  unit: "m",
  semanticKind: "latent-coordinate",
  ownerId: "diffusion.rmsDisplacement",
};
const value = { ...identity, status: "value", value: 0.5 };
const examples = [
  value,
  {
    ...identity,
    status: "symbolic",
    expressionRef: "energy-difference",
    unspecifiedSymbols: ["E0", "E1"],
  },
  {
    ...identity,
    status: "analytic-limit",
    description: "All mass is at the starting point.",
    representation: { kind: "point-mass", location: 0, mass: 1 },
  },
  {
    ...identity,
    status: "underdetermined",
    compatibleFamily: "a N is fixed",
    neededInformation: ["Independently measure the radius."],
  },
  { ...identity, status: "not-applicable", reason: "No electron is emitted below threshold." },
  {
    ...identity,
    status: "outside-domain",
    condition: "dilute radiation",
    domainKind: "model",
    reason: "The Wien approximation requires a dilute regime.",
    boundary: { alternativeModel: "planck" },
  },
  {
    ...identity,
    quantityId: "spectralEnergyDensity",
    unit: "J/m3",
    status: "divergent",
    expressionRef: "classical-integral",
    divergenceKind: "integral",
    variable: "frequency",
    range: { lower: 0, upper: "unbounded" },
    rate: { statement: "The total grows as the cube of the upper cutoff." },
    modelId: "classical-equipartition",
    finiteUnder: { parameterId: "frequencyCutoff", value: 1e15 },
  },
];
for (const example of examples)
  test(`codec round trip: ${example.status}`, () => {
    assert.deepEqual(parseResult(encodeResult(example)), example);
    assert.notEqual(decodeResult(example), example);
  });
test("numeric arrays are copied and explicitly encoded", () => {
  const result = { ...value, value: new Float64Array([0, 1, -2, 1e-200]) };
  const copy = decodeResult(result);
  result.value[1] = 8;
  assert.equal(copy.value[1], 1);
  assert.deepEqual(parseResult(encodeResult(copy)), copy);
  assert.throws(() => decodeResult({ ...value, value: [] }));
  assert.throws(() => decodeResult({ ...value, value: new Float64Array() }));
  assert.throws(
    () => decodeResult({ ...value, value: new Float64Array(new SharedArrayBuffer(8)) }),
    /shared memory/,
  );
});
for (const invalid of [NaN, Infinity, -Infinity, undefined, null, "1"])
  test(`refuse nonnumeric value: ${String(invalid)}`, () => {
    assert.throws(() => decodeResult({ ...value, value: invalid }));
    if (typeof invalid === "number")
      assert.throws(() => decodeResult({ ...value, value: new Float64Array([invalid]) }));
  });
test("unknown, missing, and accessor fields are rejected", () => {
  for (const key of Object.keys(identity)) {
    const malformed = { ...value };
    delete malformed[key];
    assert.throws(() => decodeResult(malformed), new RegExp(key));
  }
  assert.throws(() => decodeResult({ ...value, status: "error" }));
  assert.throws(() => decodeResult({ ...value, extra: 1 }));
  assert.throws(
    () =>
      decodeResult({
        ...value,
        get value() {
          throw new Error("must not execute");
        },
      }),
    /accessors/,
  );
  assert.throws(() => decodeResult(Object.assign(Object.create({ inherited: 1 }), value)));
  assert.throws(() => parseResult('{"status":"value","value":1e400}'));
});
test("divergence is not a numeric infinity or an execution failure", () => {
  const divergent = examples.at(-1);
  assert.throws(() => decodeResult({ ...divergent, value: 0 }));
  assert.throws(() => decodeResult({ ...divergent, range: { lower: 2, upper: 1 } }));
  assert.throws(() =>
    decodeResult({ ...divergent, finiteUnder: { parameterId: "cutoff", value: Infinity } }),
  );
  assert.throws(() => decodeOutcome(divergent));
  assert.throws(() => decodeRefusal(divergent));
});
test("uncertainty kinds retain their meaning and bounds", () => {
  const variants = [
    {
      kind: "statistical-interval",
      lower: 0,
      upper: 1,
      coverage: 0.95,
      sampleSize: 400,
      method: "chi-square",
    },
    { kind: "enclosure", lower: 0, upper: 1, method: "interval-arithmetic" },
    {
      kind: "numerical-error-estimate",
      magnitude: 1e-6,
      method: "step-halving",
      guarantee: "estimate",
    },
    { kind: "input-precision", significantFigures: 3, source: "declared fixture" },
    {
      kind: "measurement-uncertainty",
      magnitude: 0.1,
      datasetId: "observations",
      uncertaintyType: "standard",
    },
  ];
  for (const uncertainty of variants)
    assert.deepEqual(parseResult(encodeResult({ ...value, uncertainty })), {
      ...value,
      uncertainty,
    });
  for (const uncertainty of [
    { lower: 0, upper: 1 },
    { ...variants[0], lower: 2 },
    { ...variants[0], coverage: 1 },
    { ...variants[0], sampleSize: 0 },
    { ...variants[2], magnitude: -1 },
  ])
    assert.throws(() => decodeResult({ ...value, uncertainty }));
});
test("refusals retain ranked repairs but use registered reader language", () => {
  for (const code of Object.keys(refusalCodeRegistry)) {
    const refusal = makeRefusal(
      code,
      { parameterIds: ["dt"] },
      code === "ftcs-unstable"
        ? {
            details: { ratio: 0.5000001, limit: 0.5, dtMax: 0.25 },
            rankedRepairs: [
              { label: "Use a smaller time step.", action: { parameterId: "dt", value: 0.25 } },
            ],
          }
        : {},
    );
    assert.deepEqual(decodeRefusal(JSON.parse(JSON.stringify(refusal))), refusal);
    assert.throws(() => decodeRefusal({ ...refusal, message: "raw worker stack" }));
    assert.throws(() => decodeRefusal({ ...refusal, ratio: 10 }));
  }
  assert.throws(() => decodeRefusal(makeRefusal("ftcs-unstable", { parameterIds: ["dt"] })));
  assert.throws(() =>
    decodeRefusal(
      makeRefusal("invalid-parameter", { parameterIds: ["n"] }, { details: { input: NaN } }),
    ),
  );
  const cyclic = {};
  cyclic.self = cyclic;
  assert.throws(
    () =>
      decodeRefusal(makeRefusal("invalid-parameter", { parameterIds: ["n"] }, { details: cyclic })),
    /nesting/,
  );
});
test("all software outcomes round-trip without becoming physical statuses", () => {
  for (const [outcome, definition] of Object.entries(executionOutcomeRegistry)) {
    const result = {
      outcome,
      ...definition,
      ...(outcome === "budget-exhausted"
        ? {
            requested: { workUnits: 2, allocationBytes: 8 },
            allowed: { workUnits: 1, allocationBytes: 8 },
          }
        : {}),
    };
    assert.deepEqual(decodeOutcome(JSON.parse(JSON.stringify(result))), result);
    assert.throws(() => decodeResult(result));
  }
  assert.throws(() =>
    decodeOutcome({
      outcome: "budget-exhausted",
      ...executionOutcomeRegistry["budget-exhausted"],
      requested: { workUnits: 0, allocationBytes: 0 },
      allowed: { workUnits: 1, allocationBytes: 8 },
    }),
  );
});
const revisions = { input: 1, observer: 2, measurement: 3, estimator: 4 };
test("manifest admission, completeness, and partial results are enforced", () => {
  const outputs = [value, examples.at(-1)];
  const policy = {
    expectedRevisions: revisions,
    allowPartial: true,
    statuses: { displacement: ["value"], spectralEnergyDensity: ["divergent"] },
  };
  assert.deepEqual(decodeResultBatch({ revisions, outputs }, policy), { revisions, outputs });
  assert.throws(
    () => decodeResultBatch({ revisions, outputs }, { ...policy, allowPartial: false }),
    /partial/,
  );
  assert.throws(
    () => decodeResultBatch({ revisions, outputs: [value] }, policy),
    /missing declared/,
  );
  assert.throws(
    () => decodeResultBatch({ revisions, outputs: [value, value] }, policy),
    /duplicate/,
  );
  assert.throws(
    () => decodeResultBatch({ revisions: { ...revisions, observer: 1 }, outputs }, policy),
    /revision/,
  );
  assert.throws(
    () =>
      decodeResultBatch({ revisions, outputs: [{ ...value, revisions }, examples.at(-1)] }, policy),
    /unknown field/,
  );
  assert.throws(
    () =>
      decodeResultBatch(
        { revisions, outputs },
        { ...policy, statuses: { ...policy.statuses, spectralEnergyDensity: ["value"] } },
      ),
    /not admitted/,
  );
});
test("IDs derive from registries and are immutable", () => {
  assert.equal(outputStatusIds.length, 7);
  assert.equal(executionOutcomeIds.length, 12);
  assert.ok(statusEnumIds.includes("divergent"));
  assert.throws(() => outputStatusIds.push("error"));
  const registry = defineRefusalRegistry({
    ...refusalCodeRegistry,
    "test-code": {
      domainKind: "input",
      message: "Check this input.",
      repair: "Enter another value.",
    },
  });
  assert.ok(resultIds(registry).statusEnumIds.includes("test-code"));
  assert.throws(() =>
    defineRefusalRegistry({ bad: { domainKind: "input", message: "", repair: "Choose again." } }),
  );
  assert.throws(() =>
    defineRefusalRegistry({
      bad: {
        domainKind: "numerical",
        message: "Nature forbids this step.",
        repair: "Choose again.",
      },
    }),
  );
});
