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

  describe("alignment environments (found transcribing ap-18-639)", () => {
    // `macros: Object.freeze({})` stood in the settings until 2026-09-20. KaTeX writes its
    // own bookkeeping into that object for an environment, so every aligned equation was
    // rejected with `math-parse` and the message "Attempting to define property on object
    // that is not extensible" - which reads as "the editor mistyped the LaTeX". Page 641 of
    // ap-18-639 prints a two-line aligned pair, so no faithful transcription could pass.
    test("accept: a two-line aligned pair, as printed on ap-18-639 page 641", () => {
      const result = parseLedgerMath(
        "\\begin{aligned} H_0 - E_0 &= K_0 + C, \\\\ H_1 - E_1 &= K_1 + C, \\end{aligned}",
        true,
      );
      assert.equal(
        result.ok,
        true,
        `an alignment environment must parse; got ${result.code}: ${result.error}`,
      );
    });

    test("reject: the macro ban still holds INSIDE an alignment environment", () => {
      // The half that proves the repair loosened nothing. If the fix had been to stop
      // refusing macros rather than to stop freezing KaTeX's scratch object, this passes
      // where it must not.
      const result = parseLedgerMath("\\begin{aligned} \\def\\x{1} a &= \\x \\end{aligned}", true);
      assert.equal(result.ok, false);
      assert.equal(result.code, "math-macro-definition");
    });

    test("reject: broken LaTeX inside an alignment environment still fails to parse", () => {
      const result = parseLedgerMath("\\begin{aligned} a &= \\frac{1} \\end{aligned}", true);
      assert.equal(result.ok, false);
      assert.equal(result.code, "math-parse");
    });
  });
});
