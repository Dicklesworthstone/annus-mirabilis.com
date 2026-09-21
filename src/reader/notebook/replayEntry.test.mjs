import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createBm01ComparisonSession } from "../../experiments/bm01/comparisonSession.ts";
import { replayCompatibility } from "./replayCompatibility.ts";
import {
  captureComparisonReplay,
  parseComparisonReplay,
  ReplayBoundsError,
  ReplayRecipeError,
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

/**
 * The two refusals in cloneTape that used to be built-in throws. Both now carry a code, so the
 * refusal scanner can see them and this file can name which one fired; both still extend the
 * built-in they replaced, so every caller that matched on TypeError or RangeError is unaffected.
 *
 * Why they were converted together rather than one at a time: the scanner pairs a throw with the
 * first refusal code within eight lines below it, and coding only the size check made the
 * recipe-version throw above it read as coded too. The bare count would have fallen by two for one
 * repair - the gate satisfied without the second refusal being improved at all.
 */
test("reject: (replayEntry.ts:248) an unsupported recipe version is refused by code, and is still a TypeError", () => {
  for (const mutate of [
    (r) => (r.tape.modelIdentity.modelVersion = 2),
    (r) => (r.tape.experimentId = "bm-05"),
    (r) => (r.tape.mode = "bm-01:apparatus"),
  ]) {
    const r = clone();
    mutate(r);
    assert.throws(
      () => parseComparisonReplay(r),
      (err) =>
        err instanceof ReplayRecipeError &&
        err instanceof TypeError &&
        err.code === "unsupported-replay-recipe-version" &&
        err.name === "ReplayRecipeError" &&
        err.message === "This replay recipe version is not supported.",
    );
  }
  // The saved recipe is accepted unchanged, so each refusal above is about its own mutation.
  assert.equal(parseComparisonReplay(clone()).kind, "bm01-comparison");
});

test("reject: (replayEntry.ts:252) a tape over the bounded recipe size is refused by code, and is still a RangeError", () => {
  const r = clone();
  // The tape can only GROW by lengthening a string: record() pins the exact key set at every level
  // and caps events and predictions at one each, so padding an id is the only route to an oversized
  // tape that still validates. The saved tape is 932 bytes of the 1400 bound.
  r.tape.modelIdentity.modelId += "x".repeat(600);
  assert.ok(new TextEncoder().encode(JSON.stringify(r.tape)).length > 1400);
  assert.throws(
    () => parseComparisonReplay(r),
    (err) =>
      err instanceof ReplayBoundsError &&
      err instanceof RangeError &&
      err.code === "replay-tape-too-large" &&
      err.name === "ReplayBoundsError" &&
      err.message === "Replay tape exceeds the bounded recipe size. Nothing was truncated.",
  );

  // NOT "any large tape is refused here". Padding the checkpoint digest is also oversized and is
  // refused EARLIER, by the tape schema, with its own code - so this site is reached only by a tape
  // that is otherwise valid, which is the window it exists to guard.
  const digestPadded = clone();
  digestPadded.tape.acceptedCheckpoint.digest += "x".repeat(600);
  assert.throws(
    () => parseComparisonReplay(digestPadded),
    (err) => err.code === "tape-invalid-checkpoint-digest",
  );

  // And the saved tape is under the bound and parses, so this test would not pass for a bound of 0.
  assert.ok(new TextEncoder().encode(JSON.stringify(clone().tape)).length <= 1400);
  assert.equal(parseComparisonReplay(clone()).kind, "bm01-comparison");
});
