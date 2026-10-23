/**
 * THE out/-DEPENDENCE PARTITION, PROVED IN BOTH DIRECTIONS.
 *
 * `outDependence.ts` decides which node-lane tests may run against a stale build. Getting that
 * wrong in one direction costs nothing (a test stays gated where it already was) and in the other
 * gives a confusing failure, so both are asserted here rather than only the convenient one.
 *
 * THIS TEST IS IN THE BUN LANE ON PURPOSE. It judges which files the NODE lane may run, and a gate
 * whose only proof lives inside the lane it controls disappears at the moment that lane fails open.
 * Nothing here spawns git or reads the build, so it runs whenever the repository does.
 */

import { describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { nodeOnlyTestArgs } from "./bunfigNodeOnlyTests.ts";
import {
  browserDriverIn,
  CONTENT_GATES_THAT_MUST_STAY_REACHABLE,
  drivesBrowser,
  outReferenceIn,
  partitionByOutDependence,
} from "./outDependence.ts";

const ROOT = process.cwd();

/** A throwaway tree, so each case below is the only unusual thing in it. */
function tree(files: Readonly<Record<string, string>>): string {
  const dir = mkdtempSync(join(tmpdir(), "am-out-dependence-"));
  for (const [name, text] of Object.entries(files)) {
    const path = join(dir, name);
    mkdirSync(join(path, ".."), { recursive: true });
    writeFileSync(path, text, "utf8");
  }
  return dir;
}

describe("a file that reads the build is detected", () => {
  test("a path literal counts, in each form this repository writes", () => {
    for (const form of [
      'const dir = "out";',
      'readFileSync("out/search/index-manifest.json");',
      'const p = join(root, "out", "papers");',
      'import { x } from "./x.ts";\nconst p = "../out/index.html";',
      "const f = checkOutFreshness('out', root);",
      "const d = OUT_DIR;",
    ]) {
      const dir = tree({ "a.test.ts": form });
      expect(outReferenceIn(resolve(dir, "a.test.ts"), dir), form).toBeDefined();
    }
  });

  test("a reference reached only through a local import counts, and names the module it is in", () => {
    const dir = tree({
      "a.test.ts": 'import { serve } from "./helpers/server.ts";\nserve();\n',
      "helpers/server.ts": 'export function serve() { return join(root, "out"); }\n',
    });
    const found = outReferenceIn(resolve(dir, "a.test.ts"), dir);
    expect(found).toBe("helpers/server.ts");
  });

  test("a cycle does not hang it", () => {
    const dir = tree({
      "a.test.ts": 'import "./b.ts";\n',
      "b.ts": 'import "./a.test.ts";\nexport const x = 1;\n',
    });
    expect(outReferenceIn(resolve(dir, "a.test.ts"), dir)).toBeUndefined();
  });
});

describe("a file that does not read the build is NOT detected", () => {
  test("ordinary content work does not count, which is the whole point", () => {
    // A stripper or matcher that flagged everything would gate the whole lane for ever and read
    // exactly like the refusal it replaced.
    const dir = tree({
      "a.test.ts":
        'import { parseYaml } from "./yaml.ts";\n' +
        'test("records parse", () => { parseYaml(readFileSync("content/papers/x.json", "utf8")); });\n',
      "yaml.ts": "export function parseYaml(t: string) { return t; }\n",
    });
    expect(outReferenceIn(resolve(dir, "a.test.ts"), dir)).toBeUndefined();
  });

  test("a word that merely contains out is not a reference", () => {
    const dir = tree({
      "a.test.ts": 'const about = "layout"; const o = { outcome: "passed", outputs: [] };\n',
    });
    expect(outReferenceIn(resolve(dir, "a.test.ts"), dir)).toBeUndefined();
  });
});

describe("a browser test stays gated whatever the scan sees", () => {
  test("a driver import is enough", () => {
    const dir = tree({ "a.test.ts": 'import { chromium } from "playwright";\n' });
    expect(drivesBrowser(resolve(dir, "a.test.ts"))).toBe(true);
    const partition = partitionByOutDependence(["a.test.ts"], dir);
    expect(partition.outIndependent).toEqual([]);
    expect(partition.reasons["a.test.ts"]).toContain("browser");
  });

  test("and a plain file is not called a browser test", () => {
    const dir = tree({ "a.test.ts": 'const x = "content/papers";\n' });
    expect(drivesBrowser(resolve(dir, "a.test.ts"))).toBe(false);
  });
});

describe("the partition over the real lane", () => {
  const laneFiles = nodeOnlyTestArgs(readFileSync(join(ROOT, "bunfig.toml"), "utf8"), ROOT);
  const partition = partitionByOutDependence(laneFiles, ROOT);

  test("both halves are non-empty, so neither the gate nor the subset is vacuous", () => {
    // Reported, not frozen: the lane grows. What matters is that each side has members, because a
    // partition with an empty side answers no question.
    console.log(
      `[census] node lane: ${laneFiles.length} files, ${partition.outIndependent.length} ` +
        `out/-independent, ${partition.needsOut.length} gated on a fresh build`,
    );
    expect(laneFiles.length).toBeGreaterThan(50);
    expect(partition.outIndependent.length).toBeGreaterThan(10);
    expect(partition.needsOut.length).toBeGreaterThan(10);
    expect(partition.outIndependent.length + partition.needsOut.length).toBe(laneFiles.length);
  });

  test("every content gate this exists for is in the runnable half", () => {
    // The floor. The set that runs is derived so that it follows the lane, and a derived set can
    // quietly shrink to nothing while looking clean; these are the members that must survive.
    const runnable = new Set(partition.outIndependent);
    const lost = CONTENT_GATES_THAT_MUST_STAY_REACHABLE.filter((f) => !runnable.has(f));
    expect(lost).toEqual([]);
  });

  test("each named content gate is really in the lane, so the floor is not naming ghosts", () => {
    const inLane = new Set(laneFiles);
    const missing = CONTENT_GATES_THAT_MUST_STAY_REACHABLE.filter((f) => !inLane.has(f));
    expect(missing).toEqual([]);
  });

  test("a test that plainly reads the build is on the gated side", () => {
    // The negative control over the real lane. foundCalculus.e2e is one of the seven the lane's
    // own comment names as having each rediscovered a stale build.
    const gated = new Set(partition.needsOut);
    const shouldBeGated = laneFiles.filter((f) => f.includes("foundCalculus.e2e"));
    expect(shouldBeGated.length).toBeGreaterThan(0);
    for (const file of shouldBeGated) expect(gated.has(file), file).toBe(true);
  });
});

/**
 * THE BROWSER FILTER FOLLOWS IMPORTS, AND BLANKS COMMENTS FIRST (both halves, both directions).
 *
 * THE DEFECT, measured 2026-10-23. `drivesBrowser` read only the file it was given, and its docblock
 * said so as though it were a design choice. `scripts/e2e/smoke.test.ts` contains NONE of the browser
 * tokens; its helper `./smoke.ts`, one import away, launches Chromium. So the test was classified
 * browser-free, entered the `out/`-independent subset -- the lane an agent is told to run after a
 * content edit -- and that lane failed with 6 `browserType.launch: Executable doesn't exist` on this
 * machine, where the Playwright cache is a symlink to a volume that no longer holds the browsers.
 *
 * WHY BLANKING IS NOT OPTIONAL HERE, measured before the change rather than argued: following
 * imports with a RAW text match reclassifies 10 of the 37 subset files, and 7 of those 10 match the
 * single word "Playwright" inside a DOCBLOCK -- `src/testing/log/schema.ts:264` ("every write path
 * (logger, assertions, evidence, playwright, scripts) passes through"), `scripts/e2e/domContract.ts:3`
 * and `scripts/e2e/checks/measure.ts:6`. Those seven drive no browser and ran green without one. So
 * the import walk alone would have shrunk the safety net from 37 to 27 for a word in a sentence,
 * which is AGENTS.md's "a gate that forbids a construct must read code, not text" exactly. With
 * blanking the subset is 34: three real drivers gated, seven false ones kept.
 */
describe("the browser filter reads through imports, and reads code rather than prose", () => {
  const root = mkdtempSync(join(tmpdir(), "am-outdep-browser-"));
  const write = (rel: string, body: string): string => {
    const path = join(root, rel);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, body, "utf8");
    return path;
  };

  test("THE DEFECT: a driver one import away is found, and the module is named", () => {
    write(
      "helper.ts",
      'import { chromium } from "playwright";\nexport const go = () => chromium;\n',
    );
    const test1 = write("a.test.ts", 'import { go } from "./helper.ts";\nexport const x = go;\n');
    // The test file itself carries no token at all: this is the case that was missed.
    expect(/playwright|chromium/i.test(readFileSync(test1, "utf8"))).toBe(false);
    expect(drivesBrowser(test1, root)).toBe(true);
    expect(browserDriverIn(test1, root)).toBe("helper.ts");
  });

  // Proves the BLANKING half through the walk. Note it passes vacuously against a file-only
  // matcher, which never reaches schema.ts at all -- the line-comment case below and the real-corpus
  // validateLedgerCli case are the two that go red against that mutant.
  test("a token in a DOCBLOCK is not a driver, at any depth", () => {
    // The real false positive, reproduced: a module whose prose names Playwright while importing
    // nothing from it. Seven subset files matched exactly this before blanking.
    write(
      "schema.ts",
      "/**\n * Every write path (logger, assertions, evidence, playwright, scripts) passes through.\n */\nexport const f = 1;\n",
    );
    const test2 = write("b.test.ts", 'import { f } from "./schema.ts";\nexport const y = f;\n');
    expect(browserDriverIn(test2, root)).toBeUndefined();
    expect(drivesBrowser(test2, root)).toBe(false);
  });

  test("a token in a line comment beside real code is not a driver either", () => {
    write("c.test.ts", "// chromium is deliberately NOT used here\nexport const z = 1;\n");
    expect(drivesBrowser(join(root, "c.test.ts"), root)).toBe(false);
  });

  test("THE CONTROL: a driver in the file itself is still found", () => {
    // Without this the change could have been "always false", which satisfies both negatives above
    // and would put every browser test into the subset.
    const direct = write(
      "d.test.ts",
      'import { webkit } from "playwright";\nexport const w = webkit;\n',
    );
    expect(drivesBrowser(direct, root)).toBe(true);
    expect(browserDriverIn(direct, root)).toBe("d.test.ts");
  });

  test("the real corpus: the lane's own smoke test is gated, and names where", () => {
    // Driven against the repository rather than a fixture, because the fixture cannot show that the
    // helper is reached through the real import graph.
    const smoke = join(ROOT, "scripts/e2e/smoke.test.ts");
    expect(existsSync(smoke)).toBe(true);
    expect(drivesBrowser(smoke, ROOT)).toBe(true);
    expect(browserDriverIn(smoke, ROOT)).toBe("scripts/e2e/smoke.ts");
    // And the partition says so in its reason, which is what a reader of the lane output sees.
    const part = partitionByOutDependence(["scripts/e2e/smoke.test.ts"], ROOT);
    expect(part.outIndependent).toEqual([]);
    expect(part.reasons["scripts/e2e/smoke.test.ts"]).toMatch(
      /drives a browser in scripts\/e2e\/smoke\.ts/,
    );
  });

  test("the real corpus: a file whose only token is a docblock word stays independent", () => {
    // src/content/ledger/validateLedgerCli.test.ts reaches src/testing/log/schema.ts, whose
    // docblock names playwright. It drives no browser and must stay in the subset.
    const cli = join(ROOT, "src/content/ledger/validateLedgerCli.test.ts");
    expect(existsSync(cli)).toBe(true);
    expect(drivesBrowser(cli, ROOT)).toBe(false);
  });
});
