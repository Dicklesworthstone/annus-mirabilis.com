// The comparison behind the R2 ratchet (src/content/readings/stepsCoverage.ts), tested in the node
// lane on purpose: the ratchet itself runs in the bun lane, and a gate's proof must not live only in
// the lane the gate controls (AGENTS.md). Fixture passages, in both directions.
import assert from "node:assert/strict";
import test from "node:test";
import {
  normaliseLatex,
  proseWords,
  stepsCoverage,
  violates,
} from "../content/readings/stepsCoverage.ts";

const formula = (latex, equations) => ({
  kind: "formula",
  latex,
  spoken: "",
  ...(equations ? { equations } : {}),
});
const para = (text) => ({ kind: "paragraph", text });

test("an R2 that shows R1's formula and says more meets the contract", () => {
  const full = [para("The drift balances diffusion."), formula("D = b\\,RT/N")];
  const steps = [
    para("Write the flux, then set drift equal to diffusion, then solve for D."),
    formula("D = bRT/N"),
  ];
  const c = stepsCoverage(full, steps);
  assert.deepEqual(c.missing, []);
  assert.equal(violates(c), false);
});

test("an R2 without R1's formula violates it, and names the formula", () => {
  const full = [para("The drift balances diffusion."), formula("D = bRT/N", ["eq-model-x"])];
  const steps = [
    para("Write the flux, then set drift equal to diffusion, then solve for the coefficient."),
  ];
  const c = stepsCoverage(full, steps);
  assert.deepEqual(c.missing, ["eq-model-x"]);
  assert.equal(violates(c), true);
});

test("the same equation record, or the same LaTeX as inline math, counts as shown", () => {
  const full = [formula("E = mc^2", ["eq-model-e"]), formula("\\gamma - 1 \\approx \\beta^2/2")];
  const steps = [
    formula("E=mc^{2}", ["eq-model-e"]),
    { kind: "steps", items: ["Expand to second order: \\(\\gamma-1\\approx\\beta^2/2\\)."] },
  ];
  assert.deepEqual(stepsCoverage(full, steps).missing, []);
});

test("an R2 shorter than R1 violates it even with every formula", () => {
  const full = [para("one two three four five six seven eight"), formula("a=b")];
  const steps = [para("one two"), formula("a=b")];
  const c = stepsCoverage(full, steps);
  assert.deepEqual([c.r1Words, c.r2Words, violates(c)], [8, 2, true]);
});

test("words are prose: inline math and an embedded lesson add none", () => {
  // "Let", "and", "be", "given.": the two inline formulas are not words.
  assert.equal(proseWords("Let \\(x = 2\\) and \\(y\\) be given."), 4);
  const full = [para("one two three")];
  const steps = [
    para("one"),
    { kind: "foundation", id: "taylor-expansion", returnCaption: "Back" },
  ];
  assert.equal(stepsCoverage(full, steps).r2Words, 1);
  assert.equal(normaliseLatex("\\left( a \\, + b \\right)."), "(a+b)");
});
