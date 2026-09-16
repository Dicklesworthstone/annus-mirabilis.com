import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import {
  expandIgnorePatternsToTestFiles,
  nodeOnlyTestArgs,
  nodeOnlyTestCommand,
  parsePathIgnorePatterns,
} from "./bunfigNodeOnlyTests.ts";

describe("subprocess tests run under node, not bun test", () => {
  const bunfig = readFileSync("bunfig.toml", "utf8");
  const pkg = JSON.parse(readFileSync("package.json", "utf8")) as {
    scripts: Record<string, string>;
  };
  const workflow = readFileSync(".github/workflows/quality-gates.yml", "utf8");

  test("bunfig.toml uses the bun 1.4.0 pathIgnorePatterns key with repo-relative paths", () => {
    const patterns = parsePathIgnorePatterns(bunfig);
    expect(patterns.includes("scripts/quality-gates.test.ts")).toBe(true);
    expect(patterns.includes("scripts/check-receipts.e2e.test.ts")).toBe(true);
    expect(patterns.includes("scripts/ocr-ledgers.e2e.test.ts")).toBe(true);
    expect(patterns.includes("quality-gates.test.ts")).toBe(false);
  });

  test("bunfig ignore list expands to the spawn e2e files, ocr-ledgers, and quality-gates.test.ts", () => {
    const patterns = parsePathIgnorePatterns(bunfig);
    const files = expandIgnorePatternsToTestFiles(patterns, process.cwd());
    expect(files.includes("scripts/check-receipts.e2e.test.ts")).toBe(true);
    expect(files.includes("scripts/generateQuantityIds.e2e.test.ts")).toBe(true);
    expect(files.includes("scripts/summarize-test-logs.e2e.test.ts")).toBe(true);
    expect(files.includes("scripts/ocr-ledgers.e2e.test.ts")).toBe(true);
    expect(files.includes("scripts/quality-gates.test.ts")).toBe(true);
    expect(files.includes("src/content/editions/brownian.manifest.e2e.test.ts")).toBe(false);
  });

  test("every file matched by bunfig's pathIgnorePatterns appears in the node-only execution set", () => {
    const patterns = parsePathIgnorePatterns(bunfig);
    const ignoredFiles = expandIgnorePatternsToTestFiles(patterns, process.cwd());
    const args = nodeOnlyTestArgs(bunfig, process.cwd());
    const coveredByArgs = expandIgnorePatternsToTestFiles(args, process.cwd());
    for (const file of ignoredFiles) {
      expect(coveredByArgs).toContain(file);
    }
  });

  test("test:node derives its file list from bunfig so the two lists cannot drift", () => {
    const command = pkg.scripts["test:node"];
    expect(command).toBe("node --experimental-strip-types scripts/run-node-only-tests.ts");
    const args = nodeOnlyTestArgs(bunfig, process.cwd());
    expect(args.includes("scripts/e2e/primitives.test.ts")).toBe(true);
    expect(args.includes("scripts/quality-gates.test.ts")).toBe(true);
    expect(args.includes("scripts/check-receipts.e2e.test.ts")).toBe(true);
    expect(args.includes("scripts/ocr-ledgers.e2e.test.ts")).toBe(true);
    const printed = nodeOnlyTestCommand(args);
    expect(printed.startsWith("node --experimental-strip-types --test ")).toBe(true);
    expect(printed.includes("scripts/quality-gates.test.ts")).toBe(true);
  });

  test("CI quality-gates workflow invokes bun run test:node", () => {
    expect(workflow.includes("bun run test:node")).toBe(true);
  });
});
