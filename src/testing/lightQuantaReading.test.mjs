import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { loadReadingFiles } from "../../scripts/build-content.ts";
import { compileContent, compileReadingContent } from "../content/compiler/compile.ts";
import { validateReadingRecord } from "../content/schemas/reading.ts";
import { REGISTERED_IDS } from "../experiments/catalogue.ts";
import { getConstantSet } from "../physics/reference/constants.ts";
import { kMaxEv, quantumRate, stoppingPotentialFromEv } from "../physics/reference/photoelectric.ts";
import { classicalCutoffEnergyDensity, classicalTotalEnergy } from "../physics/reference/radiation/classical.ts";
import { independentPointsProbability } from "../physics/reference/radiation/configurations.ts";
import { entropyWithUnfixedConstant, radiationEntropyVolumeChange } from "../physics/reference/radiation/entropy.ts";
import { effectiveIndependentCount } from "../physics/reference/radiation/quanta.ts";

const files = await loadReadingFiles();
const path = "arguments/light-quanta/arg-lq-entropy-correspondence.json";
const record = JSON.parse(files.find(f => f.path === path).text);
const modern = getConstantSet("modern-si-2019");
const mutate = change => files.map(f => f.path === path ? { ...f, text: JSON.stringify(change(structuredClone(record))) } : f);

for (const [name, compile] of [["synchronous", compileReadingContent], ["production", compileContent]]) {
  test(`${name}: the introduction and all nine sections compile without claiming a reviewed edition`, async () => {
    const result = await compile(files);
    assert.equal(result.ok, true, JSON.stringify(result.diagnostics.filter(d => d.severity === "error")));
    const payload = result.papers.find(p => p.paper.id === "light-quanta");
    assert.ok(payload);
    assert.equal(payload.paper.status, "explanation-preview");
    assert.equal(payload.paper.sourceStatus, "in-preparation");
    assert.deepEqual(payload.paper.sections.map(s => s.id), Array.from({ length: 10 }, (_, i) => `s${i}`));
    assert.equal(payload.arguments.length, 12);
    assert.deepEqual(payload.paper.sections.flatMap(s => s.arguments), payload.arguments.map(a => a.id));
    assert.ok(payload.citations.some(c => c.id === "ap-17-132"));
    assert.ok(payload.foundations.some(f => f.id === "entropy-temperature"));
    const used = [...new Set(payload.arguments.flatMap(a => a.experiments))].sort();
    assert.deepEqual(used, Array.from({ length: 9 }, (_, i) => `lq-0${i + 1}`));
    for (const argument of payload.arguments) {
      assert.equal(argument.review, "draft");
      assert.ok(argument.premises.length && argument.limitations.length);
      for (const reading of ["overview", "full", "steps", "margin"]) assert.ok(argument.readings[reading].length);
      assert.ok(argument.experiments.every(id => REGISTERED_IDS.includes(id)));
      for (const dependency of argument.prerequisites) assert.ok(payload.arguments.some(a => a.id === dependency.id));
    }
  });
  for (const [label, change, code] of [
    ["unsupported laboratory", a => ({ ...a, experiments: ["avogadro-lab"] }), "unavailable-experiment"],
    ["circular derivation", a => ({ ...a, prerequisites: [{ id: a.id, edge: "premise" }] }), "premise-cycle"],
    ["missing foundation", a => ({ ...a, help: { ...a.help, why: "not-a-foundation" } }), "unresolved-reference"],
  ]) {
    test(`${name}: ${label} cannot publish a plausible incomplete reader`, async () => {
      const result = await compile(mutate(change));
      assert.equal(result.ok, false);
      assert.equal(result.papers.length, 0);
      assert.ok(result.diagnostics.some(d => d.severity === "error"), code);
    });
  }
}

