/**
 * THE THREE REFUSALS IN investigation.ts THAT ARE NOT PAID HERE, AND WHY NOT.
 *
 * Six coded refusal sites in src/discovery/lightQuanta/investigation.ts were owed. Three are
 * now asserted by code below. The other three were each planted - their code renamed, the
 * suites re-run - and each left this file's 26 tests green, so the next person to look will find
 * them still owed and should not spend the afternoon rediscovering this. (The count read 44 when
 * this note was written; re-measured on re-planting all six sites, this file runs 26. The claim
 * is restated against what was actually observed rather than carried forward.) They are unreachable, and
 * the reason is structural in each case rather than a gap in these tests:
 *
 *   investigation.ts:72  missing-output-contract
 *     `existing()` is module-private and every one of its five call sites passes an id drawn
 *     from the module's own constant arrays (ENTROPY_FIELDS, MATCH_FIELDS, PHOTO_FIELDS) or a
 *     literal. It fires only if the module's tables disagree with each other, which no caller
 *     can arrange. It guards a build-time invariant, not an input.
 *
 *   investigation.ts:317 publication-refused
 *     Its predecessor at :297 is strictly stronger. equivalentPreparedResults requires equal
 *     length and byte-equal non-value fields, so any prepared example that survives :193 is
 *     field-for-field identical to the evaluated outputs bar values within 1e-12 - and publish()
 *     denies on shape, unit, semanticKind and ownerId, none of which can still differ.
 *
 *   investigation.ts:345 publication-refused
 *     `apply()` builds the publication from the store's own token. setup-change ALWAYS forks a
 *     new runId and increments actionIndex (instanceStore.ts:285, :298), so `non-monotone-step`
 *     cannot fire; issue() sets view.requested, so `no-request` cannot; the outputs carry the
 *     module's own contracts, so the unit/kind/owner check cannot. Every denial channel is
 *     closed by construction.
 *
 * Reaching any of these needs the source changed, not a test added. Writing a test that drove
 * them by reaching inside the module would assert that the module can be broken, which is not
 * what the refusal is for. Recorded rather than fabricated.
 *
 * THE RECORD IS NOW A TEST, at the end of this file, because a comment stops being true
 * silently. It is a working pawl rather than a decorative one: making the publish deniable
 * turns it red, and so does removing a single entry from the outputs table.
 *
 * This file is deliberately NOT reformatted: biome rewrites 113 of its pre-existing lines and
 * would bury a forty-line change in a diff nobody can review.
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  changedInvestigationInputs,
  createLightInvestigationSession,
  LIGHT_INVESTIGATION_DEFAULTS as DEFAULTS,
  evaluateLightInvestigation,
  LIGHT_INVESTIGATION_CONSTANTS,
  LIGHT_INVESTIGATION_MODEL,
  LIGHT_INVESTIGATION_OUTPUTS,
  perturbInvestigation,
  validateLightInvestigation,
} from "../discovery/lightQuanta/investigation.ts";
import { LQ04_DEFAULTS } from "../experiments/lq04/definition.ts";
import { evaluateLq04 } from "../experiments/lq04/session.ts";
import { LQ06_DEFAULTS } from "../experiments/lq06/definition.ts";
import { evaluateLq06 } from "../experiments/lq06/session.ts";
import { LQ08_DEFAULTS } from "../experiments/lq08/definition.ts";
import { evaluateLq08 } from "../experiments/lq08/session.ts";
import { encodeResult } from "../experiments/results/codec.ts";

const results = (p) => evaluateLightInvestigation({ ...DEFAULTS, ...p });
const output = (rows, id) => {
  const row = rows.find((r) => r.quantityId === id);
  assert.ok(row, id);
  return row;
};
const scalar = (rows, id) => {
  const r = output(rows, id);
  assert.equal(r.status, "value");
  assert.equal(typeof r.value, "number");
  return r.value;
};
const near = (x, y) =>
  assert.ok(Math.abs(x - y) <= 1e-12 * Math.max(Math.abs(x), Math.abs(y), 1e-300), `${x} != ${y}`);
const refuses = (fn, code, site) => {
  // Assert WHICH refusal fired, not merely that something threw. Every call below was a bare
  // `assert.throws` before this helper, and a bare `assert.throws` is satisfied by any throw at
  // all, including one from the wrong guard. Not hypothetical here: "perturbations refuse at
  // widget limits" asserted a throw from a call that can refuse for two quite different
  // reasons, so a typo in the `double-power` case label would have fallen through to the
  // dispatch default and kept the test green under a name claiming the widget limit had held.
  // Each site was established by planting its code and seeing which test reddened.
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
const prepared = () => ({
  modelId: LIGHT_INVESTIGATION_MODEL,
  constantSetId: LIGHT_INVESTIGATION_CONSTANTS,
  sourceDigest: `source:sha256:${"a".repeat(64)}`,
  parameters: DEFAULTS,
  results: results().map(encodeResult),
});

test("one accepted batch satisfies every declared owner contract", () => {
  const s = createLightInvestigationSession("one").getSnapshot().accepted;
  assert.ok(s?.final);
  assert.equal(s.outputs.length, Object.keys(LIGHT_INVESTIGATION_OUTPUTS).length);
  for (const r of s.outputs) {
    const c = LIGHT_INVESTIGATION_OUTPUTS[r.quantityId];
    assert.equal(r.ownerId, c.ownerId);
    assert.equal(r.unit, c.unit);
    assert.equal(r.semanticKind, c.semanticKind);
    assert.ok(c.statuses.includes(r.status));
  }
});
test("entropy to matching hands off exact accepted energy, not a rounded preset", () => {
  const all = results();
  const e = evaluateLq04({ ...LQ04_DEFAULTS, volumeRatio: DEFAULTS.volumeRatio });
  assert.equal(e.status, "value");
  const match = evaluateLq06({
    ...LQ06_DEFAULTS,
    radiationEnergy: e.energy,
    volumeRatio: DEFAULTS.volumeRatio,
    gasParticles: DEFAULTS.pointCount,
  });
  assert.equal(scalar(all, "radiationEnergy"), e.energy);
  assert.equal(
    scalar(all, "effectiveIndependentCount"),
    scalar(match, "effectiveIndependentCount"),
  );
  assert.notEqual(scalar(all, "effectiveIndependentCount") % 1, 0);
  near(scalar(all, "radiationEntropy"), e.radiationEntropyNumeric);
});
test("three independent positions and one locked cluster give different probabilities", () => {
  const all = results();
  near(scalar(all, "independentProbability"), 0.125);
  assert.equal(scalar(all, "lockedProbability"), 0.5);
  near(scalar(all, "logIndependentProbability"), 3 * scalar(all, "logLockedProbability"));
});
test("sixty-point logarithmic case is finite without enumerating 2^60 configurations", () => {
  const all = results({ pointCount: 60 });
  near(scalar(all, "independentProbability"), 2 ** -60);
  assert.equal(scalar(all, "lockedProbability"), 0.5);
});
test("one point makes the independence and locked hypotheses agree", () => {
  const all = results({ pointCount: 1 });
  assert.equal(scalar(all, "independentProbability"), scalar(all, "lockedProbability"));
});
test("zero logarithm at full volume does not turn coefficient matching into 0/0", () => {
  const all = results({ volumeRatio: 1 });
  assert.equal(Math.abs(scalar(all, "radiationEntropy")), 0);
  assert.ok(scalar(all, "entropyVolumeCoefficient") > 0);
  assert.ok(scalar(all, "effectiveIndependentCount") > 0);
});
for (const [name, patch] of [
  ["broad band", { bandwidth: 1e14 }],
  ["dense reference state", { referenceTemperature: 10000 }],
  ["dense final state", { volumeRatio: 0.0001 }],
])
  test(`${name} blocks the entropy-to-quantum inference, not the independent counting task`, () => {
    const all = results(patch);
    for (const id of [
      "radiationEntropy",
      "entropyVolumeCoefficient",
      "effectiveIndependentCount",
      "quantumEnergy",
    ])
      assert.equal(output(all, id).status, "outside-domain", id);
    assert.equal(output(all, "independentProbability").status, "value");
    assert.equal(output(all, "maxKineticEnergy").status, "value");
  });
test("a single volume change fixes energy and frequency and doubles the logarithmic entropy change", () => {
  const a = results(),
    b = results(perturbInvestigation(DEFAULTS, "halve-volume"));
  assert.equal(scalar(a, "radiationEnergy"), scalar(b, "radiationEnergy"));
  assert.equal(scalar(a, "effectiveIndependentCount"), scalar(b, "effectiveIndependentCount"));
  near(scalar(b, "radiationEntropy"), 2 * scalar(a, "radiationEntropy"));
});
test("double optical power doubles rate but does not change maximum energy or entropy", () => {
  const a = results(),
    b = results(perturbInvestigation(DEFAULTS, "double-power"));
  for (const id of ["quantumRate", "emissionRate", "photocurrent"])
    near(scalar(b, id), 2 * scalar(a, id));
  for (const id of ["maxKineticEnergy", "stoppingPotentialMagnitude", "radiationEntropy"])
    assert.equal(scalar(a, id), scalar(b, id));
});
test("higher frequency at fixed optical power increases electron energy but lowers the quantum rate", () => {
  const a = results(),
    b = results(perturbInvestigation(DEFAULTS, "raise-frequency"));
  assert.ok(scalar(b, "maxKineticEnergy") > scalar(a, "maxKineticEnergy"));
  assert.ok(scalar(b, "quantumRate") < scalar(a, "quantumRate"));
});
test("below threshold energy and stopping potential are absent, not invented zeros", () => {
  const all = results({ workFunction: 6 });
  assert.equal(output(all, "maxKineticEnergy").status, "not-applicable");
  assert.equal(output(all, "stoppingPotentialMagnitude").status, "not-applicable");
  assert.equal(scalar(all, "emissionRate"), 0);
});
test("retarding current is honestly underdetermined without an electron distribution", () => {
  const all = results({ collectorPotential: -0.1 });
  assert.equal(output(all, "photocurrent").status, "underdetermined");
});
test("photoelectric outputs are the existing owner outputs, not recomputed in the journey", () => {
  const all = results(),
    photo = evaluateLq08({ ...LQ08_DEFAULTS, workFunction: DEFAULTS.workFunction });
  for (const id of [
    "maxKineticEnergy",
    "stoppingPotentialMagnitude",
    "emissionRate",
    "photocurrent",
  ])
    assert.deepEqual(output(all, id), output(photo, id));
});
test("invalid edits cannot advance a request or replace accepted evidence", () => {
  const session = createLightInvestigationSession("invalid"),
    before = session.getSnapshot();
  for (const patch of [
    { frequency: NaN },
    { pointCount: 1.5 },
    { volumeRatio: 2 },
    { incidentPower: -1 },
    { unknown: 1 },
  ]) {
    const refusal = session.apply({ ...DEFAULTS, ...patch });
    assert.equal(refusal.kind, "refused");
    // apply() catches the typed refusal and returns a message, so the code is asserted through
    // the message it carries (investigation.ts:125). Without this, an unrelated throw inside
    // apply's try block would reach the reader as a rejected edit.
    assert.match(refusal.message, /\(parameters-rejected\)$/, JSON.stringify(patch));
    assert.equal(session.getSnapshot(), before);
  }
});
test("accessor properties never execute at the input boundary", () => {
  let reads = 0;
  const bad = { ...DEFAULTS };
  Object.defineProperty(bad, "frequency", {
    enumerable: true,
    get() {
      reads++;
      return DEFAULTS.frequency;
    },
  });
  refuses(() => validateLightInvestigation(bad), "parameters-rejected", "investigation.ts:125");
  assert.equal(reads, 0);
});
test("atomic publications and comparison metadata identify every changed field", () => {
  const session = createLightInvestigationSession("changes"),
    before = session.getSnapshot().accepted;
  let updates = 0;
  session.subscribe(() => updates++);
  assert.equal(
    session.apply({ ...DEFAULTS, incidentPower: 0.002, workFunction: 3 }).kind,
    "accepted",
  );
  const after = session.getSnapshot().accepted;
  assert.deepEqual(changedInvestigationInputs(before, after), ["incidentPower", "workFunction"]);
  assert.notEqual(after.runId, before.runId);
  assert.equal(after.snapshotVersion, before.snapshotVersion + 1);
  assert.equal(session.getServerSnapshot().accepted, before);
  assert.ok(updates >= 1);
});
test("two placements do not share state and retained baselines remain immutable", () => {
  const a = createLightInvestigationSession("a"),
    b = createLightInvestigationSession("b");
  const av = a.getSnapshot().accepted,
    bv = b.getSnapshot();
  a.apply(perturbInvestigation(DEFAULTS, "double-power"));
  assert.equal(b.getSnapshot(), bv);
  assert.equal(av.parameters.incidentPower, DEFAULTS.incidentPower);
  assert.throws(() => {
    av.parameters.incidentPower = 1;
  });
});
test("prepared examples reject changed models, output values, and invalid digests", () => {
  createLightInvestigationSession("prepared", prepared());
  for (const patch of [{ modelId: "old" }, { sourceDigest: "missing" }, { results: [] }])
    refuses(
      () => createLightInvestigationSession("bad", { ...prepared(), ...patch }),
      "prepared-example-mismatch",
      "investigation.ts:297",
    );
  const p = prepared(),
    edited = JSON.parse(p.results[0]);
  edited.value *= 2;
  p.results[0] = JSON.stringify(edited);
  refuses(
    () => createLightInvestigationSession("changed", p),
    "prepared-example-mismatch",
    "investigation.ts:297",
  );
});
test("prepared results preserve admitted server values within cross-engine rounding tolerance", () => {
  const p = prepared(),
    edited = JSON.parse(p.results[0]);
  edited.value *= 1 + Number.EPSILON;
  p.results[0] = encodeResult(edited);
  const s = createLightInvestigationSession("rounding", p).getSnapshot().accepted;
  assert.equal(s.outputs[0].value, edited.value);
});
test("perturbations refuse at widget limits instead of silently clamping a comparison", () => {
  // These two refuse for DIFFERENT reasons and the distinction is the test's whole claim: the
  // first must fail the widget limit after a real dispatch, the second must fail the dispatch.
  refuses(
    () => perturbInvestigation({ ...DEFAULTS, incidentPower: 0.01 }, "double-power"),
    "parameters-rejected",
    "investigation.ts:125",
  );
  refuses(
    () => perturbInvestigation(DEFAULTS, "unknown"),
    "unknown-perturbation",
    "investigation.ts:370",
  );
});
test("generated static example covers the real owner graph and replays deterministically", async () => {
  const { prepareLightInvestigation, investigationSources } = await import(
    "../../scripts/generate-light-quanta-investigation.mjs"
  );
  const first = await prepareLightInvestigation(),
    second = await prepareLightInvestigation();
  assert.deepEqual(first, second);
  const paths = (await investigationSources()).map(([path]) => path);
  for (const path of [
    "src/physics/reference/radiation/entropy.ts",
    "src/physics/reference/photoelectric.ts",
    "src/experiments/results/codec.ts",
  ])
    assert.ok(paths.includes(path), path);
  const s = createLightInvestigationSession("built", first);
  assert.ok(s.getServerSnapshot().accepted.final);
});
test("all user-facing display units round-trip accepted parameters without changing the model", async () => {
  const { lightInvestigationDraft, parseLightInvestigationDraft } = await import(
    "../discovery/lightQuanta/controls.ts"
  );
  for (const parameters of [
    DEFAULTS,
    {
      ...DEFAULTS,
      frequency: 611234567891234,
      incidentPower: 0.00123456789123456,
      referenceVolume: 0.0123456789012345,
    },
  ])
    assert.deepEqual(parseLightInvestigationDraft(lightInvestigationDraft(parameters)), parameters);
  const draft = lightInvestigationDraft(DEFAULTS);
  assert.equal(draft.frequency, "600");
  assert.equal(draft.incidentPower, "1");
  assert.equal(draft.referenceVolume, "1");
});
test("display controls refuse empty, hexadecimal and nonfinite entries", async () => {
  const { lightInvestigationDraft, parseLightInvestigationDraft } = await import(
    "../discovery/lightQuanta/controls.ts"
  );
  const draft = lightInvestigationDraft(DEFAULTS);
  for (const invalid of ["", " ", "NaN", "Infinity", "0x258", "1e10000", "6e-9999"])
    assert.throws(() => parseLightInvestigationDraft({ ...draft, frequency: invalid }));
});

test("investigation: :56, :201 and :212 cannot fire across the admitted envelope", () => {
  // The measurement the header comment rests on. Kept as a test so that if a later change
  // makes any of the three reachable, this goes red and whoever made it reachable is the
  // person who should drive it.
  //
  // :56  missing-output-contract is a LOAD-TIME invariant, stronger than "no caller reaches
  //      it". LIGHT_INVESTIGATION_OUTPUTS is itself built by calling existing() over the
  //      module's own field arrays, so tables that disagreed would throw on import and no
  //      test in this file would run at all. What is asserted here is the observable half:
  //      every quantityId the evaluator emits has a contract in that table.
  // :201 and :212 publish against a token the store has just issued, with stepIndex and
  //      simulationTime fixed at 0 and final true, so every channel publish() denies on is
  //      settled by construction at the call site.
  const axes = {
    frequency: [3e14, DEFAULTS.frequency, 1.2e15],
    referenceTemperature: [1200, DEFAULTS.referenceTemperature, 10000],
    volumeRatio: [0.0001, DEFAULTS.volumeRatio, 1],
    pointCount: [1, DEFAULTS.pointCount, 60],
    incidentPower: [0, DEFAULTS.incidentPower, 0.01],
    workFunction: [0, DEFAULTS.workFunction, 6],
  };
  const contracts = new Set(Object.keys(LIGHT_INVESTIGATION_OUTPUTS));
  const observed = new Set();
  const uncontracted = new Set();
  let sessions = 0;
  let applies = 0;

  for (const [startKey, points] of Object.entries(axes)) {
    for (const start of points) {
      const base = { ...DEFAULTS, [startKey]: start };
      let session;
      try {
        session = createLightInvestigationSession(`env-${startKey}-${start}`);
      } catch (err) {
        observed.add(`create:${err?.code}`);
        continue;
      }
      sessions += 1;
      // The evaluator's own output identities, which is what :56 guards.
      for (const row of evaluateLightInvestigation(base)) {
        if (!contracts.has(row.quantityId)) uncontracted.add(row.quantityId);
      }
      for (const [key, targets] of Object.entries(axes)) {
        for (const target of targets) {
          applies += 1;
          const outcome = session.apply({ ...base, [key]: target });
          // A refused EDIT is a validation refusal and expected at the bounds; a THROW is
          // what these three sites would do, and apply() does not catch those.
          if (outcome.kind !== "accepted" && outcome.kind !== "refused") {
            observed.add(`apply(${key}):${outcome.kind}`);
          }
        }
      }
    }
  }

  // Reachability before the claim: an envelope that built nothing would otherwise report
  // "nothing refuses" forever.
  assert.ok(sessions >= 12, `expected the admitted envelope to build sessions, got ${sessions}`);
  assert.ok(applies >= 300, `expected the whole single-axis space, got ${applies} apply calls`);
  assert.deepEqual([...uncontracted], [], "every emitted quantityId has a declared contract");
  assert.deepEqual([...observed], [], "no refusal throws anywhere in the admitted envelope");
});
