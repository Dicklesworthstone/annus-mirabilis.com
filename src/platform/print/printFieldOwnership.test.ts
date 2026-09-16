import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const DIR = path.dirname(fileURLToPath(import.meta.url));

/**
 * Scans a source text to verify that `essentialForPrint` is only read as a property
 * and is never declared as a schema field, type alias, or local override map.
 */
export function auditEssentialForPrintOwnership(
  filePath: string,
  sourceText: string,
): {
  readonly valid: boolean;
  readonly errors: readonly string[];
} {
  const errors: string[] = [];
  const lines = sourceText.split(/\r?\n/);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;
    const lineNum = i + 1;

    // Check for type/interface declarations of essentialForPrint
    if (
      /type\s+essentialForPrint\s*=/i.test(line) ||
      /interface\s+\w+\s*\{[^}]*essentialForPrint/i.test(line)
    ) {
      errors.push(`${filePath}:${lineNum} declares essentialForPrint as a type/interface.`);
    }

    // Check for schema field declarations
    if (/essentialForPrint\s*:\s*z\./i.test(line) || /essentialForPrint\s*:\s*typeof/i.test(line)) {
      errors.push(`${filePath}:${lineNum} declares essentialForPrint in a schema.`);
    }

    // Check for local override maps
    if (
      /const\s+\w*(override|overrideMap|essentialMap)\w*\s*=/i.test(line) &&
      /essentialForPrint/i.test(line)
    ) {
      errors.push(`${filePath}:${lineNum} defines a local print override map.`);
    }

    // Check occurrences of essentialForPrint: must only be property reads (.essentialForPrint) or property checks
    if (line.includes("essentialForPrint")) {
      const isPropertyRead =
        /\.\s*essentialForPrint\b/.test(line) ||
        /["']essentialForPrint["']\s*:\s*(true|false)/.test(line) || // fixture or data object
        /data-essential-for-print/.test(line) || // CSS attribute selector
        /essentialForPrint\?:\s*boolean/.test(line) || // inline type hint in function param
        /essentialForPrint\s*===/.test(line) ||
        /\/\*|\*|\/\//.test(line); // comments

      if (!isPropertyRead) {
        errors.push(
          `${filePath}:${lineNum} contains unapproved usage of essentialForPrint: "${line.trim()}"`,
        );
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

describe("printFieldOwnership: Essential-for-Print Field Ownership", () => {
  it("verifies all source files under src/platform/print/ only read compiled records", () => {
    const files = readdirSync(DIR).filter(
      (f) => (f.endsWith(".ts") || f.endsWith(".css")) && !f.endsWith(".test.ts"),
    );

    assert.ok(files.length >= 4, "Expected at least 4 source files in src/platform/print");

    for (const file of files) {
      const fullPath = path.join(DIR, file);
      const text = readFileSync(fullPath, "utf-8");
      const result = auditEssentialForPrintOwnership(file, text);
      assert.equal(result.valid, true, `Violations found in ${file}:\n${result.errors.join("\n")}`);
    }
  });

  it("planted negative: fails when a local type alias or schema is declared", () => {
    const plantedTypeSnippet = `
      export type essentialForPrint = boolean;
      export function check(x: unknown) { return x; }
    `;
    const result1 = auditEssentialForPrintOwnership("plantedType.ts", plantedTypeSnippet);
    assert.equal(result1.valid, false);
    assert.ok(
      result1.errors.some((e) => e.includes("declares essentialForPrint as a type/interface")),
    );

    const plantedSchemaSnippet = `
      export const Schema = z.object({
        essentialForPrint: z.boolean().optional(),
      });
    `;
    const result2 = auditEssentialForPrintOwnership("plantedSchema.ts", plantedSchemaSnippet);
    assert.equal(result2.valid, false);
    assert.ok(result2.errors.some((e) => e.includes("declares essentialForPrint in a schema")));

    const plantedMapSnippet = `
      const printOverrideMap = { essentialForPrint: true };
    `;
    const result3 = auditEssentialForPrintOwnership("plantedMap.ts", plantedMapSnippet);
    assert.equal(result3.valid, false);
    assert.ok(result3.errors.some((e) => e.includes("defines a local print override map")));
  });
});
