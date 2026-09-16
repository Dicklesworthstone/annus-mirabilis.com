import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import { decodeResult } from "../experiments/results/codec.ts";
import {
  assertSameSet,
  constantValue,
  createDeclaredConstantSet,
  getConstantSet,
  RESERVED_SET_IDS,
  thermalConstant,
} from "../physics/reference/constants.ts";
import {
  apparentSpeed,
  gaussianPropagator,
  intervalProbability,
  moments,
  osmoticPressure,
  radialPropagator2d,
  radialPropagator3d,
  rmsDisplacement,
  stokesEinsteinD,
} from "../physics/reference/diffusion/distributions.ts";
import { erf, erfc } from "../physics/reference/special/erf.ts";

const val = (evaluation) => {
  decodeResult(evaluation.result);
  assert.equal(evaluation.result.status, "value", JSON.stringify(evaluation));
  assert.equal(typeof evaluation.result.value, "number");
  return evaluation.result.value;
};
const near = (actual, expected, relative = 1e-12, absolute = 0) =>
  assert.ok(
    Math.abs(actual - expected) <= Math.max(absolute, relative * Math.abs(expected)),
    `${actual} != ${expected}`,
  );
const modern = getConstantSet("modern-si-2019");
const entry = (quantityId, exactDecimal, unit, dependsOn = []) => ({
  quantityId,
  exactDecimal,
  unit,
  value: Number(exactDecimal),
  kind: "declared-scenario",
  evidentialRole: "declared-input",
  provenance:
    "Explicit numerical test inputs from am-ref-diffusion-lr3; not a checked transcription.",
  dependsOn,
});
const draft = {
  id: "scenario-brownian-plan-inputs",
  era: 1905,
  provenance:
    "Numerical reconstruction of the plan's declared inputs; no historical verification claimed.",
  precisionNote: "Binary64 evaluation of declared decimal values.",
  gasConstantProvenance: "not-applicable",
  entries: [
    entry("molarGasConstant", "8.31", "J/(mol K)"),
    entry("avogadroConstant", "6e23", "1/mol"),
  ],
};
test("modern exact constants and their dependency remain in one immutable set", () => {
  const k = constantValue(modern, "boltzmannConstant");
  const N = constantValue(modern, "avogadroConstant");
  const R = constantValue(modern, "molarGasConstant");
  assertSameSet(k, N, R);
  assert.equal(R.value, 8.31446261815324);
  assert.equal(N.value * k.value, R.value);
  assert.throws(() => {
    modern.entries[0].value = 1;
  });
  assert.throws(() => modern.entries.push(modern.entries[0]));
});
test("unverified historical and reserved sets cannot masquerade as available", () => {
  for (const id of ["einstein-1905-brownian-printed", ...Object.keys(RESERVED_SET_IDS)])
    assert.throws(
      () => getConstantSet(id),
      (e) => e.code === "constant-set-not-registered",
    );
  assert.throws(
    () => getConstantSet("unknown"),
    (e) => e.code === "unknown-constant-set",
  );
});
test("declared scenarios retain provenance and refuse circular illustrative inputs", () => {
  const declared = createDeclaredConstantSet(draft);
  near(thermalConstant(declared).value, 8.31 / 6e23, 0);
  assert.throws(
    () => assertSameSet(thermalConstant(declared), thermalConstant(modern)),
    (e) => e.code === "constant-set-mismatch",
  );
  assert.throws(() =>
    createDeclaredConstantSet({ ...draft, id: "einstein-1905-brownian-printed" }),
  );
  assert.throws(() =>
    createDeclaredConstantSet({ ...draft, entries: [draft.entries[0], draft.entries[0]] }),
  );
  assert.throws(() =>
    createDeclaredConstantSet({ ...draft, entries: [{ ...draft.entries[0], exactDecimal: "9" }] }),
  );
  assert.throws(() => createDeclaredConstantSet({ ...draft, gasConstantProvenance: "defined" }));
  const illustration = createDeclaredConstantSet({
    ...draft,
    entries: [
      {
        ...draft.entries[0],
        evidentialRole: "illustrative-computation",
        dependsOn: ["temperature", "viscosity", "particleRadius"],
      },
    ],
  });
  assert.throws(
    () => constantValue(illustration, "molarGasConstant"),
    (e) => e.code === "illustrative-value-as-input",
  );
});
const fixture = JSON.parse(
  readFileSync(new URL("../physics/reference/special/erf.table.json", import.meta.url), "utf8"),
);
test("independent erf table has the recorded content digest", () => {
  assert.equal(
    createHash("sha256").update(JSON.stringify(fixture.rows)).digest("hex"),
    fixture.rowsSha256,
  );
});
for (const row of fixture.rows)
  test(`erf/erfc independent 80-digit fixture x=${row.x}`, () => {
    const x = Number(row.x);
    near(erf(x), Number(row.erf), 1e-14);
    near(erfc(x), Number(row.erfc), x <= 6 ? 1e-14 : 1e-12);
    near(erf(-x), -erf(x), 0);
    near(erfc(-x), 2 - erfc(x), 0);
  });
