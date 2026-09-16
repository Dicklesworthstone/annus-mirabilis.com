import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
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

  it("nodeOnlyTestArgs always includes scripts/e2e and the bunfig-expanded files", () => {
    const args = nodeOnlyTestArgs(
      `pathIgnorePatterns = ["scripts/check-receipts.e2e.test.ts", "scripts/quality-gates.test.ts"]`,
      process.cwd(),
    );
    assert.equal(args[0], "scripts/e2e/**/*.test.ts");
    assert.equal(args.includes("scripts/quality-gates.test.ts"), true);
    assert.equal(args.includes("scripts/check-receipts.e2e.test.ts"), true);
  });

  it("every file matched by bunfig's pathIgnorePatterns appears in the node-only arg list", () => {
    const bunfigText = `pathIgnorePatterns = [
      "scripts/check-receipts.e2e.test.ts",
      "scripts/generateQuantityIds.e2e.test.ts",
      "scripts/ocr-ledgers.e2e.test.ts",
      "scripts/quality-gates.test.ts",
      "scripts/summarize-test-logs.e2e.test.ts",
      "scripts/e2e/**/*.test.ts"
    ]`;
    const patterns = parsePathIgnorePatterns(bunfigText);
    const ignoredFiles = expandIgnorePatternsToTestFiles(patterns, process.cwd());
    const args = nodeOnlyTestArgs(bunfigText, process.cwd());
    const coveredByArgs = expandIgnorePatternsToTestFiles(args, process.cwd());
    for (const file of ignoredFiles) {
      assert.ok(
        coveredByArgs.includes(file),
        `File ${file} is ignored by bunfig but missing from node-only test execution`,
      );
    }
    assert.ok(ignoredFiles.length >= 17, `Expected at least 17 ignored files, found ${ignoredFiles.length}`);
  });
});
