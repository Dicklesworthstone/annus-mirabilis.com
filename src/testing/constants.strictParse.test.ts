import { describe, expect, test } from "bun:test";
import { parseStrictYaml, StrictParseError } from "../content/schemas/strictParse.ts";

describe("constants.strictParse.test.ts: parseStrictYaml rejections", () => {
  test("duplicate key in YAML fails with file label, line, and column", () => {
    const yaml = `
id: duplicate-key-set
era: "1905"
id: duplicate-key-set-second
`;
    try {
      parseStrictYaml(yaml, "test-file.yaml");
      throw new Error("expected throw");
    } catch (e) {
      expect(e).toBeInstanceOf(StrictParseError);
      const err = e as StrictParseError;
      expect(err.code).toMatch(/duplicate-key/);
      expect(err.message).toContain("test-file.yaml");
      expect(typeof err.line).toBe("number");
      expect(typeof err.column).toBe("number");
    }
  });

  test("merge key (<<:) in YAML fails with file label, line, and column", () => {
    const yaml = `
base: &base_anchor
  x: 1
derived:
  <<: *base_anchor
  y: 2
`;
    try {
      parseStrictYaml(yaml, "test-merge.yaml");
      throw new Error("expected throw");
    } catch (e) {
      expect(e).toBeInstanceOf(StrictParseError);
      const err = e as StrictParseError;
      expect(err.code).toBe("yaml-merge-key-forbidden");
      expect(err.message).toContain("test-merge.yaml");
      expect(err.line).toBe(5);
      expect(typeof err.column).toBe("number");
    }
  });

  test("anchor and alias (& and *) fail with file label, line, and column", () => {
    const yaml = `
item: &my_anchor value
ref: *my_anchor
`;
    try {
      parseStrictYaml(yaml, "test-anchor.yaml");
      throw new Error("expected throw");
    } catch (e) {
      expect(e).toBeInstanceOf(StrictParseError);
      const err = e as StrictParseError;
      expect(err.code).toBe("yaml-anchor-alias-forbidden");
      expect(err.message).toContain("test-anchor.yaml");
      expect(typeof err.line).toBe("number");
      expect(typeof err.column).toBe("number");
    }
  });

  test("custom tag (!tag) fails with file label, line, and column", () => {
    const yaml = `
item: !customTag value
`;
    try {
      parseStrictYaml(yaml, "test-tag.yaml");
      throw new Error("expected throw");
    } catch (e) {
      expect(e).toBeInstanceOf(StrictParseError);
      const err = e as StrictParseError;
      expect(err.code).toBe("yaml-custom-tag-forbidden");
      expect(err.message).toContain("test-tag.yaml");
      expect(typeof err.line).toBe("number");
      expect(typeof err.column).toBe("number");
    }
  });

  test("non-NFC text fails with non-nfc-text error", () => {
    // "e\u0301" is decomposed (NFD), "é" (\u00e9) is NFC.
    const nonNfc = "id: test\ntext: cafe\u0301\n";
    try {
      parseStrictYaml(nonNfc, "test-nfc.yaml");
      throw new Error("expected throw");
    } catch (e) {
      expect(e).toBeInstanceOf(StrictParseError);
      const err = e as StrictParseError;
      expect(err.code).toBe("non-nfc-text");
      expect(err.message).toContain("test-nfc.yaml");
    }
  });

  test("clean YAML record parses without error", () => {
    const cleanYaml = `
id: clean-set
era: "1905"
provenance: "Test record"
`;
    const result = parseStrictYaml(cleanYaml, "clean.yaml") as Record<string, unknown>;
    expect(result.id).toBe("clean-set");
    expect(result.era).toBe("1905");
  });
});
