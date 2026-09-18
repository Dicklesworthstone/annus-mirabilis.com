/**
 * Unit tests for the brace-aware LaTeX tokenizer (am-eq-latex-generation-hc3).
 *
 * Implements Criterion 7:
 * 1. Control words and control symbols at depth 0 and inside braces, subscripts, superscripts, \text{...}, and aligned body.
 * 2. Environment names from \begin{pmatrix} and \end{pmatrix}, and mismatched \end{cases} as typed error.
 * 3. Unbalanced '{', extra '}', and trailing lone backslash with exact offsets.
 * 4. Offsets that point back to the exact source characters.
 * 5. Import scan of src/ ensuring no second LaTeX tokenizer exists.
 */

import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { extname, join } from "node:path";
import test from "node:test";
import { LatexTokenizerError, tokenizeLatex } from "./tokenize.ts";

test("tokenize.test: control words and control symbols at depth 0 and nested", () => {
  const input = "\\gamma \\, \\left({x_{i} + \\text{ref} + y^{\\alpha}}\\right)";
  const tokens = tokenizeLatex(input);

  const controlWords = tokens.filter((t) => t.kind === "control-word");
  const controlSymbols = tokens.filter((t) => t.kind === "control-symbol");

  assert.ok(controlWords.some((t) => t.value === "\\gamma" && t.depth === 0));
  assert.ok(controlSymbols.some((t) => t.value === "\\," && t.depth === 0));
  assert.ok(controlWords.some((t) => t.value === "\\left" && t.depth === 0));
  assert.ok(controlWords.some((t) => t.value === "\\text" && t.depth === 1));
  assert.ok(controlWords.some((t) => t.value === "\\alpha" && t.depth === 2));

  // Verify offsets point to exact characters in input
  for (const token of tokens) {
    if (token.kind !== "environment-begin" && token.kind !== "environment-end") {
      assert.equal(
        input.slice(token.offset, token.offset + token.value.length),
        token.value,
        `Token ${token.value} at offset ${token.offset} must match input slice`,
      );
    }
  }
});

test("tokenize.test: environments \\begin{pmatrix} ... \\end{pmatrix}", () => {
  const input = "\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}";
  const tokens = tokenizeLatex(input);

  const beginToken = tokens.find((t) => t.kind === "environment-begin");
  const endToken = tokens.find((t) => t.kind === "environment-end");

  assert.ok(beginToken);
  assert.equal(beginToken.environmentName, "pmatrix");
  assert.ok(endToken);
  assert.equal(endToken.environmentName, "pmatrix");
});

test("tokenize.test: mismatched environment is a typed error", () => {
  const input = "\\begin{pmatrix} a & b \\end{cases}";
  assert.throws(
    () => tokenizeLatex(input),
    (err: unknown) => {
      assert.ok(err instanceof LatexTokenizerError);
      assert.equal(err.kind, "mismatched-environment");
      assert.match(err.message, /expected \\end\{pmatrix\}, got \\end\{cases\}/);
      return true;
    },
  );
});

test("tokenize.test: unterminated environment is a typed error with offset", () => {
  const input = "\\begin{aligned} x = 1";
  assert.throws(
    () => tokenizeLatex(input),
    (err: unknown) => {
      assert.ok(err instanceof LatexTokenizerError);
      assert.equal(err.kind, "unterminated-environment");
      assert.equal(err.offset, 0);
      assert.match(err.message, /Unterminated environment \\begin\{aligned\}/);
      return true;
    },
  );
});

test("tokenize.test: unbalanced open brace '{' is a typed error with offset", () => {
  const input = "\\frac{a}{b";
  assert.throws(
    () => tokenizeLatex(input),
    (err: unknown) => {
      assert.ok(err instanceof LatexTokenizerError);
      assert.equal(err.kind, "unbalanced-open-brace");
      assert.equal(err.offset, 8); // Offset of the unclosed '{' before 'b'
      return true;
    },
  );
});

test("tokenize.test: extra closing brace '}' is a typed error with offset", () => {
  const input = "\\frac{a}{b}}";
  assert.throws(
    () => tokenizeLatex(input),
    (err: unknown) => {
      assert.ok(err instanceof LatexTokenizerError);
      assert.equal(err.kind, "unbalanced-close-brace");
      assert.equal(err.offset, 11); // Offset of the extra '}'
      return true;
    },
  );
});

test("tokenize.test: trailing lone backslash is a typed error with offset", () => {
  const input = "x + \\";
  assert.throws(
    () => tokenizeLatex(input),
    (err: unknown) => {
      assert.ok(err instanceof LatexTokenizerError);
      assert.equal(err.kind, "trailing-backslash");
      assert.equal(err.offset, 4);
      return true;
    },
  );
});

test("tokenize.test: import scan verifies tokenizeLatex is the only LaTeX tokenizer in src/", () => {
  const rootSrc = join(process.cwd(), "src");

  function scanDir(dir: string): string[] {
    const files: string[] = [];
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      const s = statSync(full);
      if (s.isDirectory()) {
        files.push(...scanDir(full));
      } else if (extname(full) === ".ts" || extname(full) === ".tsx" || extname(full) === ".mjs") {
        files.push(full);
      }
    }
    return files;
  }

  const allSourceFiles = scanDir(rootSrc);
  const suspiciousFiles: string[] = [];

  for (const filePath of allSourceFiles) {
    if (filePath.includes("src/equations/latex/tokenize.ts") || filePath.includes("tokenize.test.ts")) {
      continue;
    }
    // Check if any other file declares a LaTeX tokenizer
    const content = readFileSync(filePath, "utf8");
    if (
      content.includes("function tokenizeLatex") ||
      content.includes("class LatexTokenizer") ||
      content.includes("export function tokenizeTeX") ||
      content.includes("class TeXTokenizer")
    ) {
      suspiciousFiles.push(filePath);
    }
  }

  assert.equal(
    suspiciousFiles.length,
    0,
    `tokenizeLatex must be the only LaTeX tokenizer in src/. Found duplicate in: ${suspiciousFiles.join(", ")}`,
  );
});
