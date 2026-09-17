import assert from "node:assert/strict";
import test from "node:test";
import { DomContractError } from "../domContract.ts";
import { missingIdentityAttribute, readInstrumentIdentity } from "./identityReader.ts";

const complete = {
  "data-instrument-id": "rt-01",
  "data-instance-id": "runtime-analytic-a",
  "data-run-id": "runtime-analytic-a/run/1",
  "data-snapshot-version": "1",
  "data-input-revision": "1",
  "data-accepted-input-revision": "1",
  "data-pending": "false",
  "data-execution-label": "host",
};

test("identity reader parses every required data attribute", () => {
  const identity = readInstrumentIdentity(complete);
  assert.equal(identity.instanceId, "runtime-analytic-a");
  assert.equal(identity.executionLabel, "host");
});

test("identity reader names a missing attribute", () => {
  const { "data-run-id": _omit, ...rest } = complete;
  try {
    readInstrumentIdentity(rest);
    assert.fail("expected missing attribute to throw");
  } catch (error) {
    assert.ok(error instanceof DomContractError);
    assert.equal(missingIdentityAttribute(error), "data-run-id");
  }
});
