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
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { basename, dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// `dirname(fileURLToPath(import.meta.url))`, this repository's idiom in 292 places, and NOT
// `import.meta.dir`: that property exists in bun at runtime but not in this repository's ambient
// ImportMeta, so it passes `bun test` and breaks `bun run check:types` FOR EVERY PANE. The trap is
// already written down, at src/testing/editions/displayAlignable.test.ts:35 -- "typechecks nowhere
// but in the runner" -- and this file still walked into it, which is why the note is repeated here
// where the next author of a filesystem-walking test will be looking.
const ANCHORS_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(ANCHORS_DIR, "../../..");

/**
 * EVERY CODE ROOT THAT CAN HOLD A CONSUMER, not just `src/`. This read `src/` alone when it was
 * first written, and that is a population error of the kind AGENTS.md calls "A Check Inherits The
 * Silence Of Whatever It Reads": a module consumed only by a script is invisible to a scanner that
 * never opens `scripts/`, and the scanner then reports a debt that is not one.
 *
 * It was found by the error actually occurring, one directory over. The same `src/`-only walk
 * reported all seven modules in `src/content/audits/` as having no consumer -- `verifyContent.ts`,
 * `honesty.ts`, `instruments.ts`, `misconceptions.ts`, `readings.ts`, `shelfLive.ts`,
 * `equationIdentity.ts`. All seven are imported by `scripts/`, `scripts/verify-content.ts` among
 * them, so every one of those findings was false. The five modules in THIS directory survive the
 * wider walk, but they survived the narrow one by luck rather than by design.
 */
const CODE_ROOTS = ["src", "scripts", "perf", "ios"]
  .map((d) => join(REPO_ROOT, d))
  .filter((d) => existsSync(d));

/**
 * Each entry is one module in this directory that no non-test module imports, with the bead that
 * owes the wiring. Striking an entry is how the debt is paid; adding one needs the owner, because a
 * sixth unwired module in a directory that already has five is the condition this file exists to
 * refuse rather than to record.
 */
const UNWIRED_DEBT: Readonly<Record<string, string>> = {
  // THE SECOND SENTENCE HERE USED TO READ "No face emits them, so a retired id still lands
  // nowhere", and that was FALSE when it was committed. Measured in the built site the same day:
  // GermanFace.tsx:102 emits `<span id={retired} data-alias-of={target} />` inline, and
  // out/papers/<slug>/view/german/ carries 33 of the 37 declared records -- 3 of 4 for
  // mass-energy, 6 of 9 for light-quanta, 7 of 7 and 17 of 17 for the other two. The four absent
  // ones all point at reference occurrences (-r1, -r3), which are not anchors on any face, and
  // PaperPage.tsx:174 says exactly that, naming s2-p2-s1-r3. So the capability SHIPS and the
  // shortfall is deliberate.
  "aliasAnchors.ts":
    "am-read-anchors-navigation-a6o: a typed helper for static alias anchors. The CAPABILITY is " +
    "live, emitted inline by GermanFace.tsx:102 with `data-alias-of`, not by this module's " +
    "`data-alias`. So this is a duplicate of working code rather than a missing feature, and " +
    "which spelling survives is an owner call.",
  // "mapToFace.ts" WAS HERE AND ITS MODULE-LEVEL ENTRY IS PAID, 2026-10-08.
  // src/reader/faces/FaceSwitchAnchor.tsx imports `mapToResultsFace`, which gave
  // `resultsBySection` -- named in the struck entry as "genuinely unowned" -- a producer: each
  // result card now publishes `data-sections` from the `section:` field of
  // content/results/<paper>.yaml, and the index is read from the DOM rather than computed twice.
  //
  // STRIKING THE MODULE ENTRY WOULD HAVE DROPPED THE REST OF THE DEBT, which is why UNWIRED_EXPORTS
  // exists below. A module with one live import is "wired" to a per-module scanner while most of it
  // stays dead, and this module is exactly that case: two of its three exports have no importer. A
  // coarse gate that reads green on one import is the shape a half-wired library hides in.
  "paneIds.ts":
    "am-read-anchors-navigation-a6o: split-view DOM identity. No split view is rendered, so the " +
    "pane-b-- prefix and its data-anchor contract are unexercised outside tests.",
  // "placeKeeper.ts" WAS HERE AND IS PAID, 2026-10-08. It is now imported by
  // src/reader/faces/FaceSwitchAnchor.tsx, which captures the reader's place before a face switch
  // and restores it on arrival -- a6o criterion 2's second clause, "the same relative position
  // (within 8 CSS px)". This gate refused to let the entry stay once an importer existed, which is
  // the half of a debt record that stops it becoming a budget, and it refused in the same run that
  // paid it. Its live twin, src/reader/detail/nearestStableAnchor.ts, keeps the Detail axis; both
  // axes now keep a reader's place.
  "scrollRestore.ts":
    "am-read-anchors-navigation-a6o: manual scroll restoration for back and forward. " +
    "history.scrollRestoration is never set to 'manual' by any route, so the browser's own " +
    "restoration is what a reader gets.",
};

/**
 * DEBT AT THE GRAIN OF AN EXPORT, because a module is wired as soon as ONE of its exports is.
 * Keyed "<module>#<export>", and each entry asserts that no non-test file imports that NAME.
 *
 * This list exists because paying `mapToFace.ts`'s module entry would otherwise have silently
 * retired the record of its other two jobs. The same hazard applies to any module here that
 * acquires a single caller.
 */
const UNWIRED_EXPORTS: Readonly<Record<string, string>> = {
  "mapToFace.ts#mapToFace":
    "am-to1q: the nearest-ancestor walk (sentence -> paragraph -> section) has no caller. " +
    "FaceSwitchAnchor's own resolvedFaceAnchor handles the split-sentence arm and stops there, so " +
    "a reader switching to a face that publishes neither the sentence nor its paragraph gets no " +
    "scroll rather than its section. The gloss face is the live case: 11 sentence ids and 3 " +
    "paragraph ids for relativity against the German face's 223.",
  "mapToFace.ts#mapToFacsimilePage":
    "am-to1q, SETTLED BY THE OWNER 2026-10-08: this one is to STAY unwired. The live owner is " +
    "resolveFacsimileTarget, and the ruling was that mapToFacsimilePage is not to be given a " +
    "pdfPageByUnit producer (see mapToFace.ts's own docblock). It is listed here so the export is " +
    "accounted for rather than appearing to be an oversight, and it is the one entry whose " +
    "deletion condition is an owner reversal rather than an implementation.",
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
function importersOfPath(absolute: string, allFiles: readonly string[]): string[] {
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
        found.push(relative(REPO_ROOT, file));
        break;
      }
    }
  }
  return found.sort();
}

