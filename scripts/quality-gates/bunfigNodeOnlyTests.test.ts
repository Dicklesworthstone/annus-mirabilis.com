import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";
import {
  BUNFIG_RELATIVE_PATH,
  expandIgnorePatternsToTestFiles,
  nodeOnlyTestArgs,
  parsePathIgnorePatterns,
} from "./bunfigNodeOnlyTests.ts";

describe("bunfigNodeOnlyTests", () => {
  it("refuses a bunfig without pathIgnorePatterns rather than inventing an empty skip list", () => {
    assert.throws(() => parsePathIgnorePatterns('[test]\nroot = "."\n'), /pathIgnorePatterns/);
  });

  it("a basename-only quality-gates.test.ts pattern does not expand, matching bun 1.4.0", () => {
    const files = expandIgnorePatternsToTestFiles(["quality-gates.test.ts"], process.cwd());
    assert.equal(files.includes("scripts/quality-gates.test.ts"), false);
    const withRepoPath = expandIgnorePatternsToTestFiles(
      ["scripts/quality-gates.test.ts"],
      process.cwd(),
    );
    assert.equal(withRepoPath.includes("scripts/quality-gates.test.ts"), true);
  });

  it("**/*.e2e.test.ts expands to every e2e file including ocr-ledgers and brownian", () => {
    const files = expandIgnorePatternsToTestFiles(["**/*.e2e.test.ts"], process.cwd());
    assert.equal(files.includes("scripts/check-receipts.e2e.test.ts"), true);
    assert.equal(files.includes("scripts/generateQuantityIds.e2e.test.ts"), true);
    assert.equal(files.includes("scripts/ocr-ledgers.e2e.test.ts"), true);
    assert.equal(files.includes("scripts/summarize-test-logs.e2e.test.ts"), true);
    assert.equal(files.includes("src/content/editions/brownian.manifest.e2e.test.ts"), true);
  });

  it("nodeOnlyTestArgs expands globs to files node --test can consume", () => {
    const liveBunfig = readFileSync(resolve(process.cwd(), BUNFIG_RELATIVE_PATH), "utf8");
    const args = nodeOnlyTestArgs(liveBunfig, process.cwd());
    assert.equal(args.includes("scripts/e2e"), false);
    for (const arg of args) {
      assert.equal(arg.includes("*"), false, `unexpanded glob leaked into node args: ${arg}`);
    }
    assert.equal(args.includes("scripts/quality-gates.test.ts"), true);
    assert.equal(args.includes("scripts/check-receipts.e2e.test.ts"), true);
    assert.equal(args.includes("scripts/generateQuantityIds.e2e.test.ts"), true);
    assert.equal(args.includes("scripts/ocr-ledgers.e2e.test.ts"), true);
    assert.equal(args.includes("scripts/summarize-test-logs.e2e.test.ts"), true);
    assert.equal(args.includes("src/content/editions/brownian.manifest.e2e.test.ts"), true);
    assert.equal(args.includes("scripts/e2e/checks/instrumentChecks.test.ts"), true);
    assert.equal(args.includes("scripts/e2e/checks/pageChecks.test.ts"), true);
    assert.equal(args.includes("scripts/e2e/primitives.test.ts"), true);
    assert.equal(args.includes("scripts/quality-gates/bunfigNodeOnlyTests.test.ts"), true);
  });

  it("every file matched by live bunfig's pathIgnorePatterns appears in the node-only arg list", () => {
    const liveBunfig = readFileSync(resolve(process.cwd(), BUNFIG_RELATIVE_PATH), "utf8");
    const patterns = parsePathIgnorePatterns(liveBunfig);
    const ignoredFiles = expandIgnorePatternsToTestFiles(patterns, process.cwd());
    const args = nodeOnlyTestArgs(liveBunfig, process.cwd());
    assert.ok(ignoredFiles.length > 0, "bunfig pathIgnorePatterns matched no test files");
    for (const file of ignoredFiles) {
      assert.ok(
        args.includes(file),
        `File ${file} is ignored by bunfig but missing from node-only test execution`,
      );
    }
    assert.equal(ignoredFiles.includes("scripts/ocr-ledgers.e2e.test.ts"), true);
    assert.equal(ignoredFiles.includes("scripts/quality-gates.test.ts"), true);
  });
});
