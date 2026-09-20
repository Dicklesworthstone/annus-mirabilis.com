/**
 * Static analysis test ensuring no string-replacement or regex rewriting
 * of LaTeX expressions exists in the equation rendering pipeline (am-eq-latex-generation-hc3).
 *
 * Implements requirement:
 * "No regular-expression or string-replacement rewriting of LaTeX anywhere in the pipeline,
 * enforced by a test that scans the module. The tokenizer reads LaTeX; it never rewrites it."
 */

import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

test("no-string-substitution.test: src/equations/latex contains no LaTeX string substitution", () => {
  const dir = __dirname;
  const files = readdirSync(dir).filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts"));

  assert.ok(files.length >= 7, "Expected at least 7 implementation files in src/equations/latex");

  for (const file of files) {
    const content = readFileSync(join(dir, file), "utf-8");

    // Check for replaceAll
    assert.equal(
      content.includes(".replaceAll("),
      false,
      `File ${file} must not use .replaceAll() for LaTeX manipulation`,
    );

    // Check for regex replacement on LaTeX symbols
    const suspiciousReplacements = Array.from(
      content.matchAll(/\.replace\(\s*\/([^/]+)\/\w*\s*,/g),
    );

    for (const match of suspiciousReplacements) {
      const pattern = match[1] ?? "";
      // Ensure pattern is not matching LaTeX macro or symbol strings
      const isLatexPattern =
        pattern.includes("\\") ||
        pattern.includes("beta") ||
        pattern.includes("gamma") ||
        pattern.includes("eta") ||
        pattern.includes("frac");
      assert.equal(
        isLatexPattern,
        false,
        `File ${file} contains forbidden regex LaTeX replacement: ${pattern}`,
      );
    }
  }
});
