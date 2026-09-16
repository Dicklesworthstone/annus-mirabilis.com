import { describe, expect, it } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { validateU64String } from "../../content/schemas/u64String.ts";
import { parseU64, type U64String } from "../../experiments/identity/u64.ts";
import { validateSeed } from "../log/schema.ts";

const fixturePath = resolve(process.cwd(), "src/testing/fixtures/u64-boundaries.json");
const fixture = JSON.parse(readFileSync(fixturePath, "utf-8"));

function getAllSourceFiles(dir: string): string[] {
  const entries = readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!entry.name.startsWith(".") && entry.name !== "node_modules") {
        files.push(...getAllSourceFiles(fullPath));
      }
    } else if (entry.isFile() && (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx"))) {
      files.push(fullPath);
    }
  }

  return files;
}

describe("One Grammar Invariant: Single Canonical U64 Grammar Across Codebase", () => {
  it("confirms src/content/schemas/u64String.ts is purely a re-export of src/experiments/identity/u64.ts", () => {
    const schemaFilePath = resolve(process.cwd(), "src/content/schemas/u64String.ts");
    const content = readFileSync(schemaFilePath, "utf-8");

    expect(content).toContain('from "../../experiments/identity/u64.ts"');
    // Must not contain its own class definition or regex declaration
    expect(content).not.toContain("class U64ValidationError");
    expect(content).not.toContain("const U64_DECIMAL_PATTERN");
  });

  it("verifies log schema, content schema, and identity module accept and reject identically across u64-boundaries.json", () => {
    // 1. Valid vectors
    for (const valid of fixture.valid as string[]) {
      expect(parseU64(valid)).toBe(valid as U64String);
      expect(validateU64String(valid)).toBe(valid as U64String);
      expect(validateSeed(valid)).toBe(valid);
    }

    // 2. Format violations
    for (const invalid of fixture.formatViolations as string[]) {
      expect(() => parseU64(invalid)).toThrow();
      expect(() => validateU64String(invalid)).toThrow();
      expect(() => validateSeed(invalid)).toThrow();
    }

    // 3. Overflows
    for (const overflow of fixture.overflows as string[]) {
      expect(() => parseU64(overflow)).toThrow();
      expect(() => validateU64String(overflow)).toThrow();
      expect(() => validateSeed(overflow)).toThrow();
    }
  });

  it("scans non-test runtime and content source files for rogue seed parse implementations", () => {
    const srcDir = resolve(process.cwd(), "src");
    const sourceFiles = getAllSourceFiles(srcDir);

    for (const file of sourceFiles) {
      if (
        file.endsWith("src/experiments/identity/u64.ts") ||
        file.includes(".test.ts") ||
        file.includes(".test.tsx") ||
        file.includes("/testing/")
      ) {
        continue;
      }
      const content = readFileSync(file, "utf-8");

      // Verify no duplicate U64 validation class
      expect(content.includes("class U64ValidationError")).toBe(false);

      // Check that seed parsing does not use Number(seed) or parseInt(seed)
      if (
        content.includes("Number(seed)") ||
        content.includes("parseInt(seed)") ||
        content.includes("+seed")
      ) {
        throw new Error(
          `File ${file} contains rogue Number(seed), parseInt(seed), or +seed coercion.`,
        );
      }
    }
  });
});
