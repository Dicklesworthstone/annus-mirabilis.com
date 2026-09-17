import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import {
  checkExerciseAnswer,
  deriveExerciseSeed,
  exerciseDefinitionKey,
  snapshotExercise,
} from "../discovery/exercises/answer.ts";

const part = () => ({
  id: "identity",
  prompt: "Rewrite this expression.",
  declaredNames: ["x", "pi"],
  domains: { x: { min: 0, max: 1 } },
  referenceSource: "x^2",
  tolerance: { absolute: 1e-10, relative: 1e-10 },
  workedExplanation: "Multiply x by x.",
});
const outcome = async (p, text) => (await checkExerciseAnswer(p, text)).outcome?.status;
test("SHA-256 seed matches the independent Node crypto digest and retains all 64 bits", async () => {
  const key = exerciseDefinitionKey(part());
  assert.equal(
    await deriveExerciseSeed(key),
    createHash("sha256").update(key).digest().readBigUInt64BE(0).toString(),
  );
});
test("sampling identity is stable under declaration order, and changes with exercise id or reference", async () => {
  const p = part();
  const key = exerciseDefinitionKey(p);
  assert.equal(key, exerciseDefinitionKey({ ...p, declaredNames: ["pi", "x"] }));
  assert.notEqual(
    await deriveExerciseSeed(key),
    await deriveExerciseSeed(exerciseDefinitionKey({ ...p, id: "another" })),
  );
  assert.notEqual(key, exerciseDefinitionKey({ ...p, referenceSource: "x" }));
});
test("real parser, evaluator, Philox and tolerance compose for a reader answer", async () => {
  assert.equal(await outcome(part(), "x*x"), "equivalent");
  assert.equal(await outcome(part(), "x^2+sin(32*pi*x)"), "not-equivalent");
});
test("Brownian rearrangement passes without a stored answer-string comparison", async () => {
  const p = {
    ...part(),
    declaredNames: ["D", "t"],
    domains: {
      D: { min: 1e-14, max: 1e-10, scale: "log" },
      t: { min: 0.1, max: 100, scale: "log" },
    },
    referenceSource: "2*sqrt(D*t)",
  };
  assert.equal(await outcome(p, "sqrt(4*D*t)"), "equivalent");
});
test("an in-flight check retains the submitted definition despite caller mutation", async () => {
  const p = part();
  const task = checkExerciseAnswer(p, "x*x");
  p.referenceSource = "x";
  p.domains.x.max = 2;
  p.declaredNames.push("evil");
  assert.equal((await task).outcome.status, "equivalent");
});
for (const answer of ["", "window.alert(1)", "x;1", "2x", "x=1", "10⁻³", "1,5", "x".repeat(201)])
  test(`invalid reader text is a parse error: ${answer.slice(0, 25)}`, async () => {
    assert.equal((await checkExerciseAnswer(part(), answer)).kind, "parse-error");
  });
test("Unicode multiplication keeps its mathematical meaning", async () => {
  assert.equal(await outcome(part(), "x×x"), "equivalent");
});
for (const patch of [
  { declaredNames: ["x", "x"] },
  { declaredNames: ["x", "y"] },
  { declaredNames: ["sqrt"] },
  { domains: { x: { min: 1, max: 0 } } },
  { tolerance: {} },
  { tolerance: { absolute: null, relative: 0.1 } },
  { referenceSource: "unbound" },
  { id: "" },
  { workedExplanation: "" },
])
  test(`broken exercise configuration is not a wrong answer: ${Object.keys(patch)[0]}`, async () => {
    assert.equal(await outcome({ ...part(), ...patch }, "x*x"), "could-not-compare");
  });
test("exercise data accessors are rejected without execution", () => {
  const p = part();
  let called = false;
  Object.defineProperty(p, "referenceSource", {
    enumerable: true,
    get() {
      called = true;
      throw Error("called");
    },
  });
  assert.throws(() => snapshotExercise(p));
  assert.equal(called, false);
});
test("constant questions need no invented variable range", async () => {
  const p = { ...part(), referenceSource: "2+3", declaredNames: [], domains: {} };
  const result = await checkExerciseAnswer(p, "5");
  assert.equal(result.outcome.status, "equivalent");
  assert.equal(result.outcome.acceptedPointCount, 1);
});
test("snapshot cannot be changed after validation", () => {
  const p = snapshotExercise(part());
  assert.throws(() => {
    p.domains.x.max = 9;
  });
  assert.throws(() => p.declaredNames.push("new"));
});
