/**
 * NO READER IN THIS DIRECTORY IS IMPORTED ONLY BY ITS OWN TEST (am-xyxk, third item).
 *
 * The bead's words: "The reachability question is checked rather than remembered: something fails
 * when a module under scripts/e2e/runtime-conformance/ has no importer but its own test."
 *
 * WHAT IT IS GUARDING, from the bead's own measurement. Five readers here --
 * identityReader, networkLogClassifier, performanceMarkReader, rafSampler and tapeUrlBuilder --
 * each had a passing unit test in the node lane and no other importer, while `run.ts`, the module
 * the registered browser-acceptance gate invokes, imported only `checks.ts` and
 * `fixtureRegistration.ts`, and `checks.ts` imported no local module at all. The measuring half
 * existed and was tested; the failing half existed and was required in CI; nothing joined them.
 *
 * That state was green and unremarkable. A green lane said the readers parse their own fixtures,
 * which is not the same as any conformance property being checked, and nothing in the output
 * distinguished the two. All five are composed now -- this test is what stops the next one being
 * added beside them and sitting there.
 *
 * TWO THINGS IT DOES NOT DO, said here because each is a way this check could look stronger than
 * it is. It proves a module is IMPORTED, not that its output is asserted on: a composer could hold
 * a reference and ignore the value, and this would stay green. And it walks text, so a module
 * reached only through a string built at runtime reads as unimported; the direction is safe (a
 * false alarm costs a line here, a missed import would excuse a module) but it is not free.
 */
import assert from "node:assert/strict";
import { mkdtempSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "../../..");

/**
 * Allows a newline between `import` and `from`, which is the shape biome formats to.
 *
 * A pattern of the form `import[^;\n]*?from "..."` cannot match a formatted multi-line import head,
 * and a sweep built that way once reported 183 orphan modules in this repository where the true
 * figure was 80. The dynamic `import(...)` arm is separate because the runner reaches `run.ts`
 * through one.
 */
const IMPORT_RE =
  /(?:^|\n)\s*(?:import|export)\b[^;]*?from\s*["']([^"']+)["']|(?:^|[^\w.])import\s*\(\s*["']([^"']+)["']/gm;

const isTestFile = (path: string) => /\.(test|spec)\.(ts|tsx|mts|mjs)$/.test(path);

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry.startsWith(".")) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (/\.(ts|tsx|mts|mjs)$/.test(entry)) out.push(full);
  }
  return out;
}

/**
 * Every module in `dir` whose only importers are test files, with the files searched.
 *
 * A specifier is RESOLVED against the importing file's own directory rather than compared by
 * basename, because `./checks.ts` means a different file from every directory and a basename match
 * would credit the wrong one.
 */
function modulesWithoutImporters(
  dir: string,
  searchRoots: readonly string[],
): {
  readonly orphans: readonly string[];
  readonly modules: number;
  readonly filesSearched: number;
} {
  const files = searchRoots.flatMap((root) => walk(root));
  const modules = readdirSync(dir).filter(
    (entry) => /\.(ts|mts|mjs)$/.test(entry) && !isTestFile(entry),
  );
  const orphans: string[] = [];
  for (const moduleName of modules) {
    const target = resolve(dir, moduleName);
    let importedByProduction = false;
    for (const file of files) {
      if (file === target || isTestFile(file)) continue;
      for (const match of readFileSync(file, "utf8").matchAll(IMPORT_RE)) {
        const specifier = match[1] ?? match[2];
        if (!specifier?.startsWith(".")) continue;
        if (resolve(dirname(file), specifier) === target) {
          importedByProduction = true;
          break;
        }
      }
      if (importedByProduction) break;
    }
    if (!importedByProduction) orphans.push(moduleName);
  }
  return { orphans, modules: modules.length, filesSearched: files.length };
}

test("every module here is imported by something other than its own test", () => {
  const { orphans, modules, filesSearched } = modulesWithoutImporters(HERE, [
    resolve(ROOT, "src"),
    resolve(ROOT, "scripts"),
  ]);
  console.log(
    `[conformance composition] ${modules} module(s) in ${relative(ROOT, HERE)} checked against ${filesSearched} source files; ${orphans.length} imported only by their own test`,
  );
  // A walk that found nothing, or a directory that held nothing, would make the assertion vacuous.
  assert.ok(modules >= 5, `only ${modules} modules found in ${HERE}`);
  assert.ok(filesSearched > 1000, `only ${filesSearched} source files searched`);

  assert.deepEqual(
    orphans,
    [],
    `These modules are imported by nothing but their own test, so their unit tests prove they parse their own fixtures and nothing else. Compose each into checks.ts or run.ts with an assertion that consumes its output, or retire it with the owner's written permission (am-xyxk):\n${orphans.map((o) => `  ${o}`).join("\n")}`,
  );
});

test("PLANTED: an uncomposed module is reported, and a composed one is not", () => {
  // Both directions through the real predicate. Without the second, a function that returned every
  // module would pass the first and this check would refuse everything the day a reader landed.
  const dir = mkdtempSync(join(tmpdir(), "am-xyxk-composition-"));
  writeFileSync(join(dir, "composed.ts"), "export const a = 1;\n");
  writeFileSync(join(dir, "orphan.ts"), "export const b = 2;\n");
  writeFileSync(join(dir, "orphan.test.ts"), 'import { b } from "./orphan.ts";\nconsole.log(b);\n');
  // The composer is multi-line on purpose: it is the shape a naive pattern misses.
  writeFileSync(
    join(dir, "composer.ts"),
    'import {\n  a,\n} from "./composed.ts";\nconsole.log(a);\n',
  );

  const { orphans, modules } = modulesWithoutImporters(dir, [dir]);
  assert.equal(modules, 3, "composed.ts, orphan.ts and composer.ts are the non-test modules");
  // composer.ts is itself imported by nothing, so it is expected in the list beside orphan.ts.
  assert.deepEqual([...orphans].sort(), ["composer.ts", "orphan.ts"]);
  assert.ok(
    !orphans.includes("composed.ts"),
    "a module reached by a multi-line import must not be reported as an orphan",
  );
});

test("PLANTED: a test-only importer does not count as composition", () => {
  // The exact case the bead describes: a module whose sole importer is its own test.
  const dir = mkdtempSync(join(tmpdir(), "am-xyxk-testonly-"));
  writeFileSync(join(dir, "reader.ts"), "export const read = () => 1;\n");
  writeFileSync(
    join(dir, "reader.test.ts"),
    'import { read } from "./reader.ts";\nconsole.log(read());\n',
  );
  const { orphans } = modulesWithoutImporters(dir, [dir]);
  assert.deepEqual(orphans, ["reader.ts"]);
});
