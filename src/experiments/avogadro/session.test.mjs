import assert from "node:assert/strict";
import { test } from "node:test";
import { AVOGADRO_DEFAULTS } from "./definition.ts";
import { createAvogadroSession, evaluateAvogadro } from "./session.ts";
const output = (s, id) => {
  const r = s.outputs.find((r) => r.quantityId === id);
  assert.ok(r, `missing ${id}`); return r;
};

test("all three methods publish one instance-scoped initial snapshot", () => {
  const session = createAvogadroSession("comparison-initial");
  const s = session.getSnapshot().accepted;
  assert.ok(s); assert.equal(s.instanceId, "comparison-initial");
  for (const id of ["radiationNumber", "brownianNumber", "molecularNumber", "definedNumber"]) {
    assert.equal(output(s, id).status, "value"); assert.ok(Number.isFinite(output(s, id).value));
  }
  const interval = output(s, "brownianNumber").uncertainty;
  assert.equal(interval.kind, "statistical-interval"); assert.equal(interval.coverage, 0.95);
  assert.ok(interval.lower < output(s, "brownianNumber").value);
  assert.ok(interval.upper > output(s, "brownianNumber").value);
});

test("invalid drafts and no-op applies preserve the exact accepted state", () => {
  const session = createAvogadroSession("comparison-refusal");
  const before = session.getSnapshot(); let notifications = 0;
  const unsubscribe = session.subscribe(() => notifications++);
  assert.equal(session.apply({ ...AVOGADRO_DEFAULTS, meanSquareUm2: NaN }).kind, "refused");
  assert.strictEqual(session.getSnapshot(), before);
  session.apply(AVOGADRO_DEFAULTS);
  assert.strictEqual(session.getSnapshot(), before); assert.equal(notifications, 0);
  unsubscribe();
});

test("changing one instance does not change its peer or its server snapshot", () => {
  const a = createAvogadroSession("comparison-a"), b = createAvogadroSession("comparison-b");
  const initial = a.getServerSnapshot(); const peer = b.getSnapshot();
  assert.equal(a.apply({ ...AVOGADRO_DEFAULTS, alphaScale: 2 }).kind, "accepted");
  assert.equal(output(a.getSnapshot().accepted, "radiationNumber").value, output(initial.accepted, "radiationNumber").value / 2);
  assert.strictEqual(a.getServerSnapshot(), initial); assert.strictEqual(b.getSnapshot(), peer);
});

test("unknown radius publishes the family, while refusing invalid observation assumptions", () => {
  const unknown = evaluateAvogadro({ ...AVOGADRO_DEFAULTS, radiusKnown: 0 });
  assert.equal(unknown.kind, "accepted");
  assert.equal(output(unknown, "brownianNumber").status, "underdetermined");
  assert.equal(output(unknown, "brownianRadiusProduct").status, "value");
  const noisy = evaluateAvogadro({ ...AVOGADRO_DEFAULTS, independentModel: 0 });
  assert.equal(noisy.kind, "accepted"); assert.equal(output(noisy, "brownianNumber").status, "outside-domain");
  assert.equal(output(noisy, "brownianRadiusProduct").status, "outside-domain");
});

test("scientific partial results are published without falsifying the other methods", () => {
  const s = createAvogadroSession("comparison-partial");
  s.apply({ ...AVOGADRO_DEFAULTS, specificViscosity: 0.2 });
  const current = s.getSnapshot().accepted;
  assert.equal(output(current, "molecularNumber").status, "outside-domain");
  assert.equal(output(current, "radiationNumber").status, "value");
  assert.equal(output(current, "brownianNumber").status, "value");
  s.apply({ ...AVOGADRO_DEFAULTS, molarConcentration: 0, specificViscosity: 0 });
  assert.equal(output(s.getSnapshot().accepted, "molecularNumber").status, "underdetermined");
});

test("with fixed RMS, more independent observations narrow the conditional interval", () => {
  const small = evaluateAvogadro({ ...AVOGADRO_DEFAULTS, coordinateCount: 20 });
  const large = evaluateAvogadro({ ...AVOGADRO_DEFAULTS, coordinateCount: 2000 });
  assert.equal(small.kind, "accepted"); assert.equal(large.kind, "accepted");
  const a = output(small, "brownianNumber"), b = output(large, "brownianNumber");
  assert.equal(a.value, b.value);
  assert.ok(b.uncertainty.upper - b.uncertainty.lower < a.uncertainty.upper - a.uncertainty.lower);
});
