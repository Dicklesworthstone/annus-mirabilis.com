import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

function scanDirectoryForIntlNumberFormat(dir: string, violations: string[]): void {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === ".next" || entry.name === "dist") {
        continue;
      }
      scanDirectoryForIntlNumberFormat(fullPath, violations);
    } else if (entry.isFile()) {
      if (
        (entry.name.endsWith(".ts") ||
          entry.name.endsWith(".tsx") ||
          entry.name.endsWith(".js") ||
          entry.name.endsWith(".mjs")) &&
        !entry.name.includes(".test.")
      ) {
        // Skip src/i18n/numberLocale.ts, which is the designated owner of Intl.NumberFormat
        if (fullPath.endsWith(path.join("src", "i18n", "numberLocale.ts"))) {
          continue;
        }

        const content = fs.readFileSync(fullPath, "utf8");
        if (content.includes("Intl.NumberFormat")) {
          violations.push(fullPath);
        }
      }
    }
  }
}

test("intlImportBoundary: src/i18n/numberLocale.ts is the single module authorized to instantiate Intl.NumberFormat", () => {
  const srcDir = path.resolve(process.cwd(), "src");
  const violations: string[] = [];

  scanDirectoryForIntlNumberFormat(srcDir, violations);

  assert.equal(
    violations.length,
    0,
    `Found unauthorized use of Intl.NumberFormat outside of src/i18n/numberLocale.ts in: ${violations.join(
      ", ",
    )}`,
  );
});
