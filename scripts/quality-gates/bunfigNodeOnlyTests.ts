/**
 * bunfig.toml [test].pathIgnorePatterns is the single list of test files that
 * bun must not discover. Node must still run them. This module parses that
 * list so package.json, CI, and tests cannot drift from bunfig.
 */

import { type Dirent, existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import ts from "typescript";

export const BUNFIG_RELATIVE_PATH = "bunfig.toml";
/** Extra node --test inputs that bunfig does not ignore. Globs are expanded to files. */
export const NODE_SUITE_ALWAYS = [
  "scripts/e2e/**/*.test.ts",
  "scripts/quality-gates/bunfigNodeOnlyTests.test.ts",
] as const;
const SKIP_DIRS = new Set(["node_modules", ".git", ".next", "artifacts", "dist", "coverage"]);

export function parsePathIgnorePatterns(bunfigText: string): string[] {
  const block = bunfigText.match(/pathIgnorePatterns\s*=\s*\[([\s\S]*?)\]/);
  if (block === null || block[1] === undefined) {
    throw new Error(
      "bunfig.toml is missing [test].pathIgnorePatterns. Subprocess tests would run under bun test or nowhere.",
    );
  }
  const patterns = [...block[1].matchAll(/"([^"]+)"/g)]
    .map((m) => m[1])
    .filter((p): p is string => p !== undefined);
  if (patterns.length === 0) {
    throw new Error("bunfig.toml [test].pathIgnorePatterns is empty.");
  }
  return patterns;
}

function posix(rel: string): string {
  return rel.replace(/\\/g, "/");
}

export function matchPattern(relPath: string, pattern: string): boolean {
  const normalizedPath = posix(relPath);
  const normalizedPattern = posix(pattern).replace(/\/+$/, "");

  // 1. Exact match
  if (normalizedPath === normalizedPattern) {
    return true;
  }

  // 2. Directory prefix match (e.g. pattern is "scripts/e2e")
  if (!normalizedPattern.includes("*")) {
    if (normalizedPath.startsWith(`${normalizedPattern}/`)) {
      return true;
    }
  }

  // 3. Glob matching
  const regexStr = normalizedPattern
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\/\*\*\//g, ":::SLASH_GLOBSTAR_SLASH:::")
    .replace(/\*\*/g, ":::GLOBSTAR:::")
    .replace(/\*/g, "[^/]*")
    .replace(/:::SLASH_GLOBSTAR_SLASH:::/g, "/(?:.*/)?")
    .replace(/:::GLOBSTAR:::/g, ".*");
  return new RegExp(`^${regexStr}$`).test(normalizedPath);
}

function walkFiles(dir: string, root: string, out: string[]): void {
  let entries: Dirent[] | undefined;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  if (entries === undefined) return;
  for (const entry of entries) {
    if (SKIP_DIRS.has(entry.name) || entry.name.startsWith(".")) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      walkFiles(full, root, out);
    } else if (entry.isFile()) {
      out.push(posix(relative(root, full)));
    }
  }
}

export function expandIgnorePatternsToTestFiles(
  patterns: readonly string[],
  root: string,
): string[] {
  const allFiles: string[] = [];
  walkFiles(root, root, allFiles);
  const matched = allFiles.filter((rel) => {
    if (!/\.(test|spec)\.(ts|js|mjs|tsx|jsx)$/.test(rel)) return false;
    return patterns.some((pattern) => matchPattern(rel, pattern));
  });
  return [...new Set(matched)].sort();
}

export function nodeOnlyTestArgs(bunfigText: string, root: string): string[] {
  const patterns = parsePathIgnorePatterns(bunfigText);
  const fromBunfig = expandIgnorePatternsToTestFiles(patterns, root);
  const extraFiles = expandIgnorePatternsToTestFiles(NODE_SUITE_ALWAYS, root);
  const allTestFiles = [...new Set([...extraFiles, ...fromBunfig])].sort();
  if (allTestFiles.length === 0) {
    throw new Error("node-only test derivation produced an empty file list.");
  }
  for (const path of allTestFiles) {
    if (path.includes("*") || path.endsWith("/")) {
      throw new Error(
        `node --test cannot consume a glob or directory; derivation left ${path} unexpanded.`,
      );
    }
    const full = existsSync(join(root, path)) ? join(root, path) : path;
    if (!existsSync(full)) {
      throw new Error(`node-only test path does not exist: ${path}`);
    }
    if (statSync(full).isDirectory()) {
      throw new Error(
        `node --test cannot consume a directory; derivation left ${path} unexpanded.`,
      );
    }
  }
  return allTestFiles;
}

export function nodeOnlyTestCommand(args: readonly string[]): string {
  return ["node", "--experimental-strip-types", "--test", ...args].join(" ");
}

