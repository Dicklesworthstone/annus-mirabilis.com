/**
 * Tests for surveySchema refusal throw sites (am-muyh).
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test, { describe } from "node:test";
import { validateSurveyRecord } from "./surveySchema.ts";

describe("surveySchema refusal throw sites (am-muyh)", () => {
  const fixturePath = resolve(process.cwd(), "docs/provenance/survey/ap-17-549.md");
  const validRecord = readFileSync(fixturePath, "utf8");

  test("refusal (surveySchema.ts:327): survey-front-matter rejects text without front matter delimiters", () => {
    // Accept: valid survey record with front matter
    const accepted = validateSurveyRecord(validRecord, "docs/provenance/survey/ap-17-549.md");
    assert.equal(accepted.ok, true);
    assert.equal(accepted.data?.key, "ap-17-549");

    // Reject: text without --- delimiters
    const rejected = validateSurveyRecord("No front matter delimiters here", "test.md");
    assert.equal(rejected.ok, false);
    const diag = rejected.diagnostics.find((d) => d.rule === "survey-front-matter");
    assert.ok(diag);
    assert.equal(diag?.severity, "error");
    assert.match(diag?.message, /must begin with YAML front matter/);
  });

  test("refusal (surveySchema.ts:359): survey-yaml-syntax rejects malformed YAML in front matter", () => {
    // Accept: valid record
    const accepted = validateSurveyRecord(validRecord, "docs/provenance/survey/ap-17-549.md");
    assert.equal(accepted.ok, true);

    // Reject: malformed YAML syntax (unquoted non-mapping lines)
    const malformed = "---\nfoo\nbar\n---\nBody";
    const rejected = validateSurveyRecord(malformed, "test.md");
    assert.equal(rejected.ok, false);
    const diag = rejected.diagnostics.find((d) => d.rule === "survey-yaml-syntax");
    assert.ok(diag);
    assert.equal(diag?.severity, "error");
    assert.match(diag?.message ?? "", /YAML Parse Error/);
  });
});
