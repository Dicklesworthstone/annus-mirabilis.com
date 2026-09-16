import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { compileReadingContent } from "../content/compiler/compile.ts";
import { validateReadingRecord } from "../content/schemas/reading.ts";

const FOUNDATIONS_DIR = path.resolve("content/foundations");
const CALCULUS_FOUNDATION_IDS = [
  "functions-graphs",
  "derivatives",
  "partial-derivatives",
  "exponentials",
  "logarithms",
] as const;

test("foundCalculus.records: all 5 calculus foundations exist, load, and validate", () => {
  for (const id of CALCULUS_FOUNDATION_IDS) {
    const filePath = path.join(FOUNDATIONS_DIR, `${id}.json`);
    assert.equal(fs.existsSync(filePath), true, `File ${filePath} must exist`);

    const content = fs.readFileSync(filePath, "utf8");
    const parsed = JSON.parse(content);

    const record = validateReadingRecord(parsed, filePath);
    assert.equal(record.kind, "foundation");
    assert.equal(record.id, id);
    assert.ok(record.title.length > 0);
    assert.ok(record.question.length > 0);
    assert.ok(record.summary.length > 0);
    assert.ok(record.stoppingPoint.length > 0);
  }
});

test("foundCalculus.records: prerequisites and dependency graph are properly connected", () => {
  const records = new Map<string, { prerequisites?: string[] }>();
  for (const id of CALCULUS_FOUNDATION_IDS) {
    const filePath = path.join(FOUNDATIONS_DIR, `${id}.json`);
    const content = JSON.parse(fs.readFileSync(filePath, "utf8"));
    records.set(id, content);
  }

  // derivatives requires functions-graphs
  assert.deepEqual(records.get("derivatives")?.prerequisites, ["functions-graphs"]);

  // partial-derivatives requires derivatives
  assert.deepEqual(records.get("partial-derivatives")?.prerequisites, ["derivatives"]);

  // exponentials requires derivatives
  assert.deepEqual(records.get("exponentials")?.prerequisites, ["derivatives"]);

  // logarithms requires exponentials
  assert.deepEqual(records.get("logarithms")?.prerequisites, ["exponentials"]);
});

test("foundCalculus.records: voice lint rejects 'obviously' or 'clearly'", () => {
  const forbiddenWords = [/\bobviously\b/i, /\bclearly\b/i, /\bsimply\b/i];

  for (const id of CALCULUS_FOUNDATION_IDS) {
    const filePath = path.join(FOUNDATIONS_DIR, `${id}.json`);
    const rawText = fs.readFileSync(filePath, "utf8");

    for (const pattern of forbiddenWords) {
      assert.equal(
        pattern.test(rawText),
        false,
        `Foundation ${id} contains forbidden condescending voice pattern ${pattern}`,
      );
    }
  }
});

import { loadReadingFiles } from "../../scripts/build-content.ts";

test("foundCalculus.records: compiler builds all content including calculus foundations cleanly with 0 errors", async () => {
  const files = await loadReadingFiles();
  const result = compileReadingContent(files);
  const errors = result.diagnostics.filter((d) => d.severity === "error");
  assert.equal(errors.length, 0, `Compiler errors found: ${JSON.stringify(errors)}`);

  const foundIds = new Set(result.foundations.map((f) => f.id));
  for (const id of CALCULUS_FOUNDATION_IDS) {
    assert.equal(foundIds.has(id), true, `Foundation ${id} must be in compiled output`);
  }
});
