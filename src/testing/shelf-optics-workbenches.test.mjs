/** Real owners + real publication store, not mocks. am-disc-shelf-michelson-fizeau-dauq. */
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  SHELF_IDS, shelfDefaults, shelfFields, shelfPath, validateShelfInput,
} from "../experiments/shelf/definition.ts";
import { createShelfSession } from "../experiments/shelf/session.ts";
import { decodeShelfSettings, encodeShelfSettings } from "../experiments/shelf/settings.ts";
import { constantValue, getConstantSet, withMode1904Guard } from "../physics/reference/constants.ts";
import { michelsonMorleyFringeShift, fizeauFringeShift } from "../physics/reference/shelfOptics.ts";

const MM = "shelf-michelson-morley";
const FZ = "shelf-fizeau";
const MW = "shelf-maxwell-galilean";
const c = constantValue(getConstantSet("modern-si-2019"), "speedOfLight").value;
const create = (id, mode = "full", patch = {}) => createShelfSession(id, mode, `${id}-${mode}`, { ...shelfDefaults(id, mode), ...patch });
function output(session, id) {
  const item = session.getSnapshot().accepted?.outputs.find((item) => item.quantityId === id);
  assert.ok(item, `Missing ${id}`);
  return item;
}
function value(session, id) {
  const item = output(session, id);
  assert.equal(item.status, "value", id);
  assert.equal(typeof item.value, "number", id);
  assert.ok(Number.isFinite(item.value), id);
  return item.value;
}
function near(actual, expected, relative = 1e-12) {
  assert.ok(Math.abs(actual - expected) <= relative * Math.max(Math.abs(expected), 1e-300), `${actual} != ${expected}`);
}
for (const id of SHELF_IDS) for (const mode of ["full", "1904"]) {
  test(`${id} ${mode}: all declared readings are accepted, finite, and immutable`, () => {
    const session = create(id, mode);
    const snapshot = session.getSnapshot().accepted;
    assert.ok(snapshot);
    assert.equal(snapshot.outputs.length, session.readings.length);
    assert.ok(snapshot.outputs.length >= 8);
    assert.equal(new Set(snapshot.outputs.map((r) => r.quantityId)).size, snapshot.outputs.length);
    for (const reading of session.readings) {
      value(session, reading.id);
      assert.equal(output(session, reading.id).unit, reading.unit);
      assert.equal(output(session, reading.id).ownerId, "shelf-optics");
    }
    assert.ok(Object.isFrozen(snapshot));
    assert.ok(Object.isFrozen(snapshot.parameters));
  });
  test(`${id} ${mode}: settings round-trip and refuse foreign modes, extra fields, duplicates`, () => {
    const p = shelfDefaults(id, mode);
    const url = encodeShelfSettings(id, mode, p);
    assert.ok(url.startsWith(shelfPath(id, mode)));
    const search = new URL(url, "https://example.test").search;
    assert.deepEqual(decodeShelfSettings(id, mode, search), { kind: "settings", parameters: p });
    assert.equal(decodeShelfSettings(id, mode === "full" ? "1904" : "full", search).kind, "invalid");
    assert.equal(decodeShelfSettings(id, mode, `${search}&shelf=duplicate`).kind, "invalid");
    assert.equal(decodeShelfSettings(id, mode, `${search}&note=private`).kind, "invalid");
    assert.equal(decodeShelfSettings(id, mode, `?shelf=${"x".repeat(2048)}`).kind, "invalid");
    assert.throws(() => encodeShelfSettings(id, mode, { ...p, privateNote: "not part of an experiment" }));
  });
}
test("Michelson full mode reproduces the independent modern-computation fixture and owner bytes", () => {
  const s = create(MM);
  near(value(s, "etherShift"), 0.4005540251931628);
  const owner = michelsonMorleyFringeShift({ length: 11, wavelength: 550e-9, windSpeed: 30000, contraction: false });
  assert.equal(value(s, "etherShift"), owner.fringeShift.value);
  assert.equal(value(s, "contractedShift"), 0);
  assert.equal(value(s, "contractedParallel"), value(s, "contractedPerpendicular"));
});
test("Michelson 1904 uses only declared ratios; very small speeds do not cancel to zero", () => {
  withMode1904Guard(() => {
    assert.throws(() => getConstantSet("modern-si-2019"));
    const s = create(MM, "1904");
    near(value(s, "etherShift"), 0.4, 2e-8);
    assert.equal(output(s, "etherParallel").unit, "wavelength/c");
    assert.equal(value(s, "contractedShift"), 0);
  });
  const tiny = create(MM, "full", { windSpeed: 1e-8 * c });
  near(value(tiny, "etherDelay"), 11 / c * 1e-16, 1e-9);
  assert.ok(value(tiny, "etherDelay") > 0);
});
test("presentation changes preserve the run, input revision, and scientific values", () => {
  const s = create(MM);
  const before = s.getSnapshot().accepted;
  const server = s.getServerSnapshot();
  assert.equal(s.apply({ ...before.parameters, orientation: "90" }).kind, "accepted");
  const after = s.getSnapshot().accepted;
  assert.equal(after.runId, before.runId);
  assert.equal(after.revisions.input, before.revisions.input);
  assert.deepEqual(after.outputs.map((r) => r.value), before.outputs.map((r) => r.value));
  assert.equal(s.getServerSnapshot(), server);
  assert.ok(after.snapshotVersion > before.snapshotVersion);
});
test("changing the contraction hypothesis forks a model run; no-op application does not", () => {
  const s = create(MM);
  const before = s.getSnapshot();
  s.apply(before.accepted.parameters);
  assert.equal(s.getSnapshot(), before);
  s.apply({ ...before.accepted.parameters, contraction: true });
  const after = s.getSnapshot().accepted;
  assert.notEqual(after.runId, before.accepted.runId);
  assert.equal(after.parentRunId, before.accepted.runId);
});
test("observer changes preserve the wave run and advance only the observer revision", () => {
  const s = create(MW);
  const before = s.getSnapshot().accepted;
  s.apply({ ...before.parameters, beta: -0.6, map: "lorentz" });
  const after = s.getSnapshot().accepted;
  assert.equal(after.runId, before.runId);
  assert.equal(after.revisions.input, before.revisions.input);
  assert.ok(after.revisions.observer > before.revisions.observer);
});
test("Fizeau compares no, complete, and partial drag on exactly the same inputs", () => {
  const s = create(FZ);
  assert.ok(value(s, "no-drag-shift") === 0);
  near(value(s, "fresnel-drag-shift"), 0.20711824200702383);
  near(value(s, "full-drag-shift"), 2 * 3 * 1.333 ** 2 * 7.06 / (530e-9 * c));
  near(value(s, "full-drag-leading") / value(s, "fresnel-drag-leading"), 1.333 ** 2 / (1.333 ** 2 - 1));
  const owner = fizeauFringeShift({ waterPathPerBeam: 3, wavelength: 530e-9, waterSpeed: 7.06, refractiveIndex: 1.333, dragHypothesis: "fresnel-drag" });
  assert.equal(value(s, "fresnel-drag-shift"), owner.fringeShift.value);
  s.apply({ ...s.getSnapshot().accepted.parameters, reversal: true });
  near(value(s, "fresnel-drag-shift"), 2 * owner.fringeShift.value);
});
test("Fizeau signed flow reverses shift, and n=1 removes Fresnel drag", () => {
  const positive = create(FZ);
  const negative = create(FZ, "full", { waterSpeed: -7.06 });
  near(value(negative, "fresnel-drag-shift"), -value(positive, "fresnel-drag-shift"));
  const vacuum = create(FZ, "full", { refractiveIndex: 1 });
  assert.equal(value(vacuum, "fresnel-drag-shift"), 0);
});
test("Fizeau at and beyond a return-beam pole retains valid models without Infinity or negative travel times", () => {
  for (const speed of [0.5, 0.6, -0.5, -0.6]) {
    const s = create(FZ, "1904", { waterSpeedFractionOfC: speed, refractiveIndex: 2 });
    assert.equal(output(s, "full-drag-shift").status, "outside-domain");
    assert.equal(output(s, "full-drag-shift").condition, "beam-cannot-return");
    assert.equal(output(s, "full-drag-delay").status, "outside-domain");
    assert.ok(value(s, "no-drag-shift") === 0);
    assert.equal(output(s, "fresnel-drag-shift").status, "value");
    assert.ok(!JSON.stringify(s.getSnapshot().accepted).includes('"value":null'));
  }
});
test("1904 snapshots, field sets, and settings contain no later comparison or modern constant", () => {
  withMode1904Guard(() => {
    for (const id of SHELF_IDS) {
      const s = create(id, "1904");
      const encoded = JSON.stringify({ snapshot: s.getSnapshot().accepted, readings: s.readings,
        fields: shelfFields(id, "1904"), url: encodeShelfSettings(id, "1904", s.getSnapshot().accepted.parameters) });
      assert.doesNotMatch(encoded, /299792458|modern-si-2019|modern-codata|Laue|1907|laterSpeed|showLater/);
      assert.ok(s.getSnapshot().accepted.outputs.every((r) => r.unit !== "s" && r.unit !== "m/s"));
    }
  });
});
test("1904 rejects metre-per-second input rather than converting silently", () => {
  const s = create(FZ, "1904");
  const before = s.getSnapshot();
  const result = s.apply({ ...before.accepted.parameters, waterSpeed: 7.06 });
  assert.equal(result.kind, "refused");
  assert.equal(result.code, "no-pre-1905-light-speed-set");
  assert.equal(s.getSnapshot(), before);
});
test("physical domain refusals retain output identities and units and reach the accepted snapshot", () => {
  for (const [id, mode, patch] of [[MM,"1904",{ beta: 1 }], [MM,"full",{length: -1}],
    [FZ,"full",{refractiveIndex: 0.9}], [FZ,"1904",{wavelengthNm:0}], [MW,"1904",{beta:1}], [MW,"full",{wavenumber:0}]]) {
    const s = create(id, mode);
    assert.equal(s.apply({ ...s.getSnapshot().accepted.parameters, ...patch }).kind, "accepted");
    for (const item of s.getSnapshot().accepted.outputs) {
      assert.equal(item.status, "outside-domain", `${id} ${item.quantityId}`);
      assert.ok(item.reason.length > 10);
      assert.ok(!Object.hasOwn(item, "value"));
    }
  }
});
test("wave residuals distinguish unchanged form from the transformed equation in both directions", () => {
  const s = create(MW, "1904");
  near(value(s, "galilean-forward"), 0.84);
  near(value(s, "galilean-backward"), 1.56);
  assert.equal(value(s, "lorentz-forward"), 0);
  assert.equal(value(s, "lorentz-backward"), 0);
  s.apply({ ...s.getSnapshot().accepted.parameters, beta: 0 });
  assert.equal(value(s, "galilean-forward"), 0);
  assert.equal(value(s, "galilean-backward"), 0);
});
test("changing wavenumber scales the absolute residual but not the normalised residual", () => {
  const one = create(MW, "1904");
  const two = create(MW, "1904", { wavenumber: 2 });
  assert.equal(value(one, "galilean-forward"), value(two, "galilean-forward"));
  near(value(two, "galilean-forward-absolute"), 4 * value(one, "galilean-forward-absolute"));
});
test("invalid controls leave every part of the accepted state untouched", () => {
  const s = create(MM, "1904");
  const before = s.getSnapshot();
  for (const beta of [NaN, Infinity, -Infinity, "", "0", null, undefined, 1e200]) {
    assert.equal(s.apply({ ...before.accepted.parameters, beta }).kind, "refused");
    assert.equal(s.getSnapshot(), before);
  }
  assert.equal(validateShelfInput(MM, "1904", Object.create({ ...before.accepted.parameters })).kind, "refused");
  assert.throws(() => shelfFields("shelf-unknown", "1904"));
  assert.throws(() => shelfFields(MM, "unknown"));
});
test("separate placements and mode guards do not leak scientific state", () => {
  const left = createShelfSession(MM, "1904", "left");
  const right = createShelfSession(MM, "1904", "right");
  const before = right.getSnapshot();
  left.apply({ ...left.getSnapshot().accepted.parameters, beta: 0.2 });
  assert.equal(right.getSnapshot(), before);
  assert.notEqual(left.getSnapshot().accepted.instanceId, right.getSnapshot().accepted.instanceId);
  assert.equal(getConstantSet("modern-si-2019").id, "modern-si-2019");
});
