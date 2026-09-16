import assert from "node:assert/strict";
import { existsSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";
import {
  BUNFIG_RELATIVE_PATH,
  expandIgnorePatternsToTestFiles,
  nodeOnlyTestArgs,
  nodeOnlyTestCommand,
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

  it("expandIgnorePatternsToTestFiles correctly expands directory prefixes, globs, and exact paths", () => {
    const fromDir = expandIgnorePatternsToTestFiles(["scripts/e2e"], process.cwd());
    assert.ok(fromDir.includes("scripts/e2e/primitives.test.ts"));
    assert.ok(fromDir.includes("scripts/e2e/lanes.test.ts"));
    assert.ok(fromDir.includes("scripts/e2e/checks/instrumentChecks.test.ts"));

    const fromGlob = expandIgnorePatternsToTestFiles(["**/*.e2e.test.ts"], process.cwd());
    assert.ok(fromGlob.includes("scripts/check-receipts.e2e.test.ts"));
    assert.ok(fromGlob.includes("scripts/generateQuantityIds.e2e.test.ts"));
    assert.ok(fromGlob.includes("scripts/ocr-ledgers.e2e.test.ts"));
    assert.ok(fromGlob.includes("scripts/summarize-test-logs.e2e.test.ts"));
  });

  it("nodeOnlyTestArgs expands all e2e and bunfig-ignored test files without passing bare directories", () => {
    const liveBunfig = readFileSync(resolve(process.cwd(), BUNFIG_RELATIVE_PATH), "utf8");
    const args = nodeOnlyTestArgs(liveBunfig, process.cwd());
    assert.ok(args.includes("scripts/quality-gates.test.ts"));
    assert.ok(args.includes("scripts/check-receipts.e2e.test.ts"));
    assert.ok(args.includes("scripts/generateQuantityIds.e2e.test.ts"));
    assert.ok(args.includes("scripts/ocr-ledgers.e2e.test.ts"));
    assert.ok(args.includes("scripts/summarize-test-logs.e2e.test.ts"));
    assert.ok(args.includes("scripts/e2e/checks/instrumentChecks.test.ts"));
    assert.ok(args.includes("scripts/e2e/checks/pageChecks.test.ts"));
    assert.ok(args.includes("scripts/e2e/primitives.test.ts"));

    // Guard against bare directory arguments that fail node --test
    for (const arg of args) {
      assert.ok(existsSync(arg), `Path must exist: ${arg}`);
      assert.ok(statSync(arg).isFile(), `Argument must be a file, not a directory: ${arg}`);
      assert.ok(
        /\.(test|spec)\.(ts|js|mjs|tsx|jsx)$/.test(arg),
        `Argument must be a test file: ${arg}`,
      );
    }
    assert.ok(args.length >= 19, `Expected at least 19 test files, got ${args.length}`);
  });

  it("every file matched by live bunfig's pathIgnorePatterns appears in the node-only arg list (self-detecting guard)", () => {
    const liveBunfig = readFileSync(resolve(process.cwd(), BUNFIG_RELATIVE_PATH), "utf8");
    const patterns = parsePathIgnorePatterns(liveBunfig);
    const ignoredFiles = expandIgnorePatternsToTestFiles(patterns, process.cwd());
    const args = nodeOnlyTestArgs(liveBunfig, process.cwd());
    assert.ok(ignoredFiles.length > 0, "bunfig must ignore at least one test file");
    for (const file of ignoredFiles) {
      assert.ok(
        args.includes(file),
        `File ${file} is ignored by bunfig.toml pathIgnorePatterns but missing from node-only test execution`,
      );
    }
  });

  it("nodeOnlyTestCommand produces a valid command string", () => {
    const cmd = nodeOnlyTestCommand(["scripts/quality-gates.test.ts"]);
    assert.equal(cmd, "node --experimental-strip-types --test scripts/quality-gates.test.ts");
  });
});
