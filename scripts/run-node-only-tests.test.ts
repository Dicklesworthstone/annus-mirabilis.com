import { describe, expect, test } from "bun:test";
import type { OutFreshnessResult } from "../src/testing/outFreshness.ts";
import { formatDirtyStaticSourcesNotice, runNodeOnlyTests } from "./run-node-only-tests.ts";

/**
 * am-6v4k. The node lane refused to start from 33e18b70 (2026-09-20 21:41) until 2026-09-21, 49
 * commits, because its preflight treated a dirty working tree as a stale out/. Four agents in a
 * shared tree always have uncommitted work, so the condition was permanently true and 48 test
 * files stopped running - among them scripts/quality-gates.test.ts, the gate chain's own test.
 *
 * The orchestrator's ruling split it: out/ stale against its recorded build FAILS, a dirty working
 * tree is REPORTED. The report half carries three requirements, and each has a test here, because
 * a warning nobody reads is how this recurs:
 *
 *   1. name the files
 *   2. appear in the FINAL output, not only the first
 *   3. say in the same breath what it means for the result beside it
 *
 * These run in the bun lane. A test of the thing that gates the node lane must not be one of the
 * files the node lane runs.
 */

const CLEAN: OutFreshnessResult = { present: true, fresh: true, dirtyStaticSources: [] };
const DIRTY_FILES = [
  "src/app/lab/avogadro-lab/page.tsx",
  "src/components/lab/DriftDiffusionLab.tsx",
  "src/components/discover/InvestigationTransfer.tsx",
];
const DIRTY: OutFreshnessResult = { present: true, fresh: true, dirtyStaticSources: DIRTY_FILES };
const STALE: OutFreshnessResult = {
  present: true,
  fresh: false,
  reason: "Recorded buildDigest in out/search/index-manifest.json (abc123456789…) is not present",
};

/** Records what the lane printed, in order, and marks where the test run happened. */
function capture(freshness: OutFreshnessResult) {
  const lines: string[] = [];
  const status = runNodeOnlyTests(process.cwd(), {
    freshness,
    write: (line) => lines.push(line),
    runTests: () => {
      lines.push("<<TESTS RAN>>");
      return { status: 0 };
    },
  });
  return { lines, status, ranTests: lines.includes("<<TESTS RAN>>") };
}

describe("the lane runs on a dirty tree and refuses on a stale build", () => {
  test("THE REPAIR: a dirty working tree no longer stops the lane", () => {
    const { status, ranTests } = capture(DIRTY);
    expect(ranTests).toBe(true);
    expect(status).toBe(0);
  });

  /**
   * THE PAWL. Without this, the repair and a deletion of the preflight are the same green, and the
   * next agent to find a slow lane has a rationale for removing the rest of it.
   */
  test("out/ stale against its recorded build still refuses BEFORE anything spawns", () => {
    const { lines, status, ranTests } = capture(STALE);
    expect(ranTests).toBe(false);
    expect(status).toBe(1);
    expect(lines.join("\n")).toContain("out/ is stale, run bun run build");
    expect(lines.join("\n")).toContain("is not present");
  });

  test("a clean tree prints no notice at all", () => {
    const { lines, ranTests } = capture(CLEAN);
    expect(ranTests).toBe(true);
    expect(lines.join("\n")).not.toContain("modified in the working tree");
  });
});

describe("the three requirements on the report half", () => {
  test("1. it names the files, rather than counting them", () => {
    const notice = formatDirtyStaticSourcesNotice(DIRTY_FILES);
    for (const file of DIRTY_FILES) {
      expect(notice).toContain(file);
    }
    // "3 static sources dirty" is unusable to the person who has to act on it.
    expect(notice).toContain("3 static source file(s)");
  });

  test("1b. a long list names thirty and hands over the command for the rest", () => {
    const many = Array.from({ length: 42 }, (_, i) => `src/app/route-${i}/page.tsx`);
    const notice = formatDirtyStaticSourcesNotice(many);
    expect(notice).toContain("src/app/route-0/page.tsx");
    expect(notice).toContain("src/app/route-29/page.tsx");
    expect(notice).toContain("(+12 more");
    expect(notice).toContain("git diff --name-only HEAD -- src/app src/components content");
  });

  test("2. it appears in the FINAL output as well as the first", () => {
    const { lines } = capture(DIRTY);
    const notices = lines
      .map((line, index) => ({ line, index }))
      .filter(({ line }) => line.includes("modified in the working tree"))
      .map(({ index }) => index);
    const ran = lines.indexOf("<<TESTS RAN>>");

    expect(notices.length).toBe(2);
    // one before the run, and one after it: whatever prints last is what a person scrolling to the
    // verdict, and a log reader tailing the file, actually see.
    expect(notices[0]).toBeLessThan(ran);
    expect(notices[1]).toBeGreaterThan(ran);
    expect(notices[1]).toBe(lines.length - 1);
  });

  test("3. it says what it means for the result standing beside it", () => {
    const notice = formatDirtyStaticSourcesNotice(DIRTY_FILES);
    expect(notice).toContain("describes out/ AS BUILT");
    expect(notice).toContain("not that the working tree passes");
    // and why it is not a failure, so the next reader does not restore the off switch as a fix
    expect(notice).toContain("switched this lane OFF");
  });
});
