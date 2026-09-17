import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { checkVoice } from "../../content/checks/voice/index.ts";
import { parseContentYaml } from "../../content/compiler/loaders.ts";
import { encodeResult } from "../../experiments/results/codec.ts";
import { withinTolerance } from "../../units/tolerance.ts";
import { CASE_DISCLAIMER, CASE_IDS, parseCountermodelCase } from "./caseSchema.ts";
import { evaluateCountermodelCase } from "./cellEvaluator.ts";
import { cellOutcomeText, classifyCell, classifySample } from "./classify.ts";
import { createCountermodelSession } from "./session.ts";

const load = (id) =>
  parseCountermodelCase(
    parseContentYaml(
      readFileSync(
        new URL(`../../../content/reasoning/countermodel/${id}.yaml`, import.meta.url),
        "utf8",
      ),
    ),
  );
const cases = CASE_IDS.map(load);
const prepared = (spec) => ({
  case: spec,
  sourceDigest: `source:sha256:${"a".repeat(64)}`,
  caseRevision: "b".repeat(64),
  results: evaluateCountermodelCase(spec, spec.defaultBeta).outputs.map(encodeResult),
});
const session = (spec = cases[0]) => createCountermodelSession("test-case", prepared(spec));
const cells = (spec, s) =>
  spec.candidates.map((_, i) =>
    spec.tests.map((t, j) => classifyCell(s.getSnapshot().view.accepted, i, j, t)),
  );

