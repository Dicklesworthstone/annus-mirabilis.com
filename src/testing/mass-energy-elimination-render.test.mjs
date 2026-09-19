import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";
import { buildMassEnergyElimination } from "../equations/derivations/massEnergyElimination.ts";
import { compileEquation } from "../equations/render.ts";

const dir = new URL("../../content/equations/mass-energy/", import.meta.url);
const equations = await Promise.all((await readdir(dir)).filter(f => f.endsWith(".json")).map(async f => JSON.parse(await readFile(new URL(f, dir), "utf8"))));
const generated = JSON.parse(await readFile(new URL("../generated/mass-energy-elimination.json", import.meta.url), "utf8"));

test("the generated proof is a rendering of the exact five-step certificate", () => {
  const plan = buildMassEnergyElimination(equations);
  assert.deepEqual(generated.certificate, plan.certificate);
  assert.deepEqual(generated.steps, plan.steps);
  assert.deepEqual(generated.premises, plan.premises);
  assert.equal(generated.equations.length, 10);
  assert.match(generated.sourceDigest, /^sha256:[0-9a-f]{64}$/);
  for (const equation of generated.equations) {
    const original = equations.find(e => e.id === equation.id);
    const actual = compileEquation(original);
    for (const field of ["html", "mathml", "plainLatex", "treeDigest", "spoken"]) assert.equal(equation[field], actual[field]);
    assert.equal((equation.mathml.match(/<math\b/g) ?? []).length, 1);
  }
});
