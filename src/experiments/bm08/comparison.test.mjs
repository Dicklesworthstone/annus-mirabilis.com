import assert from "node:assert/strict";
import test from "node:test";
import {
  BM08_COMPARABLE_INPUTS, BM08_COMPARISON, cameraComparisonArray, cameraComparisonFrames,
  cameraComparisonInterval, cameraComparisonOutput, requireBm08ComparisonExample, verifyBm08Comparison,
} from "./comparison.ts";
import { BM08_CLASSES, BM08_DEFAULTS, BM08_OUTPUTS, bm08Layout } from "./definition.ts";

// Contract fixtures, not a Brownian generator. The deliberately simple values make it possible
// to plant a changed coordinate independently of the scientific owner under test elsewhere.
function snapshot(parameters = {}, patch = {}) {
  const p = { ...BM08_DEFAULTS, M: 3, ...parameters };
  const times = Float64Array.from({ length: p.M + 1 }, (_, i) => i * p.dt);
  const positions = Float64Array.from({ length: (p.M + 1) * p.d }, (_, i) =>
    times[Math.floor(i / p.d)] * 0.25 + (i % p.d));
  const array = (quantityId, value) => ({ quantityId, ...BM08_OUTPUTS[quantityId],
    statuses: undefined, status: "value", value: value.slice() });
  const outputs = [
    array("times", times), array("idealPositions", positions), array("positions", positions),
    array("blurredPositions", positions),
    array("latentWitness", Float64Array.from({ length: 64 }, (_, i) => i * 0.125)),
    array("increments", new Float64Array(p.M * p.d).fill(0.25)),
    array("stationaryClicks", new Float64Array(p.clicks * p.d).fill(0.03125)),
    array("naiveInterval", new Float64Array([0.1, 0.9])),
    array("centeredInterval", new Float64Array([0.2, 0.8])),
    array("pairInterval", new Float64Array([0.3, 0.7])),
    ...Object.entries({ reusedRecording: 1, reusedObservation: 1, recordingDraws: 8224,
      requestDraws: 0, measurementDraws: 0, modelDiffusion: p.D }).map(([id, value]) => array(id, {
        slice: () => value,
      })),
  ].map(({ statuses, ...output }) => output);
  return { experimentId: "bm-08", instanceId: "camera", runId: "path-1", final: true,
    snapshotVersion: 1, actionIndex: 1,
    revisions: { input: 1, measurement: 0, observer: 0, estimator: 0 },
    parameters: p, outputs, ...patch };
}
const output = (s, id) => s.outputs.find((o) => o.quantityId === id);
const accepted = (key = "sigma", command = "measurement-change") => ({
  kind: "accepted", variation: { changedInput: key, command }, rows: [],
});
const invalidEvidence = { code: "camera-comparison-evidence" };

