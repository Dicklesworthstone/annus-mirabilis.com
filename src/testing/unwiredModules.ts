import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import ts from "typescript";

/**
 * MODULES WITH THEIR OWN TEST AND NO PRODUCTION IMPORTER (am-snn0, am-rc1001-bridge-plan-pcjk.22).
 *
 * The defect class, found twice on 2026-10-23 and both times by accident:
 *
 *   `markPainted` was written, exported, documented ("emitted after the frame that commits a new
 *   snapshotVersion") and tested by a file that CALLS it. No product code called it, so the
 *   `instrument-feedback` budget joined nothing and would have reported a budget met over zero
 *   actions from a real browser run.
 *
 *   `alignmentHighlight.ts` exported three pure functions with a 6.5 KB test file beside them.
 *   The client island a reader runs reached the same answers by walking the index itself, so every
 *   assertion in that test described a module nobody executed.
 *
 * Both read as done in every lane. A test proves a function works; nothing in it can notice that
 * no caller exists, and the better the module, the more convincing the silence. This is the
 * detector for the whole class, and it is the guard that would have caught both the day they
 * landed.
 *
 * WHAT COUNTS AS A CONSUMER. Any non-test module under `src/`, `scripts/` or `ios/` whose AST
 * names this module in an import, a re-export, or a dynamic `import()`. TEST FILES ARE
 * DELIBERATELY NOT CONSUMERS: a module whose only caller is its own test is exactly what is being
 * looked for.
 *
 * IT READS THE AST, NOT THE TEXT, and a measurement decided that rather than a preference. A text
 * scan for the module's basename reports `src/content/dates.ts` as consumed because something
 * imports `src/content/schemas/dates.ts`, and `src/units/sensitivity.ts` because something imports
 * `src/experiments/avogadro/sensitivity.ts`. Both are same-basename twins and both were false.
 *
 * MODULE GRANULARITY, NOT SYMBOL. A per-name index collides: two modules exporting `ledgers` make
 * each other look consumed, which under-reports in the dangerous direction.
 *
 * EXCLUSIONS, each a thing a framework calls without importing, named by path rather than guessed:
 * Next's route files under `src/app/`, worker entry points, and `src/testing/**`, whose modules are
 * test infrastructure and have no business having a production importer. The first two would
 * otherwise be reported as unwired on every run, and a gate whose output is mostly false is a gate
 * nobody reads.
 */

const SCAN_ROOTS = ["src", "scripts", "ios"] as const;
const SKIP_DIRECTORIES = new Set(["node_modules", ".next", "out", ".git", "artifacts"]);

export function isTestModule(repoRelativePath: string): boolean {
  return /\.(test|spec)\.(ts|tsx|mts|mjs)$/.test(repoRelativePath);
}

/** Called by a framework or a loader rather than by an import, so absence of one proves nothing. */
export function isFrameworkEntry(repoRelativePath: string): boolean {
  if (
    /^src\/app\/.*\/(page|layout|route|error|not-found|loading|template|default)\.tsx?$/.test(
      repoRelativePath,
    )
  ) {
    return true;
  }
  if (
    /^src\/app\/(page|layout|error|global-error|not-found|robots|sitemap)\.tsx?$/.test(
      repoRelativePath,
    )
  ) {
    return true;
  }
  if (
    /^src\/app\/.*\/(opengraph-image|twitter-image|icon|apple-icon)\.tsx?$/.test(repoRelativePath)
  ) {
    return true;
  }
  if (/\.worker\.(ts|tsx)$/.test(repoRelativePath)) return true;
  if (/^src\/(proxy|instrumentation)\.ts$/.test(repoRelativePath)) return true;
  // Test infrastructure: its consumers are tests, which is what it is for.
  if (repoRelativePath.startsWith("src/testing/")) return true;
  return false;
}

function withoutExtension(p: string): string {
  return p.replace(/\.(ts|tsx|mts|mjs)$/, "");
}

function collect(dir: string, root: string, into: string[]): string[] {
  let entries: ReturnType<typeof readdirSync>;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return into;
  }
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (SKIP_DIRECTORIES.has(entry.name)) continue;
      collect(full, root, into);
      continue;
    }
    if (!/\.(ts|tsx|mts|mjs)$/.test(entry.name)) continue;
    into.push(relative(root, full));
  }
  return into;
}

/** Every module under the scanned roots, repo-relative, including tests. */
export function scannedModules(root: string): readonly string[] {
  const files: string[] = [];
  for (const scanRoot of SCAN_ROOTS) {
    const abs = join(root, scanRoot);
    try {
      if (statSync(abs).isDirectory()) collect(abs, root, files);
    } catch {
      /* a root that does not exist here */
    }
  }
  return files;
}

/**
 * Every module specifier a production module resolves to, without extension, plus the `/index`
 * spelling so a directory specifier counts as importing its index.
 */
export function importedModuleSet(root: string, files: readonly string[]): ReadonlySet<string> {
  const imported = new Set<string>();
  const record = (fromFile: string, specifier: string): void => {
    if (!specifier.startsWith(".")) return;
    const target = withoutExtension(relative(root, resolve(root, join(fromFile, "..", specifier))));
    imported.add(target);
    imported.add(`${target}/index`);
  };
  for (const file of files) {
    if (isTestModule(file)) continue;
    const source = ts.createSourceFile(
      file,
      readFileSync(join(root, file), "utf8"),
      ts.ScriptTarget.Latest,
      true,
      file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
    );
    const visit = (node: ts.Node): void => {
      if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
        record(file, node.moduleSpecifier.text);
      }
      if (
        ts.isExportDeclaration(node) &&
        node.moduleSpecifier &&
        ts.isStringLiteral(node.moduleSpecifier)
      ) {
        record(file, node.moduleSpecifier.text);
      }
      if (
        ts.isCallExpression(node) &&
        node.expression.kind === ts.SyntaxKind.ImportKeyword &&
        node.arguments[0] &&
        ts.isStringLiteral(node.arguments[0])
      ) {
        record(file, (node.arguments[0] as ts.StringLiteral).text);
      }
      ts.forEachChild(node, visit);
    };
    ts.forEachChild(source, visit);
  }
  return imported;
}

/** The test-file spellings this repository uses beside a module. */
export function testFilesFor(root: string, module: string): readonly string[] {
  const base = withoutExtension(module);
  return [`${base}.test.ts`, `${base}.test.tsx`, `${base}.node.test.ts`, `${base}.test.mjs`].filter(
    (candidate) => existsSync(join(root, candidate)),
  );
}

export interface UnwiredModule {
  readonly module: string;
  readonly test: string;
}

export interface UnwiredScan {
  /** Every module the scan opened, tests included. */
  readonly scanned: number;
  /** Non-entry `src/` modules that have a test file beside them: the population being judged. */
  readonly withTests: number;
  readonly unwired: readonly UnwiredModule[];
}

export function scanUnwiredModules(root: string): UnwiredScan {
  const files = scannedModules(root);
  const imported = importedModuleSet(root, files);
  const unwired: UnwiredModule[] = [];
  let withTests = 0;
  for (const file of files) {
    if (!file.startsWith("src/") || isTestModule(file) || isFrameworkEntry(file)) continue;
    const tests = testFilesFor(root, file);
    if (tests.length === 0) continue;
    withTests += 1;
    if (imported.has(withoutExtension(file))) continue;
    unwired.push({ module: file, test: tests[0] as string });
  }
  return {
    scanned: files.length,
    withTests,
    unwired: unwired.sort((a, b) => a.module.localeCompare(b.module)),
  };
}
