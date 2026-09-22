import assert from "node:assert/strict";
import { test } from "node:test";
import {
  isShelfId,
  parseShelfParameters,
  SHELF_DEFINITIONS,
  SHELF_IDS,
  shelfDraft,
} from "./definition.ts";
import { applyShelfParameters, primaryShelfMetrics, shelfSnapshot } from "./state.ts";

// These fixtures test admission and atomic presentation, not optical laws.
function report(parameters, value = 0) {
  return {
    parameters,
    primaryMetric: "Observable",
    interpretation: "Test fixture, not physics",
    rows: ["model-a", "model-b"].map((modelId) => ({
      modelId,
      label: modelId,
      metrics: [
        { label: "Observable", unit: "1", value, quantityId: "test-value", ownerId: "test-owner" },
      ],
    })),
    later: [],
  };
}

for (const id of SHELF_IDS) {
  const definition = SHELF_DEFINITIONS[id];
  test(`${id}: defaults and decimal draft round-trip without changing identity`, () => {
    assert.equal(isShelfId(id), true);
    const result = parseShelfParameters(id, shelfDraft(definition.defaults));
    assert.equal(result.kind, "parameters");
    assert.deepEqual(result.parameters, definition.defaults);
    assert.ok(Object.isFrozen(result.parameters));
  });
  for (const field of definition.fields) {
    test(`${id}: ${field.key} includes both declared bounds and rejects values beyond them`, () => {
      for (const bound of [field.min, field.max]) {
        assert.equal(
          parseShelfParameters(id, { ...definition.defaults, [field.key]: bound }).kind,
          "parameters",
        );
      }
      for (const bound of [
        field.min - Math.max(1, Math.abs(field.min)),
        field.max + Math.max(1, Math.abs(field.max)),
      ]) {
        assert.equal(
          parseShelfParameters(id, { ...definition.defaults, [field.key]: bound }).kind,
          "refused",
        );
      }
    });
    test(`${id}: ${field.key} cannot be absent, inherited, empty or coerced`, () => {
      for (const value of [
        undefined,
        null,
        "",
        "  ",
        true,
        false,
        NaN,
        Infinity,
        -Infinity,
        "NaN",
        "Infinity",
        "0x10",
        "0b11",
        "1,000",
        "1e999",
        {},
        [],
        { valueOf: () => 1 },
      ]) {
        assert.equal(
          parseShelfParameters(id, { ...definition.defaults, [field.key]: value }).kind,
          "refused",
          String(value),
        );
      }
      const { [field.key]: inherited, ...own } = definition.defaults;
      assert.equal(
        parseShelfParameters(id, Object.assign(Object.create({ [field.key]: inherited }), own))
          .kind,
        "refused",
      );
    });
  }
  for (const field of definition.switches) {
    test(`${id}: ${field.key} accepts booleans only, not strings or absent flags`, () => {
      for (const value of ["false", "true", 0, 1, null, undefined]) {
        assert.equal(
          parseShelfParameters(id, { ...definition.defaults, [field.key]: value }).kind,
          "refused",
        );
      }
      for (const value of [true, false]) {
        assert.equal(
          parseShelfParameters(id, { ...definition.defaults, [field.key]: value }).kind,
          "parameters",
        );
      }
    });
  }
  test(`${id}: refuse foreign instrument settings and unknown fields atomically`, () => {
    const current = shelfSnapshot(report(definition.defaults));
    let calls = 0;
    const evaluate = () => {
      calls += 1;
      throw new Error("Should not run");
    };
    for (const input of [
      null,
      [],
      "bad",
      {},
      { ...definition.defaults, instrumentId: "other" },
      { ...definition.defaults, unexpected: 1 },
    ]) {
      assert.equal(applyShelfParameters(current, input, evaluate).kind, "refused");
      assert.equal(current.revision, 0);
    }
    assert.equal(calls, 0);
  });
  test(`${id}: evaluate once, publish all views once, and leave the previous snapshot untouched`, () => {
    const current = shelfSnapshot(report(definition.defaults, 10));
    const field = definition.fields[0];
    const changed = { ...shelfDraft(definition.defaults), [field.key]: String(field.max) };
    let calls = 0;
    const next = applyShelfParameters(current, changed, (parameters) => {
      calls += 1;
      assert.ok(Object.isFrozen(parameters));
      return report(parameters, 20);
    });
    assert.equal(next.kind, "accepted");
    assert.equal(calls, 1);
    assert.equal(next.snapshot.revision, 1);
    assert.equal(current.revision, 0);
    assert.equal(current.report.rows[0].metrics[0].value, 10);
    assert.ok(primaryShelfMetrics(next.snapshot.report).every((value) => value.value === 20));
  });
}

test("numeric input includes finite scientific notation and signed zero", () => {
  const id = "shelf-michelson-morley";
  const result = parseShelfParameters(id, {
    armLength: "+1.1e1",
    wavelength: " 5.5E-7 ",
    beta: "-0",
  });
  assert.equal(result.kind, "parameters");
  assert.equal(result.parameters.armLength, 11);
  assert.equal(result.parameters.wavelength, 5.5e-7);
  assert.equal(result.parameters.beta, -0);
});

test("unknown IDs and prototype names never select an instrument", () => {
  for (const id of ["unknown", "__proto__", "constructor", "toString", null]) {
    assert.equal(isShelfId(id), false);
    assert.equal(parseShelfParameters(id, {}).kind, "refused");
  }
});

