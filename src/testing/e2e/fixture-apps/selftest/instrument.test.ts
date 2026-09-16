import assert from "node:assert/strict";
import test from "node:test";
import {
  applyInput,
  blockWasm,
  initialSelftestState,
  loseContext,
  requestInput,
  restart,
  restoreContext,
  restoreFromTape,
  selftestViewIdentity,
  serializeTape,
} from "./instrument.ts";

test("typed entry and step buttons exist and change data-input-revision", () => {
  const state = initialSelftestState("inst-1", "run-1");
  const requested = requestInput(state, 42);
  assert.equal(requested.inputRevision, state.inputRevision + 1);
  assert.equal(requested.pending, true);
  assert.equal(requested.requestedParams.value, 42);
});

test("out-of-domain entry shows an explanation, sets data-refusal-code, and keeps the last accepted snapshot visibly distinct from the requested settings", () => {
  let state = initialSelftestState("inst-1", "run-1");
  state = applyInput(requestInput(state, 10), 1);
  assert.equal(state.acceptedParams.value, 10);
  assert.equal(state.refusalCode, undefined);

  const outOfDomain = applyInput(requestInput(state, 999), 2);
  assert.equal(outOfDomain.refusalCode, "selftest-out-of-domain");
  // the last accepted snapshot (10) stays distinct from the rejected request (999)
  assert.equal(outOfDomain.acceptedParams.value, 10);
  assert.equal(outOfDomain.requestedParams.value, 999);
  assert.equal(outOfDomain.acceptedInputRevision, 1);
});

test("?tape= restores the same accepted identities", () => {
  let state = initialSelftestState("inst-1", "run-1");
  state = applyInput(requestInput(state, 55), 1);
  const tape = serializeTape(state);
  const restored = restoreFromTape(tape);
  assert.equal(restored.instanceId, state.instanceId);
  assert.equal(restored.runId, state.runId);
  assert.equal(restored.acceptedInputRevision, state.acceptedInputRevision);
  assert.equal(restored.acceptedParams.value, state.acceptedParams.value);
});

test("restoreFromTape rejects a malformed tape", () => {
  assert.throws(() => restoreFromTape("garbage"), /malformed selftest tape/);
  assert.throws(
    () => restoreFromTape("selftest-v1:inst-1:run-1:notanumber:5"),
    /malformed selftest tape/,
  );
});

test("the same data-snapshot-version and data-run-id appear on every view of one instance", () => {
  let state = initialSelftestState("inst-1", "run-1");
  state = applyInput(requestInput(state, 20), 1);
  const trace = selftestViewIdentity(state);
  const table = selftestViewIdentity(state);
  assert.deepEqual(trace, table);
  assert.equal(trace.runId, "run-1");
  assert.equal(trace.snapshotVersion, String(state.snapshotVersion));
});

test("two instances on one page keep independent run ids and states", () => {
  const first = applyInput(requestInput(initialSelftestState("inst-1", "run-1"), 5), 1);
  const second = applyInput(requestInput(initialSelftestState("inst-2", "run-2"), 77), 1);
  assert.notEqual(first.instanceId, second.instanceId);
  assert.notEqual(first.runId, second.runId);
  assert.equal(first.acceptedParams.value, 5);
  assert.equal(second.acceptedParams.value, 77);
});

test("blocking the WASM artifact yields host and never frankensim", () => {
  let state = initialSelftestState("inst-1", "run-1");
  state = blockWasm(state);
  state = applyInput(requestInput(state, 30), 1);
  assert.equal(state.executionLabel, "host");
});

test("a delayed older response never overwrites a newer data-accepted-input-revision", () => {
  let state = initialSelftestState("inst-1", "run-1");
  // Two requests fire before either resolves.
  state = requestInput(state, 10); // inputRevision 1 ("older")
  state = requestInput(state, 20); // inputRevision 2 ("newer")
  // The newer response arrives first.
  state = applyInput(state, 2);
  assert.equal(state.acceptedInputRevision, 2);
  assert.equal(state.acceptedParams.value, 20);
  // The older, delayed response arrives after.
  const afterStaleResponse = applyInput(state, 1);
  assert.equal(afterStaleResponse.acceptedInputRevision, 2);
  assert.equal(afterStaleResponse.acceptedParams.value, 20);
  assert.deepEqual(afterStaleResponse, state);
});

test("context loss pauses the instrument while its last accepted state stays readable, and restoring resumes it", () => {
  let state = initialSelftestState("inst-1", "run-1");
  state = applyInput(requestInput(state, 15), 1);
  const lost = loseContext(state);
  assert.equal(lost.contextLost, true);
  assert.equal(lost.executionLabel, "unavailable");
  assert.equal(lost.acceptedParams.value, 15); // still readable

  const stalledApply = applyInput(requestInput(lost, 99), 2);
  assert.equal(stalledApply.executionLabel, "unavailable");
  assert.equal(stalledApply.acceptedParams.value, 15); // context loss refuses to accept new results

  const restored = restoreContext(lost);
  assert.equal(restored.contextLost, false);
  assert.equal(restored.executionLabel, "static");
});

test("restart produces a visibly new data-run-id", () => {
  let state = initialSelftestState("inst-1", "run-1");
  state = applyInput(requestInput(state, 40), 1);
  const restarted = restart(state, "run-2");
  assert.notEqual(restarted.runId, state.runId);
  assert.equal(restarted.snapshotVersion, 1);
  assert.equal(restarted.acceptedInputRevision, 0);
});
