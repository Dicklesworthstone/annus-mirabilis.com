import assert from "node:assert/strict";
import test from "node:test";
import {
  createLightInvestigationSession,
  LIGHT_INVESTIGATION_DEFAULTS as defaults,
  perturbInvestigation,
} from "../discovery/lightQuanta/investigation.ts";
import {
  decodeLightInvestigationSettings as decode,
  encodeLightInvestigationSettings as encode,
  exportLightInvestigationEvidence as exportEvidence,
  lightInvestigationCoefficientHref as handoff,
} from "../discovery/lightQuanta/transfer.ts";
import { LQ06_DEFAULTS } from "../experiments/lq06/definition.ts";
import { prepareLinkedCoefficientExample } from "../experiments/lq06/linkedSettings.ts";
import { validateLq06Parameters } from "../experiments/lq06/parameters.ts";
import { decodeLq06Settings } from "../experiments/lq06/permalink.ts";
import { createLq06Session } from "../experiments/lq06/session.ts";

const digest = `source:sha256:${"a".repeat(64)}`;
const session = () => createLightInvestigationSession("portable");
const value = (snapshot, id) => snapshot.outputs.find((o) => o.quantityId === id).value;
const example = {
  sourceDigest: digest,
  parameters: LQ06_DEFAULTS,
  results: [],
  stepIndex: 0,
  simulationTime: 0,
};

test("accepted settings round-trip every input and source identity with no display rounding", () => {
  for (const p of [
    defaults,
    {
      ...defaults,
      frequency: 611234567891234,
      incidentPower: 0.00123456789123456,
      referenceVolume: 0.0123456789012345,
      collectorPotential: -0,
    },
  ]) {
    const linked = decode(encode(p, digest));
    assert.equal(linked.kind, "settings");
    assert.deepEqual(linked.parameters, p);
    assert.equal(linked.sourceDigest, digest);
  }
});
test("portable schema cannot accidentally disclose a private note or interpretation", () => {
  const p = { ...defaults, prediction: "private", interpretation: "quanta" };
  assert.throws(() => encode(p, digest));
  assert.equal(decode(`${encode(defaults, digest)}&prediction=private`).kind, "invalid");
});
test("absent links are distinguished from broken investigation links", () => {
  for (const search of ["", "?", "?utm_source=book"]) assert.equal(decode(search).kind, "absent");
  for (const search of ["?investigation=1", "?frequency=600", "?source=bad"])
    assert.equal(decode(search).kind, "invalid");
});
test("malformed, incomplete, duplicate and unsupported links do not produce settings", () => {
  const good = encode(defaults, digest);
  for (const mutation of [
    (q) => q.set("model", "old"),
    (q) => q.set("investigation", "2"),
    (q) => q.delete("source"),
    (q) => q.append("frequency", "6e14"),
    (q) => q.set("source", "bad"),
    (q) => q.set("frequency", "NaN"),
    (q) => q.set("frequency", "0x258"),
    (q) => q.set("incidentPower", "1e-99999"),
    (q) => q.delete("pointCount"),
    (q) => q.set("pointCount", "1.5"),
  ]) {
    const q = new URLSearchParams(good);
    mutation(q);
    assert.equal(decode(`?${q}`).kind, "invalid");
  }
  assert.equal(decode(`${good}&x=${"a".repeat(5000)}`).kind, "invalid");
});
/**
 * Assert WHICH refusal fired, at WHICH site.
 *
 * All four coded sites in transfer.ts were driven before this helper existed and not one was
 * asserted: planting each code in turn left 13 pass 0 fail every time, because every arm was a
 * bare assert.throws. Two of the four share the code `source-digest-invalid`, so nothing could
 * tell the encode-side digest check from the export-side one either.
 *
 * Sites were established by marking one at a time and running each test by name, not by reading
 * the test titles and matching them up.
 */
const refuses = (fn, code, site) => {
  assert.throws(
    fn,
    (err) => {
      assert.equal(
        err.name,
        "ExperimentRuntimeError",
        `${site}: ${err.name} is not a typed refusal`,
      );
      assert.equal(err.code, code, `${site}: refused with ${err.code}, not ${code}`);
      return true;
    },
    `${site} did not refuse`,
  );
};

