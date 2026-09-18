/**
 * Refusal throw site test suite for rightsVocabulary.ts (am-muyh).
 *
 * Verifies all 14 refusal throw sites in src/content/schemas/rightsVocabulary.ts
 * with accept/reject test pairs, asserting explicit refusal codes, error instances,
 * and error messages, with exact line citations.
 */

import * as bunTest from "bun:test";
import { describe, expect, test } from "bun:test";

interface SpyObject {
  mockReturnValue(value: unknown): SpyObject;
  mockRestore(): void;
}

const spyOn = (
  bunTest as unknown as {
    spyOn(target: unknown, method: string): SpyObject;
  }
).spyOn;

import { existsSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  evaluateExpression,
  loadRightsVocabulary,
  RightsVocabularyError,
  requireGroup,
} from "./rightsVocabulary.ts";
import * as strictParseModule from "./strictParse.ts";

const TEMP_BASE = existsSync("/Volumes/USBNVME16TB/temp_agent_space")
  ? "/Volumes/USBNVME16TB/temp_agent_space"
  : tmpdir();

function createTempVocabFile(yamlContent: string): string {
  const dir = mkdtempSync(path.join(TEMP_BASE, "am-rights-vocab-refusals-"));
  const filePath = path.join(dir, "vocab.yaml");
  writeFileSync(filePath, yamlContent, "utf8");
  return filePath;
}

function baseVocabYaml(overrides: Record<string, string> = {}): string {
  const defaults: Record<string, string> = {
    version: "1",
    rightsStatus: `  - value: public-domain-text\n    definition: Text in public domain.\n    requiredFields: []`,
    publicationDecision: `  - value: publish\n    definition: Publish.\n    requiredFields: []`,
    cloudProcessing: `  - value: permitted\n    definition: Permitted.\n    requiredFields: []`,
    reuseTerms: `  - value: pending-decision\n    definition: Pending.\n    requiredFields: []`,
    constraints: `  - id: test-constraint\n    if: "rights.status == 'public-domain-text'"\n    then: "publicationDecision == 'publish'"\n    message: "Must publish public domain text."`,
  };

  const merged = { ...defaults, ...overrides };
  const lines = [`version: ${merged.version}`];

  for (const cat of [
    "rightsStatus",
    "publicationDecision",
    "cloudProcessing",
    "reuseTerms",
    "constraints",
  ]) {
    const val = merged[cat] ?? "";
    if (val.startsWith("  ")) {
      lines.push(`${cat}:\n${val}`);
    } else {
      lines.push(`${cat}: ${val}`);
    }
  }

  return lines.join("\n");
}

