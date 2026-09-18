import { describe, test } from "bun:test";
import assert from "node:assert/strict";
import { parseStrictJson, parseStrictYaml, StrictParseError, strictParse } from "./strictParse.ts";

describe("strictParse schema refusal throw sites (am-muyh)", () => {
  test("strictParse: (strictParse.ts:144) invalid-input raised when parseStrictYaml receives non-string input", () => {
    assert.throws(
      () => parseStrictYaml(null as unknown as string),
      (err) => {
        assert.ok(err instanceof StrictParseError);
        assert.equal(err.code, "invalid-input");
        return true;
      },
    );

    // Accept valid YAML string
    const accepted = parseStrictYaml("key: value");
    assert.deepEqual(accepted, { key: "value" });
  });

  test("strictParse: (strictParse.ts:157) yaml-parse-error raised when parseStrictYaml encounters invalid YAML syntax", () => {
    assert.throws(
      () => parseStrictYaml("hello"),
      (err) => {
        assert.ok(err instanceof StrictParseError);
        assert.equal(err.code, "yaml-parse-error");
        return true;
      },
    );

    // Accept valid YAML syntax
    const accepted = parseStrictYaml("foo: [1, 2, 3]");
    assert.deepEqual(accepted, { foo: [1, 2, 3] });
  });

  test("strictParse: (strictParse.ts:160) yaml-parse-error raised when non-YamlParseError is thrown during YAML parsing", () => {
    const originalSplit = String.prototype.split;
    try {
      String.prototype.split = function (...args) {
        if (typeof this === "string" && this.includes("trigger-non-yaml-error")) {
          throw new Error("Simulated non-YamlParseError failure");
        }
        return Reflect.apply(originalSplit, this, args);
      };

      assert.throws(
        () => parseStrictYaml("trigger-non-yaml-error: true"),
        (err) => {
          assert.ok(err instanceof StrictParseError);
          assert.equal(err.code, "yaml-parse-error");
          assert.ok(err.message.includes("Simulated non-YamlParseError failure"));
          return true;
        },
      );
    } finally {
      String.prototype.split = originalSplit;
    }

    // Accept valid YAML string
    const accepted = parseStrictYaml("safe: true");
    assert.deepEqual(accepted, { safe: true });
  });

  test("strictParse: (strictParse.ts:169) invalid-input raised when parseStrictJson receives non-string input", () => {
    assert.throws(
      () => parseStrictJson(undefined as unknown as string),
      (err) => {
        assert.ok(err instanceof StrictParseError);
        assert.equal(err.code, "invalid-input");
        return true;
      },
    );

    // Accept valid JSON string
    const accepted = parseStrictJson('{"key": "value"}');
    assert.deepEqual(accepted, { key: "value" });
  });

  test("strictParse: (strictParse.ts:178) json-parse-error raised when parseStrictJson encounters malformed JSON", () => {
    assert.throws(
      () => parseStrictJson('{"key": broken}'),
      (err) => {
        assert.ok(err instanceof StrictParseError);
        assert.equal(err.code, "json-parse-error");
        return true;
      },
    );

    // Accept valid JSON string
    const accepted = parseStrictJson('{"valid": true}');
    assert.deepEqual(accepted, { valid: true });
  });

  test("strictParse: (strictParse.ts:191) invalid-input raised when strictParse receives non-string input", () => {
    assert.throws(
      () => strictParse(12345 as unknown as string),
      (err) => {
        assert.ok(err instanceof StrictParseError);
        assert.equal(err.code, "invalid-input");
        return true;
      },
    );

    // Accept valid string
    const accepted = strictParse('{"auto": "json"}', "auto");
    assert.deepEqual(accepted, { auto: "json" });
  });
});