test("both bounded case files parse and every source reference resolves", () => {
  for (const spec of cases) {
    assert.equal(spec.review, "draft");
    for (const c of spec.candidates)
      assert.ok(c.sourceIds.every((id) => spec.sources.some((s) => s.id === id)));
  }
});
test("a case cannot store an outcome at the root, candidate, test or input level", () => {
  for (const where of ["root", "candidate", "test", "input"]) {
    const c = structuredClone(cases[0]);
    const target =
      where === "root"
        ? c
        : where === "candidate"
          ? c.candidates[0]
          : where === "test"
            ? c.tests[0]
            : c.tests[0].inputs;
    target.outcome = "consistent";
    assert.throws(() => parseCountermodelCase(c), /outcomes/);
  }
});
test("unknown owners, omitted circumstances and missing tolerance reasons are rejected", () => {
  const mutations = [
    (c) => {
      c.candidates[0].id = "unregistered";
    },
    (c) => {
      c.candidates[0].circumstances = "";
    },
    (c) => {
      delete c.tests[0].tolerance.reason;
    },
    (c) => {
      c.tests[0].tolerance.absolute = 0;
    },
    (c) => {
      c.candidates[0].sourceIds = ["missing"];
    },
  ];
  for (const mutate of mutations) {
    const c = structuredClone(cases[0]);
    mutate(c);
    assert.throws(() => parseCountermodelCase(c));
  }
});
test("duplicate test, candidate and event identities cannot silently replace content", () => {
  for (const mutate of [
    (c) => {
      c.tests[1].id = c.tests[0].id;
    },
    (c) => {
      c.candidates[1].id = c.candidates[0].id;
    },
    (c) => {
      c.tests[2].inputs.events[1].id = c.tests[2].inputs.events[0].id;
    },
  ]) {
    const c = structuredClone(cases[0]);
    mutate(c);
    assert.throws(() => parseCountermodelCase(c));
  }
});
test("the default constraint matrix is computed from real owner outputs", () => {
  const out = cells(cases[0], session());
  assert.deepEqual(
    out.map((row) => row.map((c) => c.outcome)),
    [
      ["consistent", "violates", "consistent"],
      ["consistent", "consistent", "consistent"],
    ],
  );
  const low = out[1][0].samples[0];
  assert.ok(
    withinTolerance(Math.abs(low.residual), 2.2253001121072344e-14, { relative: 1e-12 }).ok,
  );
  assert.equal(out[0][1].samples[0].reference, 299792458);
  assert.ok(withinTolerance(out[0][1].samples[0].actual, 0.4 * 299792458, { relative: 1e-12 }).ok);
});
test("both ether-case rows compare against the other independently calculated candidate", () => {
  const out = cells(cases[1], session(cases[1]));
  assert.ok(out.flat().every((c) => c.outcome === "indistinguishable"));
  assert.equal(out[0][0].samples.length, 80);
  for (let j = 0; j < 4; j++)
    for (let i = 0; i < out[0][j].samples.length; i++) {
      assert.equal(out[0][j].samples[i].reference, out[1][j].samples[i].actual);
      assert.equal(out[1][j].samples[i].reference, out[0][j].samples[i].actual);
    }
  assert.ok(withinTolerance(out[0][1].samples[0].actual, 80, { relative: 1e-12 }).ok);
  assert.ok(withinTolerance(out[0][2].samples[0].actual, 0.8, { relative: 1e-12 }).ok);
  assert.ok(
    withinTolerance(out[0][3].samples[0].actual / 299792458, 15 / 17, { relative: 1e-12 }).ok,
  );
});
test("altering an accepted candidate prediction changes the outcome, not a stored verdict", () => {
  const s = session(cases[1]).getSnapshot().view.accepted;
  const outputs = s.outputs.map((o) =>
    o.quantityId === "candidate0Test2Residual" ? { ...o, value: { length: 1, at: () => 0.16 } } : o,
  );
  assert.equal(classifyCell({ ...s, outputs }, 0, 2, cases[1].tests[2]).outcome, "violates");
});
test("the numerical tolerance boundary is indeterminate rather than forced", () => {
  const t = cases[0].tests[0];
  const allowed = t.tolerance.absolute;
  assert.equal(classifySample(allowed, 0, allowed, t).outcome, "indeterminate");
  assert.equal(classifySample(0, 0, 0, t).outcome, "consistent");
  assert.equal(classifySample(2 * allowed, 0, 2 * allowed, t).outcome, "violates");
});
test("presentation toggles make zero owner calls and retain the exact accepted snapshot", () => {
  const s = session(),
    before = s.getSnapshot().view.accepted;
  s.toggle("light-speed", false);
  assert.equal(s.getEvaluationCount(), 0);
  assert.equal(s.getSnapshot().view.accepted, before);
  assert.equal(s.getSnapshot().lastCommand, "presentation-change");
  assert.ok(!s.getSnapshot().active.includes("light-speed"));
  for (const t of cases[0].tests) s.toggle(t.id, false);
  assert.match(s.getSnapshot().message, /No requirements/);
  assert.equal(s.getSnapshot().active.length, 0);
  assert.equal(s.getSnapshot().view.accepted, before);
});
test("changing the observer publishes atomically under the same run and event set", () => {
  const s = session(),
    before = s.getSnapshot().view.accepted;
  assert.deepEqual(s.apply(0), { ok: true });
  const after = s.getSnapshot().view.accepted;
  assert.equal(s.getEvaluationCount(), 1);
  assert.equal(after.runId, before.runId);
  assert.equal(after.revisions.input, before.revisions.input);
  assert.equal(after.revisions.observer, before.revisions.observer + 1);
  assert.equal(after.snapshotVersion, before.snapshotVersion + 1);
  assert.equal(after.parameters.beta, 0);
  assert.ok(
    cells(cases[0], s)
      .flat()
      .every((c) => c.outcome === "consistent"),
  );
});
test("nonfinite, luminal and blank requests keep the accepted numbers and identities", () => {
  const s = session();
  const before = s.getSnapshot().view.accepted;
  for (const bad of [1, -1, NaN, Infinity, "", null, 0.96]) assert.equal(s.apply(bad).ok, false);
  assert.equal(s.getSnapshot().view.accepted, before);
  assert.equal(s.getEvaluationCount(), 0);
});
test("signed observer changes keep the equivalence case within its specified bounds", () => {
  const s = session(cases[1]);
  for (const b of [-0.95, -0.6, 0, 0.1, 0.6, 0.9, 0.95]) {
    assert.equal(s.apply(b).ok, true);
    assert.ok(
      cells(cases[1], s)
        .flat()
        .every((c) => c.outcome === "indistinguishable"),
    );
  }
});
test("the prepared input is detached and an invalid result is never accepted", () => {
  const example = prepared(cases[0]);
  const s = createCountermodelSession("detached", example);
  const before = s.getSnapshot();
  example.results.length = 0;
  assert.equal(s.getSnapshot(), before);
  assert.throws(() => createCountermodelSession("bad", { ...example, results: [] }));
});
test("future case versions, unsupported cases and absent samples are refused", () => {
  for (const mutate of [
    (c) => {
      c.schemaVersion = 2;
    },
    (c) => {
      c.id = "a-new-case";
    },
    (c) => {
      c.tests[2].inputs.events = [];
    },
  ]) {
    const c = structuredClone(cases[0]);
    mutate(c);
    assert.throws(() => parseCountermodelCase(c));
  }
});
test("the copy uses the shared voice rules and marks Poincare as parallel work", () => {
  const strings = [CASE_DISCLAIMER];
  for (const spec of cases) {
    strings.push(spec.title, spec.question, spec.scope);
    for (const c of spec.candidates) strings.push(c.label, c.circumstances);
    for (const t of spec.tests) strings.push(t.label, t.explanation, t.tolerance.reason);
    cells(spec, session(spec)).forEach((row) => {
      row.forEach((c, j) => {
        strings.push(cellOutcomeText(c, spec.tests[j]));
      });
    });
  }
  for (const text of strings) {
    const errors = checkVoice(text, { context: "countermodel-cell" }).filter(
      (f) => f.severity === "error",
    );
    assert.deepEqual(errors, [], text);
  }
  assert.equal(cases[1].sources.find((s) => s.id === "poincare-1905-june-note").parallelWork, true);
  assert.ok(
    checkVoice("This naive candidate.", { context: "countermodel-cell" }).some(
      (f) => f.ruleId === "mockery" || f.rule === "mockery",
    ),
  );
});