/** The same lookup for one module in this directory, which is the population the debt measures. */
function importersOf(target: string, allFiles: readonly string[]): string[] {
  return importersOfPath(join(ANCHORS_DIR, target), allFiles);
}

/**
 * Every non-test module that imports the NAME `symbol` from `absolute`. A named-import clause is
 * read from the import statement, so a file that imports a different export of the same module
 * does not credit this one, and a file that imports a same-named symbol from somewhere else does
 * not either (the path is resolved first, exactly as importersOfPath does it).
 *
 * `import * as ns` and a default import are treated as importing EVERYTHING, because the scanner
 * cannot see which property a namespace object is read through. That is the conservative direction
 * for a debt list: it credits an export as wired and so can only ever UNDERSTATE the debt, never
 * invent one. No module in this directory has a default export today, and the positive control
 * below would fail if the clause parser stopped matching.
 */
function importersOfExport(
  absolute: string,
  symbol: string,
  allFiles: readonly string[],
): string[] {
  const found: string[] = [];
  for (const file of allFiles) {
    if (file === absolute) continue;
    if (basename(file).includes(".test.")) continue;
    const text = readFileSync(file, "utf8");
    // Every import statement in the file, with its clause and its specifier.
    for (const match of text.matchAll(/import\s+([^;]*?)\s*from\s+"(\.[^"]+)"/g)) {
      const clause = match[1];
      const spec = match[2];
      if (clause === undefined || spec === undefined) continue;
      const base = resolve(dirname(file), spec);
      if (![base, `${base}.ts`, `${base}.tsx`, join(base, "index.ts")].includes(absolute)) continue;
      if (/^\s*\*\s+as\s+/.test(clause) || !clause.includes("{")) {
        found.push(relative(REPO_ROOT, file));
        break;
      }
      const names = (clause.match(/\{([^}]*)\}/)?.[1] ?? "")
        .split(",")
        .map(
          (n) =>
            n
              .replace(/^\s*type\s+/, "")
              .split(/\s+as\s+/)[0]
              ?.trim() ?? "",
        )
        .filter((n) => n !== "");
      if (names.includes(symbol)) {
        found.push(relative(REPO_ROOT, file));
        break;
      }
    }
  }
  return found.sort();
}

