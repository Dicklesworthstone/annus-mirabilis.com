/**
 * Unit tests for authored LaTeX exception conversion and validation (am-eq-latex-generation-hc3).
 *
 * Implements Criterion 8:
 * 1. Valid exception converts to \\htmlData and \\htmlClass correctly.
 * 2. Unmarked bound glyph is rejected.
 * 3. Unknown ID is rejected when allowedIds is specified.
 * 4. Duplicate marker is rejected.
 * 5. Raw \\htmlData is strictly rejected (at root, inside subscripts, inside \\text{}).
 * 6. Marker body with extra payload is rejected.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { AuthoredLatexError, convertAuthoredLatex } from "./authored.ts";

test("authored.test: valid authored exception converts to HTML markup", () => {
  const input = "\\amterm{t_E}{\\lambda_x} = \\sqrt{2\\,\\amterm{t_D}{D}\\,\\amterm{t_t}{t}}";
  const result = convertAuthoredLatex(input, {
    rolesById: {
      t_E: "result",
      t_D: "constant",
      t_t: "input",
    },
  });

  assert.ok(result.latex.includes('\\htmlData{term=t_E}{\\htmlClass{am-role-result}{\\lambda_x}}'));
  assert.ok(result.latex.includes('\\htmlData{term=t_D}{\\htmlClass{am-role-constant}{D}}'));
  assert.ok(result.latex.includes('\\htmlData{term=t_t}{\\htmlClass{am-role-input}{t}}'));
  assert.deepEqual(result.termIds, ["t_E", "t_D", "t_t"]);
});

test("authored.test: unmarked bound glyph fails validation", () => {
  const input = "\\amterm{t1}{x} + y";
  assert.throws(
    () => {
      convertAuthoredLatex(input, {
        expectedTermIds: ["t1", "t2_missing"],
      });
    },
    (err: unknown) => {
      assert.ok(err instanceof AuthoredLatexError);
      assert.equal(err.kind, "unmarked-bound-glyph");
      assert.match(err.message, /t2_missing/);
      return true;
    },
  );
});

test("authored.test: unknown ID is rejected against allowedIds", () => {
  const input = "\\amterm{t_unknown}{x}";
  assert.throws(
    () => {
      convertAuthoredLatex(input, {
        allowedIds: new Set(["t1", "t2"]),
      });
    },
    (err: unknown) => {
      assert.ok(err instanceof AuthoredLatexError);
      assert.equal(err.kind, "unknown-id");
      assert.match(err.message, /t_unknown/);
      return true;
    },
  );
});

test("authored.test: duplicate marker is rejected", () => {
  const input = "\\amterm{t1}{x} + \\amterm{t1}{z}";
  assert.throws(
    () => convertAuthoredLatex(input),
    (err: unknown) => {
      assert.ok(err instanceof AuthoredLatexError);
      assert.equal(err.kind, "duplicate-marker");
      assert.match(err.message, /Duplicate marker ID "t1"/);
      return true;
    },
  );
});

test("authored.test: raw \\htmlData in authored input is rejected at root", () => {
  const input = "\\htmlData{term=x}{x} + 1";
  assert.throws(
    () => convertAuthoredLatex(input),
    (err: unknown) => {
      assert.ok(err instanceof AuthoredLatexError);
      assert.equal(err.kind, "raw-htmldata-forbidden");
      assert.match(err.message, /Raw "\\htmlData" is strictly forbidden/);
      return true;
    },
  );
});

test("authored.test: raw \\htmlData inside subscript is rejected", () => {
  const input = "x_{\\htmlData{term=sub}{i}}";
  assert.throws(
    () => convertAuthoredLatex(input),
    (err: unknown) => {
      assert.ok(err instanceof AuthoredLatexError);
      assert.equal(err.kind, "raw-htmldata-forbidden");
      return true;
    },
  );
});

test("authored.test: raw \\htmlData inside \\text{} is rejected", () => {
  const input = "\\text{before \\htmlData{term=in}{txt}}";
  assert.throws(
    () => convertAuthoredLatex(input),
    (err: unknown) => {
      assert.ok(err instanceof AuthoredLatexError);
      assert.equal(err.kind, "raw-htmldata-forbidden");
      return true;
    },
  );
});

test("authored.test: marker body with extra payload is rejected", () => {
  const input = "\\amterm{t1 extra payload}{x}";
  assert.throws(
    () => convertAuthoredLatex(input),
    (err: unknown) => {
      assert.ok(err instanceof AuthoredLatexError);
      assert.equal(err.kind, "malformed-marker-payload");
      assert.match(err.message, /extra payload/);
      return true;
    },
  );
});
