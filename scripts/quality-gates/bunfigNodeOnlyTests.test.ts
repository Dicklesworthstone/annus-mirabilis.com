import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
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
  SUBPROCESS_LANE_EXEMPTIONS,
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
      "spawns a subprocess",
    );
  });

  it("classifyTestFileContent ignores comments and non-subprocess tests", () => {
    assert.equal(classifyTestFileContent('// import { chromium } from "playwright";'), null);
    assert.equal(classifyTestFileContent('/*\nimport { chromium } from "playwright";\n*/'), null);
    assert.equal(
      classifyTestFileContent('import assert from "node:assert";\nassert.equal(1, 1);'),
      null,
    );
  });

  /**
   * am-o44v. classifyTestFileContent used to return null for the case below, because the condition
   * carried `&& !code.includes("EBADF")`: a bare substring over the whole file, granting an
   * exemption from a rule about which LANE a test runs in. A comment or a variable name containing
   * those five characters was enough. What it rewarded was worse than what it measured - the code
   * that earns the escape is an early return on EBADF, which makes the test pass having asserted
   * nothing, so a file bought its way into the lane where it fails by carrying the code that hides
   * the failure.
   */
  it("a file is no longer excused from the lane rule by containing the letters EBADF", () => {
    const spawnsAndMentionsEbadf =
      'import { spawnSync } from "node:child_process";\ntry { spawnSync("git"); } catch (err) { if (err?.code === "EBADF") return; }';
    assert.equal(classifyTestFileContent(spawnsAndMentionsEbadf), "spawns a subprocess");
    // and the weakest form of the old escape, a bare comment, which never handled anything
    assert.equal(
      classifyTestFileContent(
        'import { spawnSync } from "node:child_process";\nspawnSync("node");\n// see bunfig: EBADF',
      ),
      "spawns a subprocess",
    );
  });

  /**
   * The list is a ratchet with a pawl: an entry may only exist while it is doing work. Without the
   * second assertion an exemption would outlive the file it excuses, and a stale allowlist entry is
   * how a gate quietly stops covering something.
   */
  it("every subprocess-lane exemption names a real file, carries a reason, and is still needed", () => {
    assert.ok(SUBPROCESS_LANE_EXEMPTIONS.size > 0, "an empty list means the escape is unused");
    for (const [rel, reason] of SUBPROCESS_LANE_EXEMPTIONS) {
      assert.ok(
        existsSync(resolve(process.cwd(), rel)),
        `${rel} is excused from the subprocess lane rule but does not exist`,
      );
      assert.ok(
        reason.trim().length >= 20,
        `${rel} must record WHICH executable it spawns, not merely that it is excused`,
      );
      assert.equal(
        classifyTestFileContent(readFileSync(resolve(process.cwd(), rel), "utf8")),
        "spawns a subprocess",
        `${rel} is no longer flagged by the rule, so its exemption is stale and should be deleted`,
      );
    }
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
