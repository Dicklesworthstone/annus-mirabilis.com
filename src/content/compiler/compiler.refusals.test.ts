/**
 * Refusal throw site test suite for src/content/compiler/ (am-muyh).
 *
 * Covers 15 reachable refusal throw sites across 6 compiler modules:
 * 1. src/content/compiler/json.ts (3 sites):
 *    - (json.ts:15) invalid-json
 *    - (json.ts:22) file-budget
 *    - (json.ts:24) non-nfc
 * 2. src/content/compiler/checks/registry.ts (1 site):
 *    - (registry.ts:167) check-crashed
 * 3. src/content/compiler/compile.ts (3 sites):
 *    - (compile.ts:186) path-identity
 *    - (compile.ts:272) equation-review-pending
 *    - (compile.ts:282) editorial-review-pending
 * 4. src/content/compiler/quantities.ts (4 sites):
 *    - (quantities.ts:39) invalid-yaml
 *    - (quantities.ts:54) invalid-legacy-spellings
 *    - (quantities.ts:72) invalid-quantities-file
 *    - (quantities.ts:85) invalid-quantity
 * 5. src/content/compiler/loaders.ts (1 site):
 *    - (loaders.ts:263) yaml-parse-error
 * 6. src/content/compiler/compiler.ts (3 sites):
 *    - (compiler.ts:191) path-identity
 *    - (compiler.ts:259) equation-review-pending
 *    - (compiler.ts:272) editorial-review-pending
 *
 * Note on possibly-unreachable guard:
 * - (loaders.ts:265) is a catch-all fallback for non-YamlParseError/non-ContentError
 *   exceptions from parseYamlStrict, unreachable under normal execution within budget.
 *
 * Each test cites its explicit throw site and exercises both an accept and a reject path.
 */

