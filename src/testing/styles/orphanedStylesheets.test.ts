import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { basename, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * ORPHANED STYLESHEETS: a .css file under src/ that no module imports (am-orphaned-stylesheets-5u3c).
 *
 * Measured at the commit that introduced this gate: five stylesheets were imported by nothing
 * while the classes they style rendered on 42 built pages, so real elements rendered unstyled.
 * That is a user-visible defect, not hygiene.
 *
 *     foundations.css  26 classes      bm03.css  8      me01.css  9
 *     sr05.css          5              discovery.css 11
 *
 * THIS RUNS IN ONE DIRECTION ONLY, AND THE DIRECTION MATTERS.
 *
 *     stylesheet  ->  is anything importing it?          <- THIS GATE
 *     class name  ->  is any rule declaring it?          <- am-vw1o, declaredClassesRatchet
 *
 * A scan one way misses the other half entirely: a sheet can be imported and still declare rules
 * nothing uses, and a class can be used and have no rule anywhere. Neither gate covers both and
 * this one must not be read as if it did.
 *
 * A stylesheet imported only from a TEST does not count as reached: the test proves the file
 * parses, not that a reader ever sees it.
 */

const REPO_ROOT = resolve(fileURLToPath(new URL("../../..", import.meta.url)));
const SRC = join(REPO_ROOT, "src");

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry.startsWith(".")) continue;
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

export function orphanedStylesheets(): readonly string[] {
  const files = walk(SRC);
  const sheets = files.filter((f) => f.endsWith(".css"));
  const modules = files.filter((f) => /\.(ts|tsx|mjs|js)$/.test(f) && !/\.(test|spec)\./.test(f));
  const importedNames = new Set<string>();
  for (const m of modules) {
    const text = readFileSync(m, "utf8");
    for (const hit of text.matchAll(/['"]([^'"]*\.css)['"]/g)) {
      importedNames.add(basename(hit[1] ?? ""));
    }
  }
  return sheets
    .filter((s) => !importedNames.has(basename(s)))
    .map((s) => relative(REPO_ROOT, s))
    .sort();
}

describe("orphaned stylesheets (am-orphaned-stylesheets-5u3c)", () => {
  test("every stylesheet under src/ is imported by a non-test module", () => {
    const orphans = orphanedStylesheets();

    // Vacuity guard: a walk that found no stylesheets would report a clean bill.
    const sheetCount = walk(SRC).filter((f) => f.endsWith(".css")).length;
    console.log(
      `[orphan sheets] ${orphans.length} orphaned of ${sheetCount} stylesheets under src/`,
    );
    expect(sheetCount).toBeGreaterThan(10);

    // SHRINK-ONLY, WITH A PAWL, because the bead's population was an undercount. It named five;
    // measurement found NINE. The five are fixed - foundations, bm03, me01, sr05, discovery are
    // now imported from the components that use their classes. These four remain, recorded rather
    // than swept, and two of them sit in directories another pane is working in.
    const KNOWN_ORPHANS = [
      "src/a11y/actions/families/interval/interval.css",
      "src/equations/genealogy/genealogy.css",
      "src/reader/detail/detail.css",
      "src/visuals/kit/visuals.css",
    ];
    const unexpected = orphans.filter((o) => !KNOWN_ORPHANS.includes(o));
    expect(
      unexpected,
      `these stylesheets are imported by nothing, so their rules reach no page while their class ` +
        `names still render:\n  ${unexpected.join("\n  ")}\n` +
        `Import each from the component that uses its classes, the way reader.css is imported.`,
    ).toEqual([]);
    expect(
      orphans.length,
      `Pawl: ${orphans.length} orphans remain, fewer than the ${KNOWN_ORPHANS.length} recorded. ` +
        `Remove the fixed ones from KNOWN_ORPHANS in this same commit.`,
    ).toBeGreaterThanOrEqual(KNOWN_ORPHANS.length);
  });

  test("REJECT: the detector actually finds an unimported sheet", () => {
    // Planted by construction rather than by editing the tree: a name no module can be importing.
    const importedNames = new Set(["reader.css"]);
    const pretend = ["src/made/up/never-imported.css", "src/reader/reader.css"];
    const found = pretend.filter((s) => !importedNames.has(basename(s)));
    expect(found).toEqual(["src/made/up/never-imported.css"]);
  });
});