export const TEST_FILE_EXTENSIONS_REGEX = /\.(test|spec)\.(ts|js|mjs|tsx|jsx)$/;

export function stripComments(code: string): string {
  return code.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*/g, "");
}

export const PLAYWRIGHT_STATIC_IMPORT_REGEX =
  /(?:^|\n)\s*(?:import|export)\b[^;]*?\bfrom\s*['"](@?playwright(?:-core|\/test)?|@axe-core\/playwright|chromium)['"]/;

export const PLAYWRIGHT_BARE_IMPORT_REGEX =
  /(?:^|\n)\s*import\s*['"](@?playwright(?:-core|\/test)?|@axe-core\/playwright|chromium)['"]/;

export const PLAYWRIGHT_DYNAMIC_IMPORT_REGEX =
  /\b(?:require|import)\s*\(\s*['"](@?playwright(?:-core|\/test)?|@axe-core\/playwright|chromium)['"]\s*\)/;

export const CHROMIUM_NAMED_IMPORT_REGEX =
  /(?:^|\n)\s*(?:import|export)\b[^;]*?\bchromium\b[^;]*?\bfrom\b/;

export const SUBPROCESS_STATIC_IMPORT_REGEX =
  /(?:^|\n)\s*(?:import|export)\b[^;]*?\bfrom\s*['"](?:node:)?child_process['"]/;

export const SUBPROCESS_BARE_IMPORT_REGEX = /(?:^|\n)\s*import\s*['"](?:node:)?child_process['"]/;

export const SUBPROCESS_DYNAMIC_IMPORT_REGEX =
  /\b(?:require|import)\s*\(\s*['"](?:node:)?child_process['"]\s*\)/;

export const SUBPROCESS_SPAWN_CALL_REGEX =
  /\b(?:spawn|spawnSync|exec|execSync|execFile|execFileSync|fork)\s*\(/;

export interface UnignoredSubprocessTestViolation {
  readonly file: string;
  readonly reason: string;
  readonly lineToAdd: string;
}

export function classifyTestFileContent(rawContent: string): string | null {
  const code = stripComments(rawContent);

  const staticMatch = code.match(PLAYWRIGHT_STATIC_IMPORT_REGEX);
  if (staticMatch?.[1] !== undefined) {
    return `imports "${staticMatch[1]}"`;
  }

  const bareMatch = code.match(PLAYWRIGHT_BARE_IMPORT_REGEX);
  if (bareMatch?.[1] !== undefined) {
    return `imports "${bareMatch[1]}"`;
  }

  const dynamicMatch = code.match(PLAYWRIGHT_DYNAMIC_IMPORT_REGEX);
  if (dynamicMatch?.[1] !== undefined) {
    return `imports "${dynamicMatch[1]}"`;
  }

  if (CHROMIUM_NAMED_IMPORT_REGEX.test(code)) {
    return "imports chromium";
  }

  const hasSubprocessImport =
    SUBPROCESS_STATIC_IMPORT_REGEX.test(code) ||
    SUBPROCESS_BARE_IMPORT_REGEX.test(code) ||
    SUBPROCESS_DYNAMIC_IMPORT_REGEX.test(code);

  if (hasSubprocessImport && SUBPROCESS_SPAWN_CALL_REGEX.test(code)) {
    return "spawns a subprocess";
  }

  return null;
}

export function formatUnignoredSubprocessTestFailure(
  violations: readonly UnignoredSubprocessTestViolation[],
): string {
  const lines = [
    `Found ${violations.length} test file(s) that import playwright, @axe-core/playwright, or chromium, or spawn a subprocess, but are not matched by bunfig.toml pathIgnorePatterns:`,
    "",
  ];
  for (const v of violations) {
    lines.push(`File: ${v.file}`);
    lines.push(`Reason: ${v.reason}`);
    lines.push("Exact line to add to [test].pathIgnorePatterns in bunfig.toml:");
    lines.push(v.lineToAdd);
    lines.push("");
  }
  lines.push(
    "Subprocess-spawning and browser tests cannot run under bun test on macOS (EBADF posix_spawn failure).",
    "They must be listed in bunfig.toml pathIgnorePatterns so bun test skips them and scripts/run-node-only-tests.ts runs them under node --test.",
    "",
    "The failure is posix_spawn OF NODE. If your test's child is bun, git or another binary, add it to",
    "SUBPROCESS_LANE_EXEMPTIONS in scripts/quality-gates/bunfigNodeOnlyTests.ts with the reason, naming",
    "the executable. Catching EBADF and returning is not a reason: that makes the test pass having",
    "asserted nothing, which is what the exemption list replaced.",
  );
  return lines.join("\n");
}

/**
 * Files excused from the subprocess lane rule, each with the reason it is excused.
 *
 * This replaces `&& !code.includes("EBADF")`, which used to sit in the condition above. That was a
 * bare substring test over the whole file granting a LANE EXEMPTION: a comment, a variable name or
 * an unrelated sentence containing those five characters excused a test from a rule about where it
 * runs, and nothing anywhere recorded which files were using the escape. Measured before removing
 * it: exactly five files depended on it, and all five were absent from pathIgnorePatterns, so the
 * escape was load-bearing rather than dead.
 *
 * It also excused them for the WRONG REASON. What earns the escape is containing EBADF-handling
 * code - and that handling is an early `return` that makes the test pass having asserted nothing.
 * A file therefore earned the right to run in the lane where it fails by carrying the code that
 * hides the failure. The real justification is a different fact: bunfig.toml's comment says the
 * failure is "posix_spawn OF NODE", and none of these five spawns node. Verified per file by
 * reading the spawn call, not inferred from the group.
 *
 * An entry here is a claim that the spawned executable is not node. Adding one is not a way to
 * silence the gate: a test that spawns node belongs in bunfig.toml pathIgnorePatterns, where the
 * node lane will pick it up and actually run it.
 */
const SPAWN_CALLEES = new Set([
  "spawn",
  "spawnSync",
  "exec",
  "execSync",
  "execFile",
  "execFileSync",
  "fork",
]);

/** What a spawn call's first argument names, as far as the syntax can say. */
export type SpawnTarget =
  | { readonly kind: "literal"; readonly executable: string }
  | { readonly kind: "runtime-dependent"; readonly expression: string };

/**
 * The executables a file spawns, read from the syntax tree rather than matched in the text.
 *
 * A regex here would be this bead's own defect: `execFileSync("git", ...)` and a comment saying
 * execFileSync("node") are the same characters to a substring test and opposite answers to a
 * parser. ts.createSourceFile needs no program and no type information, so it costs one parse per
 * file and reads .mjs as happily as .ts.
 */
export function spawnTargets(code: string, fileName = "file.ts"): SpawnTarget[] {
  const sf = ts.createSourceFile(fileName, code, ts.ScriptTarget.Latest, true);
  const targets: SpawnTarget[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isCallExpression(node)) {
      const callee = ts.isPropertyAccessExpression(node.expression)
        ? node.expression.name.text
        : ts.isIdentifier(node.expression)
          ? node.expression.text
          : "";
      if (SPAWN_CALLEES.has(callee)) {
        const first = node.arguments[0];
        if (!first) {
          targets.push({ kind: "runtime-dependent", expression: "(no argument)" });
        } else if (ts.isStringLiteral(first) || ts.isNoSubstitutionTemplateLiteral(first)) {
          targets.push({ kind: "literal", executable: firstWord(first.text) });
        } else if (ts.isTemplateExpression(first)) {
          // `bun scripts/x.ts ${arg}`: the executable is in the head, before any substitution.
          targets.push({ kind: "literal", executable: firstWord(first.head.text) });
        } else {
          targets.push({ kind: "runtime-dependent", expression: first.getText(sf).slice(0, 60) });
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return targets;
}

function firstWord(text: string): string {
  return text.trim().split(/\s+/)[0] ?? "";
}

/** node, node22, /usr/local/bin/node - but never bun, git, sh or a script path. */
export function isNodeExecutable(executable: string): boolean {
  const base = executable.split("/").pop() ?? executable;
  return /^node(\d+(\.\d+)*)?(\.exe)?$/.test(base);
}

export interface SubprocessLaneExemption {
  /**
   * "checked"      every spawn in the file names a literal executable, so the gate confirms the
   *                reason itself and a change to `node` fails.
   * "unverifiable" at least one spawn target is decided at runtime - in practice
   *                process.execPath, which IS node under node and bun under bun. The syntax cannot
   *                settle it, so the reason below is a HUMAN CLAIM and is labelled as one.
   */
  readonly basis: "checked" | "unverifiable";
  readonly reason: string;
}

/**
 * Files excused from the subprocess lane rule, each with the reason and with how far that reason
 * is enforced.
 *
 * This replaces `&& !code.includes("EBADF")`, a bare substring over the whole file that granted a
 * LANE EXEMPTION: a comment or a variable name containing those five characters was enough, and
 * nothing recorded which files used it. Measured before removal: exactly five did, and all five
 * were absent from pathIgnorePatterns, so the escape was load-bearing rather than dead. It also
 * rewarded the wrong thing - what earned it was EBADF-handling code, and that handling is an early
 * return that makes a test pass having asserted nothing.
 *
 * THE LIMIT, STATED RATHER THAN PAPERED OVER. bunfig.toml's comment says the failure is posix_spawn
 * OF NODE, so the question each entry answers is "which executable is the child". For a literal
 * that is decidable and IS decided here. For process.execPath it is not decidable at all, because
 * the same expression is node under node and bun under bun. Three of the five entries are checked;
 * two are human claims, marked, and the gate refuses to let a checkable file be marked as a claim.
 */
export const SUBPROCESS_LANE_EXEMPTIONS: ReadonlyMap<string, SubprocessLaneExemption> = new Map([
  [
    "src/content/manifest/report.test.ts",
    {
      basis: "checked",
      reason: "spawns `bun scripts/source-manifest-report.ts`, so the child is bun and not node",
    },
  ],
  [
    "src/content/coverage/coverageLedger.test.ts",
    { basis: "checked", reason: "spawns `bun scripts/coverage-report.ts`, so the child is bun" },
  ],
  [
    "src/testing/checkRevisions.integration.test.ts",
    {
      basis: "checked",
      reason: 'execFileSync("git", ...): the child is git, which posix_spawn handles normally',
    },
  ],
  [
    "src/testing/editions/alignEditions.test.ts",
    {
      basis: "unverifiable",
      reason:
        "spawns process.execPath, which under `bun test` is the bun binary; unverifiable because the same expression is node under node",
    },
  ],
  [
    "src/testing/brownianDemo.test.mjs",
    {
      basis: "unverifiable",
      reason:
        "spawns process.execPath, which under `bun test` is the bun binary; unverifiable because the same expression is node under node",
    },
  ],
]);

/**
 * Check an exemption against the file it excuses. Returns the reason it is not honoured, or null.
 *
 * Both directions are refused, so the label cannot be used to dodge the check: a "checked" entry
 * whose file spawns something the syntax cannot resolve is mislabelled, and an "unverifiable" entry
 * whose file spawns only literals is a claim where a check was available.
 */
export function verifySubprocessLaneExemption(
  relPath: string,
  code: string,
  exemption: SubprocessLaneExemption,
): string | null {
  const targets = spawnTargets(code, relPath);
  const literals = targets.filter((t) => t.kind === "literal");
  const runtime = targets.filter((t) => t.kind === "runtime-dependent");

  const node = literals.find((t) => isNodeExecutable(t.executable));
  if (node && node.kind === "literal") {
    return `exempted as "${exemption.reason}" but spawns ${node.executable}; a node child is the case the lane rule exists for, so it belongs in bunfig.toml pathIgnorePatterns`;
  }
  if (exemption.basis === "checked" && runtime.length > 0) {
    const first = runtime[0];
    return `marked basis "checked" but spawns ${first && first.kind === "runtime-dependent" ? first.expression : "a runtime value"}, which the syntax cannot resolve; mark it "unverifiable" so the reason reads as the human claim it is`;
  }
  if (exemption.basis === "unverifiable" && runtime.length === 0) {
    return `marked basis "unverifiable" but every spawn target is a literal, so the claim is checkable; mark it "checked"`;
  }
  return null;
}

export function findUnignoredSubprocessTests(
  root: string = process.cwd(),
  bunfigText?: string,
  targetDirs: readonly string[] = ["src", "scripts"],
): UnignoredSubprocessTestViolation[] {
  const rawBunfig = bunfigText ?? readFileSync(resolve(root, BUNFIG_RELATIVE_PATH), "utf8");
  const patterns = parsePathIgnorePatterns(rawBunfig);

  const allFiles: string[] = [];
  for (const dir of targetDirs) {
    const fullDir = resolve(root, dir);
    if (existsSync(fullDir)) {
      walkFiles(fullDir, root, allFiles);
    }
  }

  const testFiles = allFiles.filter((rel) => TEST_FILE_EXTENSIONS_REGEX.test(rel));
  const violations: UnignoredSubprocessTestViolation[] = [];

  for (const relPath of testFiles) {
    let content: string;
    try {
      content = readFileSync(resolve(root, relPath), "utf8");
    } catch {
      continue;
    }
    const reason = classifyTestFileContent(content);
    if (reason !== null && !SUBPROCESS_LANE_EXEMPTIONS.has(relPath)) {
      const isIgnored = patterns.some((p) => matchPattern(relPath, p));
      if (!isIgnored) {
        violations.push({
          file: relPath,
          reason,
          lineToAdd: `  "${relPath}",`,
        });
      }
    }
  }

  return violations;
}

export function assertNoUnignoredSubprocessTests(
  root: string = process.cwd(),
  bunfigText?: string,
  targetDirs: readonly string[] = ["src", "scripts"],
): void {
  const violations = findUnignoredSubprocessTests(root, bunfigText, targetDirs);
  if (violations.length > 0) {
    throw new Error(formatUnignoredSubprocessTestFailure(violations));
  }
}
