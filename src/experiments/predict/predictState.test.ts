import assert from "node:assert/strict";
import test from "node:test";
import {
  amendAfterReveal,
  beginPrompt,
  clearPrompt,
  emptyRegistry,
  isRecordable,
  keepToSelf,
  PredictStateError,
  promptState,
  restartPrompt,
  reveal,
  skipPrediction,
  submitPrediction,
  withPrompt,
} from "./predictState.ts";

test("a recorded prediction cannot be silently revised after reveal; an amendment is marked after-the-fact", () => {
  const original = { form: "candidate" as const, candidateId: "larger" };
  const recorded = submitPrediction(beginPrompt("me-02-predict-exact-versus-quadratic"), original);
  const shown = reveal(recorded);
  assert.throws(
    () => submitPrediction(shown, { form: "candidate", candidateId: "equal" }),
    PredictStateError,
  );
  assert.deepEqual(shown.choice, original);
  assert.equal(shown.amendment, null);
  const amended = amendAfterReveal(shown, { form: "candidate", candidateId: "equal" });
  assert.deepEqual(amended.choice, original);
  assert.equal(amended.amendment?.recordedAfterReveal, true);
  assert.deepEqual(amended.amendment?.choice, { form: "candidate", candidateId: "equal" });
});

test("a prompt begins hidden", () => {
  const record = beginPrompt("bm-05-predict-step-shape");
  assert.equal(record.state, "hidden");
  assert.equal(record.choice, null);
});

test("submitting a candidate prediction moves hidden -> predicted and is recordable", () => {
  const record = submitPrediction(beginPrompt("p1"), {
    form: "candidate",
    candidateId: "same-bell-shape",
  });
  assert.equal(record.state, "predicted");
  assert.deepEqual(record.choice, { form: "candidate", candidateId: "same-bell-shape" });
  assert.equal(isRecordable(record), true);
});

test("keepToSelf moves hidden -> predicted-unrecorded, records no choice, and is never recordable", () => {
  const record = keepToSelf(beginPrompt("p1"));
  assert.equal(record.state, "predicted-unrecorded");
  assert.equal(record.choice, null);
  assert.equal(isRecordable(record), false);
  const revealed = reveal(record);
  assert.equal(revealed.state, "revealed");
  assert.equal(isRecordable(revealed), false);
});

test("predicted-unrecorded reveals exactly like predicted, but stays unrecordable through reveal", () => {
  const predicted = reveal(
    submitPrediction(beginPrompt("p1"), { form: "candidate", candidateId: "wider-bell" }),
  );
  const unrecorded = reveal(keepToSelf(beginPrompt("p1")));
  assert.equal(predicted.state, "revealed");
  assert.equal(unrecorded.state, "revealed");
  assert.equal(isRecordable(predicted), true);
  assert.equal(isRecordable(unrecorded), false);
});

test("skip moves hidden -> skipped, and skipped behaves like predicted-unrecorded for storage: never recordable", () => {
  const skipped = skipPrediction(beginPrompt("p1"));
  assert.equal(skipped.state, "skipped");
  assert.equal(isRecordable(skipped), false);
  const revealed = reveal(skipped);
  assert.equal(revealed.state, "revealed");
  assert.equal(isRecordable(revealed), false);
});

test("clear moves revealed -> cleared and drops the choice", () => {
  const revealed = reveal(
    submitPrediction(beginPrompt("p1"), { form: "candidate", candidateId: "x" }),
  );
  const cleared = clearPrompt(revealed);
  assert.equal(cleared.state, "cleared");
  assert.equal(cleared.choice, null);
});

test("re-predict: restarting a cleared prompt begins it over exactly like a first engagement", () => {
  const revealed = reveal(
    submitPrediction(beginPrompt("p1"), { form: "candidate", candidateId: "x" }),
  );
  const cleared = clearPrompt(revealed);
  const restarted = restartPrompt(cleared);
  assert.deepEqual(restarted, beginPrompt("p1"));
});

test("invalid transitions throw PredictStateError naming the prompt and the state it was in", () => {
  const hidden = beginPrompt("p1");
  assert.throws(
    () => reveal(hidden),
    (error: unknown) => {
      assert.ok(error instanceof PredictStateError);
      assert.equal(error.promptId, "p1");
      assert.equal(error.from, "hidden");
      return true;
    },
  );
  const predicted = submitPrediction(hidden, { form: "candidate", candidateId: "x" });
  assert.throws(
    () => submitPrediction(predicted, { form: "candidate", candidateId: "y" }),
    PredictStateError,
  );
  assert.throws(() => clearPrompt(predicted), PredictStateError);
  assert.throws(() => restartPrompt(predicted), PredictStateError);
});

test("two prompts on one instance stay independent: revealing one never reveals another", () => {
  let registry = emptyRegistry();
  registry = withPrompt(registry, "prompt-a", (r) =>
    submitPrediction(r, { form: "candidate", candidateId: "a1" }),
  );
  registry = withPrompt(registry, "prompt-b", (r) =>
    submitPrediction(r, { form: "candidate", candidateId: "b1" }),
  );
  registry = withPrompt(registry, "prompt-a", reveal);

  assert.equal(promptState(registry, "prompt-a").state, "revealed");
  assert.equal(promptState(registry, "prompt-b").state, "predicted");
});

test("verbal and values prediction forms are recordable, and sketch points round-trip", () => {
  const verbal = submitPrediction(beginPrompt("p1"), {
    form: "verbal",
    directionId: "increase",
    shapeId: "square-root",
  });
  assert.equal(isRecordable(verbal), true);
  const values = submitPrediction(beginPrompt("p1"), {
    form: "values",
    targets: [{ targetId: "t1", value: 2 }],
  });
  assert.equal(isRecordable(values), true);
  const points: readonly (readonly [number, number])[] = [
    [0, 0],
    [1, 0.5],
  ];
  const sketch = submitPrediction(beginPrompt("p1"), { form: "sketch", points });
  assert.deepEqual(sketch.choice, { form: "sketch", points });
});
