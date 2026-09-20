import assert from "node:assert/strict";
import { test } from "node:test";
import {
  ARGUMENT_STEPS,
  argumentExport,
  argumentStep,
  assessArgument,
  CONSISTENCY_ARGUMENT,
  decodeArgument,
  encodeArgument,
  readArgumentOrder,
  WORKED_ARGUMENT,
} from "../discovery/massEnergyArgument.ts";

test("the reconstruction graph has unique, resolvable, acyclic dependencies", () => {
  const visited = new Set(),
    visiting = new Set();
  assert.equal(new Set(ARGUMENT_STEPS.map((s) => s.id)).size, ARGUMENT_STEPS.length);
  function visit(id) {
    assert.ok(!visiting.has(id), `cycle at ${id}`);
    if (visited.has(id)) return;
    visiting.add(id);
    for (const dependency of argumentStep(id).requires) visit(dependency);
    visiting.delete(id);
    visited.add(id);
  }
  for (const step of ARGUMENT_STEPS) {
    visit(step.id);
    assert.ok(step.title && step.latex && step.explanation);
    assert.ok(Object.isFrozen(step));
    assert.ok(Object.isFrozen(step.requires));
  }
});

test("the worked route independently reaches the conditional inertia conclusion", () => {
  const a = assessArgument(WORKED_ARGUMENT);
  assert.equal(a.outcome, "inertia-derived");
  assert.ok(a.steps.every((s) => s.status === "supported"));
  assert.ok(a.steps.every((s) => s.assumedTarget.length === 0));
  assert.match(a.summary, /not an experimental verification/);
});

for (const omitted of WORKED_ARGUMENT)
  test(`omitting ${omitted} cannot complete the derivation`, () => {
    assert.notEqual(
      assessArgument(WORKED_ARGUMENT.filter((id) => id !== omitted)).outcome,
      "inertia-derived",
    );
  });

test("independent premises and balances admit multiple topological orders", () => {
  const order = [...WORKED_ARGUMENT];
  const early = [
    "inertial-coefficient",
    "kinetic-offset",
    "unchanged-offset",
    "light-transform",
    "conservation",
    "opposite-pulses",
  ];
  const reordered = [...early, ...order.filter((id) => !early.includes(id))];
  assert.equal(assessArgument(reordered).outcome, "inertia-derived");
  assert.notDeepEqual(reordered, WORKED_ARGUMENT);
});

test("a later premise does not retroactively justify an earlier operation", () => {
  const order = [...WORKED_ARGUMENT];
  order.splice(order.indexOf("conservation"), 1);
  order.push("conservation");
  const a = assessArgument(order);
  assert.equal(a.steps.find((s) => s.id === "rest-balance").status, "blocked");
  assert.deepEqual(a.steps.find((s) => s.id === "rest-balance").missing, ["conservation"]);
  assert.equal(a.steps.find((s) => s.id === "inertia-loss").status, "blocked");
});

test("leaving the offset free preserves a valid weaker result", () => {
  const a = assessArgument(WORKED_ARGUMENT.filter((id) => id !== "unchanged-offset"));
  assert.equal(a.outcome, "offset-unresolved");
  assert.match(a.summary, /underdetermined/);
  assert.equal(a.steps.find((s) => s.id === "retain-offset").status, "supported");
});

test("subtraction alone is not mislabeled a kinetic-energy identification", () => {
  assert.equal(assessArgument(WORKED_ARGUMENT.slice(0, 7)).outcome, "ledger-relation");
});

test("the exact kinetic-energy result is not mislabeled an inertia conclusion", () => {
  assert.equal(assessArgument(WORKED_ARGUMENT.slice(0, 11)).outcome, "kinetic-drop");
});

test("assuming rest energy permits a consistency check, never an independent derivation", () => {
  const a = assessArgument(CONSISTENCY_ARGUMENT);
  assert.equal(a.outcome, "consistency-check");
  assert.equal(a.steps.find((s) => s.id === "assume-rest-energy").status, "assumes-target");
  assert.equal(a.steps.find((s) => s.id === "rest-energy-check").status, "consistency-only");
  assert.deepEqual(a.steps.at(-1).assumedTarget, ["assume-rest-energy"]);
  assert.match(a.summary, /valid consistency check/);
});

