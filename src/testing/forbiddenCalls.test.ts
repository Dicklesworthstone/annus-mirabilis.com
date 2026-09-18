import { describe, expect, test } from "bun:test";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const ALLOWLIST_PATH = path.join(REPO_ROOT, "src/visuals/allowlist.json");

export interface ForbiddenCallViolation {
  readonly file: string;
  readonly line: number;
  readonly call: string;
  readonly snippet: string;
}

export interface AllowlistEntry {
  readonly file: string;
  readonly functions?: readonly string[] | undefined;
  readonly reason: string;
}

export function loadAllowlist(): Set<string> {
  if (!fs.existsSync(ALLOWLIST_PATH)) return new Set();
  const raw = JSON.parse(fs.readFileSync(ALLOWLIST_PATH, "utf8")) as {
    helpers: AllowlistEntry[];
  };
  return new Set(raw.helpers.map((h) => h.file));
}

const MATH_RANDOM_REGEX = /\bMath\.random\s*\(/;
const MATH_COMPUTATION_REGEX = /\bMath\.(?:exp|sqrt|log)\s*\(|\berf\s*\(/;
const SUM_OF_SQUARES_REGEX = /\+=\s*([a-zA-Z0-9_]+)\s*\*\s*\1\b/;

export function scanForbiddenCalls(
  repoRelativePath: string,
  content: string,
  allowlist: Set<string>,
): ForbiddenCallViolation[] {
  const isAllowlisted = allowlist.has(repoRelativePath);
  const violations: ForbiddenCallViolation[] = [];
  const lines = content.split("\n");
  let inBlockComment = false;

  for (let idx = 0; idx < lines.length; idx++) {
    const rawLine = lines[idx] ?? "";
    const lineNum = idx + 1;
    const trimmed = rawLine.trim();

    if (inBlockComment) {
      if (trimmed.includes("*/")) {
        inBlockComment = false;
      }
      continue;
    }
    if (trimmed.startsWith("/*") && !trimmed.includes("*/")) {
      inBlockComment = true;
      continue;
    }
    if (trimmed.startsWith("//") || (trimmed.startsWith("/*") && trimmed.endsWith("*/"))) {
      continue;
    }

    // Math.random is forbidden anywhere in a view (even in allowlisted helpers)
    if (MATH_RANDOM_REGEX.test(rawLine)) {
      violations.push({
        file: repoRelativePath,
        line: lineNum,
        call: "Math.random",
        snippet: trimmed,
      });
      continue;
    }

    if (isAllowlisted) {
      continue; // Allowlisted helper permitted for pixel projection / easing / layout
    }

    if (MATH_COMPUTATION_REGEX.test(rawLine)) {
      const match = rawLine.match(MATH_COMPUTATION_REGEX);
      violations.push({
        file: repoRelativePath,
        line: lineNum,
        call: match?.[0] ?? "Math computation",
        snippet: trimmed,
      });
    }

    if (SUM_OF_SQUARES_REGEX.test(rawLine)) {
      violations.push({
        file: repoRelativePath,
        line: lineNum,
        call: "sum-of-squares accumulator",
        snippet: trimmed,
      });
    }
  }

  return violations;
}

function walkViewSourceFiles(rootDir: string): { path: string; content: string }[] {
  const results: { path: string; content: string }[] = [];
  const targetDirs = [path.join(rootDir, "src/visuals"), path.join(rootDir, "src/components/lab")];

  function walk(dir: string): void {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
        continue;
      }
      if (!/\.(ts|tsx)$/.test(entry.name)) continue;
      const repoRelative = path.relative(rootDir, full).split(path.sep).join("/");
      results.push({ path: repoRelative, content: fs.readFileSync(full, "utf8") });
    }
  }

  for (const td of targetDirs) walk(td);
  return results;
}

describe("forbiddenCalls: view modules cannot execute raw physics or statistics", () => {
  test("the production view modules have zero forbidden calls outside allowlist", () => {
    const allowlist = loadAllowlist();
    const files = walkViewSourceFiles(REPO_ROOT);
    expect(files.length).toBeGreaterThan(0);
    const allViolations = files.flatMap((f) => scanForbiddenCalls(f.path, f.content, allowlist));
    expect(allViolations).toEqual([]);
  });

  test("a planted Math.random in a fixture view fails the scan", () => {
    const allowlist = loadAllowlist();
    const fixturePath = "src/testing/fixtures/forbiddenCalls/PlantedRandom.fixture.tsx";
    const content = fs.readFileSync(path.join(REPO_ROOT, fixturePath), "utf8");
    const violations = scanForbiddenCalls(fixturePath, content, allowlist);
    expect(violations.length).toBe(1);
    expect(violations[0]?.call).toBe("Math.random");
  });

  test("a planted sum-of-squares loop in a fixture view fails the scan", () => {
    const allowlist = loadAllowlist();
    const fixturePath = "src/testing/fixtures/forbiddenCalls/PlantedSumOfSquares.fixture.tsx";
    const content = fs.readFileSync(path.join(REPO_ROOT, fixturePath), "utf8");
    const violations = scanForbiddenCalls(fixturePath, content, allowlist);
    expect(violations.length).toBe(1);
    expect(violations[0]?.call).toBe("sum-of-squares accumulator");
  });

  test("an allowlisted easing helper passes the scan without violations", () => {
    const allowlist = loadAllowlist();
    const fixturePath = "src/testing/fixtures/forbiddenCalls/AllowlistedEasing.fixture.ts";
    const content = fs.readFileSync(path.join(REPO_ROOT, fixturePath), "utf8");
    expect(allowlist.has(fixturePath)).toBe(true);
    const violations = scanForbiddenCalls(fixturePath, content, allowlist);
    expect(violations).toEqual([]);
  });
});
