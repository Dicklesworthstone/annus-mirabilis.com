/**
 * THE DEBT: FIVE OF THE EIGHT MODULES IN THIS DIRECTORY ARE DRAWN BY NOTHING (am-to1q,
 * am-read-anchors-navigation-a6o).
 *
 * `am-read-anchors-navigation-a6o` built a complete, pure, tested library for reader anchor
 * navigation -- nearest-ancestor mapping across faces, split-pane DOM identity, place-keeping across
 * a face switch, route-level scroll restoration, static alias anchors -- with 74 passing tests. On
 * 2026-10-07, walking the import graph from `src/app/`, five of its eight modules had ZERO non-test
 * importers and reached ZERO routes. The bead is still open, so this is a half-wired feature rather
 * than work that was lost; what was missing is any signal that the wired half had not arrived.
 *
 * WHY A TEST AND NOT A NOTE. Nothing failed while this was true, and nothing would have. A pure
 * module with passing tests and no consumer is green in every lane the repository runs: the unit
 * lane tests it, the typechecker compiles it, the architecture gate counts it, and the route budgets
 * never see it because it ships in no bundle. Twenty days passed. The only way the condition
 * announces itself is a check that asserts the consumer exists, which is this file.
 *
 * THE LIST BELOW IS A DEBT RECORD, NOT A BUDGET. AGENTS.md: "A baseline is the record of a debt, not
 * a budget to draw on." So it fails in BOTH directions. A new module in this directory with no
 * importer is refused, because that is the condition getting worse. And a listed module that has
 * ACQUIRED an importer must be struck from the list, because a debt that is paid is not kept on the
 * books to make room for the next one.
 *
 * WHAT WATCHES THIS GATE. Its own non-vacuity is checked here, in the same lane, by a positive
 * control: the scanner must independently FIND the importers of the three wired modules and name
 * them. Without that, a scanner that resolved nothing would report all eight as unwired, the list
 * would be a subset of its findings, and the gate would pass while measuring nothing -- the exact
 * shape AGENTS.md records under "A Tool's Exit Code Is Not Evidence". The half this lane cannot
 * watch is whether the gate still RUNS at all; `scripts/gate-census` is where that belongs, and
 * until it registers this check the control below is the only thing standing between a green result
 * and an empty one.
 */

import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { basename, dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// `dirname(fileURLToPath(import.meta.url))`, this repository's idiom in 292 places, and NOT
// `import.meta.dir`: that property exists in bun at runtime but not in this repository's ambient
// ImportMeta, so it passes `bun test` and breaks `bun run check:types` FOR EVERY PANE. The trap is
// already written down, at src/testing/editions/displayAlignable.test.ts:35 -- "typechecks nowhere
// but in the runner" -- and this file still walked into it, which is why the note is repeated here
// where the next author of a filesystem-walking test will be looking.
const ANCHORS_DIR = dirname(fileURLToPath(import.meta.url));
const SRC_ROOT = resolve(ANCHORS_DIR, "../..");

/**
 * Each entry is one module in this directory that no non-test module imports, with the bead that
 * owes the wiring. Striking an entry is how the debt is paid; adding one needs the owner, because a
 * sixth unwired module in a directory that already has five is the condition this file exists to
 * refuse rather than to record.
 */
const UNWIRED_DEBT: Readonly<Record<string, string>> = {
  "aliasAnchors.ts":
    "am-read-anchors-navigation-a6o: static alias anchors for retired ids, so a retired spelling " +
    "lands without JavaScript. No face emits them, so a retired id still lands nowhere.",
  "mapToFace.ts":
    "am-to1q: two of its three jobs have live owners reading the same inputs " +
    "(facsimile/document.ts at 9 routes, weave/contentIds.ts at 4). The nearest-ancestor walk and " +
    "resultsBySection are genuinely unowned. Whether the duplicate arm is retired is an owner call.",
  "paneIds.ts":
    "am-read-anchors-navigation-a6o: split-view DOM identity. No split view is rendered, so the " +
    "pane-b-- prefix and its data-anchor contract are unexercised outside tests.",
  "placeKeeper.ts":
    "am-read-anchors-navigation-a6o: place-keeping across a FACE switch. Its own docblock names its " +
    "live twin, src/reader/detail/nearestStableAnchor.ts, the DETAIL-axis place-keeper, which " +
    "reaches 8 routes. One axis keeps the reader's place and the other does not.",
  "scrollRestore.ts":
    "am-read-anchors-navigation-a6o: manual scroll restoration for back and forward. " +
    "history.scrollRestoration is never set to 'manual' by any route, so the browser's own " +
    "restoration is what a reader gets.",
};

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...sourceFiles(full));
      continue;
    }
    if (entry.endsWith(".ts") || entry.endsWith(".tsx")) out.push(full);
  }
  return out;
}

