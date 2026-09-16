import assert from "node:assert/strict";
import test from "node:test";
import { adjudicatePrediction } from "./predictAdjudication.ts";

test("a matching candidate is match, never a congratulation", () => {
  const result = adjudicatePrediction({
    choice: { form: "candidate", candidateId: "larger" },
    supportedCandidateId: "larger",
  });
  assert.equal(result.status, "match");
  assert.equal(result.statement.includes("you"), false);
  assert.equal(result.statement.toLowerCase().includes("correct"), false);
  assert.equal(result.statement.toLowerCase().includes("wrong"), false);
});

test("a different candidate is not-close, not a pass", () => {
  const result = adjudicatePrediction({
    choice: { form: "candidate", candidateId: "equal" },
    supportedCandidateId: "larger",
  });
  assert.equal(result.status, "not-close");
  assert.equal(result.statement.toLowerCase().includes("wrong"), false);
});

test("a sketch is undetermined, never a generous pass", () => {
  const result = adjudicatePrediction({
    choice: {
      form: "sketch",
      points: [
        [0, 0],
        [1, 1],
      ],
    },
    supportedCandidateId: "larger",
  });
  assert.equal(result.status, "undetermined");
  assert.match(result.statement, /cannot be scored here/);
});

test("a keep-to-self (null choice) is undetermined", () => {
  const result = adjudicatePrediction({ choice: null, supportedCandidateId: "larger" });
  assert.equal(result.status, "undetermined");
});

test("typed values: exact match, close, and not-close", () => {
  const expected = [{ targetId: "t1", value: 1 }];
  assert.equal(
    adjudicatePrediction({
      choice: { form: "values", targets: [{ targetId: "t1", value: 1 }] },
      expectedValues: expected,
    }).status,
    "match",
  );
  assert.equal(
    adjudicatePrediction({
      choice: { form: "values", targets: [{ targetId: "t1", value: 1.02 }] },
      expectedValues: expected,
      closeRelative: 0.05,
    }).status,
    "close",
  );
  assert.equal(
    adjudicatePrediction({
      choice: { form: "values", targets: [{ targetId: "t1", value: 2 }] },
      expectedValues: expected,
    }).status,
    "not-close",
  );
});

test("values without expected targets are undetermined", () => {
  const result = adjudicatePrediction({
    choice: { form: "values", targets: [{ targetId: "t1", value: 1 }] },
  });
  assert.equal(result.status, "undetermined");
});
