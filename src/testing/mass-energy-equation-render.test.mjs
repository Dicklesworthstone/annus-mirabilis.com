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
  // A payload entry is the renderer's output PLUS the explanation panel the generator attaches
  // (build-equations.ts, through modelExplanations.ts). The panel is authored content, not a render:
  // its words come from the bound display's record or from the equation record's own `sentence` and
  // `explanation`, so compileEquation cannot produce it and never should. Until 2026-09-27 this loop
  // compared the enriched entry with the bare render and went red on all 24 mass-energy records the
  // day the panel landed, which reads as a renderer regression and is not one. So: compare every
  // renderer-owned field exactly, as before, and check the panel separately in both directions.
  let withWords = 0;
  for (const raw of records) {
    const entry = mass.equations.find((e) => e.id === raw.id);
    assert.ok(entry, `no payload entry for ${raw.id}`);
    const { explainer, ...rendered } = entry;
    assert.deepEqual(rendered, compileEquation(raw), raw.id);
    // A record carrying its own words always carries a panel. The converse does not hold: a record
    // with no words of its own still gets one from the printed display it is bound to.
    if (raw.sentence?.length > 0 && raw.explanation?.length > 0) {
      withWords += 1;
      assert.ok(explainer, `${raw.id} has its own sentence and explanation but no panel`);
    }
  }
  // Not vacuous: 24 of 24 mass-energy records carried their own words on 2026-09-27, so the
  // assertion above ran 24 times. A payload whose records had none would satisfy it while proving
  // nothing, which is why the count is checked rather than only reported.
  assert.ok(
    withWords > 0,
    "no mass-energy record carries its own words: the check above was empty",
  );
  // Paper-local, which is this test's name: a panel drawn from the wrong paper's record would light
  // quantities this equation does not bind, and the colours would come from another palette.
  for (const [paper, payload] of [
    ["mass-energy", mass],
    ["brownian-motion", brownian],
  ])
    for (const e of payload.equations) {
      if (!e.explainer) continue;
      assert.equal(e.explainer.paper, paper, `${e.id} panel claims paper ${e.explainer.paper}`);
      assert.equal(
        e.explainer.equation,
        e.id,
        `${e.id} panel claims equation ${e.explainer.equation}`,
      );
      assert.ok(
        Object.values(e.explainer.levels ?? {}).some((v) => String(v ?? "").trim().length > 0) ||
          (e.explainer.inWords ?? []).some((w) => String(w?.text ?? "").trim().length > 0),
        `${e.id} panel has no text at any level`,
      );
    }
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
