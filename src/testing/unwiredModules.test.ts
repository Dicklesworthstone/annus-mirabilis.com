import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { isFrameworkEntry, isTestModule, scanUnwiredModules } from "./unwiredModules.ts";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const BASELINE_PATH = "src/testing/unwiredModules.baseline.json";

/**
 * THE RATCHET OVER "TESTED, AND CALLED BY NOTHING" (am-snn0).
 *
 * The baseline is a LIST, not a count, and that is the whole design. A count would let a new
 * unwired module in whenever an old one was repaired, and the two have nothing to do with each
 * other. With a list, a new entry fails by name and a repaired entry fails as STALE until it is
 * struck off, so the ceiling can only come down. AGENTS.md: "a baseline is the record of a debt,
 * not a budget to draw on", and "when a debt is paid down, lower the ceiling with it".
 *
 * THE 51 ENTRIES ARE UNVERIFIED DEBT, not approved exemptions, and the distinction matters because
 * an exemption list with no reasons is a budget wearing a list's clothes. Three were investigated
 * on 2026-10-23 and each turned out to be a different thing:
 *
 *   src/reader/faces/alignmentHighlight.ts  an unused TWIN of live logic. The client island
 *                                           reimplemented all three of its functions, so its 6.5 KB
 *                                           test described a module no reader ran. REPAIRED by
 *                                           delegation, which is why it is not on this list.
 *   src/reader/viewMode.ts                  also a twin: ReaderController.tsx and
 *                                           reader/navigation/state.ts parse `?view=` themselves.
 *   src/visuals/three/ThreeStudioScene.ts   925 lines of donor-extracted Three.js, mounted nowhere.
 *                                           AGENTS.md "Three.js Scope" names the SR-03/SR-05 studio
 *                                           as its first legitimate use, and no decision retires it.
 *
 * So each entry needs one of three verdicts -- a twin whose test belongs on the live path, an
 * unmounted capability, or test-only by design and declared so -- and the triage is its own work.
 * Nothing here decides which. The gate's job is that the list cannot grow quietly.
 *
 * WHY THIS IS NOT AN ORPHAN DETECTOR. It only judges modules that have a test file beside them.
 * A module with no test and no importer is dead code, which is a different and cheaper question.
 * A module with a careful test and no caller is the expensive one: it reads as finished in every
 * lane, because the only thing that would notice is the caller that does not exist.
 */

