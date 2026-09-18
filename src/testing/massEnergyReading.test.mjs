import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { loadReadingFiles } from "../../scripts/build-content.ts";
import { compileContent, compileReadingContent } from "../content/compiler/compile.ts";
import { REGISTERED_IDS } from "../experiments/catalogue.ts";

const files = await loadReadingFiles();
const argumentPath = "arguments/mass-energy/arg-me-import.json";
function withExperiments(experiments) {
  return files.map(file => file.path === argumentPath
    ? { ...file, text: JSON.stringify({ ...JSON.parse(file.text), experiments }) }
    : file);
}

for (const [name, compile] of [["synchronous", compileReadingContent], ["production", compileContent]]) {
  test(`${name}: mass-energy compiles as a second explanatory paper, not a reviewed edition`, async () => {
    const result = await compile(files);
    assert.equal(result.ok, true, JSON.stringify(result.diagnostics.filter(d => d.severity === "error")));
    const payload = result.papers.find(p => p.paper.id === "mass-energy");
    assert.ok(payload);
    assert.equal(payload.paper.status, "explanation-preview");
    assert.equal(payload.paper.sourceStatus, "in-preparation");
    assert.equal(payload.paper.sections.length, 1);
    assert.equal(payload.paper.sections[0].id, "s0");
    assert.equal(payload.arguments.length, 8);
    assert.deepEqual(payload.paper.sections[0].arguments, payload.arguments.map(a => a.id));
    assert.ok(payload.foundations.some(f => f.id === "work-energy"));
    assert.ok(payload.citations.some(c => c.id === "ap-18-639"));
    for (const argument of payload.arguments) {
      assert.equal(argument.review, "draft");
      for (const reading of ["overview", "full", "steps", "margin"]) assert.ok(argument.readings[reading].length);
      assert.ok(argument.premises.length);
      assert.ok(argument.limitations.length);
      assert.ok(argument.experiments.every(id => REGISTERED_IDS.includes(id)));
    }
  });
  for (const id of ["me-99", "avogadro-lab"]) {
    test(`${name}: an unknown or still-planned instrument ${id} cannot be published`, async () => {
      const result = await compile(withExperiments([id]));
      assert.equal(result.ok, false);
      assert.equal(result.papers.length, 0);
      assert.ok(result.diagnostics.some(d => d.code === "unavailable-experiment" && d.message.includes(id)));
    });
  }
}

test("the offset premise, small-speed approximation, signed loss and historical boundary stay separate", async () => {
  const read = async id => JSON.parse(await readFile(new URL(`../../content/arguments/mass-energy/${id}.json`, import.meta.url), "utf8"));
  const premise = await read("arg-me-constant-premise");
  const speed = await read("arg-me-small-speed");
  const change = await read("arg-me-mass-change");
  const scope = await read("arg-me-scope");
  assert.match(JSON.stringify(premise), /C₀|C_0/);
  assert.match(JSON.stringify(premise), /C₁|C_1/);
  assert.equal(speed.meaning.modelStatus, "approximation");
  assert.match(JSON.stringify(speed), /finite-speed.*proxy/i);
  assert.match(JSON.stringify(change), /signed/i);
  assert.match(JSON.stringify(scope), /1906/);
});
