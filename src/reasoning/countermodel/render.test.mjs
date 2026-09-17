import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { checkVoice } from "../../content/checks/voice/index.ts";
import { parseContentYaml } from "../../content/compiler/loaders.ts";
import { encodeResult } from "../../experiments/results/codec.ts";
import { CASE_IDS, parseCountermodelCase } from "./caseSchema.ts";
import { evaluateCountermodelCase } from "./cellEvaluator.ts";
import {
  escapeWorkbenchText,
  renderCountermodelResults,
  renderCountermodelWorkbench,
} from "./render.ts";
import { createCountermodelSession } from "./session.ts";

const examples = CASE_IDS.map((id) => {
  const spec = parseCountermodelCase(
    parseContentYaml(
      readFileSync(
        new URL(`../../../content/reasoning/countermodel/${id}.yaml`, import.meta.url),
        "utf8",
      ),
    ),
  );
  return {
    case: spec,
    sourceDigest: `source:sha256:${"a".repeat(64)}`,
    caseRevision: "b".repeat(64),
    results: evaluateCountermodelCase(spec, spec.defaultBeta).outputs.map(encodeResult),
  };
});
test("all fourteen outcomes and numerical evidence are rendered without JavaScript", () => {
  const html = examples.map((e, i) => renderCountermodelWorkbench(e, `case${i}`)).join("");
  assert.equal((html.match(/data-cell-outcome=/g) || []).length, 14);
  assert.equal((html.match(/<fieldset[^>]*disabled/g) || []).length, 4);
  assert.ok(html.includes("2.2253e-14"));
  assert.ok(html.includes("Static worked example"));
  assert.ok(html.includes("full-precision decimal strings"));
  assert.ok(!/<script\b|\son\w+=/.test(html));
});
test("deselecting the light-speed requirement changes conclusions without concealing its result", () => {
  const ex = examples[0],
    s = createCountermodelSession("case", ex);
  s.toggle("light-speed", false);
  const html = renderCountermodelResults(ex.case, s.getSnapshot(), "case");
  assert.ok(html.includes("None of the selected requirements excludes this candidate"));
  assert.ok(html.includes("Violates Light-speed postulate"));
  assert.ok(html.includes("Not selected; prediction retained"));
  assert.equal(s.getEvaluationCount(), 0);
});
test("the ether case labels parallel work and does not turn indistinguishability into refutation", () => {
  const html = renderCountermodelWorkbench(examples[1], "case");
  assert.ok(html.includes("Parallel work: not on the 1904 shelf"));
  assert.ok(html.includes("This candidate is not refuted by them"));
  assert.ok(html.includes("not historical datasets"));
  assert.ok(html.includes("not every conceivable alternative"));
});
test("placement identifiers cannot inject markup, and text escaping handles attribute delimiters", () => {
  assert.throws(() => renderCountermodelWorkbench(examples[0], 'x" onclick="x'));
  assert.equal(
    escapeWorkbenchText("<x a=\"b\"> & 'quote'"),
    "&lt;x a=&quot;b&quot;&gt; &amp; &#39;quote&#39;",
  );
  const ex = structuredClone(examples[0]);
  ex.case.title = 'A "quoted" & named case';
  const html = renderCountermodelWorkbench(ex, "safe");
  assert.ok(html.includes("A &quot;quoted&quot; &amp; named case"));
});
test("visible observer labels do not include value-bearing input elements", () => {
  const html = renderCountermodelWorkbench(examples[0], "case");
  assert.match(html, /<label for="case-beta">Observer speed v\/c \(dimensionless\)<\/label><input/);
  assert.ok(!/<label[^>]*>[^<]*<input/.test(html));
});
test("every matrix cell exposes associated row and column headers and a keyboard disclosure", () => {
  const html = renderCountermodelWorkbench(examples[0], "case");
  assert.equal((html.match(/role="cell" headers=/g) || []).length, 6);
  assert.equal((html.match(/data-cell-detail=/g) || []).length, 6);
  assert.ok(html.includes('role="region"'));
});
test("rendered explanatory copy passes the shared voice rules", () => {
  for (const ex of examples) {
    const html = renderCountermodelWorkbench(ex, "case");
    const text = html.replace(/<[^>]*>/g, " ").replace(/&[^;]+;/g, " ");
    const findings = checkVoice(text, { context: "countermodel-cell" }).filter(
      (f) => f.severity === "error",
    );
    assert.deepEqual(findings, []);
  }
});