test("a disconnected alternative does not taint a genuinely independent path", () => {
  for (const order of [
    ["assume-rest-energy", ...WORKED_ARGUMENT, "rest-energy-check"],
    [...WORKED_ARGUMENT, "assume-rest-energy", "rest-energy-check"],
  ]) {
    const a = assessArgument(order);
    assert.equal(a.outcome, "inertia-derived");
    assert.deepEqual(a.steps.find((s) => s.id === "inertia-loss").assumedTarget, []);
    assert.equal(a.steps.find((s) => s.id === "rest-energy-check").status, "consistency-only");
  }
});

test("available next steps depend on justified premises, not merely selected cards", () => {
  const a = assessArgument(["rest-balance"]);
  assert.ok(!a.available.includes("subtract-balances"));
  assert.ok(a.available.includes("conservation"));
  assert.ok(!a.available.includes("rest-balance"));
});

for (const raw of [
  null,
  {},
  "inertia-loss",
  ["unknown"],
  ["conservation", "conservation"],
  [1],
  ["__proto__"],
  new Array(17).fill("conservation"),
]) {
  test(`invalid imported order is refused: ${JSON.stringify(raw)}`, () =>
    assert.throws(() => assessArgument(raw)));
}

test("orders, assessments and the deck are immutable copies", () => {
  const raw = ["conservation"];
  const order = readArgumentOrder(raw);
  raw.push("opposite-pulses");
  assert.deepEqual(order, ["conservation"]);
  const a = assessArgument(order);
  for (const value of [
    ARGUMENT_STEPS,
    WORKED_ARGUMENT,
    order,
    a,
    a.steps,
    a.steps[0],
    a.steps[0].missing,
    a.available,
  ])
    assert.ok(Object.isFrozen(value));
});

test("saved links preserve exactly the selection order, including a blocked order", () => {
  for (const order of [[], WORKED_ARGUMENT, CONSISTENCY_ARGUMENT, [...WORKED_ARGUMENT].reverse()]) {
    const decoded = decodeArgument(encodeArgument(order));
    assert.equal(decoded.kind, "argument");
    assert.deepEqual(decoded.order, order);
    assert.deepEqual(assessArgument(decoded.order), assessArgument(order));
  }
});

for (const query of [
  "?proof=2&steps=",
  "?proof=1",
  "?steps=conservation",
  "?proof=1&proof=1&steps=",
  "?proof=1&steps=&steps=conservation",
  "?proof=1&steps=unknown",
  "?proof=1&steps=conservation,conservation",
  "?proof=1&steps=conservation,",
  "?proof=1&steps=constructor",
  `?proof=1&steps=${"x".repeat(4096)}`,
]) {
  test(`malformed or unsupported shared state is explicit: ${query.slice(0, 70)}`, () =>
    assert.equal(decodeArgument(query).kind, "invalid"));
}

test("ordinary reader parameters are not mistaken for proof data", () => {
  assert.equal(decodeArgument("?theme=slate&detail=steps").kind, "empty");
  assert.equal(decodeArgument(`${encodeArgument(WORKED_ARGUMENT)}&theme=slate`).kind, "argument");
});

test("JSON export recomputes feedback and preserves notes without executable content", () => {
  const note = '<script>alert("not executed")</script> My offset premise is explicit.';
  const exported = JSON.parse(argumentExport(CONSISTENCY_ARGUMENT, note));
  assert.equal(exported.version, 1);
  assert.equal(exported.note, note);
  assert.equal(exported.assessment.outcome, "consistency-check");
  assert.deepEqual(exported.order, CONSISTENCY_ARGUMENT);
  assert.equal(exported.cards.length, CONSISTENCY_ARGUMENT.length);
  assert.ok(!encodeArgument(CONSISTENCY_ARGUMENT).includes(note));
  assert.throws(() => argumentExport([], "x".repeat(20_001)));
});

test("historical imports, model limits and sign conventions are explicit", () => {
  assert.match(
    argumentStep("light-transform").explanation,
    /not knowledge supplied by a 1904 shelf/,
  );
  assert.match(argumentStep("small-speed").explanation, /not be presented as the exact/);
  assert.match(
    argumentStep("inertial-coefficient").explanation,
    /not division by v² at exactly zero/,
  );
  assert.match(argumentStep("inertia-loss").latex, /Delta M=-/);
  assert.match(argumentStep("opposite-pulses").explanation, /Asymmetric emission/);
});
