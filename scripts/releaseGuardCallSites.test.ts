/**
 * THE ORIGIN GUARD IS CALLED ON EVERY PATH THAT BUILDS OR PROMOTES, AND BEFORE ANYTHING
 * IRREVERSIBLE (am-rc1001-bridge-plan-pcjk.3).
 *
 * The guard itself is well covered and in two lanes: `verified-production-deploy.test.ts` drives
 * `originAncestryRefusal` through all three observations and asserts `observeOriginAncestry` fetches
 * before it asks git, and `releaseOriginGuard.node.test.ts` proves against a REAL git repository
 * that `merge-base --is-ancestor` distinguishes a pushed commit from a local-only one, with a
 * positive control first.
 *
 * None of that says the deploy script CALLS it. Every one of those tests passes the stage label in
 * itself -- `assertCommitOnOrigin(COMMIT, "preflight")` -- so the label is the test's, not the
 * mode's. Delete `assertCommitOnOrigin(headCommit, "preflight")` from the main flow, or move it
 * below the build, and all of them stay green while a commit on no branch reaches production. That
 * is the failure the bead was opened for: "The deploy script took a commit that was on no branch to
 * production. AGENTS.md assumes `main` is what ships, and nothing enforced that."
 *
 * The bead asks for refusal on each of the three paths -- `--candidate-only`, the direct path and
 * `--promote`. Driving `main()` three times is not available here: it spawns `vercel`, takes the
 * port 48915 lock and moves aliases. So this is the coarse, lane-independent half AGENTS.md asks
 * for in that situation, and it says plainly which half it is: it reads the CALL SITES and their
 * ORDER, not their execution. The execution half is the mocked-spawn suite above; what this adds is
 * that the sites are there at all, which nothing checked.
 *
 * It reads CODE, not text: comments are blanked first, because the densest prose about a call is
 * the comment explaining it, and a scanner over raw source cannot tell the two apart. Both
 * directions of that are proved in the last test.
 */

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { blankComments } from "../src/testing/source/comments.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DEPLOY_SCRIPT = "scripts/verified-production-deploy.ts";

/** The deploy script with every comment body blanked, so only executable text is matched. */
const code = blankComments(readFileSync(join(ROOT, DEPLOY_SCRIPT), "utf8"));

function occurrences(haystack: string, needle: string): number {
  return haystack.split(needle).length - 1;
}

/**
 * The index of a CALL, excluding the declaration of the same name.
 *
 * Several of these helpers are declared and called in this one file, so counting the bare name
 * conflates `export function writeReleaseIdentity(` with the call to it -- which is how the first
 * draft of this test failed on 2 where it expected 1. An ordering claim about "the call" has to
 * name the call.
 */
function indicesOf(needle: string): number[] {
  const at: number[] = [];
  for (let i = code.indexOf(needle); i !== -1; i = code.indexOf(needle, i + 1)) at.push(i);
  return at;
}

function callIndex(needle: string): number {
  const sites: number[] = [];
  for (let at = code.indexOf(needle); at !== -1; at = code.indexOf(needle, at + 1)) {
    const preceding = code.slice(Math.max(0, at - 24), at);
    if (/function\s+$/u.test(preceding)) continue;
    sites.push(at);
  }
  expect(sites.length, `${DEPLOY_SCRIPT} must contain exactly one CALL to ${needle}`).toBe(1);
  return sites[0] as number;
}

const PROMOTE_GUARD = 'assertCommitOnOrigin(record.commit, "promote")';
const PREFLIGHT_GUARD = 'assertCommitOnOrigin(headCommit, "preflight")';