describe("modules with their own test and no production importer", () => {
  test("the live tree matches its baseline exactly, in both directions", () => {
    const scan = scanUnwiredModules(REPO_ROOT);
    const baseline: string[] = JSON.parse(readFileSync(join(REPO_ROOT, BASELINE_PATH), "utf8"));
    const found = scan.unwired.map((u) => u.module);
    console.log(
      `[unwired modules] ${scan.scanned} modules under src/, scripts/, ios/; ${scan.withTests} non-entry src/ modules carry their own test; ${found.length} of those have no production importer (baseline ${baseline.length})`,
    );
    // A denominator of zero reads exactly like a clean sweep, so it fails here instead.
    expect(scan.withTests).toBeGreaterThan(400);

    const added = found.filter((m) => !baseline.includes(m));
    const stale = baseline.filter((m) => !found.includes(m));
    // Named rather than counted: a failure has to say which module, or the next reader re-derives
    // the list to find out.
    expect(added).toEqual([]);
    expect(stale).toEqual([]);
  });

  test("every baselined entry still has the test file that put it on the list", () => {
    // A baseline entry whose test was deleted is a line of debt that no longer describes anything,
    // and it would keep the ceiling one higher than the tree deserves.
    const scan = scanUnwiredModules(REPO_ROOT);
    const baseline: string[] = JSON.parse(readFileSync(join(REPO_ROOT, BASELINE_PATH), "utf8"));
    const byModule = new Map(scan.unwired.map((u) => [u.module, u.test]));
    const withoutTests = baseline.filter((m) => !byModule.has(m));
    expect(withoutTests).toEqual([]);
  });

  test("the scan finds an unimported module and ignores an imported one", () => {
    // Both directions over a fixture tree. A detector that reported everything would be useless
    // and a detector that reported nothing would be green forever; neither is distinguishable from
    // the other by looking at the real tree's output alone.
    const root = mkdtempSync(join(tmpdir(), "unwired-"));
    mkdirSync(join(root, "src"), { recursive: true });
    writeFileSync(join(root, "src", "consumed.ts"), "export const a = 1;\n");
    writeFileSync(join(root, "src", "consumed.test.ts"), "// a test\n");
    writeFileSync(join(root, "src", "orphan.ts"), "export const b = 2;\n");
    writeFileSync(join(root, "src", "orphan.test.ts"), "// a test\n");
    writeFileSync(
      join(root, "src", "consumer.ts"),
      'import { a } from "./consumed.ts";\nexport const used = a;\n',
    );
    const scan = scanUnwiredModules(root);
    expect(scan.unwired.map((u) => u.module)).toEqual(["src/orphan.ts"]);
    expect(scan.unwired[0]?.test).toBe("src/orphan.test.ts");
  });

  test("prose naming a module is not an import of it", () => {
    // The direction this repository keeps paying for. A basename grep reports `src/content/dates.ts`
    // as consumed because something imports `src/content/schemas/dates.ts`, and a text scan reports
    // a module as consumed because a docblock explains why it should not be imported.
    const root = mkdtempSync(join(tmpdir(), "unwired-prose-"));
    mkdirSync(join(root, "src"), { recursive: true });
    writeFileSync(join(root, "src", "orphan.ts"), "export const b = 2;\n");
    writeFileSync(join(root, "src", "orphan.test.ts"), "// a test\n");
    writeFileSync(
      join(root, "src", "consumer.ts"),
      [
        "/**",
        ' * Do not import "./orphan.ts" from here; it belongs to the other face.',
        " */",
        'const mention = "./orphan.ts";',
        "export const note = mention;",
      ].join("\n"),
    );
    expect(scanUnwiredModules(root).unwired.map((u) => u.module)).toEqual(["src/orphan.ts"]);
  });

  test("a module with no test file is not this gate's business", () => {
    // Dead code without a test is a different and cheaper question. Including it here would bury
    // the expensive case -- careful, documented, tested, uncalled -- under hundreds of cheap ones.
    const root = mkdtempSync(join(tmpdir(), "unwired-untested-"));
    mkdirSync(join(root, "src"), { recursive: true });
    writeFileSync(join(root, "src", "untested.ts"), "export const c = 3;\n");
    const scan = scanUnwiredModules(root);
    expect(scan.unwired).toEqual([]);
    expect(scan.withTests).toBe(0);
  });

  test("a test file is never counted as a consumer, which is the point", () => {
    const root = mkdtempSync(join(tmpdir(), "unwired-testconsumer-"));
    mkdirSync(join(root, "src"), { recursive: true });
    writeFileSync(join(root, "src", "orphan.ts"), "export const b = 2;\n");
    writeFileSync(
      join(root, "src", "orphan.test.ts"),
      'import { b } from "./orphan.ts";\nexport const t = b;\n',
    );
    // Its own test imports it, as every test does. If that counted, the gate would find nothing
    // ever, which is precisely how `markPainted` passed for weeks.
    expect(scanUnwiredModules(root).unwired.map((u) => u.module)).toEqual(["src/orphan.ts"]);
  });

  test("a dynamic import and a bare re-export both count as consumption", () => {
    const root = mkdtempSync(join(tmpdir(), "unwired-dynamic-"));
    mkdirSync(join(root, "src"), { recursive: true });
    for (const name of ["lazy", "reexported"]) {
      writeFileSync(join(root, "src", `${name}.ts`), "export const v = 1;\n");
      writeFileSync(join(root, "src", `${name}.test.ts`), "// a test\n");
    }
    writeFileSync(
      join(root, "src", "consumer.ts"),
      ['export * from "./reexported.ts";', "export const load = () => import('./lazy.ts');"].join(
        "\n",
      ),
    );
    expect(scanUnwiredModules(root).unwired).toEqual([]);
  });

  test("framework entries and test infrastructure are excluded by path", () => {
    expect(isFrameworkEntry("src/app/papers/mass-energy/page.tsx")).toBe(true);
    expect(isFrameworkEntry("src/app/layout.tsx")).toBe(true);
    expect(isFrameworkEntry("src/app/papers/opengraph-image.tsx")).toBe(true);
    expect(isFrameworkEntry("src/workers/diffusion.worker.ts")).toBe(true);
    expect(isFrameworkEntry("src/testing/reactDom.ts")).toBe(true);
    // And the ones that are NOT excluded, because an exclusion list that swallowed these would
    // make the gate quietly vacuous. `_opengraph-image.tsx` leads with an underscore, which is how
    // Next is told NOT to route it, so it must be imported by something.
    expect(isFrameworkEntry("src/app/_opengraph-image.tsx")).toBe(false);
    expect(isFrameworkEntry("src/reader/faces/AlignmentController.tsx")).toBe(false);
    expect(isFrameworkEntry("src/equations/record.ts")).toBe(false);
    expect(isTestModule("src/reader/faces/alignmentHighlight.test.ts")).toBe(true);
    expect(isTestModule("src/reader/faces/alignmentHighlight.ts")).toBe(false);
  });
});
