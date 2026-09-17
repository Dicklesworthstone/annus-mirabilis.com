import { describe, expect, test } from "bun:test";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * am-cm-schemas-source-1en: every surface that renders a date uses formatDate or
 * formatDateStrict from src/content/dates.ts, the only functions that can never return a
 * string finer than the stored precision. A third-party formatter, a raw Intl call, or a
 * template slice of an ISO string all happily fabricate a day from a month- or year-precision
 * date; this scan fails a route component that does any of those directly instead of going
 * through the two blessed functions.
 */
const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const WATCHED_DIRECTORY_PREFIXES = ["src/app/", "src/reader/", "src/content/"];
const EXEMPT_FILES = new Set(["src/content/dates.ts", "src/content/schemas/dates.ts"]);

const FORBIDDEN_PATTERNS: readonly Readonly<{ id: string; pattern: RegExp }>[] = [
  { id: "toLocaleDateString", pattern: /\.toLocaleDateString\s*\(/ },
  { id: "Intl.DateTimeFormat", pattern: /new\s+Intl\.DateTimeFormat\s*\(/ },
  { id: "iso-string-template-slice", pattern: /\b(?:iso|date)\w*\.slice\s*\(\s*0\s*,\s*10\s*\)/i },
  { id: "third-party-date-library", pattern: /from\s+["'](?:date-fns|dayjs|moment|luxon)["']/ },
];

export interface DateFormattingViolation {
  readonly file: string;
  readonly patternId: string;
  readonly line: number;
}

function listSourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listSourceFiles(full));
    else if (/\.(ts|tsx)$/.test(entry.name) && !/\.test\.(ts|tsx)$/.test(entry.name))
      out.push(full);
  }
  return out;
}

export function scanForDateFormattingViolations(root: string): DateFormattingViolation[] {
  const violations: DateFormattingViolation[] = [];
  for (const prefix of WATCHED_DIRECTORY_PREFIXES) {
    const dir = path.join(root, prefix);
    if (!fs.existsSync(dir)) continue;
    for (const file of listSourceFiles(dir)) {
      const relative = path.relative(root, file).split(path.sep).join("/");
      if (EXEMPT_FILES.has(relative)) continue;
      const lines = fs.readFileSync(file, "utf8").split("\n");
      lines.forEach((lineText, i) => {
        for (const { id, pattern } of FORBIDDEN_PATTERNS) {
          if (pattern.test(lineText)) {
            violations.push({ file: relative, patternId: id, line: i + 1 });
          }
        }
      });
    }
  }
  return violations;
}

describe("date formatting boundary scan (am-cm-schemas-source-1en)", () => {
  test("no route component under src/app, src/reader, or src/content formats a date directly", () => {
    const violations = scanForDateFormattingViolations(REPO_ROOT);
    expect(violations).toEqual([]);
  });

  test("the scan catches a seeded toLocaleDateString call", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "am-date-scan-test-"));
    try {
      const appDir = path.join(dir, "src", "app");
      fs.mkdirSync(appDir, { recursive: true });
      fs.writeFileSync(
        path.join(appDir, "page.tsx"),
        "export const label = someDate.toLocaleDateString();\n",
      );
      const violations = scanForDateFormattingViolations(dir);
      expect(violations.length).toBe(1);
      expect(violations[0]?.patternId).toBe("toLocaleDateString");
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test("the scan catches a seeded Intl.DateTimeFormat construction", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "am-date-scan-test-"));
    try {
      const readerDir = path.join(dir, "src", "reader");
      fs.mkdirSync(readerDir, { recursive: true });
      fs.writeFileSync(
        path.join(readerDir, "Card.tsx"),
        "const fmt = new Intl.DateTimeFormat('en-US');\n",
      );
      const violations = scanForDateFormattingViolations(dir);
      expect(violations.length).toBe(1);
      expect(violations[0]?.patternId).toBe("Intl.DateTimeFormat");
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test("the scan catches a seeded ISO string template slice inside a route component", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "am-date-scan-test-"));
    try {
      const contentDir = path.join(dir, "src", "content");
      fs.mkdirSync(contentDir, { recursive: true });
      fs.writeFileSync(
        path.join(contentDir, "projection.ts"),
        "export const day = isoDate.slice(0, 10);\n",
      );
      const violations = scanForDateFormattingViolations(dir);
      expect(violations.length).toBe(1);
      expect(violations[0]?.patternId).toBe("iso-string-template-slice");
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test("the exempt formatter modules themselves are not flagged for defining the ban", () => {
    const dir = REPO_ROOT;
    const violations = scanForDateFormattingViolations(dir).filter((v) =>
      v.file.includes("dates.ts"),
    );
    expect(violations).toEqual([]);
  });
});