test("every existing input has exactly its existing command role; the world and all seeds are locked", () => {
  assert.deepEqual(Object.keys(BM08_COMPARISON.inputs).sort(), Object.keys(BM08_DEFAULTS).sort());
  for (const [id, cls] of Object.entries(BM08_CLASSES)) {
    assert.equal(BM08_COMPARISON.inputs[id].command,
      cls === "input" ? "setup-change" : `${cls}-change`, id);
  }
  for (const id of ["seed", "D", "flowDrift", "noiseSeed", "clickSeed", "coverageTrials"])
    assert.equal(BM08_COMPARISON.inputs[id].comparable, false, id);
  assert.ok(BM08_COMPARABLE_INPUTS.length > 0);
  for (const id of BM08_COMPARABLE_INPUTS) assert.equal(BM08_COMPARISON.inputs[id].comparable, true);
});
test("selected outputs are declared scalars, never array-valued intervals or coordinates", () => {
  assert.ok(BM08_COMPARISON.outputs.length > 0);
  for (const out of BM08_COMPARISON.outputs) {
    assert.ok(BM08_OUTPUTS[out.id], out.id);
    assert.equal(bm08Layout(out.id, BM08_DEFAULTS), null);
    assert.ok(out.displayFactor > 0);
  }
});
test("frame projection retains every coordinate, time and position from one snapshot", () => {
  const s = snapshot(), rows = cameraComparisonFrames(s);
  assert.equal(rows.length, (s.parameters.M + 1) * s.parameters.d);
  assert.deepEqual(rows[3], { frame: 2, time: 1, coordinate: "y", latent: 1.25, blurred: 1.25, observed: 1.25 });
  assert.ok(rows.every(Object.isFrozen));
  assert.ok(Object.isFrozen(rows));
  output(s, "positions").value[3] = 123;
  assert.equal(rows[3].observed, 1.25);
});
test("published read-only NumericViews work without mutable array access", () => {
  const s = snapshot();
  for (const o of s.outputs) if (o.value instanceof Float64Array) {
    const v = o.value;
    o.value = Object.freeze({ length: v.length, at: (i) => v[i], copy: () => v.slice() });
  }
  assert.equal(cameraComparisonFrames(s)[3].observed, 1.25);
  assert.equal(cameraComparisonArray(s, "latentWitness").length, 64);
});
test("missing, duplicate and wrong-identity evidence raises camera-comparison-evidence", () => {
  for (const change of [
    (s) => { s.outputs = s.outputs.filter((o) => o.quantityId !== "times"); },
    (s) => { s.outputs.push(output(s, "times")); },
    (s) => { output(s, "times").unit = "ms"; },
    (s) => { output(s, "times").ownerId = "invented-owner"; },
    (s) => { output(s, "times").semanticKind = "other-time"; },
    (s) => { output(s, "times").status = "underdetermined"; },
  ]) {
    const s = snapshot(); change(s);
    assert.throws(() => cameraComparisonOutput(s, "times"), invalidEvidence);
  }
  // THE CODE AS A LITERAL, INSIDE THE BLOCK (am-muyh). `invalidEvidence` is declared at module scope, so
  // no test block contained the string and the refusal ratchet credited the site to nobody: it counts
  // blocks that NAME a code, and a variable holding it is not a mention. One literal assertion fixes it
  // without weakening anything above.
  const s = snapshot();
  s.outputs = s.outputs.filter((o) => o.quantityId !== "times");
  assert.throws(() => cameraComparisonOutput(s, "times"), { code: "camera-comparison-evidence" });
});
test("array shape, missing samples and nonfinite data are never replaced with zeros", () => {
  for (const value of [new Float64Array([0]), new Float64Array([0, 1, NaN, 3]),
    [0, 1, 2, 3], 4, null, { length: 4, copy: () => [0, 1, 2, 3] },
    { length: 4, copy: () => new Float64Array([0, Infinity, 2, 3]) }]) {
    const s = snapshot(); output(s, "times").value = value;
    assert.throws(() => cameraComparisonArray(s, "times"), invalidEvidence);
  }
  assert.throws(() => cameraComparisonArray(snapshot(), "modelDiffusion"), invalidEvidence);
});
test("a complete large admitted frame selection is not truncated", () => {
  const s = snapshot({ M: 1000 });
  assert.equal(cameraComparisonFrames(s).at(-1).frame, 1001);
});
test("duplicate and reversed frame times are refused", () => {
  for (const times of [[0, 1, 1, 3], [0, 2, 1, 3]]) {
    const s = snapshot(); output(s, "times").value = Float64Array.from(times);
    assert.throws(() => cameraComparisonFrames(s), invalidEvidence);
  }
});
test("interval bounds remain separate owner results, including a real zero lower bound", () => {
  const s = snapshot(); output(s, "pairInterval").value[0] = 0;
  assert.deepEqual(cameraComparisonInterval(s, "pairInterval"), { status: "value", lower: 0, upper: 0.7 });
});
test("an inapplicable interval retains its explanation, not a fabricated bound", () => {
  const s = snapshot(), o = output(s, "naiveInterval");
  o.status = "not-applicable"; o.reason = "Neighboring steps share localization error."; delete o.value;
  assert.deepEqual(cameraComparisonInterval(s, "naiveInterval"), {
    status: "not-applicable", reason: o.reason,
  });
  o.reason = " ";
  assert.throws(() => cameraComparisonInterval(s, "naiveInterval"), invalidEvidence);
});
test("reversed intervals raise the coded contract failure", () => {
  const s = snapshot(); output(s, "pairInterval").value = new Float64Array([0.7, 0.3]);
  assert.throws(() => cameraComparisonInterval(s, "pairInterval"), invalidEvidence);
});
test("a real camera change may change observations but must retain latent data", () => {
  const a = snapshot(), b = snapshot({ sigma: 0.4e-6 });
  output(b, "positions").value[4] += 7;
  output(b, "measurementDraws").value = 32;
  output(b, "reusedObservation").value = 0;
  assert.equal(verifyBm08Comparison(a, b, accepted()), null);
});
test("matching seeds and draw counts do not hide a changed latent witness", () => {
  const a = snapshot(), b = snapshot({ sigma: 0.4e-6 });
  output(b, "latentWitness").value[63] += 1;
  assert.match(verifyBm08Comparison(a, b, accepted()), /latent recording/);
});
test("matching prefix witnesses do not hide changed latent frames beyond that witness", () => {
  const a = snapshot(), b = snapshot({ sigma: 0.4e-6 });
  output(b, "idealPositions").value[7] += 1;
  assert.match(verifyBm08Comparison(a, b, accepted()), /latent positions differ/);
});
test("changed spacing compares common times instead of falsely comparing array offsets", () => {
  const a = snapshot(), b = snapshot({ dt: 2 });
  assert.equal(verifyBm08Comparison(a, b, accepted("dt")), null);
  output(b, "idealPositions").value[2] += 1;
  assert.match(verifyBm08Comparison(a, b, accepted("dt")), /shared frame time/);
});
test("changed coordinate selection compares the actual shared axes", () => {
  const a = snapshot(), b = snapshot({ d: 1 });
  assert.equal(verifyBm08Comparison(a, b, accepted("d")), null);
  output(b, "idealPositions").value[2] += 1;
  assert.match(verifyBm08Comparison(a, b, accepted("d")), /shared frame time/);
});
test("changed observation length can select a prefix of the same latent record", () => {
  assert.equal(verifyBm08Comparison(snapshot({ M: 7 }), snapshot(), accepted("M")), null);
});
test("a run, physical parameter or seed change cannot masquerade as remeasurement", () => {
  const a = snapshot({ seed: "18446744073709551615" });
  for (const key of ["seed", "D", "flowDrift", "noiseSeed", "clickSeed"]) {
    const b = snapshot({ ...a.parameters, [key]: typeof a.parameters[key] === "number" ? 1 : "1906" });
    assert.match(verifyBm08Comparison(a, b, accepted()), /same physical run/);
  }
  for (const patch of [{ runId: "another" }, { instanceId: "another" }])
    assert.match(verifyBm08Comparison(a, snapshot(a.parameters, patch), accepted()), /same physical run/);
});
test("reuse flags and latent draw accounting are required, not inferred", () => {
  for (const [id, value] of [["reusedRecording", 0], ["requestDraws", 1], ["recordingDraws", 999], ["modelDiffusion", 1]]) {
    const a = snapshot(), b = snapshot(); output(b, id).value = value;
    assert.match(verifyBm08Comparison(a, b, accepted()), /pinned latent recording/);
  }
  const a = snapshot(), b = snapshot();
  output(a, "recordingDraws").value = 0; output(b, "recordingDraws").value = 0;
  assert.match(verifyBm08Comparison(a, b, accepted()), /pinned latent recording/);
});
test("estimator changes preserve both frames and stationary calibration clicks", () => {
  const a = snapshot(), b = snapshot({ noiseMethod: "known" });
  assert.equal(verifyBm08Comparison(a, b, accepted("noiseMethod", "estimator-change")), null);
  for (const id of ["positions", "blurredPositions", "increments", "stationaryClicks"]) {
    const c = snapshot({ noiseMethod: "known" }); output(c, id).value[1] += 1;
    assert.match(verifyBm08Comparison(a, c, accepted("noiseMethod", "estimator-change")), /estimator comparison/);
  }
});
test("estimator reuse requires zero new measurement work and the owner's confirmation", () => {
  for (const [id, value] of [["measurementDraws", 1], ["reusedObservation", 0]]) {
    const a = snapshot(), b = snapshot({ coverage: 0.9 }); output(b, id).value = value;
    assert.match(verifyBm08Comparison(a, b, accepted("coverage", "estimator-change")), /estimator comparison/);
  }
});
test("incomplete evidence becomes a recoverable comparison failure", () => {
  const a = snapshot(), b = snapshot(); b.outputs = b.outputs.filter((o) => o.quantityId !== "latentWitness");
  assert.match(verifyBm08Comparison(a, b, accepted()), /evidence is incomplete/);
});
test("a vacuous overlap cannot prove preservation", () => {
  const a = snapshot(), b = snapshot(); output(b, "times").value = Float64Array.from([10, 11, 12, 13]);
  assert.match(verifyBm08Comparison(a, b, accepted()), /no shared latent frame/);
});
test("refused comparisons and an unchanged initial example make no reuse claim", () => {
  const s = snapshot(); output(s, "reusedRecording").value = 0;
  assert.equal(verifyBm08Comparison(s, s, { kind: "refused", code: "fixture", message: "fixture" }), null);
  assert.equal(verifyBm08Comparison(s, s, accepted(null, null)), null);
  assert.match(verifyBm08Comparison(s, s, accepted("D", "setup-change")), /not the physical path/);
});