/** Non-test modules in this directory, which is the population the debt list is measured against. */
function anchorModules(): string[] {
  return readdirSync(ANCHORS_DIR)
    .filter((f) => (f.endsWith(".ts") || f.endsWith(".tsx")) && !f.includes(".test."))
    .sort();
}

/**
 * Every non-test module under `src/` that imports `target`, by resolved path rather than by
 * basename: `paneIds.ts` would otherwise be credited by any file importing a different `paneIds`.
 */
function importersOf(target: string, allFiles: readonly string[]): string[] {
  const absolute = join(ANCHORS_DIR, target);
  const found: string[] = [];
  for (const file of allFiles) {
    if (file === absolute) continue;
    if (basename(file).includes(".test.")) continue;
    const text = readFileSync(file, "utf8");
    for (const match of text.matchAll(/(?:from|import)\s+"(\.[^"]+)"/g)) {
      const spec = match[1];
      if (spec === undefined) continue;
      const base = resolve(dirname(file), spec);
      const candidates = [base, `${base}.ts`, `${base}.tsx`, join(base, "index.ts")];
      if (candidates.includes(absolute)) {
        found.push(relative(SRC_ROOT, file));
        break;
      }
    }
  }
  return found.sort();
}

describe("the anchor navigation library's wiring debt", () => {
  const modules = anchorModules();
  const all = sourceFiles(SRC_ROOT);
  const importers = new Map(modules.map((m) => [m, importersOf(m, all)]));

  test("the scanner examined a real population, and says how large it was", () => {
    // `examined N of M` beside the verdict, because zero modules scanned and zero unwired modules
    // print the same green. The minimum is below today's 8 so adding a module is not a failure here,
    // and far enough above zero that an empty directory walk is.
    console.log(
      `[census] unwired-anchor-modules examined ${modules.length} modules against ${all.length} source files (minimum 6 modules, 500 files)`,
    );
    expect(modules.length).toBeGreaterThanOrEqual(6);
    expect(all.length).toBeGreaterThanOrEqual(500);
    // No barrel in this directory, so an importer of the directory itself cannot exist. If one is
    // added, every conclusion below changes and this is where that shows up.
    expect(modules).not.toContain("index.ts");
  });

  test("POSITIVE CONTROL: the scanner finds the importers of the three modules that have them", () => {
    // Without this the gate is satisfiable by a scanner that resolves nothing. Each pair was read
    // from the importing file, so a rename on either side fails here rather than silently widening
    // the debt.
    expect(importers.get("resolve.ts")).toContain("reader/navigation/state.ts");
    expect(importers.get("aliases.ts")).toContain("reader/anchors/resolve.ts");
    expect(importers.get("emitAnchor.ts")).toContain("reader/faces/TranslationUnit.tsx");

    const wired = modules.filter((m) => (importers.get(m) ?? []).length > 0);
    expect(wired.sort()).toEqual(["aliases.ts", "emitAnchor.ts", "resolve.ts"]);
  });

  test("every module with no importer is a recorded debt, and a new one is refused", () => {
    const unwired = modules.filter((m) => (importers.get(m) ?? []).length === 0).sort();
    const undeclared = unwired.filter((m) => !(m in UNWIRED_DEBT));
    expect(undeclared).toEqual([]);
    // Non-vacuity on purpose rather than by accident: were every module wired, the loop above would
    // run zero times and pass while proving nothing. When that day comes, this expectation is what
    // forces the list and this assertion to be struck together.
    expect(unwired.length).toBeGreaterThan(0);
  });

  test("a debt that has been paid is struck from the list, so the record cannot become a budget", () => {
    const paid = Object.keys(UNWIRED_DEBT).filter((m) => (importers.get(m) ?? []).length > 0);
    expect(paid).toEqual([]);
    const vanished = Object.keys(UNWIRED_DEBT).filter((m) => !modules.includes(m));
    expect(vanished).toEqual([]);
  });

  test("each entry names the bead that owes the wiring, not just the fact", () => {
    // A debt with no owner is a complaint. Every reason has to carry an `am-` id, so the next reader
    // has somewhere to go.
    const withoutBead = Object.entries(UNWIRED_DEBT)
      .filter(([, reason]) => !/\bam-[a-z0-9-]+\b/.test(reason))
      .map(([module]) => module);
    expect(withoutBead).toEqual([]);
    // NOT `toBe(5)`, which is what this line said until the plants exposed it. Freezing the census
    // into an equality makes the gate go RED the day a debt is correctly PAID and its entry struck,
    // which is the one outcome this file is meant to reward. AGENTS.md: "Report a count; assert a
    // property." The count is reported by the census test above; the property here is that the list
    // is not empty, which is what makes `withoutBead` a real loop rather than a vacuous one.
    expect(Object.keys(UNWIRED_DEBT).length).toBeGreaterThan(0);
  });
});