describe("the anchor navigation library's wiring debt", () => {
  const modules = anchorModules();
  const all = CODE_ROOTS.flatMap((root) => sourceFiles(root));
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
    expect(importers.get("resolve.ts")).toContain("src/reader/navigation/state.ts");
    expect(importers.get("aliases.ts")).toContain("src/reader/anchors/resolve.ts");
    expect(importers.get("emitAnchor.ts")).toContain("src/reader/faces/TranslationUnit.tsx");

    const wired = modules.filter((m) => (importers.get(m) ?? []).length > 0);
    // FOUR NOW, not three: placeKeeper.ts joined on 2026-10-08 (a6o criterion 2). An identity
    // assertion rather than a count, so wiring a module requires saying so here -- which is how
    // this line came to be edited rather than quietly satisfied.
    expect(wired.sort()).toEqual([
      "aliases.ts",
      "emitAnchor.ts",
      "mapToFace.ts",
      "placeKeeper.ts",
      "resolve.ts",
    ]);
    expect(importers.get("mapToFace.ts")).toContain("src/reader/faces/FaceSwitchAnchor.tsx");
    expect(importers.get("placeKeeper.ts")).toContain("src/reader/faces/FaceSwitchAnchor.tsx");
  });

  test("POSITIVE CONTROL for the cross-root walk: a consumer in scripts/ is found", () => {
    // The arm that matters most, because its absence is what made the FIRST version of this file
    // wrong about a neighbouring directory. `src/content/audits/instruments.ts` has no importer
    // anywhere in `src/`, and `scripts/verify-content.ts:16` imports it. A scanner that reads only
    // `src/` calls that module unconsumed, which is exactly the false debt this control refuses.
    const audited = join(REPO_ROOT, "src/content/audits/instruments.ts");
    expect(existsSync(audited)).toBe(true);
    const found = importersOfPath(audited, all);
    expect(found).toContain("scripts/verify-content.ts");
    // And nothing in src/ imports it, so the find above could only have come from the wider walk.
    expect(found.filter((f) => f.startsWith("src/"))).toEqual([]);
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

  test("PER-EXPORT: each declared export has no importer, and the scanner can find one", () => {
    const paid: string[] = [];
    for (const key of Object.keys(UNWIRED_EXPORTS)) {
      const [mod, symbol] = key.split("#");
      if (mod === undefined || symbol === undefined) throw new Error(`Malformed key '${key}'`);
      const who = importersOfExport(join(ANCHORS_DIR, mod), symbol, all);
      if (who.length > 0) paid.push(`${key} <- ${who.join(", ")}`);
    }
    expect(paid).toEqual([]);

    // POSITIVE CONTROL, in the same test so the list above cannot be satisfied by a scanner that
    // resolves no names at all. `mapToResultsFace` is the export this list was built around: it IS
    // imported, by the file named here, which is why it is not in UNWIRED_EXPORTS beside its two
    // siblings. A clause parser that stopped working would empty `paid` AND empty this.
    const wiredExport = importersOfExport(
      join(ANCHORS_DIR, "mapToFace.ts"),
      "mapToResultsFace",
      all,
    );
    expect(wiredExport).toContain("src/reader/faces/FaceSwitchAnchor.tsx");

    // And the negative half of the control: the same file must NOT be credited for an export it
    // does not import. Without this, a parser that credited every name in a matched module would
    // pass the line above and make the whole list vacuous.
    const notImported = importersOfExport(
      join(ANCHORS_DIR, "mapToFace.ts"),
      "mapToFacsimilePage",
      all,
    );
    expect(notImported).not.toContain("src/reader/faces/FaceSwitchAnchor.tsx");

    console.log(
      `[census] unwired-exports examined ${Object.keys(UNWIRED_EXPORTS).length} declared exports; ` +
        `control: mapToResultsFace has ${wiredExport.length} importer(s), mapToFacsimilePage ${notImported.length}`,
    );
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
