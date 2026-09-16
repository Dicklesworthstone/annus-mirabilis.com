import { describe, expect, it } from "bun:test";
import {
  ContentError,
  checkFileSize,
  checkNfc,
  parseContentJson,
  parseContentYaml,
} from "../content/compiler/loaders.ts";
import { getLogger } from "./log/logger.ts";

describe("Loaders & Strict Parsing (am-cm-compiler-core-oa7)", () => {
  const logger = getLogger("content-compiler-tests");

  function logTest(testId: string, outcome: "passed" | "failed", message: string) {
    logger.log({
      testId,
      beadId: "am-cm-compiler-core-oa7",
      outcome,
      message,
    });
  }

  it("rejects YAML with custom tag !!js/function with line number", () => {
    const yaml = "name: test\nfn: !!js/function >\n  function() { return 1; }\n";
    expect(() => parseContentYaml(yaml, "test.yaml")).toThrow(ContentError);
    try {
      parseContentYaml(yaml, "test.yaml");
    } catch (e: unknown) {
      const err = e as ContentError;
      expect(err.code).toBe("yaml-custom-tag");
      expect(err.line).toBe(2);
      expect(err.path).toContain("test.yaml:2");
    }
    logTest("yaml-custom-tag", "passed", "Rejected YAML with custom tag !!js/function");
  });

  it("rejects YAML with anchor and alias", () => {
    const anchorYaml = "default: &def\n  timeout: 10\nservice:\n  timeout: 20\n";
    expect(() => parseContentYaml(anchorYaml, "anchor.yaml")).toThrow(ContentError);
    try {
      parseContentYaml(anchorYaml, "anchor.yaml");
    } catch (e: unknown) {
      const err = e as ContentError;
      expect(err.code).toBe("yaml-anchor-forbidden");
      expect(err.line).toBe(1);
    }

    const aliasYaml = "service:\n  timeout: *def\n";
    expect(() => parseContentYaml(aliasYaml, "alias.yaml")).toThrow(ContentError);
    try {
      parseContentYaml(aliasYaml, "alias.yaml");
    } catch (e: unknown) {
      const err = e as ContentError;
      expect(err.code).toBe("yaml-alias-forbidden");
      expect(err.line).toBe(2);
    }
    logTest("yaml-anchor-alias", "passed", "Rejected YAML anchors and aliases");
  });

  it("rejects YAML with merge key <<:", () => {
    const yaml = "base:\n  x: 1\nderived:\n  <<: *base\n  y: 2\n";
    expect(() => parseContentYaml(yaml, "merge.yaml")).toThrow(ContentError);
    try {
      parseContentYaml(yaml, "merge.yaml");
    } catch (e: unknown) {
      const err = e as ContentError;
      expect(err.code).toBe("yaml-merge-key-forbidden");
      expect(err.line).toBe(4);
    }
    logTest("yaml-merge-key", "passed", "Rejected YAML merge keys (<<:)");
  });

  it("rejects duplicate keys in YAML mappings with line number", () => {
    const yaml = "title: First Title\ntitle: Duplicate Title\n";
    expect(() => parseContentYaml(yaml, "duplicate.yaml")).toThrow(ContentError);
    try {
      parseContentYaml(yaml, "duplicate.yaml");
    } catch (e: unknown) {
      const err = e as ContentError;
      expect(err.code).toBe("duplicate-key");
      expect(err.line).toBe(2);
    }
    logTest("yaml-duplicate-key", "passed", "Rejected duplicate key in YAML");
  });

  it("rejects duplicate keys in JSON with line number", () => {
    const json = '{\n  "title": "First",\n  "title": "Duplicate"\n}';
    expect(() => parseContentJson(json, "duplicate.json")).toThrow(ContentError);
    try {
      parseContentJson(json, "duplicate.json");
    } catch (e: unknown) {
      const err = e as ContentError;
      expect(err.code).toBe("duplicate-key");
    }
    logTest("json-duplicate-key", "passed", "Rejected duplicate key in JSON");
  });

  it("rejects oversized content files (> 512 KiB)", () => {
    const bigString = "x".repeat(600 * 1024);
    expect(() => checkFileSize(bigString.length, "oversized.json")).toThrow(ContentError);
    try {
      checkFileSize(bigString.length, "oversized.json");
    } catch (e: unknown) {
      const err = e as ContentError;
      expect(err.code).toBe("file-budget");
      expect(err.message).toContain("512 KiB");
    }
    logTest("oversized-file", "passed", "Rejected 600 KiB file exceeding 512 KiB cap");
  });

  it("rejects German paragraph written with decomposed NFD characters with line number", () => {
    // Decomposed 'a' + combining diaeresis U+0308 = ä in NFD
    const decomposedA = "a\u0308";
    const text = `Line 1: Normal text\nLine 2: W${decomposedA}rme und Bewegung\nLine 3: End`;
    expect(() => checkNfc(text, "german.txt")).toThrow(ContentError);
    try {
      checkNfc(text, "german.txt");
    } catch (e: unknown) {
      const err = e as ContentError;
      expect(err.code).toBe("non-nfc");
      expect(err.line).toBe(2);
      expect(err.path).toBe("german.txt:2");
      expect(err.message).toContain("line 2");
    }
    logTest("nfd-rejection", "passed", "Rejected decomposed NFD German text with line number");
  });
});