test("erf utilities reject nonfinite arguments", () => {
  for (const x of [NaN, Infinity, -Infinity]) {
    assert.throws(() => erf(x));
    assert.throws(() => erfc(x));
  }
});
test("modern Brownian golden scenario and scaling identities", () => {
  const D = val(stokesEinsteinD({ T: 293.15, eta: 0.001, a: 0.5e-6 }, modern));
  // mpmath 1.3.0, mp.dps=80: D=mpf("1.380649e-23")*mpf("293.15")/(6*pi*mpf(".001")*mpf(".0000005")); sqrt(2*D).
  // Independent decimal arithmetic, not a rounded six-digit caption.
  near(D, 4.294395645549614529111291e-13, 1e-14);
  const rms = val(rmsDisplacement(D, 1));
  near(rms, 9.26757319426139145840759e-7, 1e-14);
  near(val(rmsDisplacement(D, 10)) / rms, Math.sqrt(10), 1e-15);
  near(val(rmsDisplacement(D / 2, 1)) / rms, 1 / Math.sqrt(2), 1e-15);
  const doubled = val(stokesEinsteinD({ T: 293.15, eta: 0.002, a: 0.5e-6 }, modern));
  near(doubled, D / 2, 1e-15);
  near(val(apparentSpeed(D, 0.25)), 2 * val(apparentSpeed(D, 1)), 1e-15);
});
test("declared 1905-plan inputs reproduce the arithmetic without claiming transcription", () => {
  const scenario = createDeclaredConstantSet(draft);
  const D = stokesEinsteinD({ T: 290.15, eta: 1.35e-3, a: 0.5e-6 }, scenario);
  assert.equal(D.constantSetId, "scenario-brownian-plan-inputs");
  near(val(rmsDisplacement(val(D), 1)), 0.7947832833e-6, 1e-10);
  near(val(rmsDisplacement(val(D), 60)), 6.15636484e-6, 1e-10);
  assert.notEqual(val(stokesEinsteinD({ T: 290.15, eta: 1.35e-3, a: 0.5e-6 }, modern)), val(D));
});
test("gas, nonpositive physical inputs, and nonfinite parameters are explicit non-values", () => {
  for (const bad of [0, -1, Infinity, NaN]) {
    assert.equal(
      stokesEinsteinD({ T: bad, eta: 0.001, a: 0.5e-6 }, modern).result.status,
      "outside-domain",
    );
    assert.equal(
      stokesEinsteinD({ T: 293.15, eta: bad, a: 0.5e-6 }, modern).result.status,
      "outside-domain",
    );
    assert.equal(
      stokesEinsteinD({ T: 293.15, eta: 0.001, a: bad }, modern).result.status,
      "outside-domain",
    );
  }
  const gas = stokesEinsteinD({ T: 293.15, eta: 0.001, a: 0.5e-6, medium: "gas" }, modern);
  assert.equal(gas.result.condition, "stokes-gas-medium");
  decodeResult(gas.result);
  assert.equal(apparentSpeed(1, 0).result.status, "outside-domain");
  assert.equal(gaussianPropagator(0, -1, 1).result.status, "outside-domain");
  assert.equal(intervalProbability(1, -1, 1, 1).result.status, "outside-domain");
  assert.equal(radialPropagator2d(-1, 1, 1).result.status, "outside-domain");
});
test("point distributions include closed endpoints, not an infinitely tall Gaussian", () => {
  for (const [D, t] of [
    [1, 0],
    [0, 1],
    [0, 0],
  ]) {
    for (const f of [gaussianPropagator, radialPropagator2d, radialPropagator3d]) {
      const result = f(0, t, D).result;
      assert.equal(result.status, "analytic-limit");
      decodeResult(result);
    }
    for (const [lo, hi, expected] of [
      [-1, 1, 1],
      [0, 1, 1],
      [-1, 0, 1],
      [0, 0, 1],
      [0.5, 1, 0],
      [-2, -1, 0],
    ])
      assert.equal(val(intervalProbability(lo, hi, t, D)), expected);
  }
  assert.equal(val(intervalProbability(0, 0, 1, 1)), 0);
  assert.equal(val(rmsDisplacement(0, 1)), 0);
});
test("interval probability uses tail-safe and narrow-interval calculations", () => {
  near(val(intervalProbability(-1, 1, 1, 0.5)), 0.6826894921370859, 1e-14);
  near(val(intervalProbability(8, 9, 1, 0.5)), 6.219831985865830283955079e-16, 1e-13);
  near(val(intervalProbability(-9, -8, 1, 0.5)), 6.219831985865830283955079e-16, 1e-13);
  const a = 8,
    b = 8 + 1e-10;
  near(
    val(intervalProbability(a, b, 1, 0.5)),
    (Math.exp(-32) / Math.sqrt(2 * Math.PI)) * (b - a),
    1e-9,
  );
  assert.equal(gaussianPropagator(1e200, 1, 0.5).result.status, "outside-domain");
  assert.equal(intervalProbability(100, 101, 1, 0.5).result.status, "outside-domain");
  assert.equal(val(intervalProbability(-1e308, 1e308, 1, 0.5)), 1);
});
// Composite Simpson quadrature is independent of the propagator's closed-form integral.
function integrate(f, a, b, n = 10000) {
  const h = (b - a) / n;
  let sum = f(a) + f(b);
  for (let i = 1; i < n; i++) sum += (i % 2 ? 4 : 2) * f(a + i * h);
  return (sum * h) / 3;
}
test("1D, 2D radial, and 3D radial densities normalize independently", () => {
  near(
    integrate((x) => val(gaussianPropagator(x, 1, 0.5)), -10, 10),
    1,
    1e-12,
  );
  for (const [d, density] of [
    [2, radialPropagator2d],
    [3, radialPropagator3d],
  ]) {
    const stats = moments(d, 0.5, 1);
    near(
      integrate((r) => val(density(r, 1, 0.5)), 0, 10),
      1,
      1e-12,
    );
    near(
      integrate((r) => r * val(density(r, 1, 0.5)), 0, 10),
      val(stats.meanRadius),
      1e-12,
    );
    near(
      integrate((r) => r * r * val(density(r, 1, 0.5)), 0, 10),
      val(stats.total),
      1e-12,
    );
    near(val(stats.total), d * val(stats.marginal), 1e-15);
    near(val(stats.rmsRadius) ** 2, val(stats.total), 1e-15);
  }
});
test("osmotic pressure uses number density, and zero particles is a valid zero", () => {
  near(val(osmoticPressure({ n: 1e18, T: 293.15 }, modern)), 4.0473725435e-3, 1e-14);
  assert.equal(val(osmoticPressure({ n: 0, T: 293.15 }, modern)), 0);
});
