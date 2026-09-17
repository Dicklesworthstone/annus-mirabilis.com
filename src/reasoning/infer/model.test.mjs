import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { compareBitwise, withinTolerance } from "../../units/tolerance.ts";
import { evidenceFromPrepared, parseInferenceEvidence } from "./evidence.ts";
import { CAMERA_DEFAULTS, evaluateRadius, RADIUS_DEFAULTS, RADIUS_EXAMPLE } from "./model.ts";
import { createCameraInferenceSession, createRadiusSession } from "./session.ts";

const source = async (id) =>
  JSON.parse(
    await readFile(new URL(`../../generated/${id}-example.json`, import.meta.url), "utf8"),
  );
const idealSource = await source("bm07"),
  cameraSource = await source("bm08");
const ideal = evidenceFromPrepared("ideal", idealSource, "a".repeat(64));
const camera = evidenceFromPrepared("camera", cameraSource, "b".repeat(64));
const accepted = (session) => {
  const s = session.getSnapshot().accepted;
  assert.ok(s);
  return s;
};
const output = (s, id) => {
  const r = s.outputs.find((r) => r.quantityId === id);
  assert.ok(r, id);
  return r;
};
const hash = (e) => createHash("sha256").update(JSON.stringify(e)).digest("hex");
const near = (a, b) => assert.ok(withinTolerance(a, b, { relative: 1e-12, absolute: 1e-30 }).ok);

