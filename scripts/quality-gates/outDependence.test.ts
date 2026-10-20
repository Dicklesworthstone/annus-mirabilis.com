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
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { nodeOnlyTestArgs } from "./bunfigNodeOnlyTests.ts";
import {
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
