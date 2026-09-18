import { describe, expect, it } from "bun:test";
import { readdir, readFile } from "node:fs/promises";
import { relative, resolve } from "node:path";
import { getLogger } from "./log/logger.ts";

describe("Client Component Import Boundary Gate (am-cm-compiler-core-oa7)", () => {
  const logger = getLogger("content-compiler-tests");

  function logTest(testId: string, outcome: "passed" | "failed", message: string) {
    logger.log({
      testId,
      beadId: "am-cm-compiler-core-oa7",
      outcome,
      message,
    });
  }

  async function walkDir(dir: string, fileList: string[] = []): Promise<string[]> {
    try {
      const entries = await readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = resolve(dir, entry.name);
        if (entry.isDirectory()) {
          if (entry.name !== "node_modules" && entry.name !== ".next" && entry.name !== ".git") {
            await walkDir(fullPath, fileList);
          }
        } else if (/\.(tsx|ts|jsx|js|mjs)$/.test(entry.name)) {
          fileList.push(fullPath);
        }
      }
    } catch {
      // Directory may not exist yet
    }
    return fileList;
  }

  it("verifies no client component under src/app or src/visuals imports the compiler core or generated corpus aggregate", async () => {
    const root = process.cwd();
    const appFiles = await walkDir(resolve(root, "src/app"));
    const visualFiles = await walkDir(resolve(root, "src/visuals"));
    const componentFiles = await walkDir(resolve(root, "src/components"));

    const scannedFiles = [...appFiles, ...visualFiles, ...componentFiles];

    // Scanned-nothing guard. walkDir swallows readdir errors ("Directory may not
    // exist yet"), so a renamed or unreadable root would leave scannedFiles empty
    // and this gate would pass having inspected no files at all. Sibling gate
    // noPhysicsInComponents.test.ts:123 already asserts this; this one did not.
    expect(appFiles.length).toBeGreaterThan(0);
    expect(visualFiles.length).toBeGreaterThan(0);
    expect(componentFiles.length).toBeGreaterThan(0);

    const violations: { file: string; line: number; importStatement: string }[] = [];

    for (const filePath of scannedFiles) {
      const content = await readFile(filePath, "utf8");
      const isClient =
        content.includes('"use client"') ||
        content.includes("'use client'") ||
        filePath.includes("/visuals/");

      if (isClient) {
        const lines = content.split(/\r?\n/);
        for (let idx = 0; idx < lines.length; idx++) {
          const line = lines[idx];
          if (!line) continue;
          // Check for forbidden imports
          if (
            /from\s+["'].*?(?:content\/compiler|generated\/content(?:\/index)?)["']/.test(line) ||
            /import\(["'].*?(?:content\/compiler|generated\/content(?:\/index)?)["']\)/.test(line)
          ) {
            violations.push({
              file: relative(root, filePath),
              line: idx + 1,
              importStatement: line.trim(),
            });
          }
        }
      }
    }

    if (violations.length > 0) {
      console.error("Client import boundary violations detected:", violations);
    }

    expect(violations.length).toBe(0);
    logTest(
      "client-import-boundary",
      violations.length === 0 ? "passed" : "failed",
      `Verified client import boundary across ${scannedFiles.length} files (0 violations).`,
    );
  });
});
