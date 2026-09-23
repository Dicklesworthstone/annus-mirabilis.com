import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";
import { MASS_ENERGY_QUANTITIES } from "../equations/massEnergyQuantities.ts";
import { compileEquation } from "../equations/render.ts";

const directory = new URL("../../content/equations/mass-energy/", import.meta.url);
const records = await Promise.all(
  (await readdir(directory))
    .filter((p) => p.endsWith(".json"))
    .map(async (p) => JSON.parse(await readFile(new URL(p, directory), "utf8"))),
);

test("every mass-energy equation renders every selectable node and a single semantic MathML tree", () => {
  assert.ok(records.length > 0);
  for (const raw of records) {
    const compiled = compileEquation(raw);
    for (const node of compiled.navigation)
      assert.ok(
        compiled.html.includes(`data-${node.kind === "term" ? "term" : "op"}="${node.id}"`),
        node.id,
      );
    assert.equal((compiled.mathml.match(/<math\b/g) ?? []).length, 1);
    assert.ok(!compiled.mathml.includes("data-term") && !compiled.html.includes("katex-error"));
    for (const term of compiled.terms)
      assert.deepEqual(term.quantity, MASS_ENERGY_QUANTITIES[term.quantityId]);
    assert.deepEqual(compiled, compileEquation(structuredClone(raw)));
  }
});

test("generated payloads remain paper-local and match the actual renderer", async () => {
  const mass = JSON.parse(
    await readFile(new URL("../generated/mass-energy-equations.json", import.meta.url), "utf8"),
  );
  const brownian = JSON.parse(
    await readFile(new URL("../generated/brownian-equations.json", import.meta.url), "utf8"),
  );
  // Each payload holds exactly its own paper's records (counted from the record directories).
  const brownianOnDisk = (
    await readdir(new URL("../../content/equations/brownian-motion/", import.meta.url))
  ).filter((p) => p.endsWith(".json")).length;
  assert.equal(mass.equations.length, records.length);
  assert.equal(brownian.equations.length, brownianOnDisk);
  assert.ok(mass.equations.every((e) => e.paper === "mass-energy"));
  assert.ok(brownian.equations.every((e) => e.paper === "brownian-motion"));
  assert.equal(mass.rendererDigest, brownian.rendererDigest);
  for (const raw of records)
    assert.deepEqual(
      mass.equations.find((e) => e.id === raw.id),
      compileEquation(raw),
    );
});

test("review and malicious marker claims fail before KaTeX can publish them", () => {
  for (const change of [
    (e) => (e.review = "reviewed"),
    (e) => (e.tree.opId += ' onclick="x'),
    (e) => (e.title = '<img src=x onerror="x">'),
    (e) => (e.unitSystem = "normalized"),
  ]) {
    const raw = structuredClone(records[0]);
    change(raw);
    assert.throws(() => compileEquation(raw));
  }
});
