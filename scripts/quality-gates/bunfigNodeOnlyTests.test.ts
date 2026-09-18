import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";
import {
  assertNoUnignoredSubprocessTests,
  BUNFIG_RELATIVE_PATH,
  classifyTestFileContent,
  expandIgnorePatternsToTestFiles,
  findUnignoredSubprocessTests,
  formatUnignoredSubprocessTestFailure,
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

  it("classifyTestFileContent detects playwright, axe-core, chromium, and subprocess variants", () => {
    const pw = "play" + "wright";
    const axe = "@axe-core/" + "playwright";
    const pwCore = "playwright" + "-core";

    assert.equal(
      classifyTestFileContent(`import { chromium } from "${pw}";`),
      'imports "playwright"',
    );
    assert.equal(
      classifyTestFileContent(`import {\n  chromium,\n  type Page\n} from "${pw}";`),
      'imports "playwright"',
    );
    assert.equal(
      classifyTestFileContent(`import type { Page } from "${pw}";`),
      'imports "playwright"',
    );
    assert.equal(classifyTestFileContent(`import "${pw}";`), 'imports "playwright"');
    assert.equal(
      classifyTestFileContent(`const pwMod = require("${pw}");`),
      'imports "playwright"',
    );
    assert.equal(
      classifyTestFileContent(`const pwMod = await import("${pw}");`),
      'imports "playwright"',
    );
    assert.equal(
      classifyTestFileContent(`import { AxeBuilder } from "${axe}";`),
      'imports "@axe-core/playwright"',
    );
    assert.equal(
      classifyTestFileContent(`import { chromium } from "${pwCore}";`),
      'imports "playwright-core"',
    );
    assert.equal(
      classifyTestFileContent('import { chromium } from "./browser.js";'),
      "imports chromium",
    );
    assert.equal(
      classifyTestFileContent('import { spawn } from "node:child_process";\nspawn("ls");'),
      "spawns a subprocess without EBADF handling",
    );
  });

  it("classifyTestFileContent ignores comments, non-subprocess tests, and tests handling EBADF", () => {
    assert.equal(classifyTestFileContent('// import { chromium } from "playwright";'), null);
    assert.equal(classifyTestFileContent('/*\nimport { chromium } from "playwright";\n*/'), null);
    assert.equal(
      classifyTestFileContent('import assert from "node:assert";\nassert.equal(1, 1);'),
      null,
    );
    assert.equal(
      classifyTestFileContent(
        'import { spawnSync } from "node:child_process";\ntry { spawnSync("git"); } catch (err) { if (err?.code === "EBADF") return; }',
      ),
      null,
    );
  });

  it("formatUnignoredSubprocessTestFailure formats failure with exact line to add", () => {
    const message = formatUnignoredSubprocessTestFailure([
      {
        file: "src/testing/foo.test.ts",
        reason: 'imports "playwright"',
        lineToAdd: '  "src/testing/foo.test.ts",',
      },
    ]);
    assert.ok(message.includes("src/testing/foo.test.ts"));
    assert.ok(message.includes('imports "playwright"'));
    assert.ok(message.includes('  "src/testing/foo.test.ts",'));
  });

  it("assertNoUnignoredSubprocessTests passes on the live repository tree", () => {
    assert.doesNotThrow(() => assertNoUnignoredSubprocessTests(process.cwd()));
  });

  it("planted negative: simulated missing bunfig entry fails and adding pattern passes", () => {
    const simulatedBunfig = '[test]\npathIgnorePatterns = ["scripts/e2e"]\n';
    const violations = findUnignoredSubprocessTests(process.cwd(), simulatedBunfig, [
      "src/testing/styles",
    ]);
    assert.equal(violations.length, 1);
    const v = violations[0];
    assert.ok(v !== undefined);
    assert.equal(v.file, "src/testing/styles/computedStylesLayout.test.ts");
    assert.equal(v.lineToAdd, '  "src/testing/styles/computedStylesLayout.test.ts",');
    assert.equal(v.reason, 'imports "playwright"');

    const fixedBunfig =
      '[test]\npathIgnorePatterns = ["scripts/e2e", "src/testing/styles/computedStylesLayout.test.ts"]\n';
    const fixedViolations = findUnignoredSubprocessTests(process.cwd(), fixedBunfig, [
      "src/testing/styles",
    ]);
    assert.equal(fixedViolations.length, 0);
  });
});
