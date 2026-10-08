import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { isDsrCheck } from "../../src/testing/dsrChecks.ts";
import {
  assertNoUnignoredSubprocessTests,
  classifyTestFileContent,
  expandIgnorePatternsToTestFiles,
  formatUnignoredSubprocessTestFailure,
  nodeOnlyTestArgs,
  nodeOnlyTestCommand,
  parsePathIgnorePatterns,
} from "./bunfigNodeOnlyTests.ts";

describe("subprocess tests run under node, not bun test", () => {
  const bunfig = readFileSync("bunfig.toml", "utf8");
  const pkg = JSON.parse(readFileSync("package.json", "utf8")) as {
    scripts: Record<string, string>;
  };

  test("bunfig.toml uses the bun 1.4.0 pathIgnorePatterns key with **/ globs", () => {
    const patterns = parsePathIgnorePatterns(bunfig);
    expect(patterns.includes("scripts/e2e")).toBe(true);
    expect(patterns.includes("**/*.e2e.test.ts")).toBe(true);
    expect(patterns.includes("scripts/quality-gates.test.ts")).toBe(true);
    expect(patterns.includes("quality-gates.test.ts")).toBe(false);
  });

  test("bunfig ignore list expands to every e2e file plus quality-gates.test.ts", () => {
    const patterns = parsePathIgnorePatterns(bunfig);
    const files = expandIgnorePatternsToTestFiles(patterns, process.cwd());
    expect(files.includes("scripts/check-receipts.e2e.test.ts")).toBe(true);
    expect(files.includes("scripts/generateQuantityIds.e2e.test.ts")).toBe(true);
    expect(files.includes("scripts/summarize-test-logs.e2e.test.ts")).toBe(true);
    expect(files.includes("scripts/ocr-ledgers.e2e.test.ts")).toBe(true);
    expect(files.includes("src/content/editions/brownian.manifest.e2e.test.ts")).toBe(true);
    expect(files.includes("scripts/quality-gates.test.ts")).toBe(true);
  });

  test("every file matched by bunfig's pathIgnorePatterns appears in the node-only execution set", () => {
    const patterns = parsePathIgnorePatterns(bunfig);
    const ignoredFiles = expandIgnorePatternsToTestFiles(patterns, process.cwd());
    const args = nodeOnlyTestArgs(bunfig, process.cwd());
    expect(ignoredFiles.length).toBeGreaterThan(0);
    for (const file of ignoredFiles) {
      expect(args).toContain(file);
    }
  });

  test("test:node derives expanded files from bunfig so node --test never receives a bare directory", () => {
    const command = pkg.scripts["test:node"];
    expect(command).toBe("node --experimental-strip-types scripts/run-node-only-tests.ts");
    const args = nodeOnlyTestArgs(bunfig, process.cwd());
    expect(args.includes("scripts/e2e")).toBe(false);
    expect(args.some((arg) => arg.includes("*"))).toBe(false);
    expect(args.includes("scripts/e2e/primitives.test.ts")).toBe(true);
    expect(args.includes("scripts/quality-gates.test.ts")).toBe(true);
    expect(args.includes("scripts/check-receipts.e2e.test.ts")).toBe(true);
    expect(args.includes("scripts/ocr-ledgers.e2e.test.ts")).toBe(true);
    const printed = nodeOnlyTestCommand(args);
    expect(printed.startsWith("node --experimental-strip-types --test ")).toBe(true);
    expect(printed.includes("scripts/quality-gates.test.ts")).toBe(true);
    expect(printed.includes(" scripts/e2e ")).toBe(false);
  });

  test("the CI really runs bun run test:node, which is what makes this split mean anything", () => {
    /*
      THIS READ A WORKFLOW THAT NEVER EXECUTES (am-7bkr). It was
      `expect(workflow.includes("bun run test:node")).toBe(true)` over
      `.github/workflows/quality-gates.yml`, and the owner's standing rule is verbatim "we don't use
      gh actions for CI *EVER*, we ONLY use /dsr" (docs/DECISIONS.md
      D-2026-09-22-dsr-is-the-ci-never-github-actions). Five workflow files are tracked and none of
      them runs. So the assertion was green while describing the wiring of a runner that never
      starts, which is precisely what the rest of this file exists to prevent: a check whose subject
      nothing reaches.

      Its sibling guard, src/testing/ciGateWiring.test.ts, moved its evidence to package.json on
      2026-09-22 for this reason and says so in its own docblock. This one was missed.

      The evidence is now the same as that guard's: dsr runs `bun run <script>`, and those scripts
      are in the repository. Three things are asserted and each can fail on its own -- the check is
      one dsr runs, the script exists, and it is the node-only runner rather than something that
      merely shares the name.
    */
    expect(isDsrCheck("test:node")).toBe(true);
    const body = pkg.scripts["test:node"];
    expect(typeof body).toBe("string");
    expect(body).toContain("scripts/run-node-only-tests.ts");
    // A positive control for the predicate itself: a name dsr does not run must not pass it.
    expect(isDsrCheck("test:browser")).toBe(false);
  });

  test("every browser or subprocess-spawning test is excluded in bunfig.toml pathIgnorePatterns (am-zbcg)", () => {
    expect(() => assertNoUnignoredSubprocessTests(process.cwd())).not.toThrow();
  });

  test("unignored test importing playwright or chromium fails and names file and exact line to add (am-zbcg)", () => {
    const fixtureCode = 'import { chromium } from "playwright";\n';
    expect(classifyTestFileContent(fixtureCode)).toBe('imports "playwright"');

    const failureMsg = formatUnignoredSubprocessTestFailure([
      {
        file: "src/testing/dummy.test.ts",
        reason: 'imports "playwright"',
        lineToAdd: '  "src/testing/dummy.test.ts",',
      },
    ]);
    expect(failureMsg).toContain("src/testing/dummy.test.ts");
    expect(failureMsg).toContain('  "src/testing/dummy.test.ts",');
    expect(failureMsg).toContain('imports "playwright"');
  });
});
