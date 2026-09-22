import assert from "node:assert/strict";
import { test } from "node:test";
import { SHELF_DEFINITIONS, SHELF_IDS } from "./definition.ts";
import { evaluateShelfOptics, metric, requireOwnerValue, scalar } from "./evaluation.ts";
import { primaryShelfMetrics, shelfSnapshot } from "./state.ts";

// These are mathematical/reference fixtures, never transcribed observations.
const defaults = (id) => SHELF_DEFINITIONS[id].defaults;
const evaluate = (id, changes = {}) => evaluateShelfOptics({ ...defaults(id), ...changes });
const value = (report, modelId, label = report.primaryMetric) => {
  const metric = report.rows
    .find((row) => row.modelId === modelId)
    ?.metrics.find((entry) => entry.label === label);
  assert.ok(metric, `${modelId}: ${label}`);
  return metric.value;
};
const near = (actual, expected, tolerance = 1e-12) =>
  assert.ok(
    Math.abs(actual - expected) <= tolerance * Math.max(Math.abs(expected), 1e-30),
    `${actual} differs from ${expected}`,
  );

for (const id of SHELF_IDS) {
  test(`${id}: real reference owner supplies a complete, finite, serializable default`, () => {
    const report = evaluate(id);
    const snapshot = shelfSnapshot(report);
    assert.ok(snapshot.report.rows.length >= 2);
    for (const row of snapshot.report.rows) {
      assert.ok(
        row.metrics.every(
          (metric) => Number.isFinite(metric.value) && metric.ownerId.startsWith("shelf-optics"),
        ),
      );
    }
    assert.deepEqual(JSON.parse(JSON.stringify(snapshot)), snapshot);
    assert.equal(primaryShelfMetrics(report).length, report.rows.length);
  });
  for (const field of SHELF_DEFINITIONS[id].fields) {
    test(`${id}: real owner remains finite at both ${field.key} instrument boundaries`, () => {
      for (const bound of [field.min, field.max]) {
        const report = evaluate(id, { [field.key]: bound });
        assert.doesNotThrow(() => shelfSnapshot(report));
      }
    });
  }
}

test("Michelson: illustrative default predicts 0.4 fringes to leading order, not an observed bound", () => {
  const report = evaluate("shelf-michelson-morley");
  near(value(report, "mm-ether", "Leading order in β²"), 0.4);
  near(value(report, "mm-ether"), 0.400000005, 1e-10);
  assert.equal(value(report, "mm-ether-contraction"), 0);
});

test("Michelson: path length and wavelength change the shift in opposite directions", () => {
  const id = "shelf-michelson-morley";
  const base = evaluate(id);
  near(
    value(evaluate(id, { armLength: defaults(id).armLength * 2 }), "mm-ether"),
    2 * value(base, "mm-ether"),
  );
  near(
    value(evaluate(id, { wavelength: defaults(id).wavelength * 2 }), "mm-ether"),
    value(base, "mm-ether") / 2,
  );
  assert.equal(
    value(evaluate(id, { beta: -defaults(id).beta }), "mm-ether"),
    value(base, "mm-ether"),
  );
});

test("Michelson: zero wind is a valid null state, while high speed exposes the approximation", () => {
  assert.ok(
    primaryShelfMetrics(evaluate("shelf-michelson-morley", { beta: 0 })).every(
      (metric) => metric.value === 0,
    ),
  );
  const report = evaluate("shelf-michelson-morley", { beta: 0.6 });
  near(value(report, "mm-ether"), 25e6);
  near(value(report, "mm-ether", "Leading order in β²"), 14.4e6);
  const contracted = "mm-ether-contraction";
  assert.equal(
    value(report, contracted, "Parallel round-trip time"),
    value(report, contracted, "Perpendicular round-trip time"),
  );
});

test("Fizeau: zero flow, sign reversal and protocol reversal are distinct operations", () => {
  const id = "shelf-fizeau";
  const base = evaluate(id);
  const reverseFlow = evaluate(id, { waterSpeed: -defaults(id).waterSpeed });
  const reverseProtocol = evaluate(id, { reversal: true });
  assert.ok(
    primaryShelfMetrics(evaluate(id, { waterSpeed: 0 })).every((metric) => metric.value === 0),
  );
  for (const row of base.rows) {
    near(value(reverseFlow, row.modelId), -value(base, row.modelId));
    near(value(reverseProtocol, row.modelId), 2 * value(base, row.modelId));
    assert.equal(
      value(reverseProtocol, row.modelId, "Forward path speed"),
      value(base, row.modelId, "Forward path speed"),
    );
  }
});