test("a zero observable is accepted, with model names and owner identities intact", () => {
  const current = shelfSnapshot(report(SHELF_DEFINITIONS["shelf-fizeau"].defaults));
  const points = primaryShelfMetrics(current.report);
  assert.equal(points[0].value, 0);
  assert.equal(points[0].modelLabel, "model-a");
  assert.equal(points[0].label, "Observable");
  assert.equal(points[0].ownerId, "test-owner");
});

test("copy/freeze prevents aliases between instances or evaluator-owned arrays", () => {
  const source = report({ ...SHELF_DEFINITIONS["shelf-fizeau"].defaults });
  const first = shelfSnapshot(source);
  const second = shelfSnapshot(source);
  source.parameters.waterSpeed = 99;
  source.rows[0].metrics[0].value = 99;
  source.later.push({
    label: "late",
    unit: "1",
    value: 99,
    ownerId: "test-owner",
    quantityId: "late",
  });
  assert.equal(first.report.parameters.waterSpeed, 7);
  assert.equal(second.report.rows[0].metrics[0].value, 0);
  assert.deepEqual(first.report.later, []);
  assert.notEqual(first.report.rows, second.report.rows);
  assert.throws(() => {
    first.report.rows[0].metrics[0].value = 7;
  });
});

for (const [name, broken] of [
  [
    "exception",
    () => {
      throw new Error("owner failure");
    },
  ],
  ["nonfinite output", (p) => report(p, Infinity)],
  ["NaN output", (p) => report(p, NaN)],
  ["wrong settings", (p) => report({ ...p, beta: 0.9 })],
  ["missing model", (p) => ({ ...report(p), rows: report(p).rows.slice(0, 1) })],
  ["missing primary observable", (p) => ({ ...report(p), primaryMetric: "missing" })],
  ["duplicate model", (p) => ({ ...report(p), rows: [report(p).rows[0], report(p).rows[0]] })],
  ["unlabeled output", (p) => ({ ...report(p), later: [{ label: "", unit: "1", value: 1 }] })],
]) {
  test(`refuse ${name} without discarding the accepted comparison`, () => {
    const current = shelfSnapshot(report(SHELF_DEFINITIONS["shelf-michelson-morley"].defaults, 4));
    const before = JSON.stringify(current);
    assert.equal(applyShelfParameters(current, current.report.parameters, broken).kind, "refused");
    assert.equal(JSON.stringify(current), before);
  });
}

test("revision overflow is refused rather than publishing an ambiguous identity", () => {
  const current = shelfSnapshot(
    report(SHELF_DEFINITIONS["shelf-fizeau"].defaults),
    Number.MAX_SAFE_INTEGER,
  );
  assert.equal(applyShelfParameters(current, current.report.parameters, report).kind, "refused");
  for (const revision of [-1, 0.5, NaN, Infinity])
    assert.throws(() => shelfSnapshot(current.report, revision));
});

// Every refusal shelfSnapshot and primaryShelfMetrics can make, driven and named by its code.
// The two primary-observable-missing sites share a code, so each test cites its own line.
const acceptedReport = () => report(SHELF_DEFINITIONS["shelf-fizeau"].defaults);
test("a negative, fractional or missing revision is refused: invalid-revision", () => {
  for (const revision of [-1, 0.5, Number.NaN])
    assert.throws(() => shelfSnapshot(acceptedReport(), revision), { code: "invalid-revision" });
  assert.equal(shelfSnapshot(acceptedReport(), 3).revision, 3);
});
test("a report whose own parameters fail admission is refused: parameters-rejected", () => {
  const r = acceptedReport();
  assert.throws(() => shelfSnapshot({ ...r, parameters: { ...r.parameters, waterSpeed: 1e9 } }), {
    code: "parameters-rejected",
  });
});
test("one model row, or a repeated one, is not a comparison: model-rows-not-distinct", () => {
  const r = acceptedReport();
  assert.throws(() => shelfSnapshot({ ...r, rows: [r.rows[0]] }), {
    code: "model-rows-not-distinct",
  });
  assert.throws(() => shelfSnapshot({ ...r, rows: [r.rows[0], r.rows[0]] }), {
    code: "model-rows-not-distinct",
  });
});
test("a metric without a finite value is never shown: owner-result-nonfinite", () => {
  for (const value of [Number.NaN, Infinity, -Infinity])
    assert.throws(() => shelfSnapshot(report(SHELF_DEFINITIONS["shelf-fizeau"].defaults, value)), {
      code: "owner-result-nonfinite",
    });
});
test("shelfSnapshot refuses a row without its one primary observable: primary-observable-missing (state.ts:72)", () => {
  const r = acceptedReport();
  const rows = r.rows.map((row, i) => (i === 0 ? { ...row, metrics: [] } : row));
  assert.throws(() => shelfSnapshot({ ...r, rows }), { code: "primary-observable-missing" });
});
test("primaryShelfMetrics refuses a row the plot cannot draw: primary-observable-missing (state.ts:124)", () => {
  const r = acceptedReport();
  const rows = r.rows.map((row, i) =>
    i === 1 ? { ...row, metrics: [{ ...row.metrics[0], label: "Some other observable" }] } : row,
  );
  assert.throws(() => primaryShelfMetrics({ ...r, rows }), { code: "primary-observable-missing" });
  assert.equal(primaryShelfMetrics(r).length, 2);
});
