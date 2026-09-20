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
  shouldSkipDirectory,
  spawnTargets,
  verifySubprocessLaneExemption,
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
    for (const [rel, exemption] of SUBPROCESS_LANE_EXEMPTIONS) {
      assert.ok(
        existsSync(resolve(process.cwd(), rel)),
        `${rel} is excused from the subprocess lane rule but does not exist`,
      );
      assert.ok(
        exemption.reason.trim().length >= 20,
        `${rel} must record WHICH executable it spawns, not merely that it is excused`,
      );
      const code = readFileSync(resolve(process.cwd(), rel), "utf8");
      assert.equal(
        classifyTestFileContent(code),
        "spawns a subprocess",
        `${rel} is no longer flagged by the rule, so its exemption is stale and should be deleted`,
      );
      assert.equal(
        verifySubprocessLaneExemption(rel, code, exemption),
        null,
        `${rel}'s exemption is not supported by what the file actually spawns`,
      );
    }
  });

  /**
   * The enforcement and its limit, stated as tests rather than as prose.
   *
   * A literal executable is decidable, so it IS decided: three of the five entries are "checked"
   * and a change to a node child fails. process.execPath is NOT decidable - the same expression is
   * node under node and bun under bun - so those entries are labelled "unverifiable" and their
   * reasons read as the human claims they are. The label cannot be used to dodge the check in
   * either direction.
   */
  it("a literal node child is refused however the exemption is labelled", () => {
    const spawnsNode =
      'import { spawnSync } from "node:child_process";\nspawnSync("node", ["--test", "x.ts"]);';
    for (const basis of ["checked", "unverifiable"] as const) {
      const broken = verifySubprocessLaneExemption("x.test.ts", spawnsNode, {
        basis,
        reason: "a reason of entirely sufficient length to pass the length check",
      });
      assert.match(String(broken), /spawns node/);
    }
  });

  it("a runtime-dependent child cannot be labelled checked, and a literal one cannot be labelled unverifiable", () => {
    const execPath =
      'import { spawnSync } from "node:child_process";\nspawnSync(process.execPath, ["x.ts"]);';
    const literal = 'import { spawnSync } from "node:child_process";\nspawnSync("bun", ["x.ts"]);';
    const reason = "a reason of entirely sufficient length to pass the length check";
    assert.match(
      String(verifySubprocessLaneExemption("x.test.ts", execPath, { basis: "checked", reason })),
      /cannot resolve/,
    );
    assert.match(
      String(
        verifySubprocessLaneExemption("x.test.ts", literal, { basis: "unverifiable", reason }),
      ),
      /checkable/,
    );
    assert.equal(
      verifySubprocessLaneExemption("x.test.ts", literal, { basis: "checked", reason }),
      null,
    );
    assert.equal(
      verifySubprocessLaneExemption("x.test.ts", execPath, { basis: "unverifiable", reason }),
      null,
    );
  });

  /**
   * Found by planting a real violation in src/content/coverage/coverageLedger.test.ts and watching
   * the gate stay green. SKIP_DIRS was a flat set of names applied at every depth, so a directory
   * called "coverage" was treated as a coverage report wherever it sat. src/content/coverage is a
   * source directory with two test files, and neither this gate nor the node-lane expansion could
   * see them - a file listed in pathIgnorePatterns under it would have been skipped by bun and run
   * by nobody.
   */
  it("a build-output name is skipped at the root and not in the middle of the source tree", () => {
    assert.equal(shouldSkipDirectory("coverage", true), true);
    assert.equal(shouldSkipDirectory("coverage", false), false);
    assert.equal(shouldSkipDirectory("dist", true), true);
    assert.equal(shouldSkipDirectory("dist", false), false);
    // never source directories, so skipped wherever they appear
    assert.equal(shouldSkipDirectory("node_modules", false), true);
    assert.equal(shouldSkipDirectory(".git", false), true);
  });

  it("the walk reaches the test files inside src/content/coverage", () => {
    const expanded = expandIgnorePatternsToTestFiles(["src/content/coverage"], process.cwd());
    assert.ok(
      expanded.includes("src/content/coverage/coverageLedger.test.ts"),
      `the walk did not enter src/content/coverage; it found ${JSON.stringify(expanded)}`,
    );
  });

  it("spawnTargets reads the executable from the syntax, not from the text", () => {
    // the case a substring test gets wrong in both directions
    assert.deepEqual(spawnTargets('execFileSync("git", ["log"]);'), [
      { kind: "literal", executable: "git" },
    ]);
    assert.deepEqual(spawnTargets('// execFileSync("node", [])'), []);
    // authored as a template so the ${...} inside the FIXTURE stays literal source text
    assert.deepEqual(spawnTargets(`execSync(\`bun scripts/x.ts \${flag}\`);`), [
      { kind: "literal", executable: "bun" },
    ]);
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
