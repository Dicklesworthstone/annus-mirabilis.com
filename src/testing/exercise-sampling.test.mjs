import assert from "node:assert/strict";
import test from "node:test";
import { checkEquivalence } from "../discovery/exercises/equivalence.ts";
import {
  boundaryPoints,
  haltonPoints,
  haltonValue,
  mapUnitToDomain,
  philoxPoints,
  validateDomains,
} from "../discovery/exercises/samplePoints.ts";
import { createPhiloxStream } from "../physics/reference/philox.ts";

const n = (value) => ({ kind: "number", value });
const x = { kind: "identifier", name: "x" };
const b = (op, left, right) => ({ kind: "binary", op, left, right });
const call = (name, arg) => ({ kind: "call", name, arg });
const tolerance = { absolute: 1e-10, relative: 1e-10 };
const domain = { x: { min: 0, max: 1 } };
const check = (reader, reference, domains = domain, options) =>
  checkEquivalence(reader, reference, domains, tolerance, options);

test("the documented grid-tuned false equivalence is rejected by the second set", () => {
  const wrong = b("+", b("^", x, n(2)), call("sin", b("*", b("*", n(32), n(Math.PI)), x)));
  for (const seed of ["0", "1", "9007199254740993", "18446744073709551615"])
    assert.equal(check(wrong, b("*", x, x), domain, { seed }).status, "not-equivalent");
});
test("polynomial identities retain a qualified, reproducible success", () => {
  const run = () =>
    check(b("-", b("^", x, n(2)), n(1)), b("*", b("-", x, n(1)), b("+", x, n(1))), {
      x: { min: -10, max: 10 },
    });
  assert.deepEqual(run(), run());
  assert.equal(run().status, "equivalent");
  assert.ok(run().acceptedPointCount >= 32);
  assert.match(run().label, /not a proof/);
});
test("a formula undefined on half the reference domain cannot pass by skipping that half", () => {
  assert.equal(
    check(b("^", call("sqrt", x), n(2)), x, { x: { min: -1, max: 1 } }).status,
    "could-not-compare",
  );
});
test("a cancelled denominator cannot hide a domain hole at zero", () => {
  const result = check(b("/", x, x), n(1), { x: { min: -1, max: 1 } });
  assert.equal(result.status, "could-not-compare");
  assert.match(result.reason, /cannot be discarded/);
});
test("sqrt(x*x) is not x on a domain including negative values", () => {
  assert.equal(
    check(call("sqrt", b("*", x, x)), x, { x: { min: -1, max: 1 } }).status,
    "not-equivalent",
  );
});
test("an everywhere undefined reference gives no verdict", () => {
  assert.equal(check(n(0), b("/", n(1), n(0))).status, "could-not-compare");
});
test("literal expressions count a single distinct point instead of invented sample coverage", () => {
  const result = check(b("+", n(2), n(3)), n(5), {});
  assert.equal(result.status, "equivalent");
  assert.equal(result.acceptedPointCount, 1);
});
test("representationally collapsed sampling cannot fabricate independent coverage", () => {
  assert.equal(check(x, x, { x: { min: 1, max: 1 + Number.EPSILON } }).status, "could-not-compare");
});
for (const spec of [
  {},
  { relative: 1 },
  { absolute: NaN },
  { absolute: Infinity },
  { absolute: -1 },
  { relativeTo: "invalid", absolute: 1e-9 },
])
  test(`invalid tolerance is not a wrong-answer verdict: ${JSON.stringify(spec)}`, () => {
    assert.equal(checkEquivalence(x, x, domain, spec).status, "could-not-compare");
  });
for (const bounds of [
  { min: 1, max: 0 },
  { min: 1, max: 1 },
  { min: NaN, max: 2 },
  { min: 0, max: Infinity },
  { min: 0, max: 1, scale: "log" },
  { min: 1, max: 2, scale: "bad" },
])
  test(`invalid domains are refused: ${JSON.stringify(bounds)}`, () => {
    assert.throws(() => validateDomains({ x: bounds }));
    assert.equal(check(x, x, { x: bounds }).status, "could-not-compare");
  });
for (const count of [-1, 0.5, 257, Infinity, NaN])
  test(`bounded sampler rejects count ${count}`, () => {
    assert.throws(() => haltonPoints(domain, count));
    assert.throws(() => philoxPoints(domain, count));
  });
test("Halton published initial base-two points are unchanged", () => {
  assert.deepEqual(
    haltonPoints(domain, 4).map((p) => p.x),
    [0.5, 0.25, 0.75, 0.125],
  );
  assert.equal(haltonValue(0, 2), 0);
  assert.throws(() => haltonValue(1, 1));
  assert.throws(() => haltonValue(Infinity, 2));
});
test("no modulo reuse of the same Halton axis beyond eight dimensions", () => {
  assert.throws(() =>
    haltonPoints(
      Object.fromEntries(Array.from({ length: 9 }, (_, i) => ["x" + i, { min: 0, max: 1 }])),
      4,
    ),
  );
});
test("sampling cannot shadow the built-in pi constant or execute an accessor", () => {
  assert.throws(() => philoxPoints({ pi: { min: 2, max: 3 } }, 1));
  let called = false;
  const invalid = {};
  Object.defineProperty(invalid, "x", {
    enumerable: true,
    get() {
      called = true;
      throw Error("called");
    },
  });
  assert.throws(() => validateDomains(invalid));
  assert.equal(called, false);
});
test("linear and logarithmic sampling stay finite across extreme ranges", () => {
  for (const d of [
    { min: -1e308, max: 1e308 },
    { min: 1e-300, max: 1e300, scale: "log" },
  ])
    for (const points of [haltonPoints({ x: d }, 64), philoxPoints({ x: d }, 64)])
      assert.ok(points.every((p) => Number.isFinite(p.x) && p.x >= d.min && p.x <= d.max));
  assert.equal(mapUnitToDomain(0.5, { min: -1e308, max: 1e308 }), 0);
});
test("Philox points use exact 64-bit seeds, reproduce, and separate exercise streams", () => {
  const a = philoxPoints(domain, 16, "9007199254740992");
  const b = philoxPoints(domain, 16, "9007199254740993");
  assert.notDeepEqual(a, b);
  assert.deepEqual(b, philoxPoints(domain, 16, "9007199254740993"));
  assert.throws(() => philoxPoints(domain, 1, Number.MAX_SAFE_INTEGER + 2));
});
test("no simulation stream is consumed and no Math.random fallback is used", () => {
  const stream = createPhiloxStream({ seed: "42", kernel: 1, tile: 0 });
  const before = stream.index;
  const original = Math.random;
  Math.random = () => {
    throw Error("forbidden");
  };
  try {
    assert.equal(check(x, x).status, "equivalent");
  } finally {
    Math.random = original;
  }
  assert.equal(stream.index, before);
});
test("boundary probes are bounded and samples are immutable", () => {
  const points = boundaryPoints({ x: { min: -1, max: 1 }, y: { min: 2, max: 4 } });
  assert.equal(points.length, 5);
  assert.deepEqual(points[0], { x: 0, y: 3 });
  assert.throws(() => {
    points[0].x = 9;
  });
  assert.throws(() => {
    haltonPoints(domain, 1).push({ x: 1 });
  });
});
