import assert from "node:assert/strict";
import { test } from "node:test";
import { AVOGADRO_DEFAULTS } from "./definition.ts";
import { createAvogadroSession, evaluateAvogadro } from "./session.ts";

const output = (s, id) => {
  const r = s.outputs.find((r) => r.quantityId === id);
  assert.ok(r, `missing ${id}`);
  return r;
};

test("all three methods publish one instance-scoped initial snapshot", () => {
  const session = createAvogadroSession("comparison-initial");
  const s = session.getSnapshot().accepted;
  assert.ok(s);
  assert.equal(s.instanceId, "comparison-initial");
  for (const id of ["radiationNumber", "brownianNumber", "molecularNumber", "definedNumber"]) {
    assert.equal(output(s, id).status, "value");
    assert.ok(Number.isFinite(output(s, id).value));
  }
  const interval = output(s, "brownianNumber").uncertainty;
  assert.equal(interval.kind, "statistical-interval");
  assert.equal(interval.coverage, 0.95);
  assert.ok(interval.lower < output(s, "brownianNumber").value);
  assert.ok(interval.upper > output(s, "brownianNumber").value);
});

test("invalid drafts and no-op applies preserve the exact accepted state", () => {
  const session = createAvogadroSession("comparison-refusal");
  const before = session.getSnapshot();
  let notifications = 0;
  const unsubscribe = session.subscribe(() => notifications++);
  assert.equal(session.apply({ ...AVOGADRO_DEFAULTS, meanSquareUm2: NaN }).kind, "refused");
  assert.strictEqual(session.getSnapshot(), before);
  session.apply(AVOGADRO_DEFAULTS);
  assert.strictEqual(session.getSnapshot(), before);
  assert.equal(notifications, 0);
  unsubscribe();
});

test("changing one instance does not change its peer or its server snapshot", () => {
  const a = createAvogadroSession("comparison-a"),
    b = createAvogadroSession("comparison-b");
  const initial = a.getServerSnapshot();
  const peer = b.getSnapshot();
  assert.equal(a.apply({ ...AVOGADRO_DEFAULTS, alphaScale: 2 }).kind, "accepted");
  assert.equal(
    output(a.getSnapshot().accepted, "radiationNumber").value,
    output(initial.accepted, "radiationNumber").value / 2,
  );
  assert.strictEqual(a.getServerSnapshot(), initial);
  assert.strictEqual(b.getSnapshot(), peer);
});

test("unknown radius publishes the family, while refusing invalid observation assumptions", () => {
  const unknown = evaluateAvogadro({ ...AVOGADRO_DEFAULTS, radiusKnown: 0 });
  assert.equal(unknown.kind, "accepted");
  assert.equal(output(unknown, "brownianNumber").status, "underdetermined");
  assert.equal(output(unknown, "brownianRadiusProduct").status, "value");
  const noisy = evaluateAvogadro({ ...AVOGADRO_DEFAULTS, independentModel: 0 });
  assert.equal(noisy.kind, "accepted");
  assert.equal(output(noisy, "brownianNumber").status, "outside-domain");
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
  assert.equal(small.kind, "accepted");
  assert.equal(large.kind, "accepted");
  const a = output(small, "brownianNumber"),
    b = output(large, "brownianNumber");
  assert.equal(a.value, b.value);
  assert.ok(b.uncertainty.upper - b.uncertainty.lower < a.uncertainty.upper - a.uncertainty.lower);
});

/**
 * Refusal sites in session.ts, one case per throw site (am-p465, am-kd9h).
 *
 * ONE OF THE THREE SITES IS REACHABLE. The other two are left counted rather than covered, and
 * `publication-refused` is NOT named anywhere below, so no assertion here can collect a surplus
 * credit for a site no case drives.
 *
 *   :199 the initial publication. Its output contracts are BUILT FROM initial.outputs a few lines
 *        above it, so the batch it checks and the contracts it checks against come from the same
 *        evaluation and agree by construction.
 *   :234 the publication inside apply(). This one is not structural in the same way - the
 *        contracts are frozen from the FIRST evaluation, so a later apply that changed the shape
 *        of the output set would break them. Measured across the parameter envelope, the shape
 *        does not change: eight outputs with the same ids, units, semantic kinds and owners for
 *        radiusKnown 0, independentModel 0, alphaScale 2, coefficient 1, radiusUm 5,
 *        coordinateCount 1, specificViscosity 0 and molarConcentration 0, while
 *        soluteDiffusionUm2S 0 and meanSquareUm2 0 are refused by the evaluator first and never
 *        reach a publication. Not proved unreachable, measured unreached.
 */
test("a session refuses to open on parameters the evaluator rejects (session.ts:168)", () => {
  let thrown;
  try {
    createAvogadroSession("avogadro-refusal-open", { ...AVOGADRO_DEFAULTS, meanSquareUm2: NaN });
  } catch (error) {
    thrown = error;
  }
  assert.ok(thrown, "the session opened on parameters the evaluator rejects");
  assert.equal(thrown.code, "parameters-rejected");
  assert.equal(thrown.experimentId, "avogadro");
  // The refusal carries the evaluator's own reason rather than a generic message, so a reader is
  // told which setting is wrong and not merely that something was.
  assert.notEqual(thrown.message, "");
  assert.equal(evaluateAvogadro({ ...AVOGADRO_DEFAULTS, meanSquareUm2: NaN }).kind, "refused");
});

test("a session opens on parameters the evaluator accepts", () => {
  // The negative a naive "always throw" implementation would fail.
  const session = createAvogadroSession("avogadro-refusal-control");
  assert.equal(session.getSnapshot().accepted?.experimentId, "avogadro-lab");
});
