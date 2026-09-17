import assert from "node:assert/strict";
import test from "node:test";
import { transformThreeForce } from "../physics/reference/forceTransform.ts";
import { withinTolerance } from "../units/tolerance.ts";

const zero = Object.freeze({ x: 0, y: 0, z: 0 });
const base = Object.freeze({ force: { x: 2, y: 3, z: -5 }, velocity: zero, beta: 0.6, c: 1 });
function admitted(input = base) {
  const out = transformThreeForce(input);
  assert.equal(out.status, "value", out.reason);
  return out;
}
function near(a, b, relative = 1e-12) {
  const spec = b === 0 ? { absolute: relative } : { relative };
  const verdict = withinTolerance(a, b, spec);
  assert.ok(verdict.ok, `${a} != ${b} (${verdict.kind})`);
}
test("zero boost preserves force and coordinate time", () => {
  const out = admitted({ ...base, beta: 0, velocity: { x: 0.2, y: 0.3, z: -0.4 } });
  assert.deepEqual(out.force, base.force);
  assert.equal(out.dtPrimeOverDt, 1);
  assert.equal(out.gamma, 1);
});
test("a stationary particle's transverse force scales by inverse gamma", () => {
  const out = admitted();
  near(out.force.x, 2);
  near(out.force.y, 2.4);
  near(out.force.z, -4);
  near(out.dtPrimeOverDt, 1.25);
});
test("a comoving particle's transverse force scales by gamma", () => {
  const out = admitted({ ...base, velocity: { x: 0.6, y: 0, z: 0 } });
  near(out.force.x, 2);
  near(out.force.y, 3.75);
  near(out.force.z, -6.25);
  near(out.dtPrimeOverDt, 0.8);
});
test("longitudinal force remains unchanged at near-null collinear speeds", () => {
  const out = admitted({
    ...base,
    force: { x: 7, y: 0, z: 0 },
    beta: 0.999999999999,
    velocity: { x: 0.999999999999, y: 0, z: 0 },
  });
  assert.equal(out.force.x, 7);
});
for (const beta of [-0.9, -0.6, -0.1, 0.1, 0.6, 0.9]) {
  test(`three-force agrees with an independent four-force transformation at beta=${beta}`, () => {
    const u = { x: 0.2, y: -0.3, z: 0.4 };
    const F = base.force;
    const out = admitted({ ...base, velocity: u, beta });
    const particleGamma = 1 / Math.sqrt(1 - u.x ** 2 - u.y ** 2 - u.z ** 2);
    const observerGamma = 1 / Math.sqrt(1 - beta ** 2);
    const K0 = particleGamma * (F.x * u.x + F.y * u.y + F.z * u.z);
    const Kx = particleGamma * F.x;
    const KxPrime = observerGamma * (Kx - beta * K0);
    const particleGammaPrime = observerGamma * particleGamma * (1 - beta * u.x);
    near(out.force.x, KxPrime / particleGammaPrime);
    near(out.force.y, (particleGamma * F.y) / particleGammaPrime);
    near(out.force.z, (particleGamma * F.z) / particleGammaPrime);
  });
}
test("inverse boost recovers the same force when velocity is also transformed", () => {
  const u = { x: 0.2, y: -0.3, z: 0.4 };
  const out = admitted({ ...base, velocity: u });
  const den = 1 - base.beta * u.x;
  const up = { x: (u.x - base.beta) / den, y: u.y / (out.gamma * den), z: u.z / (out.gamma * den) };
  const back = admitted({ ...base, force: out.force, velocity: up, beta: -base.beta });
  for (const axis of ["x", "y", "z"]) near(back.force[axis], base.force[axis]);
  near(out.dtPrimeOverDt * back.dtPrimeOverDt, 1);
});
test("explicit SI and normalized units give the same force", () => {
  const c = 299792458;
  const normalized = admitted({ ...base, velocity: { x: 0.2, y: 0.3, z: 0.4 } });
  const si = admitted({ ...base, c, velocity: { x: 0.2 * c, y: 0.3 * c, z: 0.4 * c } });
  for (const axis of ["x", "y", "z"]) near(si.force[axis], normalized.force[axis]);
});
test("zero force stays zero without suppressing the time transformation", () => {
  const out = admitted({ ...base, force: zero });
  assert.deepEqual(out.force, zero);
  near(out.dtPrimeOverDt, 1.25);
});
for (const beta of [-2, -1, 1, 2]) {
  test(`refuse non-inertial beta=${beta}`, () =>
    assert.equal(transformThreeForce({ ...base, beta }).domainKind, "physical"));
}
for (const velocity of [
  { x: 1, y: 0, z: 0 },
  { x: 0.8, y: 0.8, z: 0 },
]) {
  test(`refuse total massive-particle speed ${JSON.stringify(velocity)}`, () =>
    assert.equal(transformThreeForce({ ...base, velocity }).domainKind, "physical"));
}
for (const patch of [
  { c: 0 },
  { c: -1 },
  { c: NaN },
  { beta: Infinity },
  { force: { ...zero, x: NaN } },
  { velocity: { ...zero, y: Infinity } },
]) {
  test(`refuse non-finite/invalid input ${JSON.stringify(patch)}`, () =>
    assert.equal(transformThreeForce({ ...base, ...patch }).domainKind, "input"));
}
test("overflow is a numerical refusal, never an accepted infinite force", () => {
  const out = transformThreeForce({
    ...base,
    force: { x: 0, y: Number.MAX_VALUE, z: 0 },
    velocity: { x: 0.6, y: 0, z: 0 },
  });
  assert.equal(out.status, "outside-domain");
  assert.equal(out.domainKind, "numerical");
});
test("published result and vector are immutable; caller inputs are unchanged", () => {
  const input = { ...base, force: { ...base.force } };
  const before = structuredClone(input);
  const out = admitted(input);
  assert.deepEqual(input, before);
  assert.ok(Object.isFrozen(out));
  assert.ok(Object.isFrozen(out.force));
  input.force.x = 10;
  assert.equal(out.force.x, 2);
});
