import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { FIELD_ORDER, AGENTS_MD_SUITE_LOG_PATH_PATTERN } from "./schema.ts";

const AGENTS_MD_PATH = path.join(process.cwd(), "AGENTS.md");

/**
 * `comparisonKind`'s own enum values appear as backtick-quoted tokens right
 * beside the real field names in the "Structured logs" paragraph. They are
 * values, not fields, and must not be checked against the field schema.
 */
const KNOWN_NON_FIELD_VALUE_TOKENS = new Set(["bitwise", "formatted"]);

function extractStructuredLogsParagraph(agentsMdText: string): string {
  const marker = "**Structured logs.**";
  const start = agentsMdText.indexOf(marker);
  if (start === -1) throw new Error('Could not find the "Structured logs." paragraph in AGENTS.md.');
  const end = agentsMdText.indexOf("\n", start);
  if (end === -1) throw new Error('The "Structured logs." paragraph never terminates before end of file.');
  return agentsMdText.slice(start, end);
}

function extractSuiteLogPathPattern(paragraph: string): string {
  const match = paragraph.match(/writes JSON lines to `([^`]+)`/);
  if (!match) throw new Error('Could not find the suite log path pattern in the "Structured logs." paragraph.');
  return match[1]!;
}

/** Every plausible field-name-shaped backtick token in the paragraph, in order of first appearance. */
function extractFieldNameTokens(paragraph: string): string[] {
  const tokens: string[] = [];
  const seen = new Set<string>();
  for (const match of paragraph.matchAll(/`([a-zA-Z][a-zA-Z0-9]*)`/g)) {
    const token = match[1]!;
    if (KNOWN_NON_FIELD_VALUE_TOKENS.has(token) || seen.has(token)) continue;
    seen.add(token);
    tokens.push(token);
  }
  return tokens;
}

/**
 * Fails if a field named in an AGENTS.md "Structured logs" paragraph is
 * missing from the schema's field set. This is the load-bearing check: it is
 * exercised both against the real AGENTS.md text and against a fabricated
 * fixture paragraph in the test below, so a schema/document drift is always
 * a build failure, never a silent gap.
 */
function assertParagraphFieldsAreInSchema(paragraph: string, knownFields: ReadonlySet<string>): void {
  for (const field of extractFieldNameTokens(paragraph)) {
    if (!knownFields.has(field)) {
      throw new Error(`AGENTS.md's "Structured logs" paragraph names field "${field}", which is missing from the logging schema.`);
    }
  }
}

test('every field named in AGENTS.md\'s "Structured logs" paragraph exists in the schema', () => {
  const agentsMd = readFileSync(AGENTS_MD_PATH, "utf8");
  const paragraph = extractStructuredLogsParagraph(agentsMd);
  const knownFields = new Set<string>(FIELD_ORDER);
  assertParagraphFieldsAreInSchema(paragraph, knownFields);

  const fields = extractFieldNameTokens(paragraph);
  assert.ok(fields.includes("timestamp"));
  assert.ok(fields.includes("logRunId"));
  assert.ok(fields.includes("toolRunId"));
  assert.ok(fields.includes("runId"));
  assert.ok(fields.includes("seed"));
  assert.ok(fields.includes("comparisonKind"));
  assert.ok(fields.length >= 25, `expected at least 25 distinct fields named in the paragraph, found ${fields.length}`);
});

test('the path pattern in AGENTS.md matches artifacts/test-logs/<suite>/<log-run-id>.jsonl', () => {
  const agentsMd = readFileSync(AGENTS_MD_PATH, "utf8");
  const paragraph = extractStructuredLogsParagraph(agentsMd);
  const pathPattern = extractSuiteLogPathPattern(paragraph);
  assert.equal(pathPattern, AGENTS_MD_SUITE_LOG_PATH_PATTERN);
  assert.equal(pathPattern, "artifacts/test-logs/<suite>/<log-run-id>.jsonl");
});

test("a fixture paragraph naming a field absent from the schema fails, naming that field", () => {
  const fixtureParagraph =
    "**Structured logs.** Every test suite writes JSON lines to `artifacts/test-logs/<suite>/<log-run-id>.jsonl` with `timestamp`, `suite`, `logRunId`, `testId`, and `bogusField`.";
  const knownFields = new Set<string>(FIELD_ORDER);
  assert.throws(
    () => assertParagraphFieldsAreInSchema(fixtureParagraph, knownFields),
    /bogusField/,
  );
});

test("a fixture paragraph naming only real schema fields passes", () => {
  const fixtureParagraph =
    "**Structured logs.** Every test suite writes JSON lines to `artifacts/test-logs/<suite>/<log-run-id>.jsonl` with `timestamp`, `suite`, `logRunId`, `testId`, and `message`.";
  const knownFields = new Set<string>(FIELD_ORDER);
  assert.doesNotThrow(() => assertParagraphFieldsAreInSchema(fixtureParagraph, knownFields));
});