test("Fizeau: total per-beam path doubles the signal, wavelength halves it", () => {
  const id = "shelf-fizeau";
  const base = evaluate(id);
  const longer = evaluate(id, { waterPathPerBeam: defaults(id).waterPathPerBeam * 2 });
  const wavelength = evaluate(id, { wavelength: defaults(id).wavelength * 2 });
  for (const row of base.rows) {
    near(value(longer, row.modelId), 2 * value(base, row.modelId));
    near(value(wavelength, row.modelId), value(base, row.modelId) / 2);
  }
});

test("Fizeau: unit index eliminates Fresnel drag, not the stipulated full-drag hypothesis", () => {
  const report = evaluate("shelf-fizeau", { refractiveIndex: 1 });
  assert.equal(value(report, "fresnel-drag"), 0);
  assert.equal(value(report, "fizeau-no-drag"), 0);
  assert.ok(value(report, "fizeau-full-drag") > 0);
});

test("later comparison is opt-in and cannot change any of the earlier model rows", () => {
  const earlier = evaluate("shelf-fizeau");
  const later = evaluate("shelf-fizeau", { showLater: true });
  assert.deepEqual(earlier.later, []);
  assert.deepEqual(earlier.rows, later.rows);
  assert.ok(later.later.length > 0);
  assert.ok(later.later.every((metric) => Number.isFinite(metric.value)));
  assert.doesNotThrow(() =>
    shelfSnapshot(evaluate("shelf-fizeau", { showLater: true, waterSpeed: 0 })),
  );
});

test("wave diagnostic: k changes the dimensional residual, not the normalized comparison", () => {
  const id = "shelf-maxwell-galilean";
  const base = evaluate(id);
  const doubled = evaluate(id, { wavenumber: 2 });
  const model = "galilean-wave-operator";
  near(value(base, model), 0.19);
  near(value(doubled, model), value(base, model));
  near(
    value(doubled, model, "Maximum absolute residual"),
    4 * value(base, model, "Maximum absolute residual"),
  );
  assert.equal(value(base, "lorentz-1904-wave-operator"), 0);
  near(value(evaluate(id, { beta: -0.1 }), model), 0.21);
  assert.ok(primaryShelfMetrics(evaluate(id, { beta: 0 })).every((metric) => metric.value === 0));
});

// The binding's refusals, each driven and named by its code. The owner functions refuse only
// outside the domain parseShelfParameters admits, so the helpers are called directly.
test("an owner refusal becomes a typed error that keeps the owner's reason: owner-refused", () => {
  assert.throws(
    () =>
      requireOwnerValue({
        status: "outside-domain",
        reason: "Ether wind speed must be strictly subluminal.",
      }),
    (error) => error.code === "owner-refused" && error.message.includes("strictly subluminal"),
  );
  assert.throws(() => requireOwnerValue({ status: "outside-domain" }), { code: "owner-refused" });
  assert.doesNotThrow(() => requireOwnerValue({ status: "value" }));
});
test("an owner result that is not one finite number is never shown: owner-result-nonfinite", () => {
  const base = { quantityId: "fringeShift", ownerId: "test-owner" };
  for (const result of [
    { ...base, status: "outside-domain" },
    { ...base, status: "value", value: Number.NaN },
    { ...base, status: "value", value: Infinity },
    { ...base, status: "value", value: "0.4" },
  ])
    assert.throws(() => metric("Signed fringe shift", "fringes", result), {
      code: "owner-result-nonfinite",
    });
  assert.equal(
    metric("Signed fringe shift", "fringes", { ...base, status: "value", value: 0.4 }).value,
    0.4,
  );
});
test("a nonfinite computed number is never shown: owner-scalar-nonfinite", () => {
  for (const value of [Number.NaN, Infinity, -Infinity])
    assert.throws(() => scalar("Mixed-derivative coefficient", "1", value, "coefficient", "fn"), {
      code: "owner-scalar-nonfinite",
    });
  assert.equal(
    scalar("Mixed-derivative coefficient", "1", 2, "coefficient", "fn").ownerId,
    "shelf-optics.fn",
  );
});
test("parameters outside admission never reach the owner: parameters-rejected", () => {
  assert.throws(() => evaluate("shelf-fizeau", { waterSpeed: 1e9 }), {
    code: "parameters-rejected",
  });
  assert.throws(() => evaluate("shelf-michelson-morley", { beta: 2 }), {
    code: "parameters-rejected",
  });
});
