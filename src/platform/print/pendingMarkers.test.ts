import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

/**
 * Recursively walks a directory and collects matching source files.
 */
function walkDir(dir: string, fileList: string[] = []): string[] {
  if (!existsSync(dir)) return fileList;
  for (const entry of readdirSync(dir)) {
    if (
      entry === "nodeToIgnore" ||
      entry === "node_modules" ||
      entry === ".git" ||
      entry === ".next" ||
      entry === "artifacts"
    ) {
      continue;
    }
    const fullPath = path.join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      walkDir(fullPath, fileList);
    } else if (
      entry.endsWith(".ts") ||
      entry.endsWith(".tsx") ||
      entry.endsWith(".js") ||
      entry.endsWith(".mjs") ||
      entry.endsWith(".yaml") ||
      entry.endsWith(".json")
    ) {
      fileList.push(fullPath);
    }
  }
  return fileList;
}

describe("pendingMarkers: Removal of pendingOn markers for am-plat-print-3orn", () => {
  it("verifies no pendingOn: am-plat-print-3orn markers remain across src/, scripts/, and e2e/", () => {
    const scanDirs = [path.join(ROOT, "src"), path.join(ROOT, "scripts"), path.join(ROOT, "e2e")];

    const violations: string[] = [];
    const thisTestFile = fileURLToPath(import.meta.url);

    for (const d of scanDirs) {
      const files = walkDir(d);
      for (const file of files) {
        if (file === thisTestFile) continue; // Skip this test file itself
        const text = readFileSync(file, "utf-8");
        if (
          text.includes("pendingOn: am-plat-print-3orn") ||
          text.includes("pendingOn: 'am-plat-print-3orn'") ||
          text.includes('pendingOn: "am-plat-print-3orn"') ||
          text.includes('"pendingOn": "am-plat-print-3orn"')
        ) {
          violations.push(path.relative(ROOT, file));
        }
      }
    }

    assert.equal(
      violations.length,
      0,
      `Found remaining pendingOn: am-plat-print-3orn in: ${violations.join(", ")}`,
    );
  });
});
