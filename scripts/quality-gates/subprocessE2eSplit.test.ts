import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { classifyTestFile } from "./test-runner.ts";

const E2E_SPAWN_FILES = [
  "scripts/check-receipts.e2e.test.ts",
  "scripts/generateQuantityIds.e2e.test.ts",
  "scripts/summarize-test-logs.e2e.test.ts",
  "scripts/ocr-ledgers.e2e.test.ts",
  "scripts/quality-gates.test.ts",
] as const;

describe("subprocess e2e tests run under node, not bun test", () => {
  test("bunfig.toml ignores *.e2e.test.ts so bun test does not discover them", () => {
    const bunfig = readFileSync("bunfig.toml", "utf8");
    expect(bunfig).toContain("**/*.e2e.test.ts");
    expect(bunfig).toContain("pathIgnorePatterns");
  });

  test("each spawn-based e2e file is classified as the node runner", () => {
    for (const file of E2E_SPAWN_FILES) {
      const classified = classifyTestFile(file);
      expect(classified.runner).toBe("node");
    }
  });

  test("package.json test:node invokes the same node --test command as scripts/e2e plus the root e2e files", () => {
    const pkg = JSON.parse(readFileSync("package.json", "utf8")) as {
      scripts: Record<string, string>;
    };
    const command = pkg.scripts["test:node"];
    expect(command).toContain("node --experimental-strip-types --test");
    expect(command).toContain("scripts/e2e");
    for (const file of E2E_SPAWN_FILES) {
      expect(command).toContain(file);
    }
  });
});
