import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";
import { loadReadingFiles } from "../../scripts/build-content.ts";
import { compileReadingContent } from "../content/compiler/compile.ts";
import { expressionLatex } from "../equations/latex.ts";
import { navigate, navigationTree } from "../equations/navigation.ts";
import { BROWNIAN_QUANTITIES } from "../equations/quantities.ts";
import { parseEquationRecord } from "../equations/record.ts";

const load = async (name) =>
  JSON.parse(
    await readFile(
      new URL(`../../content/equations/brownian-motion/eq-model-bm-${name}.json`, import.meta.url),
      "utf8",
    ),
  );
test("every Brownian teaching equation compiles, bound on every term or on none, with explicit draft provenance", async () => {
  const compiled = compileReadingContent(await loadReadingFiles());
  assert.equal(compiled.ok, true, JSON.stringify(compiled.diagnostics));
  const paper = compiled.papers.find((p) => p.paper.id === "brownian-motion");
  const equations = paper.equations;
  // The population is the records directory, not a frozen three: nine reading records joined it.
  const onDisk = (
    await readdir(new URL("../../content/equations/brownian-motion/", import.meta.url))
  ).filter((f) => f.endsWith(".json")).length;
  assert.equal(equations.length, onDisk);
  const bound = [];
  for (const e of equations) {
    assert.equal(e.notation, "modern-pedagogical");
    assert.equal(e.review, "draft");
    const nav = navigationTree(e.tree);
    assert.equal(nav.length, e.notes.length);
    // A laboratory equation binds every term to an output; a reading equation binds none. A partly
    // bound equation would show some terms live and others static in one formula.
    const terms = nav.filter((n) => n.kind === "term").length;
    assert.ok(
      e.bindings.length === 0 || e.bindings.length === terms,
      `${e.id}: ${e.bindings.length} of ${terms} terms bound`,
    );
    if (e.bindings.length > 0) bound.push(e.id);
  }
  // Identity, not census: the three laboratory equations, and at least one reading-only record.
  assert.deepEqual(bound.sort(), [
    "eq-model-bm-apparent-speed",
    "eq-model-bm-diffusivity",
    "eq-model-bm-rms",
  ]);
  assert.ok(equations.length > bound.length);
});
test("TeX is generated structurally with term and operation markers, not by replacing letters", async () => {
  const rms = parseEquationRecord(await load("rms"), "rms");
  const plain = expressionLatex(rms.tree, BROWNIAN_QUANTITIES);
  assert.equal(plain, "\\lambda_x = \\sqrt{2\\,D\\,t}");
  assert.ok(!plain.includes("html"));
  const marked = expressionLatex(rms.tree, BROWNIAN_QUANTITIES, true);
  for (const n of navigationTree(rms.tree))
    assert.ok(marked.includes(`${n.kind === "term" ? "term" : "op"}=${n.id}`));
  const diffusivity = parseEquationRecord(await load("diffusivity"), "diffusivity");
  assert.equal(
    expressionLatex(diffusivity.tree, BROWNIAN_QUANTITIES),
    "D = \\frac{k_B\\,T}{6\\,\\pi\\,\\eta\\,a}",
  );
});
test("missing explanations, invented source ids and mismatched output bindings are rejected", async () => {
  for (const change of [
    (e) => e.notes.pop(),
    (e) => (e.id = "eq-s5-01"),
    (e) => (e.bindings[0].quantityId = "sampleRms"),
    (e) => (e.bindings[0].outputId = "sampleRms"),
    (e) => (e.bindings[0].instanceSlot = "first-found"),
    (e) => e.bindings.push(e.bindings[0]),
    (e) => (e.sentence[0].nodeId = "absent"),
    (e) => (e.review = "reviewed"),
  ]) {
    const e = await load("rms");
    change(e);
    assert.throws(() => parseEquationRecord(e, "test"));
  }
});
test("equation references fail closed when the argument or foundation does not exist", async () => {
  const input = await loadReadingFiles(),
    path = "equations/brownian-motion/eq-model-bm-rms.json";
  for (const change of [
    (e) => (e.argument = "arg-bm-absent"),
    (e) => (e.notes[0].foundation = "absent-foundation"),
  ]) {
    const revised = input.map((f) => {
      if (f.path !== path) return f;
      const e = JSON.parse(f.text);
      change(e);
      return { ...f, text: JSON.stringify(e) };
    });
    const result = compileReadingContent(revised);
    assert.equal(result.ok, false);
  }
});
test("keyboard traversal follows expression ancestry and siblings, including nested operations", async () => {
  const e = parseEquationRecord(await load("rms"), "rms"),
    nav = navigationTree(e.tree),
    first = nav[0];
  assert.equal(navigate(nav, null, "ArrowDown"), first.id);
  const left = navigate(nav, first.id, "ArrowDown");
  assert.equal(left, e.tree.left.termId);
  const right = navigate(nav, left, "ArrowRight");
  assert.equal(right, e.tree.right.opId);
  const product = navigate(nav, right, "ArrowDown");
  assert.equal(product, e.tree.right.radicand.opId);
  assert.equal(navigate(nav, product, "ArrowUp"), right);
  assert.equal(navigate(nav, left, "Home"), left);
  assert.equal(navigate(nav, left, "End"), right);
  assert.equal(navigate(nav, product, "Escape"), null);
});