test("evidence is an immutable data projection, not a generator-truth record", () => {
  for (const e of [ideal, camera]) {
    assert.ok(Object.isFrozen(e));
    assert.ok(Object.isFrozen(e.increments));
    for (const field of [
      "hiddenNumber",
      "generatorRadius",
      "D",
      "sigma",
      "noiseSeed",
      "calibrationScale",
    ])
      assert.equal(Object.hasOwn(e, field), false, field);
    assert.throws(() => parseInferenceEvidence({ ...e, hiddenNumber: 1 }), /known data fields/);
  }
  const raw = { ...ideal, increments: [...ideal.increments] };
  const parsed = parseInferenceEvidence(raw);
  raw.increments[0] = 123;
  assert.notEqual(parsed.increments[0], 123);
});
test("full unsigned 64-bit seeds stay exact and malformed projections are rejected", () => {
  assert.equal(
    parseInferenceEvidence({ ...ideal, seed: "18446744073709551615" }).seed,
    "18446744073709551615",
  );
  for (const patch of [
    { seed: "18446744073709551616" },
    { schemaVersion: 2 },
    { dt: 0 },
    { d: 3 },
    { increments: [1, 2] },
    { increments: [...ideal.increments, 1] },
    { increments: [NaN, ...ideal.increments.slice(1)] },
    { exposure: 0.1 },
    { sourceDigest: "forged" },
    { observationDigest: "bad" },
  ])
    assert.throws(() => parseInferenceEvidence({ ...ideal, ...patch }));
  const accessor = { ...ideal };
  Object.defineProperty(accessor, "seed", {
    get() {
      throw Error("not data");
    },
    enumerable: true,
  });
  assert.throws(() => parseInferenceEvidence(accessor), /data fields/);
});
test("prepared observations must be unique accepted metre-valued arrays", () => {
  const row = idealSource.results.find((s) => JSON.parse(s).quantityId === "observationIncrements");
  assert.ok(row);
  assert.throws(() =>
    evidenceFromPrepared("ideal", { ...idealSource, results: [] }, "a".repeat(64)),
  );
  assert.throws(() =>
    evidenceFromPrepared(
      "ideal",
      { ...idealSource, results: [...idealSource.results, row] },
      "a".repeat(64),
    ),
  );
  const parsed = JSON.parse(row);
  parsed.unit = "pixel";
  assert.throws(() =>
    evidenceFromPrepared(
      "ideal",
      { ...idealSource, results: [JSON.stringify(parsed)] },
      "a".repeat(64),
    ),
  );
});
test("radius case publishes mixed typed statuses before any auxiliary measurement", () => {
  const session = createRadiusSession("radius", ideal),
    s = accepted(session);
  assert.equal(s.final, true);
  assert.equal(output(s, "avogadroNumberEstimate").status, "underdetermined");
  assert.equal(output(s, "molecularInterval").status, "underdetermined");
  assert.equal(output(s, "diffusionCoefficientEstimate").status, "value");
  assert.equal(session.getServerSnapshot().accepted, s);
});
test("adding radius keeps observations, input revision and run identity unchanged", () => {
  const session = createRadiusSession("radius", ideal),
    before = accepted(session),
    digest = hash(session.evidence);
  assert.equal(session.apply(RADIUS_EXAMPLE).kind, "accepted");
  const after = accepted(session);
  assert.equal(hash(session.evidence), digest);
  assert.equal(after.runId, before.runId);
  assert.equal(after.revisions.input, before.revisions.input);
  assert.equal(after.revisions.estimator, before.revisions.estimator + 1);
  assert.equal(after.snapshotVersion, before.snapshotVersion + 1);
  assert.equal(output(after, "avogadroNumberEstimate").status, "value");
  near(output(after, "simultaneousCoverage").value, 0.95);
  assert.ok(
    compareBitwise(
      output(before, "familyNumbers").value.copy(),
      output(after, "familyNumbers").value.copy(),
    ).ok,
  );
  assert.equal(session.getServerSnapshot().accepted, before);
});
test("removing radius restores underdetermination and does not select a fresh trial", () => {
  const session = createRadiusSession("radius", ideal, RADIUS_EXAMPLE),
    before = accepted(session);
  assert.equal(session.apply(RADIUS_DEFAULTS).kind, "accepted");
  const after = accepted(session);
  assert.equal(after.runId, before.runId);
  assert.equal(output(after, "molecularInterval").status, "underdetermined");
});
test("insufficient coverage is an explicit absent interval, not inflated confidence", () => {
  const session = createRadiusSession("radius", ideal);
  assert.equal(session.apply({ ...RADIUS_EXAMPLE, radiusCoverage: 0.95 }).kind, "accepted");
  assert.equal(output(accepted(session), "molecularInterval").status, "not-applicable");
});
test("malformed and circular radius requests leave the accepted snapshot untouched", () => {
  const session = createRadiusSession("radius", ideal),
    before = accepted(session);
  for (const patch of [
    { radius: -1 },
    { provenance: "" },
    { radiusProvenance: "same-displacements" },
    { extra: 1 },
  ]) {
    const rejected = session.apply({ ...RADIUS_EXAMPLE, ...patch });
    assert.notEqual(rejected.kind, "accepted");
    assert.equal(accepted(session), before);
    assert.equal(session.getSnapshot().pending, false);
  }
  assert.equal(evaluateRadius(camera, RADIUS_EXAMPLE).kind, "refused");
});
test("camera variance alone leaves both parameters underdetermined", () => {
  const s = accepted(createCameraInferenceSession("camera", camera));
  for (const id of ["diffusionEstimate", "noiseEstimate"])
    assert.equal(output(s, id).status, "underdetermined");
  assert.equal(output(s, "sampleCovariance").status, "not-applicable");
  assert.equal(output(s, "diffusionConfidenceInterval").status, "not-applicable");
  assert.equal(output(s, "familyDiffusion").value.length, 41);
});
test("covariance and second interval use identical observations without false intervals", () => {
  const session = createCameraInferenceSession("camera", camera),
    before = accepted(session),
    digest = hash(session.evidence);
  for (const information of ["covariance", "second-interval", "variance"]) {
    assert.equal(session.apply({ information }).kind, "accepted");
    const s = accepted(session);
    assert.equal(hash(session.evidence), digest);
    assert.equal(s.runId, before.runId);
    assert.equal(s.revisions.input, before.revisions.input);
    assert.equal(s.revisions.measurement, before.revisions.measurement);
    assert.equal(output(s, "sampleVariance").value, output(before, "sampleVariance").value);
    assert.equal(output(s, "diffusionConfidenceInterval").status, "not-applicable");
    if (information !== "variance") assert.equal(output(s, "diffusionEstimate").status, "value");
    if (information === "second-interval")
      assert.equal(output(s, "secondVariance").status, "value");
  }
});
test("an invalid information choice does not alter the accepted camera result", () => {
  const session = createCameraInferenceSession("camera", camera),
    before = accepted(session);
  assert.equal(session.apply({ information: "invented" }).kind, "refused");
  assert.equal(accepted(session), before);
  assert.equal(session.apply({ ...CAMERA_DEFAULTS, D: 1 }).kind, "refused");
  assert.equal(accepted(session), before);
});
test("placements are independent and each accepted action announces once to subscribers", () => {
  const a = createRadiusSession("first", ideal),
    b = createRadiusSession("second", ideal);
  const original = accepted(b);
  let completed = 0;
  const unsubscribe = a.subscribe(() => {
    if (!a.getSnapshot().pending) completed++;
  });
  a.apply(RADIUS_EXAMPLE);
  assert.equal(completed, 1);
  assert.equal(accepted(b), original);
  assert.notEqual(accepted(a).runId, original.runId);
  unsubscribe();
});
