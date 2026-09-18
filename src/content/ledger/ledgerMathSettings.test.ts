import assert from "node:assert/strict";
import test, { describe } from "node:test";
import { parseLedgerMath } from "./ledgerMathSettings.ts";

describe("ledgerMathSettings refusal throw sites (am-muyh)", () => {
  describe("math-macro-definition (ledgerMathSettings.ts:41)", () => {
    test("reject: (ledgerMathSettings.ts:41) macro definition returns math-macro-definition refusal", () => {
      const result = parseLedgerMath("\\def\\myMacro{foo}");
      assert.equal(result.ok, false);
      if (!result.ok) {
        assert.equal(result.code, "math-macro-definition");
        assert.ok(result.error?.includes("Macro definition"));
      }

      const resNew = parseLedgerMath("\\newcommand{\\foo}{bar}");
      assert.equal(resNew.ok, false);
      if (!resNew.ok) {
        assert.equal(resNew.code, "math-macro-definition");
      }
    });

    test("accept: mathematics without macro definitions parses cleanly", () => {
      const result = parseLedgerMath("E = mc^2");
      assert.equal(result.ok, true);
    });
  });

  describe("math-parse (ledgerMathSettings.ts:56)", () => {
    test("reject: (ledgerMathSettings.ts:56) invalid LaTeX syntax returns math-parse refusal", () => {
      const result = parseLedgerMath("\\frac{1}");
      assert.equal(result.ok, false);
      if (!result.ok) {
        assert.equal(result.code, "math-parse");
        assert.ok(result.error && result.error.length > 0);
      }
    });

    test("accept: valid display mathematics parses cleanly", () => {
      const result = parseLedgerMath("\\frac{a}{b} + \\sqrt{c}", true);
      assert.equal(result.ok, true);
    });
  });
});