import { beforeEach, describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import {
  type ContentCheck,
  clearRegisteredChecksForTests,
  registerCheck,
  runAllChecks,
} from "./checks/registry.ts";
import { compileReadingContent } from "./compile.ts";
import { compileContent } from "./compiler.ts";
import { ContentError as JsonContentError, parseContentJson } from "./json.ts";
import { ContentError as LoaderContentError, parseContentYaml } from "./loaders.ts";
import { compileLegacySpellingsFile, compileQuantitiesFile } from "./quantities.ts";

const validFoundation = {
  schemaVersion: 1,
  kind: "foundation",
  id: "test-fdn",
  title: "Adding and averaging",
  question: "How do sums and averages relate?",
  summary: "Summing N items and dividing by N gives the arithmetic mean.",
  review: "draft",
  explanation: [
    {
      kind: "paragraph",
      text: "An average distributes the total equally among all contributors.",
    },
  ],
  example: [
    {
      kind: "paragraph",
      text: "Three values: 1, 2, 6 sum to 9; average is 3.",
    },
  ],
  prerequisites: [],
  stoppingPoint: "Count terms and divide.",
  citations: [],
};

const validQuantityYaml = `- id: diffusionCoefficient
  name: Diffusion coefficient
  description: The Stokes-Einstein diffusion coefficient D
  dimensionStatus: declared
  dimension: [2, 0, -1, 0, 0, 0]
  mathematicalKind: scalar
  frame: not-applicable
  colorRole: material
`;

const validEquationText = readFileSync(
  "content/equations/brownian-motion/eq-model-bm-apparent-speed.json",
  "utf8",
);

describe("src/content/compiler/json.ts Refusals", () => {
  test("parseContentJson: (json.ts:15) invalid-json rejects syntax error, accepts valid JSON", () => {
    // Reject: malformed JSON
    expect(() => parseContentJson("{ unquoted_key: 1 }", "test.json")).toThrow(JsonContentError);
    try {
      parseContentJson("{ unquoted_key: 1 }", "test.json");
    } catch (e) {
      expect(e instanceof JsonContentError).toBe(true);
      expect((e as JsonContentError).code).toBe("invalid-json");
    }

    // Accept: valid JSON
    const parsed = parseContentJson('{"valid": true}', "test.json");
    expect(parsed).toEqual({ valid: true });
  });

  test("parseContentJson: (json.ts:22) file-budget rejects payload exceeding 512 KiB, accepts compliant payload", () => {
    // Reject: payload over 512 KiB
    const oversized = " ".repeat(512 * 1024 + 1);
    expect(() => parseContentJson(oversized, "test.json")).toThrow(JsonContentError);
    try {
      parseContentJson(oversized, "test.json");
    } catch (e) {
      expect(e instanceof JsonContentError).toBe(true);
      expect((e as JsonContentError).code).toBe("file-budget");
    }

    // Accept: small compliant payload
    const parsed = parseContentJson('{"size": "small"}', "test.json");
    expect(parsed).toEqual({ size: "small" });
  });

  test("parseContentJson: (json.ts:24) non-nfc rejects decomposed Unicode, accepts precomposed NFC", () => {
    // Reject: decomposed Unicode NFD (e + combining acute)
    const decomposed = '"e\u0301"';
    expect(() => parseContentJson(decomposed, "test.json")).toThrow(JsonContentError);
    try {
      parseContentJson(decomposed, "test.json");
    } catch (e) {
      expect(e instanceof JsonContentError).toBe(true);
      expect((e as JsonContentError).code).toBe("non-nfc");
    }

    // Accept: precomposed Unicode NFC (é)
    const precomposed = '"\u00e9"';
    const parsed = parseContentJson(precomposed, "test.json");
    expect(parsed).toBe("é");
  });
});

describe("src/content/compiler/checks/registry.ts Refusals", () => {
  beforeEach(() => {
    clearRegisteredChecksForTests();
  });

  test("runAllChecks: (registry.ts:167) check-crashed reports crashing checks, accepts cleanly running checks", async () => {
    // Reject: check throws uncaught error
    const explodingCheck: ContentCheck = {
      id: "exploding-check",
      family: "compiler",
      severity: "error",
      run: () => {
        throw new Error("Simulated rule crash in test");
      },
    };
    registerCheck(explodingCheck);

    const context = {
      records: new Map(),
      files: [],
      indexes: {},
    };
    const result = await runAllChecks(context);
    expect(result.passed).toBe(false);
    const crashDiag = result.diagnostics.find((d) => d.code === "check-crashed");
    expect(crashDiag).toBeDefined();
    expect(crashDiag?.rule).toBe("check-crashed");

    // Accept: cleanly running check
    clearRegisteredChecksForTests();
    const healthyCheck: ContentCheck = {
      id: "healthy-check",
      family: "compiler",
      severity: "flag",
      run: ({ report }) => {
        report({ message: "Healthy notice" });
      },
    };
    registerCheck(healthyCheck);
    const cleanResult = await runAllChecks(context);
    expect(cleanResult.diagnostics.some((d) => d.code === "check-crashed")).toBe(false);
  });
});

describe("src/content/compiler/compile.ts Refusals", () => {
  test("compileReadingContent: (compile.ts:186) path-identity rejects record id mismatching file path, accepts matching id", () => {
    // Reject: foundation id does not match path slug
    const mismatchFile = {
      path: "content/foundations/expected-slug.json",
      text: JSON.stringify({
        ...validFoundation,
        id: "mismatched-id",
      }),
    };
    const rejectResult = compileReadingContent([mismatchFile]);
    expect(rejectResult.ok).toBe(false);
    expect(rejectResult.diagnostics.some((d) => d.code === "path-identity")).toBe(true);

    // Accept: foundation id matches path slug
    const matchFile = {
      path: "content/foundations/expected-slug.json",
      text: JSON.stringify({
        ...validFoundation,
        id: "expected-slug",
      }),
    };
    const acceptResult = compileReadingContent([matchFile]);
    expect(acceptResult.diagnostics.some((d) => d.code === "path-identity")).toBe(false);
  });

  test("compileReadingContent: (compile.ts:272) equation-review-pending emits review diagnostic for draft equations, accepts non-equations", () => {
    // Reject/Flag: equation emits equation-review-pending review diagnostic
    const eqFile = {
      path: "content/equations/brownian-motion/eq-model-bm-apparent-speed.json",
      text: validEquationText,
    };
    const eqResult = compileReadingContent([eqFile]);
    expect(eqResult.diagnostics.some((d) => d.code === "equation-review-pending")).toBe(true);

    // Accept: foundation record does not emit equation-review-pending
    const fdnFile = {
      path: "content/foundations/test-fdn.json",
      text: JSON.stringify(validFoundation),
    };
    const fdnResult = compileReadingContent([fdnFile]);
    expect(fdnResult.diagnostics.some((d) => d.code === "equation-review-pending")).toBe(false);
  });

  test("compileReadingContent: (compile.ts:282) editorial-review-pending emits review diagnostic for draft foundation, accepts non-foundation non-argument", () => {
    // Reject/Flag: foundation emits editorial-review-pending review diagnostic
    const fdnFile = {
      path: "content/foundations/test-fdn.json",
      text: JSON.stringify(validFoundation),
    };
    const fdnResult = compileReadingContent([fdnFile]);
    expect(fdnResult.diagnostics.some((d) => d.code === "editorial-review-pending")).toBe(true);

    // Accept: equation record does not emit editorial-review-pending
    const eqFile = {
      path: "content/equations/brownian-motion/eq-model-bm-apparent-speed.json",
      text: validEquationText,
    };
    const eqResult = compileReadingContent([eqFile]);
    expect(eqResult.diagnostics.some((d) => d.code === "editorial-review-pending")).toBe(false);
  });
});

describe("src/content/compiler/quantities.ts Refusals", () => {
  test("compileQuantitiesFile: (quantities.ts:39) invalid-yaml rejects invalid YAML syntax, accepts valid YAML", () => {
    // Reject: duplicate key throws invalid-yaml
    expect(() =>
      compileQuantitiesFile("foo: 1\nfoo: 2\n", "content/quantities/test.yaml", []),
    ).toThrow();
    try {
      compileQuantitiesFile("foo: 1\nfoo: 2\n", "content/quantities/test.yaml", []);
    } catch (e: any) {
      expect(e.code).toBe("invalid-yaml");
    }

    // Accept: valid YAML list
    const valid = compileQuantitiesFile(validQuantityYaml, "content/quantities/test.yaml", []);
    expect(valid.length).toBe(1);
  });

  test("compileLegacySpellingsFile: (quantities.ts:54) invalid-legacy-spellings rejects invalid spelling table, accepts valid mapping", () => {
    // Reject: invalid legacy spellings structure
    expect(() =>
      compileLegacySpellingsFile(
        "invalid_structure: 123\n",
        "content/quantities/legacy-spellings.yaml",
      ),
    ).toThrow();
    try {
      compileLegacySpellingsFile(
        "invalid_structure: 123\n",
        "content/quantities/legacy-spellings.yaml",
      );
    } catch (e: any) {
      expect(e.code).toBe("invalid-legacy-spellings");
    }

    // Accept: valid legacy spellings list
    const valid = compileLegacySpellingsFile(
      "- spelling: lightSpeed\n  canonicalIds: [speedOfLight]\n",
      "content/quantities/legacy-spellings.yaml",
    );
    expect(Array.isArray(valid)).toBe(true);
    expect(valid.length).toBe(1);
  });

  test("compileQuantitiesFile: (quantities.ts:72) invalid-quantities-file rejects YAML mapping instead of list, accepts YAML list", () => {
    // Reject: YAML mapping where a list was expected
    expect(() => compileQuantitiesFile("foo: bar\n", "content/quantities/test.yaml", [])).toThrow();
    try {
      compileQuantitiesFile("foo: bar\n", "content/quantities/test.yaml", []);
    } catch (e: any) {
      expect(e.code).toBe("invalid-quantities-file");
    }

    // Accept: YAML list
    const valid = compileQuantitiesFile(validQuantityYaml, "content/quantities/test.yaml", []);
    expect(valid.length).toBe(1);
  });

  test("compileQuantitiesFile: (quantities.ts:85) invalid-quantity rejects invalid quantity object, accepts valid quantity", () => {
    // Reject: quantity object missing required schema fields
    expect(() =>
      compileQuantitiesFile("- bad_field: true\n", "content/quantities/test.yaml", []),
    ).toThrow();
    try {
      compileQuantitiesFile("- bad_field: true\n", "content/quantities/test.yaml", []);
    } catch (e: any) {
      expect(e.code).toBe("invalid-quantity");
    }

    // Accept: valid quantity record
    const valid = compileQuantitiesFile(validQuantityYaml, "content/quantities/test.yaml", []);
    expect(valid.length).toBe(1);
  });
});

describe("src/content/compiler/loaders.ts Refusals", () => {
  test("parseContentYaml: (loaders.ts:263) yaml-parse-error rejects malformed YAML syntax, accepts valid YAML", () => {
    // Reject: YAML syntax parse error (mapping with invalid unquoted scalar child)
    expect(() => parseContentYaml("key:\n  not a valid mapping line", "test.yaml")).toThrow(
      LoaderContentError,
    );
    try {
      parseContentYaml("key:\n  not a valid mapping line", "test.yaml");
    } catch (e) {
      expect(e instanceof LoaderContentError).toBe(true);
      expect((e as LoaderContentError).code).toBe("yaml-parse-error");
    }

    // Accept: valid YAML syntax
    const valid = parseContentYaml("key: value", "test.yaml");
    expect(valid).toEqual({ key: "value" });
  });
});

describe("src/content/compiler/compiler.ts Refusals", () => {
  test("compileContent: (compiler.ts:191) path-identity rejects record id mismatching file path parameter, accepts matching id", async () => {
    // Reject: record id does not match path parameter
    const mismatchFile = {
      path: "content/foundations/expected-id.json",
      text: JSON.stringify({
        ...validFoundation,
        id: "different-id",
      }),
    };
    const rejectResult = await compileContent([mismatchFile]);
    expect(rejectResult.ok).toBe(false);
    expect(rejectResult.diagnostics.some((d) => d.code === "path-identity")).toBe(true);

    // Accept: record id matches path parameter
    const matchFile = {
      path: "content/foundations/expected-id.json",
      text: JSON.stringify({
        ...validFoundation,
        id: "expected-id",
      }),
    };
    const acceptResult = await compileContent([matchFile]);
    expect(acceptResult.diagnostics.some((d) => d.code === "path-identity")).toBe(false);
  });

  test("compileContent: (compiler.ts:259) equation-review-pending emits review flag diagnostic for equation, accepts non-equation", async () => {
    // Reject/Flag: equation emits equation-review-pending review flag
    const eqFile = {
      path: "content/equations/brownian-motion/eq-model-bm-apparent-speed.json",
      text: validEquationText,
    };
    const eqResult = await compileContent([eqFile]);
    expect(eqResult.diagnostics.some((d) => d.code === "equation-review-pending")).toBe(true);

    // Accept: foundation record does not emit equation-review-pending
    const fdnFile = {
      path: "content/foundations/test-fdn.json",
      text: JSON.stringify(validFoundation),
    };
    const fdnResult = await compileContent([fdnFile]);
    expect(fdnResult.diagnostics.some((d) => d.code === "equation-review-pending")).toBe(false);
  });

  test("compileContent: (compiler.ts:272) editorial-review-pending emits review flag diagnostic for foundation, accepts non-foundation", async () => {
    // Reject/Flag: foundation emits editorial-review-pending review flag
    const fdnFile = {
      path: "content/foundations/test-fdn.json",
      text: JSON.stringify(validFoundation),
    };
    const fdnResult = await compileContent([fdnFile]);
    expect(fdnResult.diagnostics.some((d) => d.code === "editorial-review-pending")).toBe(true);

    // Accept: equation record does not emit editorial-review-pending
    const eqFile = {
      path: "content/equations/brownian-motion/eq-model-bm-apparent-speed.json",
      text: validEquationText,
    };
    const eqResult = await compileContent([eqFile]);
    expect(eqResult.diagnostics.some((d) => d.code === "editorial-review-pending")).toBe(false);
  });
});