test("a source revision is retained rather than hidden by the decoder", () => {
  const other = `source:sha256:${"b".repeat(64)}`;
  assert.equal(decode(encode(defaults, other)).sourceDigest, other);
  refuses(() => encode(defaults, "no-digest"), "source-digest-invalid", "(transfer.ts:34)");
});
test("exports preserve both accepted columns, typed output contracts and changed fields", () => {
  const s = session(),
    before = s.getSnapshot().accepted;
  s.apply(perturbInvestigation(defaults, "double-power"));
  const after = s.getSnapshot().accepted;
  const artifact = JSON.parse(exportEvidence(before, after, digest));
  assert.deepEqual(artifact.changedSettings, ["incidentPower"]);
  assert.equal(artifact.current.runId, after.runId);
  assert.equal(artifact.baseline.runId, before.runId);
  assert.equal(artifact.sourceDigest, digest);
  assert.equal(artifact.privateNotesIncluded, false);
  assert.equal(artifact.evidenceKind, "model-consequence");
  const emitted = artifact.current.results.find((o) => o.quantityId === "emissionRate");
  assert.equal(emitted.value, value(after, "emissionRate"));
  assert.equal(emitted.unit, "s^-1");
  assert.equal(emitted.ownerId, "photoelectric.emissionRate");
  assert.ok(emitted.status === "value");
});
test("out-of-domain and missing results remain explicit in exported evidence", () => {
  const s = session(),
    before = s.getSnapshot().accepted;
  s.apply({ ...defaults, referenceTemperature: 10000, workFunction: 6 });
  const a = JSON.parse(exportEvidence(before, s.getSnapshot().accepted, digest));
  assert.equal(
    a.current.results.find((o) => o.quantityId === "effectiveIndependentCount").status,
    "outside-domain",
  );
  const missing = a.current.results.find((o) => o.quantityId === "maxKineticEnergy");
  assert.equal(missing.status, "not-applicable");
  assert.equal(Object.hasOwn(missing, "value"), false);
});
test("exporting or constructing links neither issues a request nor changes a snapshot", () => {
  const s = session(),
    before = s.getSnapshot();
  let notifications = 0;
  s.subscribe(() => notifications++);
  exportEvidence(before.accepted, before.accepted, digest);
  handoff(before.accepted);
  encode(before.accepted.parameters, digest);
  assert.equal(s.getSnapshot(), before);
  assert.equal(notifications, 0);
});
test("cross-instance, partial, malformed and owner-mismatched evidence is refused", () => {
  // Three refusals in one test, and they are NOT interchangeable. A mismatched instance, a
  // snapshot that is not exportable, and a malformed digest are different findings for the
  // reader, and the digest check at :82 runs BEFORE the instance check at :83 - so a valid
  // digest is what lets the first assertion reach the instance guard at all.
  const a = session().getSnapshot().accepted,
    b = createLightInvestigationSession("other").getSnapshot().accepted;
  refuses(() => exportEvidence(a, b, digest), "evidence-instance-mismatch", "(transfer.ts:135)");
  for (const patch of [
    { final: false },
    { snapshotVersion: 0 },
    { experimentId: "wrong" },
    { outputs: a.outputs.slice(1) },
    { outputs: [a.outputs[0], ...a.outputs.slice(0, -1)] },
    { outputs: a.outputs.map((o, i) => (i === 0 ? { ...o, ownerId: "pretend-owner" } : o)) },
  ])
    refuses(
      () => exportEvidence(a, { ...a, ...patch }, digest),
      "evidence-snapshot-invalid",
      "(transfer.ts:82)",
    );

  // A NONFINITE VALUE IS REFUSED BY A DIFFERENT LAYER, and this test could not previously say
  // so. It sat in the list above under a bare assert.throws, so it read as one more case of the
  // snapshot guard at :60 refusing malformed evidence. It is not: the result codec rejects the
  // nonfinite value first and throws ResultDecodeError, which carries no refusal code at all.
  //
  // That is defensible behaviour - the codec is the right place to reject Infinity, and the
  // export never sees it - but it is a different claim from "transfer.ts refuses this", and the
  // distinction is the sort the typed-result rules exist to keep. Asserted as what it is.
  const nonfinite = {
    ...a,
    outputs: a.outputs.map((o, i) => (i === 0 ? { ...o, value: Infinity } : o)),
  };
  assert.throws(
    () => exportEvidence(a, nonfinite, digest),
    (err) => {
      assert.equal(
        err.name,
        "ResultDecodeError",
        "a nonfinite value is refused by the codec, not by transfer.ts",
      );
      assert.equal(err.code, undefined, "ResultDecodeError carries no refusal code");
      return true;
    },
  );
  refuses(() => exportEvidence(a, a, "not-a-digest"), "source-digest-invalid", "(transfer.ts:130)");
});
test("coefficient handoff reaches the real existing codec with exact accepted energy", () => {
  const s = session();
  s.apply({ ...defaults, frequency: 660000000000000, volumeRatio: 0.3, pointCount: 5 });
  const before = s.getSnapshot().accepted;
  const link = handoff(before);
  assert.ok(link.startsWith("/lab/lq-06/?"));
  const shared = decodeLq06Settings(new URL(link, "https://example.test").search);
  assert.equal(shared.kind, "settings");
  assert.equal(shared.parameters.radiationEnergy, value(before, "radiationEnergy"));
  assert.equal(shared.parameters.frequency, before.parameters.frequency);
  assert.equal(shared.parameters.gasParticles, 5);
  assert.equal(shared.parameters.selectedSubexpression, "none");
  assert.equal(shared.parameters.forkAChoice, "none");
  const admitted = prepareLinkedCoefficientExample(example, shared.parameters);
  assert.equal(admitted.kind, "accepted");
  const specialist = createLq06Session("specialist", admitted.example).getSnapshot().accepted;
  assert.equal(value(specialist, "radiationEnergy"), value(before, "radiationEnergy"));
  assert.equal(
    value(specialist, "effectiveIndependentCount"),
    value(before, "effectiveIndependentCount"),
  );
});
test("unavailable inference has no coefficient handoff, even if a prior accepted state was valid", () => {
  const s = session();
  assert.ok(handoff(s.getSnapshot().accepted));
  s.apply({ ...defaults, referenceTemperature: 10000 });
  assert.equal(handoff(s.getSnapshot().accepted), null);
});
test("coefficient link preflight refuses bad input and leaves its original example untouched", () => {
  const before = structuredClone(example);
  for (const bad of [
    { ...LQ06_DEFAULTS, frequency: NaN },
    { ...LQ06_DEFAULTS, radiationEnergy: -1 },
    { ...LQ06_DEFAULTS, unexpected: true },
  ])
    assert.equal(prepareLinkedCoefficientExample(example, bad).kind, "invalid");
  assert.deepEqual(example, before);
});
test("shape-valid but unrepresentable incoming calculations are refused before rendering", () => {
  const parameters = {
    ...LQ06_DEFAULTS,
    radiationEnergy: Number.MAX_VALUE,
    frequency: Number.MIN_VALUE,
  };
  assert.equal(validateLq06Parameters(parameters).kind, "accepted");
  assert.equal(prepareLinkedCoefficientExample(example, parameters).kind, "invalid");
});
