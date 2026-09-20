/**
 * Two fail-open defects in the budget governance gate, both from a test that did not
 * anchor what it matched (am-plat-perf-budgets-s3ww).
 *
 * 1. THE MEASUREMENT LOOKUP matched `f.includes(`-${id}.json`) || f.endsWith(`${id}.json`)`,
 *    so a longer budget's record discharged a shorter budget's requirement. The governance
 *    rule is that a changed budget must have been measured; the check could be satisfied by
 *    somebody else's measurement.
 *
 * 2. THE COMPARISON BASE was `git show HEAD:perf/budgets.json`, which compares the working
 *    tree against HEAD. In CI the runner checks out the commit that CONTAINS the budget
 *    change, so HEAD already holds the new value and the diff is empty: the gate prints
 *    "No budget changes detected" for exactly the commit it exists to stop. The comment
 *    above it said "HEAD~1 or merge-base" - the intent was recorded and the code did
 *    neither.
 *
 * Both plants below are the real prior behaviour, not invented shapes.
 */
import { describe, expect, test } from "bun:test";
import { isMeasurementFor, resolveComparisonBase } from "./budgetChangeCheck.ts";

describe("measurement lookup is anchored (am-plat-perf-budgets-s3ww)", () => {
  // The old predicate, kept verbatim so the negative below is the real defect.
  const loose = (f: string, id: string) => f.includes(`-${id}.json`) || f.endsWith(`${id}.json`);

  test("a longer budget's record does not discharge a shorter budget", () => {
    // The fixture reaches the state it tests: the loose predicate DID admit this.
    expect(loose("cumulative-layout-shift.json", "layout-shift")).toBe(true);
    expect(isMeasurementFor("cumulative-layout-shift.json", "layout-shift")).toBe(false);

    expect(loose("2026-09-17-cumulative-layout-shift.json", "layout-shift")).toBe(true);
    expect(isMeasurementFor("2026-09-17-cumulative-layout-shift.json", "layout-shift")).toBe(false);
  });

  test("the convention the existing tests already fix is still admitted", () => {
    expect(isMeasurementFor("2026-09-17-initial-route-js.json", "initial-route-js")).toBe(true);
    expect(isMeasurementFor("initial-route-js.json", "initial-route-js")).toBe(true);
    expect(isMeasurementFor("2026-09-17T142530Z-a1b2c3-layout-shift.json", "layout-shift")).toBe(
      true,
    );
  });

  test("a prefix that is not a date or run id is refused", () => {
    expect(isMeasurementFor("draft-layout-shift.json", "layout-shift")).toBe(false);
    expect(isMeasurementFor("layout-shift.txt", "layout-shift")).toBe(false);
    expect(isMeasurementFor("layout-shift.json.bak", "layout-shift")).toBe(false);
  });
});

describe("comparison base is the pair a run should compare (am-plat-perf-budgets-s3ww)", () => {
  const git = (answers: Record<string, string>) => (cmd: string) => {
    for (const [k, v] of Object.entries(answers)) if (cmd.includes(k)) return v;
    throw new Error(`no answer for ${cmd}`);
  };

  test("a pull request compares against the merge base with its target branch", () => {
    const base = resolveComparisonBase(
      "/repo",
      { GITHUB_BASE_REF: "main" } as unknown as NodeJS.ProcessEnv,
      git({ "merge-base origin/main HEAD": "abc123", "rev-parse": "abc123" }),
    );
    expect(base.rev).toBe("abc123");
    expect(base.reason).toContain("merge base");
    // Not HEAD, which is what the defect used and what finds nothing in CI.
    expect(base.rev).not.toBe("HEAD");
  });

  test("a CI push compares against the previous commit, not the commit under test", () => {
    const base = resolveComparisonBase(
      "/repo",
      { CI: "true", GITHUB_SHA: "deadbeef" } as unknown as NodeJS.ProcessEnv,
      git({ "rev-parse HEAD~1": "parentsha" }),
    );
    expect(base.rev).toBe("HEAD~1");
    expect(base.reason).toContain("previous commit");
  });

  test("a local run compares against HEAD, and says that is why", () => {
    const base = resolveComparisonBase(
      "/repo",
      {} as unknown as NodeJS.ProcessEnv,
      git({ "rev-parse HEAD": "headsha" }),
    );
    expect(base.rev).toBe("HEAD");
    expect(base.reason).toContain("local run");
  });

  test("every base carries a reason, because the gate prints it for a reader to check", () => {
    for (const env of [
      { GITHUB_BASE_REF: "main" },
      { CI: "true" },
      {},
    ] as unknown as NodeJS.ProcessEnv[]) {
      const base = resolveComparisonBase(
        "/repo",
        env,
        git({ "merge-base": "m", "rev-parse": "r" }),
      );
      expect(base.reason.length).toBeGreaterThan(20);
    }
  });
});
