import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { test } from "node:test";
import { CATALOGUE_QUESTIONS, CATALOGUE_STATUS, resolveCatalogueAddress } from "../catalogue.ts";
import { assertOwnerBinding } from "../owners.ts";
import { labName } from "../../reader/actions/labNames.ts";
import { SHELF_IDS, SHELF_DEFINITIONS } from "./definition.ts";

for (const id of SHELF_IDS) {
  test(`${id}: registered reference owner, question and accessible link name agree`, () => {
    assert.equal(CATALOGUE_STATUS[id], "registered");
    const binding = assertOwnerBinding(id, CATALOGUE_STATUS[id]);
    assert.equal(binding.kind, "reference-evaluator");
    assert.equal(binding.module, "src/experiments/shelfOptics/evaluation.ts");
    assert.equal(binding.function, "evaluateShelfOptics");
    assert.ok(existsSync(new URL("./evaluation.ts", import.meta.url)));
    assert.equal(CATALOGUE_QUESTIONS[id], SHELF_DEFINITIONS[id].question);
    assert.equal(labName(id), SHELF_DEFINITIONS[id].title);
  });
  test(`${id}: a canonical App Router page mounts the intended comparison`, () => {
    const file = new URL(`../../app/lab/${id}/page.tsx`, import.meta.url);
    assert.ok(existsSync(file));
    const code = readFileSync(file, "utf8");
    assert.match(code, new RegExp(`^  return <ShelfOpticsPage instrumentId="${id}" />;`, "m"));
    assert.match(code, /robots: \{ index: false \}/);
  });
  test(`${id}: registering the explanatory default does not admit a strict 1904 mode`, () => {
    assert.deepEqual(resolveCatalogueAddress(id), { id, mode: null });
    assert.equal(resolveCatalogueAddress(`${id}:1904`).code, "undeclared-mode");
  });
}

test("the instruments index gives optical comparisons their own argument grouping", () => {
  const code = readFileSync(new URL("../../app/instruments/page.tsx", import.meta.url), "utf8");
  assert.match(code, /^    prefix: "shelf-",$/m);
  assert.match(code, /reviewed historical datasets and strict 1904 modes remain in preparation/);
});
