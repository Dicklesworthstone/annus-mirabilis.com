import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createBm01ComparisonSession } from "../../experiments/bm01/comparisonSession.ts";
import { replayCompatibility } from "./replayCompatibility.ts";
import {
  captureComparisonReplay,
  parseComparisonReplay,
  verifyReplayEvidence,
} from "./replayEntry.ts";

const example = JSON.parse(
  await readFile(new URL("../../generated/bm01-comparison.json", import.meta.url), "utf8"),
);
const state = createBm01ComparisonSession("saved", example, () => {
  throw Error("Unexpected owner creation");
}).getServerSnapshot();
const passage = { contentRevision: "b".repeat(64), translationRevision: null };
const replay = await captureComparisonReplay(
  state,
  passage,
  { before: "Before", after: "After" },
  "smaller",
);
const clone = () => JSON.parse(JSON.stringify(replay));

test("captures real accepted readouts, one validated tape, and a scalar checkpoint", async () => {
  assert.equal(
    replay.variant.outputs.diffusionCoefficient.value,
    state.variant.outputs.diffusionCoefficient.value,
  );
  assert.equal(replay.tape.events.length, 1);
  assert.equal(replay.tape.events[0].paramId, "a");
  assert.equal(replay.checkpointScope, "saved-scalar-comparison");
  assert.ok(await verifyReplayEvidence(replay));
  assert.ok(Object.isFrozen(replay.tape.initialConditions));
  assert.equal(JSON.stringify(parseComparisonReplay(clone())), JSON.stringify(replay));
});
test("reading and explaining an entry does not start a worker", () => {
  assert.equal(replay.explanationBefore, "Before");
  assert.equal(replay.explanationAfter, "After");
  assert.equal(replay.tape.predictions[0].payload.candidateId, "smaller");
});
test("pending comparisons cannot be captured under previous accepted labels", async () => {
  await assert.rejects(
    captureComparisonReplay({ ...state, pending: true }, passage, { before: "", after: "" }),
    /completed/,
  );
});
test("tape mutations cannot change two inputs, command class, seed, grid, or checkpoint identity", () => {
  const mutations = [
    (r) => (r.tape.initialConditions.eta *= 2),
    (r) => (r.tape.events[0].commandClass = "observer-change"),
    (r) => (r.tape.seed = "1906"),
    (r) => (r.tape.replayGrid.baseSpacing *= 2),
    (r) => r.tape.acceptedCheckpoint.acceptedInputRevision++,
    (r) => r.tape.events.push({ ...r.tape.events[0], actionIndex: 2 }),
    (r) => (r.tape.events[0].paramId = "__proto__"),
  ];
  for (const mutate of mutations) {
    const r = clone();
    mutate(r);
    assert.throws(() => parseComparisonReplay(r));
  }
});
test("reject: (replayEntry.ts:135) bm01-comparison tape variation mismatch throws TypeError", () => {
  const r = clone();
  r.tape.events[0].commandClass = "observer-change";
  assert.throws(
    () => parseComparisonReplay(r),
    (err) =>
      err instanceof TypeError &&
      err.message === "Replay tape must reproduce exactly the saved single variation.",
  );
});
test("accept: bm01-comparison tape with exact saved single variation parses cleanly", () => {
  const r = clone();
  const parsed = parseComparisonReplay(r);
  assert.equal(parsed.kind, "bm01-comparison");
  assert.equal(parsed.tape.events[0].commandClass, "setup-change");
});
test("reject: (replayEntry.ts:138) bm01-comparison replay checkpoint mismatch throws TypeError", () => {
  const r = clone();
  r.tape.acceptedCheckpoint.acceptedInputRevision++;
  assert.throws(
    () => parseComparisonReplay(r),
    (err) =>
      err instanceof TypeError &&
      err.message === "Replay checkpoint does not name its accepted result.",
  );
});
test("accept: bm01-comparison replay checkpoint naming its accepted result parses cleanly", () => {
  const r = clone();
  const parsed = parseComparisonReplay(r);
  assert.equal(parsed.kind, "bm01-comparison");
  assert.equal(
    parsed.tape.acceptedCheckpoint.acceptedInputRevision,
    parsed.variant.acceptedInputRevision,
  );
});
test("saved evidence tampering fails the checkpoint before replay", async () => {
  const r = clone();
  r.variant.outputs.sampleRms.value *= 2;
  assert.equal(await verifyReplayEvidence(parseComparisonReplay(r)), false);
});
test("unknown fields, invalid statuses and nonfinite readouts fail without truncation", () => {
  for (const mutate of [
    (r) => (r.password = "private"),
    (r) => (r.tape.note = "private"),
    (r) => (r.tape.predictions[0].payload.note = "private"),
    (r) => (r.baseline.outputs.sampleRms.value = Infinity),
    (r) => (r.baseline.outputs.sampleRms.status = "guessed"),
    (r) => (r.passage.contentRevision = "not-a-digest"),
    (r) => (r.schemaVersion = 2),
    (r) => (r.explanationAfter = "x".repeat(10001)),
  ]) {
    const r = clone();
    mutate(r);
    assert.throws(() => parseComparisonReplay(r));
  }
});
test("every model, stream, executable and constant mismatch is visible", () => {
  const cat = {
    identity: replay.baseline.identity,
    passages: { "arg-bm-observable": passage },
    aliases: [],
  };
  assert.equal(replayCompatibility(replay, "arg-bm-observable", cat).modelChanged, false);
  for (const key of [
    "modelVersion",
    "streamVersion",
    "allocationId",
    "constantSetId",
    "sourceDigest",
    "artifactDigest",
    "executionLabel",
  ]) {
    const changed = replayCompatibility(replay, "arg-bm-observable", {
      ...cat,
      identity: { ...cat.identity, [key]: "different" },
    });
    assert.equal(changed.modelChanged, true);
    assert.ok(changed.modelMessage.includes("new identified run"));
  }
});
test("revised and unresolved passages are not claimed unchanged", () => {
  const cat = {
    identity: replay.baseline.identity,
    passages: { current: { ...passage, translationRevision: "c".repeat(64) } },
    aliases: [],
  };
  assert.equal(replayCompatibility(replay, "current", cat).passageChanged, true);
  assert.equal(replayCompatibility(replay, "missing", cat).anchor, null);
});
