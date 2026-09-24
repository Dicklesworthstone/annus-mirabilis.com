/**
 * Which test files exercise a laboratory's owner functions.
 *
 * The instrument audit's owner-test column used to look for any `.test.` file in
 * src/experiments/<compact id>/, or for src/experiments/<id>.test.ts. On 2026-09-24 that reported
 * 25 labs as untested, although most of their tests live in src/testing/ or beside the reference
 * evaluators. It also credited a lab with any test in that directory, whatever the test imported.
 * A directory cannot say what a test tests; its imports can. So a lab has an owner test when some
 * test file, wherever it lives, imports one of the functions its manifest names as owner
 * (`owner.kernelFunctions`).
 *
 * Both sides resolve to the module that DEFINES the function, following `export *` and
 * `export { x } from` re-exports. A manifest may name a barrel (bm-08 names inference.ts) while its
 * tests import the defining file, and a test may import through a barrel (radiation.ts) while the
 * manifest names the defining file. Comments are blanked before matching, so an import quoted in a
 * comment is not an import. Type-only imports execute nothing, so they do not count.
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, normalize, relative, sep } from "node:path";

export type OwnerFunction = Readonly<{ module: string; exportName: string }>;

const TEST_FILE = /\.test\.(ts|tsx|mjs|js)$/;
const SKIPPED_DIRECTORIES = new Set(["node_modules", ".next", "out"]);
const IDENTIFIER = /^[A-Za-z_$][\w$]*$/;

/** Comments blanked, keeping every newline and the length, so line-anchored patterns still hold. */
export function blankComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, " "))
    .replace(
      /(^|[^:"'`\\])\/\/[^\n]*/g,
      (m, lead: string) => lead + " ".repeat(m.length - lead.length),
    );
}

const toPosix = (path: string) => path.split(sep).join("/");

function testFiles(rootDir: string): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    if (!existsSync(dir)) return;
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        if (!SKIPPED_DIRECTORIES.has(entry.name)) walk(join(dir, entry.name));
      } else if (entry.isFile() && TEST_FILE.test(entry.name)) {
        out.push(toPosix(relative(rootDir, join(dir, entry.name))));
      }
    }
  };
  walk(join(rootDir, "src"));
  walk(join(rootDir, "scripts"));
  return out.sort();
}

/** The names a binding list imports or re-exports, as [original, local] pairs, without `type` ones. */
function bindingNames(list: string): Array<[string, string]> {
  const out: Array<[string, string]> = [];
  for (const raw of list.split(",")) {
    const part = raw.trim();
    if (!part || /^type\s/.test(part)) continue;
    const [original, alias] = part.split(/\s+as\s+|\s*:\s*/);
    if (original) out.push([original.trim(), (alias ?? original).trim()]);
  }
  return out;
}

/**
 * The owner-test lookup for one repository root. It reads every test file once; ask it about as
 * many owner functions as needed.
 */
export function ownerTestIndex(rootDir: string): {
  testFilesScanned: number;
  testsOf: (owner: OwnerFunction) => readonly string[];
} {
  const code = new Map<string, string | null>();
  const read = (module: string): string | null => {
    if (!code.has(module)) {
      const path = join(rootDir, module);
      code.set(
        module,
        existsSync(path) && statSync(path).isFile()
          ? blankComments(readFileSync(path, "utf8"))
          : null,
      );
    }
    return code.get(module) ?? null;
  };
  const resolveSpecifier = (fromModule: string, specifier: string): string | null => {
    if (!specifier.startsWith(".")) return null;
    const base = normalize(join(dirname(join(rootDir, fromModule)), specifier));
    for (const candidate of [
      base,
      `${base}.ts`,
      `${base}.tsx`,
      `${base}.mjs`,
      `${base}/index.ts`,
    ]) {
      if (existsSync(candidate) && statSync(candidate).isFile()) {
        return toPosix(relative(rootDir, candidate));
      }
    }
    return null;
  };

  const definitions = new Map<string, string | null>();
  /** Where `name`, exported by `module`, is declared; null when the module does not export it. */
  const definitionOf = (module: string, name: string, depth = 0): string | null => {
    if (!IDENTIFIER.test(name)) return null;
    const key = `${module}#${name}`;
    if (definitions.has(key)) return definitions.get(key) ?? null;
    definitions.set(key, null);
    const source = depth > 8 ? null : read(module);
    let found: string | null = null;
    if (source !== null) {
      const declared = new RegExp(
        `(?:^|\\n)[ \\t]*export\\s+(?:declare\\s+)?(?:async\\s+)?(?:function\\*?|const|let|var|class)\\s+${name.replaceAll("$", "\\$")}(?![\\w$])`,
      );
      if (declared.test(source)) found = key;
      for (const m of source.matchAll(
        /(?:^|\n)[ \t]*export\s*\{([^}]*)\}(\s*from\s*["']([^"']+)["'])?/g,
      )) {
        if (found) break;
        for (const [original, exported] of bindingNames(m[1] ?? "")) {
          if (exported !== name) continue;
          if (!m[2]) found = key;
          else {
            const target = resolveSpecifier(module, m[3] ?? "");
            if (target) found = definitionOf(target, original, depth + 1);
          }
        }
      }
      for (const m of source.matchAll(/(?:^|\n)[ \t]*export\s+\*\s+from\s+["']([^"']+)["']/g)) {
        if (found) break;
        const target = resolveSpecifier(module, m[1] ?? "");
        if (target) found = definitionOf(target, name, depth + 1);
      }
    }
    definitions.set(key, found);
    return found;
  };

  // Every function a test imports, keyed by where it is defined.
  const testsByDefinition = new Map<string, Set<string>>();
  const credit = (test: string, module: string | null, name: string) => {
    if (!module || !IDENTIFIER.test(name)) return;
    const definition = definitionOf(module, name) ?? `${module}#${name}`;
    const tests = testsByDefinition.get(definition) ?? new Set<string>();
    tests.add(test);
    testsByDefinition.set(definition, tests);
  };
  const tests = testFiles(rootDir);
  for (const test of tests) {
    const source = read(test) ?? "";
    for (const m of source.matchAll(
      /(?:^|\n)[ \t]*import\s+(?!type[\s{])([^;"']*?)\s*from\s*["']([^"']+)["']/g,
    )) {
      const clause = m[1] ?? "";
      const module = resolveSpecifier(test, m[2] ?? "");
      for (const named of clause.matchAll(/\{([^}]*)\}/g)) {
        for (const [original] of bindingNames(named[1] ?? "")) credit(test, module, original);
      }
      const namespace = clause.match(/\*\s+as\s+(\w+)/)?.[1];
      if (namespace) {
        for (const use of source.matchAll(new RegExp(`\\b${namespace}\\.(\\w+)`, "g"))) {
          credit(test, module, use[1] ?? "");
        }
      }
    }
    for (const m of source.matchAll(
      /\{([^}]*)\}\s*=\s*await\s+import\(\s*["']([^"']+)["']\s*\)/g,
    )) {
      const module = resolveSpecifier(test, m[2] ?? "");
      for (const [original] of bindingNames(m[1] ?? "")) credit(test, module, original);
    }
  }

  return {
    testFilesScanned: tests.length,
    testsOf: (owner) => {
      const definition =
        definitionOf(owner.module, owner.exportName) ?? `${owner.module}#${owner.exportName}`;
      return [...(testsByDefinition.get(definition) ?? [])].sort();
    },
  };
}