describe("rightsVocabulary.ts refusal throw sites (am-muyh)", () => {
  // --------------------------------------------------------------------------
  // Site 1: line 59 - invalid-category
  // --------------------------------------------------------------------------
  test("rejects non-list category (rightsVocabulary.ts:59)", () => {
    // Reject: category is not a list
    const badFile = createTempVocabFile(baseVocabYaml({ rightsStatus: '"not-a-list"' }));
    expect(() => loadRightsVocabulary(badFile)).toThrow(
      new RightsVocabularyError(
        "invalid-category",
        'rights-vocabulary.yaml: "rightsStatus" must be a list.',
      ),
    );

    // Accept: category is a list
    const goodFile = createTempVocabFile(baseVocabYaml());
    const vocab = loadRightsVocabulary(goodFile);
    expect(vocab.rightsStatus.length).toBe(1);
    expect(vocab.rightsStatus[0]?.value).toBe("public-domain-text");
  });

  // --------------------------------------------------------------------------
  // Site 2: line 70 - invalid-value
  // --------------------------------------------------------------------------
  test("rejects non-kebab-case category value (rightsVocabulary.ts:70)", () => {
    // Reject: category value is not kebab-case
    const badFile = createTempVocabFile(
      baseVocabYaml({
        rightsStatus: `  - value: Invalid_CamelCase_Value\n    definition: Valid def.\n    requiredFields: []`,
      }),
    );
    expect(() => loadRightsVocabulary(badFile)).toThrow(
      new RightsVocabularyError(
        "invalid-value",
        "rights-vocabulary.yaml: rightsStatus[0].value must be a kebab-case string.",
      ),
    );

    // Accept: valid kebab-case value
    const goodFile = createTempVocabFile(
      baseVocabYaml({
        rightsStatus: `  - value: valid-kebab-value\n    definition: Valid def.\n    requiredFields: []`,
      }),
    );
    const vocab = loadRightsVocabulary(goodFile);
    expect(vocab.rightsStatus[0]?.value).toBe("valid-kebab-value");
  });

  // --------------------------------------------------------------------------
  // Site 3: line 76 - duplicate-value
  // --------------------------------------------------------------------------
  test("rejects duplicate value in category (rightsVocabulary.ts:76)", () => {
    // Reject: duplicate value within same category
    const badFile = createTempVocabFile(
      baseVocabYaml({
        rightsStatus: [
          "  - value: public-domain-text",
          "    definition: First def.",
          "    requiredFields: []",
          "  - value: public-domain-text",
          "    definition: Second def.",
          "    requiredFields: []",
        ].join("\n"),
      }),
    );
    expect(() => loadRightsVocabulary(badFile)).toThrow(
      new RightsVocabularyError(
        "duplicate-value",
        'rights-vocabulary.yaml: rightsStatus has a duplicate value "public-domain-text".',
      ),
    );

    // Accept: distinct values in category
    const goodFile = createTempVocabFile(
      baseVocabYaml({
        rightsStatus: [
          "  - value: public-domain-text",
          "    definition: First def.",
          "    requiredFields: []",
          "  - value: public-domain-image",
          "    definition: Second def.",
          "    requiredFields: []",
        ].join("\n"),
      }),
    );
    const vocab = loadRightsVocabulary(goodFile);
    expect(vocab.rightsStatus.length).toBe(2);
  });

  // --------------------------------------------------------------------------
  // Site 4: line 83 - missing-definition
  // --------------------------------------------------------------------------
  test("rejects category entry with empty or missing definition (rightsVocabulary.ts:83)", () => {
    // Reject: empty definition string
    const badFile = createTempVocabFile(
      baseVocabYaml({
        rightsStatus: `  - value: public-domain-text\n    definition: "   "\n    requiredFields: []`,
      }),
    );
    expect(() => loadRightsVocabulary(badFile)).toThrow(
      new RightsVocabularyError(
        "missing-definition",
        'rights-vocabulary.yaml: rightsStatus[0] ("public-domain-text") is missing a definition.',
      ),
    );

    // Accept: non-empty definition
    const goodFile = createTempVocabFile(
      baseVocabYaml({
        rightsStatus: `  - value: public-domain-text\n    definition: "A comprehensive definition."\n    requiredFields: []`,
      }),
    );
    const vocab = loadRightsVocabulary(goodFile);
    expect(vocab.rightsStatus[0]?.definition).toBe("A comprehensive definition.");
  });

  // --------------------------------------------------------------------------
  // Site 5: line 89 - missing-required-fields
  // --------------------------------------------------------------------------
  test("rejects category entry with invalid requiredFields (rightsVocabulary.ts:89)", () => {
    // Reject: non-array requiredFields
    const badFile = createTempVocabFile(
      baseVocabYaml({
        rightsStatus: `  - value: public-domain-text\n    definition: Valid def.\n    requiredFields: "not-a-list"`,
      }),
    );
    expect(() => loadRightsVocabulary(badFile)).toThrow(
      new RightsVocabularyError(
        "missing-required-fields",
        'rights-vocabulary.yaml: rightsStatus[0] ("public-domain-text") is missing a requiredFields list.',
      ),
    );

    // Accept: array of string requiredFields
    const goodFile = createTempVocabFile(
      baseVocabYaml({
        rightsStatus: `  - value: public-domain-text\n    definition: Valid def.\n    requiredFields:\n      - rights.credit`,
      }),
    );
    const vocab = loadRightsVocabulary(goodFile);
    expect(vocab.rightsStatus[0]?.requiredFields).toEqual(["rights.credit"]);
  });

  // --------------------------------------------------------------------------
  // Site 6: line 109 - invalid-constraints
  // --------------------------------------------------------------------------
  test("rejects non-list constraints field (rightsVocabulary.ts:109)", () => {
    // Reject: constraints is not a list
    const badFile = createTempVocabFile(baseVocabYaml({ constraints: '"not-a-list"' }));
    expect(() => loadRightsVocabulary(badFile)).toThrow(
      new RightsVocabularyError(
        "invalid-constraints",
        'rights-vocabulary.yaml: "constraints" must be a list.',
      ),
    );

    // Accept: constraints is a list (even empty)
    const goodFile = createTempVocabFile(baseVocabYaml({ constraints: "[]" }));
    const vocab = loadRightsVocabulary(goodFile);
    expect(vocab.constraints.length).toBe(0);
  });

  // --------------------------------------------------------------------------
  // Site 7: line 120 - missing-constraint-id
  // --------------------------------------------------------------------------
  test("rejects constraint with missing or whitespace id (rightsVocabulary.ts:120)", () => {
    // Reject: constraint id is whitespace
    const badFile = createTempVocabFile(
      baseVocabYaml({
        constraints: `  - id: "   "\n    if: "rights.status == 'public-domain-text'"\n    then: "publicationDecision == 'publish'"\n    message: "Valid message."`,
      }),
    );
    expect(() => loadRightsVocabulary(badFile)).toThrow(
      new RightsVocabularyError(
        "missing-constraint-id",
        "rights-vocabulary.yaml: constraints[0].id is required.",
      ),
    );

    // Accept: constraint with valid id
    const goodFile = createTempVocabFile(
      baseVocabYaml({
        constraints: `  - id: "valid-constraint-id"\n    if: "rights.status == 'public-domain-text'"\n    then: "publicationDecision == 'publish'"\n    message: "Valid message."`,
      }),
    );
    const vocab = loadRightsVocabulary(goodFile);
    expect(vocab.constraints[0]?.id).toBe("valid-constraint-id");
  });

  // --------------------------------------------------------------------------
  // Site 8: line 126 - duplicate-constraint-id
  // --------------------------------------------------------------------------
  test("rejects duplicate constraint id (rightsVocabulary.ts:126)", () => {
    // Reject: duplicate constraint id
    const badFile = createTempVocabFile(
      baseVocabYaml({
        constraints: [
          "  - id: duplicate-id",
          "    if: \"rights.status == 'public-domain-text'\"",
          "    then: \"publicationDecision == 'publish'\"",
          '    message: "First."',
          "  - id: duplicate-id",
          "    if: \"rights.status == 'public-domain-image'\"",
          "    then: \"publicationDecision == 'publish'\"",
          '    message: "Second."',
        ].join("\n"),
      }),
    );
    expect(() => loadRightsVocabulary(badFile)).toThrow(
      new RightsVocabularyError(
        "duplicate-constraint-id",
        'rights-vocabulary.yaml: duplicate constraint id "duplicate-id".',
      ),
    );

    // Accept: unique constraint ids
    const goodFile = createTempVocabFile(
      baseVocabYaml({
        constraints: [
          "  - id: constraint-alpha",
          "    if: \"rights.status == 'public-domain-text'\"",
          "    then: \"publicationDecision == 'publish'\"",
          '    message: "First."',
          "  - id: constraint-beta",
          "    if: \"rights.status == 'public-domain-image'\"",
          "    then: \"publicationDecision == 'publish'\"",
          '    message: "Second."',
        ].join("\n"),
      }),
    );
    const vocab = loadRightsVocabulary(goodFile);
    expect(vocab.constraints.length).toBe(2);
  });

  // --------------------------------------------------------------------------
  // Site 9: line 133 - malformed-constraint
  // --------------------------------------------------------------------------
  test("rejects constraint with non-string clauses (rightsVocabulary.ts:133)", () => {
    // Reject: if is not a string
    const badFile = createTempVocabFile(
      baseVocabYaml({
        constraints: `  - id: constraint-malformed\n    if: 123\n    then: "publicationDecision == 'publish'"\n    message: "Message."`,
      }),
    );
    expect(() => loadRightsVocabulary(badFile)).toThrow(
      new RightsVocabularyError(
        "malformed-constraint",
        'rights-vocabulary.yaml: constraint "constraint-malformed" must carry string "if", "then", and "message" fields.',
      ),
    );

    // Accept: if, then, message are strings
    const goodFile = createTempVocabFile(
      baseVocabYaml({
        constraints: `  - id: constraint-wellformed\n    if: "rights.status == 'public-domain-text'"\n    then: "publicationDecision == 'publish'"\n    message: "Message."`,
      }),
    );
    const vocab = loadRightsVocabulary(goodFile);
    expect(vocab.constraints[0]?.thenClause).toBe("publicationDecision == 'publish'");
  });

  // --------------------------------------------------------------------------
  // Site 10: line 152 - invalid-file
  // --------------------------------------------------------------------------
  test("rejects vocabulary file that does not parse to an object (rightsVocabulary.ts:152)", () => {
    // Reject: strictParse returns a non-object scalar
    const spy = spyOn(strictParseModule, "strictParse").mockReturnValue(
      "scalar-string-not-an-object",
    );
    try {
      const tempFile = createTempVocabFile("version: 1\n");
      expect(() => loadRightsVocabulary(tempFile)).toThrow(
        new RightsVocabularyError(
          "invalid-file",
          "rights-vocabulary.yaml must parse to an object.",
        ),
      );
    } finally {
      spy.mockRestore();
    }

    // Accept: file parses to a mapping object
    const goodFile = createTempVocabFile(baseVocabYaml());
    const vocab = loadRightsVocabulary(goodFile);
    expect(typeof vocab).toBe("object");
  });

  // --------------------------------------------------------------------------
  // Site 11: line 158 - missing-version
  // --------------------------------------------------------------------------
  test("rejects vocabulary file with missing or non-number version (rightsVocabulary.ts:158)", () => {
    // Reject: version is a string instead of number
    const badFile = createTempVocabFile(baseVocabYaml({ version: '"version-one"' }));
    expect(() => loadRightsVocabulary(badFile)).toThrow(
      new RightsVocabularyError(
        "missing-version",
        'rights-vocabulary.yaml: "version" must be a number.',
      ),
    );

    // Accept: version is a number
    const goodFile = createTempVocabFile(baseVocabYaml({ version: "2" }));
    const vocab = loadRightsVocabulary(goodFile);
    expect(vocab.version).toBe(2);
  });

  // --------------------------------------------------------------------------
  // Site 12: line 224 - unsupported-expression (requireGroup)
  // --------------------------------------------------------------------------
  test("rejects missing capture group in requireGroup (rightsVocabulary.ts:224)", () => {
    // Reject: regex match array missing expected group index
    const mockMatch = ["full-match"] as unknown as RegExpExecArray;
    expect(() => requireGroup(mockMatch, 5, "raw-expression")).toThrow(
      new RightsVocabularyError(
        "unsupported-expression",
        'rights-vocabulary.yaml: could not extract a required capture group from "raw-expression".',
      ),
    );

    // Accept: valid capture group present
    const validMatch = /foo-(\w+)/.exec("foo-bar");
    if (!validMatch) throw new Error("Expected regex match");
    const group = requireGroup(validMatch, 1, "foo-bar");
    expect(group).toBe("bar");
  });

  // --------------------------------------------------------------------------
  // Site 13: line 240 - unsupported-expression (parseList)
  // --------------------------------------------------------------------------
  test("rejects unquoted list element in 'in [...]' clause (rightsVocabulary.ts:240)", () => {
    // Reject: unquoted list element in 'in [...]' clause
    expect(() =>
      evaluateExpression("rights.status in [unquoted_value]", {
        rights: { status: "unquoted_value" },
      }),
    ).toThrow(
      new RightsVocabularyError(
        "unsupported-expression",
        'rights-vocabulary.yaml: unrecognized list element "unquoted_value" in an "in [...]" clause.',
      ),
    );

    // Accept: properly single-quoted list elements in 'in [...]' clause
    const accepted = evaluateExpression(
      "rights.status in ['public-domain-text', 'public-domain-image']",
      { rights: { status: "public-domain-text" } },
    );
    expect(accepted).toBe(true);
  });

  // --------------------------------------------------------------------------
  // Site 14: line 278 - unsupported-expression (parseClause)
  // --------------------------------------------------------------------------
  test("rejects unrecognized constraint clause syntax (rightsVocabulary.ts:278)", () => {
    // Reject: unsupported operator/syntax in clause
    expect(() =>
      evaluateExpression("rights.status ~= 'public-domain-text'", {
        rights: { status: "public-domain-text" },
      }),
    ).toThrow(
      new RightsVocabularyError(
        "unsupported-expression",
        "rights-vocabulary.yaml: unrecognized constraint clause \"rights.status ~= 'public-domain-text'\".",
      ),
    );

    // Accept: supported comparison syntax
    const accepted = evaluateExpression("rights.status == 'public-domain-text'", {
      rights: { status: "public-domain-text" },
    });
    expect(accepted).toBe(true);
  });
});
