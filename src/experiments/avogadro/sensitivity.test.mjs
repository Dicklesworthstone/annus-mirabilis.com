import assert from "node:assert/strict";
import test from "node:test";
import { AVOGADRO_DEFAULTS, AVOGADRO_FIELDS } from "./definition.ts";
import { AVOGADRO_STUDY_ROUTES, MAX_SENSITIVITY_POINTS, parseSensitivityValues, studyAvogadroSensitivity } from "./sensitivity.ts";

// These fixtures test orchestration and evidence preservation, not numerical physics.
const result = (route, value = 4, payload = {}) => ({ quantityId: route.id, unit: "mol^-1", semanticKind: "avogadro-comparison", ownerId: `fixture-${route.id}`, status: "value", value, ...payload });
const calculate = (parameters) => ({ kind: "accepted", parameters, outputs: AVOGADRO_STUDY_ROUTES.map(route => result(route, parameters.alphaScale * 4)) });
const run = (values = [0.8, 1, 1.2], owner = calculate, input = AVOGADRO_DEFAULTS, key = "alphaScale") => studyAvogadroSensitivity(input, key, values, owner);

test("exactly one declared input changes in each trial; the caller's baseline is untouched", () => {
  const input = { ...AVOGADRO_DEFAULTS };
  const seen = [];
  const got = run([0.8, 1, 1.2], p => { seen.push(p); return calculate(p); }, input);
  assert.equal(got.kind, "accepted");
  assert.equal(seen.length, 3, "baseline-valued trial reuses the baseline calculation");
  for (const p of seen) {
    assert.ok(Object.isFrozen(p));
    for (const key of Object.keys(AVOGADRO_FIELDS)) if (key !== "alphaScale") assert.equal(p[key], input[key], key);
  }
  assert.deepEqual(input, AVOGADRO_DEFAULTS);
  assert.equal(got.study.points[0].readings[0].ratio, 0.8);
  assert.equal(got.study.points[1].readings[0].ratio, 1);
  assert.equal(got.study.points[2].readings[0].ratio, 1.2);
});
test("historical and modern basis can be studied without changing observations", () => {
  const seen = [];
  const got = run([0, 1], p => { seen.push(p); return calculate(p); }, AVOGADRO_DEFAULTS, "constantBasis");
  assert.equal(got.kind, "accepted");
  assert.equal(seen[1].constantBasis, 1);
  for (const key of Object.keys(AVOGADRO_FIELDS)) if (key !== "constantBasis") assert.equal(seen[1][key], AVOGADRO_DEFAULTS[key]);
});
test("every invalid request is rejected before any numerical work", () => {
  let calls = 0;
  const owner = p => { calls++; return calculate(p); };
  for (const [values, input, key] of [
    [[], AVOGADRO_DEFAULTS, "alphaScale"],
    [[1], AVOGADRO_DEFAULTS, "alphaScale"],
    [[0.5, 0.5], AVOGADRO_DEFAULTS, "alphaScale"],
    [[0.8, NaN], AVOGADRO_DEFAULTS, "alphaScale"],
    [[0.8, Infinity], AVOGADRO_DEFAULTS, "alphaScale"],
    [[0.8, 100], AVOGADRO_DEFAULTS, "alphaScale"],
    [[0.8], {}, "alphaScale"],
    [[0.8], AVOGADRO_DEFAULTS, "constructor"],
    [[0.8], AVOGADRO_DEFAULTS, "__proto__"],
    [[0.8], AVOGADRO_DEFAULTS, "doesNotExist"],
    [[0.5], AVOGADRO_DEFAULTS, "constantBasis"],
    [[2], AVOGADRO_DEFAULTS, "coefficient"],
    [Array.from({ length: MAX_SENSITIVITY_POINTS + 1 }, (_, i) => 1 + i / 10), AVOGADRO_DEFAULTS, "alphaScale"],
  ]) assert.equal(run(values, owner, input, key).kind, "refused");
  assert.equal(calls, 0);
});
test("the maximum accepted study stays within the declared evaluation budget", () => {
  let calls = 0;
  const got = run(Array.from({ length: MAX_SENSITIVITY_POINTS }, (_, i) => 2 + i / 10), p => { calls++; return calculate(p); });
  assert.equal(got.kind, "accepted");
  assert.equal(calls, MAX_SENSITIVITY_POINTS + 1);
});
for (const payload of [
  { status: "underdetermined", compatibleFamily: "aN is fixed", neededInformation: ["Independent radius"] },
  { status: "outside-domain", domainKind: "model", condition: "dilute-model", reason: "The solution is too concentrated.", boundary: { alternativeModel: "Concentrated-solution model" } },
  { status: "not-applicable", reason: "The selected quantity does not apply." },
  { status: "symbolic", expressionRef: "unknown-radius", unspecifiedSymbols: ["radius"] },
  { status: "analytic-limit", description: "A limiting coefficient", representation: { kind: "coefficient", value: 1 } },
  { status: "divergent", expressionRef: "integral", divergenceKind: "integral", variable: "x", range: { lower: 0, upper: "unbounded" }, rate: { statement: "No finite total" }, modelId: "fixture", finiteUnder: { parameterId: "cutoff", value: 1 } },
]) {
  test(`${payload.status} stays a nonnumeric result, never zero or a made-up ratio`, () => {
    const owner = p => {
      const got = calculate(p);
      const { value, ...identity } = got.outputs[0];
      got.outputs[0] = { ...identity, ...structuredClone(payload) };
      return got;
    };
    const got = run([0.8], owner);
    assert.equal(got.kind, "accepted");
    const reading = got.study.points[0].readings[0];
    assert.equal(reading.result.status, payload.status);
    assert.equal(reading.ratio, null);
    assert.ok(!Object.hasOwn(reading.result, "value"));
    for (const [key, value] of Object.entries(payload)) assert.deepEqual(reading.result[key], value);
  });
}
test("non-numeric to numeric transitions still have no ratio", () => {
  const got = run([0.8], p => {
    const got = calculate(p);
    if (p.alphaScale === 1) {
      const { value, ...identity } = got.outputs[0];
      got.outputs[0] = { ...identity, status: "not-applicable", reason: "No baseline quantity." };
    }
    return got;
  });
  assert.equal(got.kind, "accepted");
  assert.equal(got.study.points[0].readings[0].result.status, "value");
  assert.equal(got.study.points[0].readings[0].ratio, null);
});
test("owner output storage and uncertainty are detached and frozen", () => {
  const emitted = [];
  const got = run([0.8], p => {
    const got = calculate(p);
    got.outputs[0].uncertainty = { kind: "statistical-interval", lower: 1, upper: 9, coverage: 0.95, sampleSize: 100, method: "Fixture" };
    emitted.push(got);
    return got;
  });
  assert.equal(got.kind, "accepted");
  emitted[1].outputs[0].value = 900;
  emitted[1].outputs[0].uncertainty.lower = 800;
  const reading = got.study.points[0].readings[0].result;
  assert.equal(reading.value, 3.2);
  assert.equal(reading.uncertainty.lower, 1);
  assert.ok(Object.isFrozen(reading.uncertainty));
  assert.ok(Object.isFrozen(got.study.points));
  assert.ok(Object.isFrozen(got.study.baseline.parameters));
});
for (const field of ["unit", "ownerId", "semanticKind"]) {
  test(`a changed ${field} refuses the entire study`, () => {
    const got = run([0.8], p => {
      const got = calculate(p);
      if (p.alphaScale !== 1) got.outputs[0][field] = "changed";
      return got;
    });
    assert.equal(got.kind, "refused");
    assert.ok(!Object.hasOwn(got, "study"));
  });
}
test("missing, duplicate, nonfinite and array-valued scalar outputs are refused", () => {
  for (const mutate of [
    r => r.outputs.pop(),
    r => r.outputs.push(r.outputs[0]),
    r => { r.outputs[0].value = Infinity; },
    r => { r.outputs[0].value = new Float64Array([4]); },
  ]) {
    assert.equal(run([0.8], p => { const got = calculate(p); mutate(got); return got; }).kind, "refused");
  }
});
test("results for different settings cannot be attributed to the requested trial", () => {
  assert.equal(run([0.8], p => ({ ...calculate(p), parameters: { ...p, viscosityMpaS: 2 } })).kind, "refused");
});
test("zero denominators and overflow never turn into numeric comparison readings", () => {
  for (const [base, changed] of [[0, 4], [Number.MIN_VALUE, Number.MAX_VALUE]]) {
    const got = run([0.8], p => ({ ...calculate(p), outputs: AVOGADRO_STUDY_ROUTES.map(route => result(route, p.alphaScale === 1 ? base : changed)) }));
    assert.equal(got.kind, "accepted");
    assert.equal(got.study.points[0].readings[0].ratio, null);
  }
});
test("a finite ratio that underflows is not reported as an exact zero", () => {
  const got = run([0.8], p => ({ ...calculate(p), outputs: AVOGADRO_STUDY_ROUTES.map(route => result(route, p.alphaScale === 1 ? 1e300 : 1e-300)) }));
  assert.equal(got.kind, "accepted");
  assert.equal(got.study.points[0].readings[0].ratio, null);
});
test("a genuine zero numerator still gives a zero ratio", () => {
  const got = run([0.8], p => ({ ...calculate(p), outputs: AVOGADRO_STUDY_ROUTES.map(route => result(route, p.alphaScale === 1 ? 4 : 0)) }));
  assert.equal(got.kind, "accepted");
  assert.equal(got.study.points[0].readings[0].ratio, 0);
});
test("late owner refusal or crash does not publish a partially populated study", () => {
  for (const crash of [false, true]) {
    let calls = 0;
    const got = run([0.8, 1.2], p => {
      calls++;
      if (calls === 3) {
        if (crash) throw new Error("fixture failure");
        return { kind: "refused", reason: "Trial refused" };
      }
      return calculate(p);
    });
    assert.equal(got.kind, "refused");
    assert.ok(!Object.hasOwn(got, "study"));
    assert.equal(calls, 3);
  }
});
test("trial parser accepts explicit decimal notation, not expressions, omissions or coerced values", () => {
  const got = parseSensitivityValues(" 0.8, 1e0, +1.2 ");
  assert.equal(got.kind, "accepted");
  assert.deepEqual(got.values, [0.8, 1, 1.2]);
  assert.ok(Object.isFrozen(got.values));
  for (const text of ["", " ", "1,", ",1", "1,,2", "0x1", "1/2", "NaN", "Infinity", "1e999", "1,1.0", "1,2,3,4,5,6,7,8", "1".repeat(65), "1,".repeat(300)]) assert.equal(parseSensitivityValues(text).kind, "refused", text);
});