describe("the release origin guard's call sites (am-rc1001-bridge-plan-pcjk.3)", () => {
  test("the guard is called exactly twice, and those two calls cover the three paths", () => {
    /*
     * Two sites, three paths, and the arithmetic is the structure rather than a coincidence: the
     * promote branch guards and returns, so the second call is reached by BOTH `--candidate-only`
     * and the direct path. A third site would mean a path was guarded twice or a new path exists,
     * and either is worth a read.
     */
    expect(occurrences(code, "assertCommitOnOrigin(")).toBe(3); // 2 calls + 1 definition
    expect(occurrences(code, "export function assertCommitOnOrigin(")).toBe(1);
    expect(occurrences(code, PROMOTE_GUARD)).toBe(1);
    expect(occurrences(code, PREFLIGHT_GUARD)).toBe(1);
  });

  test("the promote path re-checks the CANDIDATE's commit, not HEAD", () => {
    /*
     * The bead is explicit about why: `--promote` "re-checks, since `origin/main` can move between
     * candidate and promotion". The commit that matters there is the one the candidate was built
     * from, which is `record.commit`. Guarding `headCommit` instead would check a commit nobody is
     * about to promote and would pass while promoting one that had been rewound off origin/main.
     */
    expect(code).toContain(PROMOTE_GUARD);
    expect(code).not.toContain('assertCommitOnOrigin(headCommit, "promote")');
  });

  test("both alias-moving sites are preceded by a guard, and there are only two", () => {
    /*
     * THERE ARE TWO PLACES THAT MOVE AN ALIAS, which the first draft of this test did not know and
     * was told by its own failure: `executePromotionStateMachine({` appears at the `--promote`
     * branch and again at the end of the direct path. So the direct path BUILDS AND PROMOTES, and
     * that is exactly why the preflight guard carries as much weight as the promote one.
     *
     * Moving an alias is the irreversible step, the one that puts a commit in front of readers, so
     * the claim is per site rather than in aggregate: each alias move has a guard call before it.
     * The count is asserted too, because a third alias-moving site would be a third path, and the
     * interesting question about a new path is whether anyone guarded it.
     */
    const moves = indicesOf("executePromotionStateMachine({");
    expect(moves.length).toBe(2);
    const promoteGuard = callIndex(PROMOTE_GUARD);
    const preflightGuard = callIndex(PREFLIGHT_GUARD);
    expect(promoteGuard).toBeLessThan(moves[0] as number);
    expect(preflightGuard).toBeLessThan(moves[1] as number);
    // And the promote branch's guard is inside that branch: it precedes its own alias move and the
    // preflight guard that the branch returns before reaching.
    expect(promoteGuard).toBeLessThan(preflightGuard);
  });

  test("the preflight guard runs before the gates, the build lock, and the written identity", () => {
    /*
     * Ordering, not mere presence. A guard that ran after the build would still refuse, but only
     * after spending the quality gates and a full `vercel build`, and after writing an identity
     * file naming a commit that may not be releasable. Each of these three is a cost or a piece of
     * state that a refusal should precede.
     */
    const guard = callIndex(PREFLIGHT_GUARD);
    expect(guard).toBeLessThan(callIndex("runPreflightQualityGates(options.profile)"));
    expect(guard).toBeLessThan(callIndex('assertNoConflictingBuilds("before-build")'));
    expect(guard).toBeLessThan(callIndex("writeReleaseIdentity("));
  });

  test("the guard refuses with the typed code the bead names", () => {
    // The code is the first argument and a standalone kebab string, which is the shape the
    // throw-site census reads. A code built into a message template is not matchable.
    expect(code).toContain('throw new ReleaseRefusalError("release-commit-not-on-origin"');
  });

  /**
   * THE CONTROL, in both directions, because a comment blanker that removed everything would
   * report a clean surface forever and one that removed nothing would credit prose as code. The
   * four cases are the ones AGENTS.md names for this: a construct inside a line comment and inside
   * a block comment must NOT match, the same construct in code MUST match, and neither comment
   * form may swallow the code beside it.
   */
  test("the scan reads code and not the comments that describe it", () => {
    const sample = [
      '// assertCommitOnOrigin(headCommit, "preflight") is called below',
      '/* and also assertCommitOnOrigin(record.commit, "promote") in the promote branch */',
      'const real = assertCommitOnOrigin(headCommit, "preflight"); // trailing note',
      "/* block */ const after = 1;",
    ].join("\n");
    const scanned = blankComments(sample);

    // Exactly the one in code, not the two in prose.
    expect(occurrences(scanned, PREFLIGHT_GUARD)).toBe(1);
    expect(occurrences(scanned, PROMOTE_GUARD)).toBe(0);
    // A trailing comment does not swallow the code before it, and a block comment does not swallow
    // the code after it.
    expect(scanned).toContain("const real =");
    expect(scanned).toContain("const after = 1;");

    // And the positive control for the blanker itself: unblanked, the prose DOES match, which is
    // what makes the three assertions above a finding rather than a tautology.
    expect(occurrences(sample, PREFLIGHT_GUARD)).toBe(2);
    expect(occurrences(sample, PROMOTE_GUARD)).toBe(1);
  });
});
