import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";
import { buildMassEnergyLowSpeed } from "../equations/derivations/massEnergyLowSpeed.ts";
import { renderLowSpeedProof } from "../equations/derivations/renderLowSpeed.ts";
import { compileEquation } from "../equations/render.ts";

const directory = new URL("../../content/equations/mass-energy/", import.meta.url);
const records = await Promise.all(
  (await readdir(directory))
    .filter((p) => p.endsWith(".json"))
    .map(async (p) => JSON.parse(await readFile(new URL(p, directory), "utf8"))),
);
const generated = JSON.parse(
  await readFile(new URL("../generated/mass-energy-low-speed.json", import.meta.url), "utf8"),
);

test("generated low-speed content is the actual checked catalogue and real KaTeX rendering", () => {
  const checked = buildMassEnergyLowSpeed(records),
    rendered = renderLowSpeedProof(checked, records.map(compileEquation));
  const { sourceDigest, ...view } = generated;
  assert.deepEqual(view, rendered);
  assert.match(sourceDigest, /^sha256:[0-9a-f]{64}$/);
  assert.equal(view.equations.length, 5);
  assert.ok(!Object.hasOwn(view.certificate, "normalizedTree"));
  assert.deepEqual(
    view.approximations.map((a) => a.order),
    [2, 4, 6],
  );
  assert.deepEqual(
    view.approximations.map((a) => a.omittedCoefficient),
    ["3/8", "5/16", "35/128"],
  );
  for (const formula of [
    ...view.equations,
    ...view.approximations.map((a) => a.formula),
    view.limit,
    view.factorization,
  ]) {
    assert.equal((formula.mathml.match(/<math\b/g) ?? []).length, 1);
    assert.ok(!formula.html.includes("katex-error"));
    assert.ok(formula.spoken.length > 30);
  }
  for (const approximation of view.approximations) {
    assert.ok(approximation.formula.latex.includes("\\approx"));
    assert.ok(!approximation.formula.latex.includes("="));
  }
  assert.match(view.limit.latex, /\\lim/);
  assert.match(view.factorization.latex, /v\\ne 0/);
  assert.deepEqual(renderLowSpeedProof(checked, records.map(compileEquation)), rendered);
});

test("the renderer refuses a missing canonical source instead of emitting a partial proof", () => {
  const checked = buildMassEnergyLowSpeed(records),
    compiled = records.map(compileEquation);
  for (const id of checked.equationIds)
    assert.throws(() =>
      renderLowSpeedProof(
        checked,
        compiled.filter((e) => e.id !== id),
      ),
    );
});