test("the coefficient correspondence has a distinct heuristic role and rejects an invented role", () => {
  assert.equal(validateReadingRecord(record, path).meaning.logicalRole, "heuristic-inference");
  assert.equal(record.meaning.modelStatus, "approximation");
  assert.throws(() => validateReadingRecord({ ...record, meaning: { ...record.meaning, logicalRole: "empirically-proven" } }, path));
});

test("the spectral glyph extension admits rho but not executable TeX", () => {
  const change = latex => ({ ...record, readings: { ...record.readings, full: [{ kind: "formula", latex, spoken: "A test relation." }] } });
  assert.doesNotThrow(() => validateReadingRecord(change(String.raw`\rho_\nu=A\nu^3`), path));
  for (const latex of [String.raw`\href{https://example.com}{x}`, String.raw`\htmlClass{foo}{x}`, String.raw`\def\x{1}`]) {
    assert.throws(() => validateReadingRecord(change(latex), path));
  }
});

test("worked cutoff comparison uses the actual owner: doubling cutoff multiplies total by eight", () => {
  const a = classicalCutoffEnergyDensity(1e14, 300, modern);
  const b = classicalCutoffEnergyDensity(2e14, 300, modern);
  assert.equal(a.status, "value");
  assert.equal(b.status, "value");
  assert.equal(b.value / a.value, 8);
  assert.notEqual(classicalTotalEnergy(300, modern).status, "value");
});

test("the four-point example is one in sixteen, not the locked-position one in two", () => {
  assert.equal(independentPointsProbability(4, 0.5).value, 1 / 16);
  assert.equal(independentPointsProbability(1, 0.5).value, 1 / 2);
});

test("volume doubling and the unfixed constant retain the actual entropy owner's meaning", () => {
  const p = { E: 1e-14, nu: 6e14, dNu: 1e11, V0: 1, V: 2 };
  const a = radiationEntropyVolumeChange(p, modern);
  const b = radiationEntropyVolumeChange({ ...p, V0: 2, V: 4 }, modern);
  assert.equal(a.status, "value");
  assert.equal(b.status, "value");
  assert.ok(Math.abs(a.deltaS / b.deltaS - 1) < 1e-12);
  const c = entropyWithUnfixedConstant({ ...p, C: 1e-30 }, modern);
  assert.equal(c.extraTerm, p.dNu * 1e-30 * (p.V - p.V0));
  assert.notEqual(c.deltaSWithC, c.deltaS);
  assert.equal(radiationEntropyVolumeChange({ ...p, V: 1e-20 }, modern).status, "outside-domain");
});

test("an effective coefficient is not rounded to an integer packet count", () => {
  const nu = 6e14;
  const energy = 2.5 * 6.62607015e-34 * nu;
  assert.ok(Math.abs(effectiveIndependentCount(energy, nu, modern).count - 2.5) < 1e-12);
});

test("the authored 600 THz example agrees with the real photoelectric owner", () => {
  const energy = kMaxEv(6e14, 2, modern);
  assert.equal(energy.status, "value");
  assert.ok(Math.abs(energy.value - 0.481400618154315) < 1e-12);
  const one = quantumRate(1, 6e14, modern);
  const two = quantumRate(2, 6e14, modern);
  assert.equal(one.status, "value");
  assert.equal(two.status, "value");
  assert.equal(two.value / one.value, 2);
  assert.equal(stoppingPotentialFromEv(1e14, 2, modern).status, "not-applicable");
});

test("all laboratory links from the existing light-quanta pages land on a compiled section", async () => {
  const result = compileReadingContent(files);
  const sections = new Set(result.papers.find(p => p.paper.id === "light-quanta").paper.sections.map(s => s.id));
  for (let i = 1; i <= 9; i++) {
    const source = await readFile(new URL(`../app/lab/lq-0${i}/page.tsx`, import.meta.url), "utf8");
    for (const match of source.matchAll(/\/papers\/light-quanta\/(?:#(s\d+)|(s\d+)\/)/g)) {
      assert.ok(sections.has(match[1] ?? match[2]), `lq-0${i}: ${match[0]}`);
    }
  }
});