test("the prepared example must be complete, camera-valid and contain no repeated experiment request", () => {
  const s = snapshot();
  assert.equal(requireBm08ComparisonExample(s), s);
  for (const bad of [null, snapshot({}, { final: false }), snapshot({ coverageTrials: 100 })])
    assert.throws(() => requireBm08ComparisonExample(bad), invalidEvidence);
  s.outputs = s.outputs.filter((o) => o.quantityId !== "pairInterval");
  assert.throws(() => requireBm08ComparisonExample(s), invalidEvidence);
});
test("shared-memory and wrongly declared NumericViews are not accepted as snapshots", () => {
  const s = snapshot();
  for (const value of [new Float64Array(new SharedArrayBuffer(4 * 8)),
    { length: 5, copy: () => new Float64Array(4) }]) {
    output(s, "times").value = value;
    assert.throws(() => cameraComparisonArray(s, "times"), invalidEvidence);
  }
});


test("a NumericView cannot smuggle shared memory through its copy operation", () => {
  const s = snapshot();
  output(s, "times").value = { length: 4, copy: () => new Float64Array(new SharedArrayBuffer(4 * 8)) };
  assert.throws(() => cameraComparisonArray(s, "times"), invalidEvidence);
});
test("malformed confidence sets cannot replace an otherwise reusable accepted pair", () => {
  for (const side of ["baseline", "variant"]) {
    const a = snapshot(), b = snapshot({ sigma: 0.4e-6 });
    output(side === "baseline" ? a : b, "pairInterval").value = new Float64Array([0.7, 0.3]);
    assert.match(verifyBm08Comparison(a, b, accepted()), /evidence is incomplete/);
  }
  const a = snapshot(), b = snapshot({ sigma: 0.4e-6 });
  output(b, "pairInterval").status = "not-applicable";
  output(b, "pairInterval").reason = "The physical confidence set is empty.";
  delete output(b, "pairInterval").value;
  assert.equal(verifyBm08Comparison(a, b, accepted()), null);
});
