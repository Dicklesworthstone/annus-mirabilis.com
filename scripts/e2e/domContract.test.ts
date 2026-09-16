import assert from "node:assert/strict";
import test from "node:test";
import {
  DomContractError,
  parseAnchor,
  parseInstrumentAddress,
  parseInstrumentRoot,
  parseInstrumentView,
  parseReaderRoot,
} from "./domContract.ts";

test("bm-01 parses as the default mode", () => {
  const address = parseInstrumentAddress("bm-01");
  assert.deepEqual(address, { raw: "bm-01", instrumentId: "bm-01", mode: null });
});

test("me-03:box-1906, sr-02:apparatus, bm-04:kicks-off, and bm-07:kitchen parse as mode addresses", () => {
  assert.deepEqual(parseInstrumentAddress("me-03:box-1906"), { raw: "me-03:box-1906", instrumentId: "me-03", mode: "box-1906" });
  assert.deepEqual(parseInstrumentAddress("sr-02:apparatus"), { raw: "sr-02:apparatus", instrumentId: "sr-02", mode: "apparatus" });
  assert.deepEqual(parseInstrumentAddress("bm-04:kicks-off"), { raw: "bm-04:kicks-off", instrumentId: "bm-04", mode: "kicks-off" });
  assert.deepEqual(parseInstrumentAddress("bm-07:kitchen"), { raw: "bm-07:kitchen", instrumentId: "bm-07", mode: "kitchen" });
});

test("sr-03-boost-0.6c (a preset id) in mode position fails", () => {
  assert.throws(() => parseInstrumentAddress("sr-03-boost-0.6c"), DomContractError);
});

test("me-03:box:1906 (two colons) fails", () => {
  assert.throws(() => parseInstrumentAddress("me-03:box:1906"), /more than one colon/);
});

test("ME-03:Box-1906 (upper case) fails", () => {
  assert.throws(() => parseInstrumentAddress("ME-03:Box-1906"), DomContractError);
});

test("bm-01: (empty mode) fails", () => {
  assert.throws(() => parseInstrumentAddress("bm-01:"), /ill-formed or empty mode/);
});

test("the-boost-to-0.6c used as an address fails", () => {
  assert.throws(() => parseInstrumentAddress("the-boost-to-0.6c"), DomContractError);
});

test("with a supplied declared-mode list, an address outside it fails naming the registered modes", () => {
  const declaredModes = ["me-03:box-1906", "sr-02:apparatus"];
  assert.deepEqual(parseInstrumentAddress("me-03:box-1906", declaredModes).mode, "box-1906");
  assert.throws(() => parseInstrumentAddress("lq-08:intensity-probe", declaredModes), /not among the registered modes/);
});

test("with no list, the parser returns the instrument id and mode and asserts nothing", () => {
  const address = parseInstrumentAddress("lq-08:intensity-probe");
  assert.deepEqual(address, { raw: "lq-08:intensity-probe", instrumentId: "lq-08", mode: "intensity-probe" });
});

const FULL_INSTRUMENT_ROOT_ATTRS = {
  "data-instrument-id": "bm-06",
  "data-instance-id": "instance-1",
  "data-run-id": "run-1",
  "data-snapshot-version": "3",
  "data-input-revision": "4",
  "data-accepted-input-revision": "3",
  "data-pending": "true",
  "data-execution-label": "host",
  "data-result-status": "value",
  "data-refusal-code": undefined,
  "data-accepted-action-index": "2",
  "data-view-state": "expanded",
};

test("parsing an instrument root with every attribute", () => {
  const parsed = parseInstrumentRoot(FULL_INSTRUMENT_ROOT_ATTRS);
  assert.equal(parsed.address.instrumentId, "bm-06");
  assert.equal(parsed.instanceId, "instance-1");
  assert.equal(parsed.runId, "run-1");
  assert.equal(parsed.snapshotVersion, "3");
  assert.equal(parsed.inputRevision, "4");
  assert.equal(parsed.acceptedInputRevision, "3");
  assert.equal(parsed.pending, true);
  assert.equal(parsed.executionLabel, "host");
  assert.equal(parsed.resultStatus, "value");
  assert.equal(parsed.refusalCode, undefined);
  assert.equal(parsed.acceptedActionIndex, "2");
  assert.equal(parsed.viewState, "expanded");
});

test("a root missing data-snapshot-version yields the message naming that attribute", () => {
  const { "data-snapshot-version": _omit, ...rest } = FULL_INSTRUMENT_ROOT_ATTRS;
  try {
    parseInstrumentRoot(rest);
    assert.fail("expected parseInstrumentRoot to throw");
  } catch (error) {
    assert.ok(error instanceof DomContractError);
    assert.equal(error.attribute, "data-snapshot-version");
    assert.match(error.message, /data-snapshot-version/);
  }
});

test("an unknown data-execution-label value is rejected", () => {
  const attrs = { ...FULL_INSTRUMENT_ROOT_ATTRS, "data-execution-label": "gpu" };
  try {
    parseInstrumentRoot(attrs);
    assert.fail("expected parseInstrumentRoot to throw");
  } catch (error) {
    assert.ok(error instanceof DomContractError);
    assert.equal(error.attribute, "data-execution-label");
    assert.equal(error.value, "gpu");
  }
});

test("data-accepted-action-index and data-view-state are read when present and never required", () => {
  const { "data-accepted-action-index": _a, "data-view-state": _b, ...withoutRuntimeLaneAttrs } = FULL_INSTRUMENT_ROOT_ATTRS;
  const parsed = parseInstrumentRoot(withoutRuntimeLaneAttrs);
  assert.equal(parsed.acceptedActionIndex, undefined);
  assert.equal(parsed.viewState, undefined);
});

test("parseInstrumentView requires instance, run, and snapshot identity", () => {
  const view = parseInstrumentView({ "data-instance-id": "i1", "data-run-id": "r1", "data-snapshot-version": "2" });
  assert.deepEqual(view, { instanceId: "i1", runId: "r1", snapshotVersion: "2" });
  assert.throws(() => parseInstrumentView({ "data-instance-id": "i1", "data-run-id": "r1" }), /data-snapshot-version/);
});

test("parseReaderRoot reads data-ready and requires data-view", () => {
  assert.deepEqual(parseReaderRoot({ "data-ready": "true", "data-view": "reading" }), { ready: true, view: "reading" });
  assert.deepEqual(parseReaderRoot({ "data-ready": "false", "data-view": "results" }), { ready: false, view: "results" });
  assert.throws(() => parseReaderRoot({ "data-ready": "true" }), /data-view/);
});

test("parseAnchor requires id and data-anchor to agree", () => {
  assert.deepEqual(parseAnchor({ id: "s1-p2", "data-anchor": "s1-p2" }), { id: "s1-p2", anchor: "s1-p2" });
  assert.throws(() => parseAnchor({ id: "s1-p2", "data-anchor": "s1-p3" }), /does not match/);
  assert.throws(() => parseAnchor({ id: "s1-p2" }), /data-anchor/);
});
